import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CelulasService } from '../../src/services/celulas-service';

// Mock do Supabase Client focado no Lote 4
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
        or: (_condition: string) => {
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
                  // Aplicar update
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

describe('Módulo Células — Lote 4: Estudos Bíblicos, Supervisão e Relatórios', () => {
  const ministryA = 'ministry-alpha-uuid';
  const ministryB = 'ministry-beta-cross-tenant';
  const congregacaoA1 = 'congregacao-a1-uuid';
  const congregacaoB1 = 'congregacao-b1-uuid';
  const userA = 'user-lider-a-uuid';
  const memberSupervisorA = 'member-supervisor-a-uuid';
  const memberSupervisorB = 'member-supervisor-b-uuid';
  const celulaA1 = 'celula-a1-uuid';

  const initialDbState = {
    ministries: [{ id: ministryA }, { id: ministryB }],
    congregacoes: [
      { id: congregacaoA1, ministry_id: ministryA, nome: 'Sede Alpha' },
      { id: congregacaoB1, ministry_id: ministryB, nome: 'Sede Beta' },
    ],
    celulas_redes: [
      { id: 'rede-jovens-a', ministry_id: ministryA, nome: 'Jovens Alpha' },
      { id: 'rede-jovens-b', ministry_id: ministryB, nome: 'Jovens Beta' },
    ],
    members: [
      { id: memberSupervisorA, ministry_id: ministryA, name: 'Pr. Supervisor Alpha' },
      { id: memberSupervisorB, ministry_id: ministryB, name: 'Pr. Supervisor Beta' },
    ],
    celulas: [
      { id: celulaA1, ministry_id: ministryA, congregacao_id: congregacaoA1, nome: 'Célula Boas Novas', status: 'ativa' },
    ],
    celulas_participantes: [
      { id: 'p1', ministry_id: ministryA, celula_id: celulaA1, status: 'ativo', papel: 'lider' },
      { id: 'p2', ministry_id: ministryA, celula_id: celulaA1, status: 'ativo', papel: 'membro' },
    ],
    celulas_reunioes: [
      { id: 'r1', ministry_id: ministryA, celula_id: celulaA1, status: 'finalizada', presencas_total: 10, presencas_visitantes: 2 },
    ],
    celulas_estudos: [] as any[],
    celulas_supervisoes: [] as any[],
  };

  it('1. Salva e publica estudo bíblico para o ministério com governança de status', async () => {
    const dbState = JSON.parse(JSON.stringify(initialDbState));
    const service = new CelulasService(createMockSupabase(dbState) as any);

    const novoEstudo = await service.salvarEstudo(ministryA, {
      titulo: 'Princípios do Discipulado Cristão',
      tema: 'Vida Cristã',
      serie: 'Fundamentos da Fé',
      numero_licao: 1,
      referencias_biblicas: 'Mateus 28:18-20',
      desenvolvimento: 'O discipulado é o centro da comissão deixada por Cristo aos discípulos...',
      status: 'publicado',
      data_publicacao_inicio: '2026-11-12',
    }, userA);

    assert.ok(novoEstudo.id);
    assert.strictEqual(novoEstudo.titulo, 'Princípios do Discipulado Cristão');
    assert.strictEqual(novoEstudo.status, 'publicado');
    assert.strictEqual(novoEstudo.versao, 1);
  });

  it('2. Bloqueia vínculo de estudo a rede de outro ministério (anti cross-tenant)', async () => {
    const dbState = JSON.parse(JSON.stringify(initialDbState));
    const service = new CelulasService(createMockSupabase(dbState) as any);

    await assert.rejects(
      async () => {
        await service.salvarEstudo(ministryA, {
          titulo: 'Estudo Inválido Cross-tenant',
          rede_id: 'rede-jovens-b', // Rede do ministério B
          desenvolvimento: 'Tentativa de associação cruzada...',
        });
      },
      /A rede informada não pertence a este ministério/
    );
  });

  it('3. Agenda visita de supervisão pastoral para célula válida', async () => {
    const dbState = JSON.parse(JSON.stringify(initialDbState));
    const service = new CelulasService(createMockSupabase(dbState) as any);

    const supervisao = await service.salvarSupervisao(ministryA, {
      celula_id: celulaA1,
      supervisor_member_id: memberSupervisorA,
      tipo: 'visita',
      data_agendada: '2026-11-20',
      diagnostico_saude: 'saudavel',
      observacoes_pastorais: 'Célula em crescimento, liderança bem alinhada.',
    }, userA);

    assert.ok(supervisao.id);
    assert.strictEqual(supervisao.celula_id, celulaA1);
    assert.strictEqual(supervisao.status, 'agendada');
    assert.strictEqual(supervisao.solicitou_apoio_pastoral, false);
  });

  it('4. Bloqueia atribuição de supervisor de outro ministério (anti cross-tenant)', async () => {
    const dbState = JSON.parse(JSON.stringify(initialDbState));
    const service = new CelulasService(createMockSupabase(dbState) as any);

    await assert.rejects(
      async () => {
        await service.salvarSupervisao(ministryA, {
          celula_id: celulaA1,
          supervisor_member_id: memberSupervisorB, // Supervisor do ministério B
          tipo: 'visita',
          data_agendada: '2026-11-22',
        });
      },
      /O supervisor selecionado não pertence a este ministério/
    );
  });

  it('5. Gera relatório consolidado com métricas consistentes e reconciliadas', async () => {
    const dbState = JSON.parse(JSON.stringify(initialDbState));
    const service = new CelulasService(createMockSupabase(dbState) as any);

    // Inserir uma supervisão com solicitação de apoio aberta
    await service.salvarSupervisao(ministryA, {
      celula_id: celulaA1,
      tipo: 'solicitacao_apoio',
      status: 'agendada',
      data_agendada: '2026-11-15',
      solicitou_apoio_pastoral: true,
      detalhe_apoio: 'Necessidade de visita pastoral ao líder da célula.',
    });

    const consolidado = await service.obterRelatorioConsolidado(ministryA);

    assert.strictEqual(consolidado.total_celulas, 1);
    assert.strictEqual(consolidado.celulas_ativas, 1);
    assert.strictEqual(consolidado.total_participantes, 2);
    assert.strictEqual(consolidado.participantes_ativos, 2);
    assert.strictEqual(consolidado.lideres_ativos, 1);
    assert.strictEqual(consolidado.reunioes_mes, 1);
    assert.strictEqual(consolidado.media_presenca_reuniao, 10);
    assert.strictEqual(consolidado.total_visitantes_mes, 2);
    assert.strictEqual(consolidado.supervisoes_pendentes, 1);
    assert.strictEqual(consolidado.solicitacoes_apoio_abertas, 1);
  });
});
