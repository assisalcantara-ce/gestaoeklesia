import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CelulasService } from '../../src/services/celulas-service';

function createMockSupabase(dbState: any) {
  return {
    from: (table: string) => {
      let currentTable = table;
      let filters: any = {};

      const createChainable = (targetData: any) => ({
        eq: (col: string, val: any) => {
          filters[col] = val;
          return createChainable(targetData);
        },
        select: () => ({
          single: async () => ({ data: targetData, error: null }),
          maybeSingle: async () => ({ data: targetData || null, error: null })
        }),
        single: async () => ({ data: targetData, error: null }),
        maybeSingle: async () => ({ data: targetData || null, error: null })
      });

      const builder: any = {
        select: () => builder,
        eq: (col: string, val: any) => {
          filters[col] = val;
          return builder;
        },
        order: () => builder,
        single: async () => {
          const list = (dbState[currentTable] || []).filter((row: any) => {
            return Object.entries(filters).every(([k, v]) => row[k] === v);
          });
          if (list.length === 0) return { data: null, error: { message: 'Not found' } };
          return { data: list[0], error: null };
        },
        maybeSingle: async () => {
          const list = (dbState[currentTable] || []).filter((row: any) => {
            return Object.entries(filters).every(([k, v]) => row[k] === v);
          });
          return { data: list[0] || null, error: null };
        },
        insert: (payload: any) => {
          const rows = Array.isArray(payload) ? payload : [payload];
          const inserted = rows.map((r: any) => ({ id: r.id || `mock-${Date.now()}-${Math.random()}`, ...r }));
          if (!dbState[currentTable]) dbState[currentTable] = [];
          dbState[currentTable].push(...inserted);
          const first = inserted[0];
          return createChainable(first);
        },
        update: (payload: any) => {
          const updateHandler = {
            eq: (col: string, val: any) => {
              filters[col] = val;
              const list = dbState[currentTable] || [];
              let updatedRow = null;
              for (let i = 0; i < list.length; i++) {
                if (list[i][col] === val) {
                  list[i] = { ...list[i], ...payload };
                  updatedRow = list[i];
                }
              }
              return createChainable(updatedRow);
            }
          };
          return updateHandler;
        }
      };

      return builder;
    }
  } as any;
}

describe('Módulo Células — Lote 3: Participantes, Vínculos e Transferências', () => {
  const minA = 'min-alpha-uuid';
  const minB = 'min-beta-uuid';
  const congA1 = 'cong-alpha-1';

  it('1. Permite vincular membro existente a uma célula do mesmo ministério', async () => {
    const dbState = {
      celulas: [
        { id: 'cel-1', ministry_id: minA, congregacao_id: congA1, nome: 'Célula Boas Novas', status: 'ativa' }
      ],
      members: [
        { id: 'membro-1', ministry_id: minA, name: 'João Batista', email: 'joao@eklesia.test' }
      ],
      celulas_participantes: []
    };

    const service = new CelulasService(createMockSupabase(dbState));
    const part = await service.salvarParticipante(minA, {
      celula_id: 'cel-1',
      member_id: 'membro-1',
      nome_completo: 'João Batista',
      papel: 'membro',
      status: 'ativo',
    });

    assert.ok(part.id);
    assert.strictEqual(part.member_id, 'membro-1');
    assert.strictEqual(part.status, 'ativo');
  });

  it('2. Bloqueia vincular membro de outro ministério (anti cross-tenant)', async () => {
    const dbState = {
      celulas: [
        { id: 'cel-1', ministry_id: minA, congregacao_id: congA1, nome: 'Célula Boas Novas', status: 'ativa' }
      ],
      members: [
        { id: 'membro-b', ministry_id: minB, name: 'Pedro Alvo', email: 'pedro@beta.test' }
      ],
      celulas_participantes: []
    };

    const service = new CelulasService(createMockSupabase(dbState));
    await assert.rejects(
      async () => {
        await service.salvarParticipante(minA, {
          celula_id: 'cel-1',
          member_id: 'membro-b',
          nome_completo: 'Pedro Alvo',
        });
      },
      /O membro selecionado não pertence a este ministério/
    );
  });

  it('3. Impede segundo vínculo ATIVO para o mesmo membro no mesmo ministério', async () => {
    const dbState = {
      celulas: [
        { id: 'cel-1', ministry_id: minA, congregacao_id: congA1, nome: 'Célula 1', status: 'ativa' },
        { id: 'cel-2', ministry_id: minA, congregacao_id: congA1, nome: 'Célula 2', status: 'ativa' }
      ],
      members: [
        { id: 'membro-1', ministry_id: minA, name: 'João Batista' }
      ],
      celulas_participantes: [
        {
          id: 'part-1',
          ministry_id: minA,
          celula_id: 'cel-1',
          member_id: 'membro-1',
          status: 'ativo',
          nome_completo: 'João Batista',
          celula: { nome: 'Célula 1' }
        }
      ]
    };

    const service = new CelulasService(createMockSupabase(dbState));
    await assert.rejects(
      async () => {
        await service.salvarParticipante(minA, {
          celula_id: 'cel-2',
          member_id: 'membro-1',
          nome_completo: 'João Batista',
          status: 'ativo',
        });
      },
      /já possui um vínculo ativo na célula/
    );
  });

  it('4. Realiza transferência de célula com geração de histórico auditável', async () => {
    const dbState = {
      celulas: [
        { id: 'cel-1', ministry_id: minA, congregacao_id: congA1, nome: 'Célula Origem', status: 'ativa' },
        { id: 'cel-2', ministry_id: minA, congregacao_id: congA1, nome: 'Célula Destino', status: 'ativa' }
      ],
      celulas_participantes: [
        {
          id: 'part-1',
          ministry_id: minA,
          celula_id: 'cel-1',
          congregacao_id: congA1,
          member_id: 'membro-1',
          nome_completo: 'Maria Madalena',
          status: 'ativo'
        }
      ],
      celulas_transferencias: []
    };

    const service = new CelulasService(createMockSupabase(dbState));
    const transf = await service.transferirParticipante(minA, {
      participante_id: 'part-1',
      celula_destino_id: 'cel-2',
      motivo: 'Mudança de endereço residencial para novo bairro.',
    }, 'user-admin-1');

    assert.ok(transf.id);
    assert.strictEqual(transf.celula_origem_id, 'cel-1');
    assert.strictEqual(transf.celula_destino_id, 'cel-2');
    assert.strictEqual(transf.solicitado_por, 'user-admin-1');

    // Verifica se participante foi atualizado para cel-2
    const partAtualizado = dbState.celulas_participantes.find((p: any) => p.id === 'part-1');
    assert.ok(partAtualizado);
    assert.strictEqual(partAtualizado.celula_id, 'cel-2');
  });

  it('5. Rejeita transferência quando a célula destino for a mesma da origem', async () => {
    const dbState = {
      celulas: [
        { id: 'cel-1', ministry_id: minA, congregacao_id: congA1, nome: 'Célula Origem', status: 'ativa' }
      ],
      celulas_participantes: [
        {
          id: 'part-1',
          ministry_id: minA,
          celula_id: 'cel-1',
          nome_completo: 'Maria Madalena'
        }
      ],
      celulas_transferencias: []
    };

    const service = new CelulasService(createMockSupabase(dbState));
    await assert.rejects(
      async () => {
        await service.transferirParticipante(minA, {
          participante_id: 'part-1',
          celula_destino_id: 'cel-1',
        });
      },
      /A célula de destino deve ser diferente da célula atual/
    );
  });
});
