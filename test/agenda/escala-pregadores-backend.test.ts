import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EscalaPregadoresService } from '@/services/escala-pregadores-service';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('Serviço Backend: EscalaPregadoresService (Etapa 2)', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';

  // Mock do SupabaseClient
  function createMockSupabase(initialState: {
    eventos?: any[];
    membros?: any[];
    escalas?: any[];
  }) {
    let eventos = [...(initialState.eventos || [])];
    let membros = [...(initialState.membros || [])];
    let escalas = [...(initialState.escalas || [])];

    return {
      from(table: string) {
        if (table === 'agenda_eventos') {
          return {
            select(_cols: string) {
              let res = [...eventos];
              return {
                eq(col: string, val: any) {
                  res = res.filter(item => item[col] === val);
                  return this;
                },
                neq(col: string, val: any) {
                  res = res.filter(item => item[col] !== val);
                  return this;
                },
                gte(col: string, val: any) {
                  res = res.filter(item => item[col] >= val);
                  return this;
                },
                lte(col: string, val: any) {
                  res = res.filter(item => item[col] <= val);
                  return this;
                },
                ilike(col: string, pattern: string) {
                  const p = pattern.replace(/%/g, '').toLowerCase();
                  res = res.filter(item => (item[col] || '').toLowerCase().includes(p));
                  return this;
                },
                order() {
                  return this;
                },
                range(from: number, to: number) {
                  res = res.slice(from, to + 1);
                  return this;
                },
                then(resolve: any) {
                  return Promise.resolve({ data: res, count: res.length, error: null }).then(resolve);
                }
              };
            }
          };
        }

        if (table === 'congregacoes') {
          return {
            select(_cols: string) {
              return {
                eq(_col: string, _val: any) {
                  return Promise.resolve({
                    data: [
                      { id: 'cong-1', nome: 'Sede Central', is_sede: true },
                      { id: 'cong-2', nome: 'Congregação Norte', is_sede: false },
                    ],
                    error: null,
                  });
                },
              };
            },
          };
        }

        if (table === 'members') {
          return {
            select(_cols: string) {
              let res = [...membros];
              return {
                eq(col: string, val: any) {
                  res = res.filter(item => item[col] === val);
                  return this;
                },
                or(_condStr: string) {
                  // Filtra role/tipo_cadastro ministro e status active
                  return this;
                },
                order() {
                  return this;
                },
                range(from: number, to: number) {
                  res = res.slice(from, to + 1);
                  return this;
                },
                then(resolve: any) {
                  return Promise.resolve({ data: res, count: res.length, error: null }).then(resolve);
                }
              };
            }
          };
        }

        if (table === 'agenda_escala_pregadores') {
          return {
            select(_cols: string) {
              let res = [...escalas];
              const queryObj: any = {
                eq(col: string, val: any) {
                  res = res.filter(item => item[col] === val);
                  return this;
                },
                in(col: string, vals: any[]) {
                  res = res.filter(item => vals.includes(item[col]));
                  return this;
                },
                order() {
                  return {
                    limit(n: number) {
                      return Promise.resolve({ data: res.slice(0, n), error: null });
                    },
                    then(resolve: any) {
                      return Promise.resolve({ data: res, error: null }).then(resolve);
                    }
                  };
                },
                single() {
                  const row = res[0] || null;
                  return Promise.resolve({ data: row, error: row ? null : { message: 'Not found' } });
                },
                then(resolve: any) {
                  return Promise.resolve({ data: res, error: null }).then(resolve);
                }
              };
              return queryObj;
            },
            insert(rows: any[]) {
              const newRow = {
                ...rows[0],
                id: rows[0].id || `esc-${Date.now()}-${Math.random()}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              escalas.push(newRow);
              return {
                select() {
                  return {
                    single() {
                      return Promise.resolve({ data: newRow, error: null });
                    }
                  };
                }
              };
            },
            update(updates: any) {
              return {
                eq(col: string, val: any) {
                  return {
                    eq(col2: string, val2: any) {
                      escalas = escalas.map(item => {
                        if (item[col] === val && item[col2] === val2) {
                          return { ...item, ...updates };
                        }
                        return item;
                      });
                      const updated = escalas.find(item => item[col] === val);
                      return {
                        select() {
                          return {
                            single() {
                              return Promise.resolve({ data: updated, error: null });
                            }
                          };
                        },
                        then(resolve: any) {
                          return Promise.resolve({ data: updated, error: null }).then(resolve);
                        }
                      };
                    }
                  };
                }
              };
            }
          };
        }

        throw new Error(`Tabela não mockada: ${table}`);
      }
    } as unknown as SupabaseClient;
  }

  it('1. Listar eventos com indicação de pregador e filtro apenasSemPregador', async () => {
    const mockSupabase = createMockSupabase({
      eventos: [
        { id: 'evt-1', ministry_id: tenantId, titulo: 'Culto 1', data_inicio: '2026-11-01T22:00:00Z', status: 'agendado' },
        { id: 'evt-2', ministry_id: tenantId, titulo: 'Culto 2', data_inicio: '2026-11-02T22:00:00Z', status: 'agendado' },
      ],
      escalas: [
        { id: 'esc-1', ministry_id: tenantId, agenda_evento_id: 'evt-1', member_id: 'min-1', status: 'escalado' }
      ]
    });

    const todos = await EscalaPregadoresService.listarEventosComEscala(mockSupabase, { ministryId: tenantId });
    assert.equal(todos.length, 2);
    assert.equal(todos[0].possui_pregador, true);
    assert.equal(todos[1].possui_pregador, false);

    const semPregador = await EscalaPregadoresService.listarEventosComEscala(mockSupabase, {
      ministryId: tenantId,
      apenasSemPregador: true,
    });
    assert.equal(semPregador.length, 1);
    assert.equal(semPregador[0].id, 'evt-2');
  });

  it('2. Listar ministros com estatísticas de rodízio e destaque para menos escalados', async () => {
    const mockSupabase = createMockSupabase({
      membros: [
        { id: 'min-1', ministry_id: tenantId, name: 'Pr. Carlos', cargo_ministerial: 'Pastor', status: 'active', role: 'ministro' },
        { id: 'min-2', ministry_id: tenantId, name: 'Ev. Lucas', cargo_ministerial: 'Evangelista', status: 'active', role: 'ministro' },
      ],
      escalas: [
        { id: 'esc-1', ministry_id: tenantId, member_id: 'min-1', evento_data_inicio_snapshot: new Date().toISOString(), status: 'escalado' }
      ]
    });

    const ministros = await EscalaPregadoresService.listarMinistrosComRodizio(mockSupabase, tenantId);
    assert.equal(ministros.length, 2);
    const carlos = ministros.find(m => m.id === 'min-1')!;
    const lucas = ministros.find(m => m.id === 'min-2')!;

    assert.equal(carlos.total_escalas_mes, 1);
    assert.equal(lucas.total_escalas_mes, 0);
    assert.equal(lucas.is_menos_escalado, true, 'Ev. Lucas deve ser destacado como menos escalado');
  });

  it('3. Atribuir pregador a um evento existente', async () => {
    const mockSupabase = createMockSupabase({
      eventos: [{ id: 'evt-1', ministry_id: tenantId, titulo: 'Culto da Família', status: 'agendado' }],
      membros: [{ id: 'min-1', name: 'Pr. Carlos', status: 'active', role: 'ministro' }],
    });

    const escala = await EscalaPregadoresService.atribuirPregador(mockSupabase, {
      ministryId: tenantId,
      agendaEventoId: 'evt-1',
      memberId: 'min-1',
      temaMensagem: 'O Poder da Oração',
    });

    assert.equal(escala.agenda_evento_id, 'evt-1');
    assert.equal(escala.member_id, 'min-1');
    assert.equal(escala.status, 'escalado');
    assert.equal(escala.tema_mensagem, 'O Poder da Oração');
  });

  it('4. Substituição de pregador: atômica, marca status substituido e cria nova escala', async () => {
    const mockSupabase = createMockSupabase({
      escalas: [
        { id: 'esc-orig', ministry_id: tenantId, agenda_evento_id: 'evt-1', member_id: 'min-1', status: 'escalado' }
      ]
    });

    const novaEscala = await EscalaPregadoresService.editarEscala(mockSupabase, {
      escalaId: 'esc-orig',
      ministryId: tenantId,
      novoMemberId: 'min-2',
      motivoSubstituicao: 'Problema de saúde do titular',
    });

    assert.equal(novaEscala.member_id, 'min-2');
    assert.equal(novaEscala.status, 'escalado');
  });

  it('5. Desfazer escala: marca como cancelado preservando histórico', async () => {
    const mockSupabase = createMockSupabase({
      escalas: [
        { id: 'esc-1', ministry_id: tenantId, agenda_evento_id: 'evt-1', member_id: 'min-1', status: 'escalado' }
      ]
    });

    const cancelada = await EscalaPregadoresService.desfazerEscala(mockSupabase, {
      escalaId: 'esc-1',
      ministryId: tenantId,
      motivoCancelamento: 'Escala suspensa pelo pastor titular',
    });

    assert.equal(cancelada.status, 'cancelado');
    assert.equal(cancelada.motivo_alteracao, 'Escala suspensa pelo pastor titular');
  });

  it('6. Remanejar pregador: cancela anterior e insere no novo evento de forma atômica', async () => {
    const mockSupabase = createMockSupabase({
      escalas: [
        { id: 'esc-orig', ministry_id: tenantId, agenda_evento_id: 'evt-1', member_id: 'min-1', status: 'escalado', tema_mensagem: 'Fé' }
      ]
    });

    const remanejada = await EscalaPregadoresService.remanejarPregador(mockSupabase, {
      escalaOrigemId: 'esc-orig',
      novoAgendaEventoId: 'evt-2',
      ministryId: tenantId,
      motivoRemanejamento: 'Remanejado para congregação vizinha por necessidade',
    });

    assert.equal(remanejada.agenda_evento_id, 'evt-2');
    assert.equal(remanejada.member_id, 'min-1');
    assert.equal(remanejada.status, 'escalado');
    assert.equal(remanejada.tema_mensagem, 'Fé');
  });
});
