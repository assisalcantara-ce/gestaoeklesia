import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CelulasService } from '../../src/services/celulas-service';

// Mock do Supabase Client focado no Lote 5
function createMockSupabase(dbState: any) {
  return {
    from: (table: string) => {
      let currentTable = table;
      let filters: Array<{ field: string; op: string; value: any }> = [];
      let isSingle = false;
      let isMaybeSingle = false;

      const chain: any = {
        select: (_fields: string = '*') => {
          return chain;
        },
        eq: (field: string, val: any) => {
          filters.push({ field, op: 'eq', value: val });
          return chain;
        },
        order: (_field: string, _options?: any) => {
          return chain;
        },
        single: () => {
          isSingle = true;
          return chain.execute();
        },
        maybeSingle: () => {
          isMaybeSingle = true;
          return chain.execute();
        },
        insert: (data: any) => {
          const rows = Array.isArray(data) ? data : [data];
          const inserted: any[] = [];
          for (const row of rows) {
            const newRow = {
              id: row.id || `mock-id-${Math.random().toString(36).substring(2, 9)}`,
              ...row,
              created_at: row.created_at || new Date().toISOString(),
              updated_at: row.updated_at || new Date().toISOString(),
            };
            if (!dbState[currentTable]) {
              dbState[currentTable] = [];
            }
            dbState[currentTable].push(newRow);
            inserted.push(newRow);
          }

          return {
            select: () => ({
              single: () => Promise.resolve({ data: inserted[0], error: null }),
            }),
            then: (resolve: any) => resolve({ data: inserted, error: null }),
          };
        },
        update: (data: any) => {
          return {
            eq: (field: string, val: any) => {
              filters.push({ field, op: 'eq', value: val });
              return {
                eq: (f2: string, v2: any) => {
                  filters.push({ field: f2, op: 'eq', value: v2 });
                  let updatedItem: any = null;
                  const records = dbState[currentTable] || [];
                  for (let i = 0; i < records.length; i++) {
                    const match = filters.every(f => records[i][f.field] === f.value);
                    if (match) {
                      records[i] = { ...records[i], ...data, updated_at: new Date().toISOString() };
                      updatedItem = records[i];
                    }
                  }
                  return {
                    select: () => ({
                      single: () => Promise.resolve({ data: updatedItem, error: null }),
                    }),
                    then: (resolve: any) => resolve({ data: updatedItem, error: null }),
                  };
                },
                select: () => {
                  let updatedItem: any = null;
                  const records = dbState[currentTable] || [];
                  for (let i = 0; i < records.length; i++) {
                    const match = filters.every(f => records[i][f.field] === f.value);
                    if (match) {
                      records[i] = { ...records[i], ...data, updated_at: new Date().toISOString() };
                      updatedItem = records[i];
                    }
                  }
                  return {
                    single: () => Promise.resolve({ data: updatedItem, error: null }),
                  };
                },
                then: (resolve: any) => {
                  let updatedItem: any = null;
                  const records = dbState[currentTable] || [];
                  for (let i = 0; i < records.length; i++) {
                    const match = filters.every(f => records[i][f.field] === f.value);
                    if (match) {
                      records[i] = { ...records[i], ...data, updated_at: new Date().toISOString() };
                      updatedItem = records[i];
                    }
                  }
                  resolve({ data: updatedItem, error: null });
                },
              };
            },
          };
        },
        execute: () => {
          const records = dbState[currentTable] || [];
          let filtered = records.filter((r: any) => {
            return filters.every(f => {
              if (f.op === 'eq') return r[f.field] === f.value;
              return true;
            });
          });

          if (isSingle) {
            return Promise.resolve({
              data: filtered[0] || null,
              error: filtered[0] ? null : { message: 'Row not found' },
            });
          }

          if (isMaybeSingle) {
            return Promise.resolve({
              data: filtered[0] || null,
              error: null,
            });
          }

          return Promise.resolve({
            data: filtered,
            error: null,
          });
        },
      };

      chain.then = (resolve: any) => chain.execute().then(resolve);
      return chain;
    },
  };
}

describe('Módulo Células — Lote 5: Multiplicação Assistida e Genealogia', () => {
  const ministryA = 'ministry-alpha-uuid';
  const ministryB = 'ministry-beta-cross-tenant';
  const congregacaoA1 = 'congregacao-a1-uuid';
  const userPastorA = 'user-pastor-a-uuid';
  const memberLiderA = 'member-lider-a-uuid';
  const memberNovoLiderA = 'member-novo-lider-a-uuid';
  const memberNovoLiderB = 'member-novo-lider-b-uuid';
  const celulaMaeId = 'celula-mae-uuid';

  const initialDbState = {
    ministries: [{ id: ministryA }, { id: ministryB }],
    congregacoes: [{ id: congregacaoA1, ministry_id: ministryA, nome: 'Sede Alpha' }],
    celulas_redes: [{ id: 'rede-familia-a', ministry_id: ministryA, nome: 'Rede Família' }],
    members: [
      { id: memberLiderA, ministry_id: ministryA, name: 'Líder Célula Mãe' },
      { id: memberNovoLiderA, ministry_id: ministryA, name: 'Líder em Treinamento Preparado' },
      { id: memberNovoLiderB, ministry_id: ministryB, name: 'Líder de Outro Ministério' },
    ],
    celulas: [
      { 
        id: celulaMaeId, 
        ministry_id: ministryA, 
        congregacao_id: congregacaoA1, 
        rede_id: 'rede-familia-a',
        nome: 'Célula Graça e Paz', 
        status: 'ativa',
        dia_semana: 4,
        horario: '20:00',
        endereco: 'Rua Central, 100'
      },
    ],
    celulas_participantes: [
      { id: 'part-1', ministry_id: ministryA, celula_id: celulaMaeId, member_id: memberLiderA, nome_completo: 'Líder Célula Mãe', status: 'ativo', papel: 'lider' },
      { id: 'part-2', ministry_id: ministryA, celula_id: celulaMaeId, member_id: memberNovoLiderA, nome_completo: 'Novo Líder', status: 'ativo', papel: 'lider_em_treinamento' },
      { id: 'part-3', ministry_id: ministryA, celula_id: celulaMaeId, member_id: null, nome_completo: 'Visitante Regular', status: 'ativo', papel: 'visitante_regular' },
    ],
    celulas_multiplicacoes: [] as any[],
    celulas_multiplicacao_participantes: [] as any[],
    celulas_transferencias: [] as any[],
  };

  it('1. Solicita processo de multiplicação com participantes planejados', async () => {
    const dbState = JSON.parse(JSON.stringify(initialDbState));
    const service = new CelulasService(createMockSupabase(dbState) as any);

    const mult = await service.solicitarMultiplicacao(ministryA, {
      celula_origem_id: celulaMaeId,
      nome_nova_celula: 'Célula Esperança Viva',
      novo_lider_member_id: memberNovoLiderA,
      data_planejada: '2026-12-01',
      motivo_planejamento: 'Célula mãe atingiu 20 participantes regulares.',
      participantes: [
        { participante_id: 'part-2', papel_planejado: 'lider' },
        { participante_id: 'part-3', papel_planejado: 'membro' },
      ],
    }, userPastorA);

    assert.ok(mult.id);
    assert.strictEqual(mult.celula_origem_id, celulaMaeId);
    assert.strictEqual(mult.status, 'solicitada');
    assert.strictEqual(mult.nome_nova_celula, 'Célula Esperança Viva');
  });

  it('2. Bloqueia planejamento com líder de outro ministério (anti cross-tenant)', async () => {
    const dbState = JSON.parse(JSON.stringify(initialDbState));
    const service = new CelulasService(createMockSupabase(dbState) as any);

    await assert.rejects(
      async () => {
        await service.solicitarMultiplicacao(ministryA, {
          celula_origem_id: celulaMaeId,
          nome_nova_celula: 'Célula Inválida',
          novo_lider_member_id: memberNovoLiderB, // Líder do ministério B
        });
      },
      /O líder planejado para a nova célula não pertence a este ministério/
    );
  });

  it('3. Avalia e aprova processo de multiplicação com justificativa', async () => {
    const dbState = JSON.parse(JSON.stringify(initialDbState));
    const service = new CelulasService(createMockSupabase(dbState) as any);

    const mult = await service.solicitarMultiplicacao(ministryA, {
      celula_origem_id: celulaMaeId,
      nome_nova_celula: 'Célula Monte Sião',
      novo_lider_member_id: memberNovoLiderA,
    }, userPastorA);

    const avaliada = await service.avaliarMultiplicacao(ministryA, {
      multiplicacao_id: mult.id,
      acao: 'aprovar',
      justificativa: 'Critérios de maturidade e local aprovados pela coordenação.',
    }, userPastorA);

    assert.strictEqual(avaliada.status, 'aprovada');
    assert.strictEqual(avaliada.justificativa_aprovacao, 'Critérios de maturidade e local aprovados pela coordenação.');
  });

  it('4. Rejeita efetivação de multiplicação quando status não estiver aprovado', async () => {
    const dbState = JSON.parse(JSON.stringify(initialDbState));
    const service = new CelulasService(createMockSupabase(dbState) as any);

    const mult = await service.solicitarMultiplicacao(ministryA, {
      celula_origem_id: celulaMaeId,
      nome_nova_celula: 'Célula Não Aprovada',
    }, userPastorA);

    await assert.rejects(
      async () => {
        await service.efetivarMultiplicacao(ministryA, { multiplicacao_id: mult.id }, userPastorA);
      },
      /Apenas processos com status 'aprovada' podem ser efetivados/
    );
  });

  it('5. Efetiva multiplicação: gera nova célula com genealogia íntegra e migra participantes', async () => {
    const dbState = JSON.parse(JSON.stringify(initialDbState));
    const service = new CelulasService(createMockSupabase(dbState) as any);

    // 1. Solicitar
    const mult = await service.solicitarMultiplicacao(ministryA, {
      celula_origem_id: celulaMaeId,
      nome_nova_celula: 'Célula Emanuel',
      novo_lider_member_id: memberNovoLiderA,
      participantes: [
        { participante_id: 'part-2', papel_planejado: 'lider' },
      ],
    }, userPastorA);

    // 2. Aprovar
    await service.avaliarMultiplicacao(ministryA, {
      multiplicacao_id: mult.id,
      acao: 'aprovar',
    }, userPastorA);

    // 3. Efetivar
    const resultado = await service.efetivarMultiplicacao(ministryA, { multiplicacao_id: mult.id }, userPastorA);

    assert.strictEqual(resultado.multiplicacao.status, 'efetivada');
    assert.ok(resultado.novaCelula.id);
    assert.strictEqual(resultado.novaCelula.celula_mae_id, celulaMaeId); // Genealogia preservada!
    assert.strictEqual(resultado.novaCelula.nome, 'Célula Emanuel');

    // Conferir se o participante planejado foi migrado para a nova célula
    const part2 = dbState.celulas_participantes.find((p: any) => p.id === 'part-2');
    assert.ok(part2);
    assert.strictEqual(part2.celula_id, resultado.novaCelula.id);
    assert.strictEqual(part2.papel, 'lider');

    // Conferir se o log de transferência foi gerado
    assert.strictEqual(dbState.celulas_transferencias.length, 1);
    assert.strictEqual(dbState.celulas_transferencias[0].celula_origem_id, celulaMaeId);
    assert.strictEqual(dbState.celulas_transferencias[0].celula_destino_id, resultado.novaCelula.id);
  });
});
