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
        select: (fields: string) => {
          if (fields) {
            // no-op para mock
          }
          return builder;
        },
        eq: (col: string, val: any) => {
          filters[col] = val;
          return builder;
        },
        gte: (col: string, val: any) => {
          filters[`${col}_gte`] = val;
          return builder;
        },
        lte: (col: string, val: any) => {
          filters[`${col}_lte`] = val;
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
        },
        upsert: (payload: any) => {
          if (!dbState[currentTable]) dbState[currentTable] = [];
          const idx = dbState[currentTable].findIndex((r: any) => r.celula_id === payload.celula_id && r.reuniao_id === payload.reuniao_id);
          let target = null;
          if (idx >= 0) {
            dbState[currentTable][idx] = { ...dbState[currentTable][idx], ...payload };
            target = dbState[currentTable][idx];
          } else {
            target = { id: `token-${Date.now()}`, ...payload };
            dbState[currentTable].push(target);
          }
          return createChainable(target);
        },
        delete: () => {
          return {
            eq: () => ({
              eq: async () => ({ error: null })
            })
          };
        }
      };

      return builder;
    }
  } as any;
}

describe('Módulo Células — Lote 2: Reuniões, Frequência e Links Temporários', () => {
  const minA = 'min-alpha-uuid';
  const minB = 'min-beta-uuid';
  const congA1 = 'cong-alpha-1';

  it('1. Permite criar reunião em célula do mesmo ministério', async () => {
    const dbState = {
      celulas: [
        { id: 'cel-1', ministry_id: minA, congregacao_id: congA1, nome: 'Célula Boas Novas', status: 'ativa' }
      ],
      celulas_reunioes: []
    };

    const service = new CelulasService(createMockSupabase(dbState));
    const reuniao = await service.salvarReuniao(minA, {
      celula_id: 'cel-1',
      data_reuniao: '2026-11-20',
      horario_inicio: '19:30:00',
      tema_estudo: 'A Parábola do Semeador',
      presentes_membros: 8,
      presentes_visitantes: 2,
      presentes_criancas: 1,
    }, 'user-admin-1');

    assert.ok(reuniao.id);
    assert.strictEqual(reuniao.tema_estudo, 'A Parábola do Semeador');
    assert.strictEqual(reuniao.presentes_membros, 8);
  });

  it('2. Bloqueia criação de reunião em célula de outro ministério (anti cross-tenant)', async () => {
    const dbState = {
      celulas: [
        { id: 'cel-b', ministry_id: minB, congregacao_id: 'cong-b', nome: 'Célula Beta', status: 'ativa' }
      ],
      celulas_reunioes: []
    };

    const service = new CelulasService(createMockSupabase(dbState));
    await assert.rejects(
      async () => {
        await service.salvarReuniao(minA, {
          celula_id: 'cel-b',
          data_reuniao: '2026-11-20',
        });
      },
      /não existe ou não pertence a este ministério/
    );
  });

  it('3. Exige justificativa para editar reunião com status finalizada (Governança)', async () => {
    const dbState = {
      celulas: [
        { id: 'cel-1', ministry_id: minA, congregacao_id: congA1, nome: 'Célula Boas Novas', status: 'ativa' }
      ],
      celulas_reunioes: [
        {
          id: 'reuniao-encerrada',
          ministry_id: minA,
          celula_id: 'cel-1',
          data_reuniao: '2026-11-10',
          status: 'finalizada',
          presentes_membros: 5,
        }
      ]
    };

    const service = new CelulasService(createMockSupabase(dbState));
    await assert.rejects(
      async () => {
        await service.salvarReuniao(minA, {
          id: 'reuniao-encerrada',
          celula_id: 'cel-1',
          data_reuniao: '2026-11-10',
          presentes_membros: 6,
        });
      },
      /informe obrigatoriamente a justificativa/
    );
  });

  it('4. Permite atualizar reunião finalizada quando justificativa for fornecida', async () => {
    const dbState = {
      celulas: [
        { id: 'cel-1', ministry_id: minA, congregacao_id: congA1, nome: 'Célula Boas Novas', status: 'ativa' }
      ],
      celulas_reunioes: [
        {
          id: 'reuniao-encerrada',
          ministry_id: minA,
          celula_id: 'cel-1',
          data_reuniao: '2026-11-10',
          status: 'finalizada',
          presentes_membros: 5,
        }
      ]
    };

    const service = new CelulasService(createMockSupabase(dbState));
    const atualizada = await service.salvarReuniao(minA, {
      id: 'reuniao-encerrada',
      celula_id: 'cel-1',
      data_reuniao: '2026-11-10',
      presentes_membros: 7,
      justificativa_edicao: 'Correção de contagem de membros que chegaram após início do relatório.',
    });

    assert.strictEqual(atualizada.presentes_membros, 7);
    assert.strictEqual(atualizada.editada_pos_fechamento, true);
  });

  it('5. Gera link temporário seguro com token_hash criptográfico (SHA-256)', async () => {
    const dbState = {
      celulas: [
        { id: 'cel-1', ministry_id: minA, congregacao_id: congA1, nome: 'Célula Boas Novas' }
      ],
      celulas_chamada_tokens: []
    };

    const service = new CelulasService(createMockSupabase(dbState));
    const resultado = await service.gerarTokenChamadaRapida(minA, {
      celula_id: 'cel-1',
      duracao_horas: 12,
    }, 'user-lider-1');

    assert.ok(resultado.rawToken);
    assert.strictEqual(resultado.rawToken.length, 64);
    assert.strictEqual(resultado.tokenItem.status, 'ativo');
    assert.notStrictEqual(resultado.tokenItem.token_hash, resultado.rawToken);
  });

  it('6. Valida token rápido legítimo e rejeita tokens inválidos ou malformados', async () => {
    const dbState = {
      celulas: [
        { id: 'cel-1', ministry_id: minA, congregacao_id: congA1, nome: 'Célula Boas Novas' }
      ],
      celulas_chamada_tokens: []
    };

    const service = new CelulasService(createMockSupabase(dbState));
    const { rawToken } = await service.gerarTokenChamadaRapida(minA, { celula_id: 'cel-1' });

    // Validação de token válido
    const resValido = await service.validarTokenChamadaRapida(rawToken);
    assert.strictEqual(resValido.valido, true);
    assert.strictEqual(resValido.celula?.nome, 'Célula Boas Novas');

    // Validação de token falso
    const resFalso = await service.validarTokenChamadaRapida('0000000000000000000000000000000000000000000000000000000000000000');
    assert.strictEqual(resFalso.valido, false);
    assert.strictEqual(resFalso.motivo, 'Link de acesso não encontrado.');
  });
});
