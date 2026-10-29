import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EscalaPregadoresService } from '@/services/escala-pregadores-service';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('Homologação Funcional: Escala de Pregadores (Etapa 5)', () => {
  const ministryId = '99999999-9999-9999-9999-999999999999';
  const congregacaoSedeId = '11111111-1111-1111-1111-111111111111';
  const congregacaoFilialId = '22222222-2222-2222-2222-222222222222';

  // Mock do Supabase simulando as regras da migration do PostgreSQL
  function setupMockHomologacao() {
    const eventos = [
      {
        id: 'evt-01',
        ministry_id: ministryId,
        church_id: congregacaoSedeId,
        titulo: 'Culto de Doutrina',
        data_inicio: '2026-11-05T22:30:00Z', // 19:30 Belém
        data_fim: '2026-11-06T00:00:00Z',    // 21:00 Belém
        status: 'agendado',
        congregacoes: { id: congregacaoSedeId, nome: 'Templo Sede', is_sede: true },
        agenda_tipos: { id: 'tipo-01', nome: 'Culto Oficial', cor: '#3b82f6' },
      },
      {
        id: 'evt-02',
        ministry_id: ministryId,
        church_id: congregacaoFilialId,
        titulo: 'Culto de Ensino',
        data_inicio: '2026-11-05T22:30:00Z', // 19:30 Belém (Mesmo Horário)
        data_fim: '2026-11-06T00:00:00Z',
        status: 'agendado',
        congregacoes: { id: congregacaoFilialId, nome: 'Congregação Canaã', is_sede: false },
        agenda_tipos: { id: 'tipo-01', nome: 'Culto Oficial', cor: '#3b82f6' },
      },
      {
        id: 'evt-03',
        ministry_id: ministryId,
        church_id: congregacaoFilialId,
        titulo: 'Culto de Missões',
        data_inicio: '2026-11-08T22:00:00Z', // Domingo 19:00 Belém
        data_fim: '2026-11-08T23:30:00Z',
        status: 'agendado',
        congregacoes: { id: congregacaoFilialId, nome: 'Congregação Canaã', is_sede: false },
        agenda_tipos: { id: 'tipo-01', nome: 'Culto Oficial', cor: '#3b82f6' },
      },
      {
        id: 'evt-cancelado',
        ministry_id: ministryId,
        church_id: congregacaoSedeId,
        titulo: 'Culto Cancelado',
        data_inicio: '2026-11-09T22:00:00Z',
        data_fim: '2026-11-09T23:30:00Z',
        status: 'cancelado',
        congregacoes: { id: congregacaoSedeId, nome: 'Templo Sede', is_sede: true },
        agenda_tipos: { id: 'tipo-01', nome: 'Culto Oficial', cor: '#3b82f6' },
      },
    ];

    const membros = [
      {
        id: 'min-01',
        ministry_id: ministryId,
        congregacao_id: congregacaoSedeId,
        name: 'Pr. Carlos Eduardo',
        matricula: 'MIN-001',
        cargo_ministerial: 'Pastor',
        status_membro: 'ativo',
        foto_url: null,
      },
      {
        id: 'min-02',
        ministry_id: ministryId,
        congregacao_id: congregacaoFilialId,
        name: 'Ev. Marcos Souza',
        matricula: 'MIN-002',
        cargo_ministerial: 'Evangelista',
        status_membro: 'ativo',
        foto_url: null,
      },
      {
        id: 'membro-comum',
        ministry_id: ministryId,
        congregacao_id: congregacaoSedeId,
        name: 'Irmão Lucas Comum',
        matricula: 'MEM-099',
        cargo_ministerial: null, // Sem cargo ministerial
        status_membro: 'ativo',
        foto_url: null,
      },
    ];

    let escalas: any[] = [];

    const mockClient = {
      from(table: string) {
        if (table === 'agenda_eventos') {
          return {
            select(_cols: string) {
              let res = [...eventos];
              return {
                eq(c: string, v: any) {
                  res = res.filter((item) => (item as any)[c] === v);
                  return this;
                },
                neq(c: string, v: any) {
                  res = res.filter((item) => (item as any)[c] !== v);
                  return this;
                },
                gte(c: string, v: any) {
                  res = res.filter((item) => (item as any)[c] >= v);
                  return this;
                },
                lte(c: string, v: any) {
                  res = res.filter((item) => (item as any)[c] <= v);
                  return this;
                },
                ilike(c: string, p: string) {
                  const pat = p.replace(/%/g, '').toLowerCase();
                  res = res.filter((item) => ((item as any)[c] || '').toLowerCase().includes(pat));
                  return this;
                },
                order() {
                  return Promise.resolve({ data: res, error: null });
                },
                single() {
                  return Promise.resolve({ data: res[0] || null, error: res[0] ? null : { message: 'Not found' } });
                },
                maybeSingle() {
                  return Promise.resolve({ data: res[0] || null, error: null });
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
                eq(c: string, v: any) {
                  res = res.filter((item) => (item as any)[c] === v);
                  return this;
                },
                not(c: string, op: string, v: any) {
                  if (op === 'is' && v === null) {
                    res = res.filter((item) => (item as any)[c] !== null);
                  }
                  return this;
                },
                or(condStr: string) {
                  if (condStr.includes('role.eq.ministro')) {
                    res = res.filter((item) => item.cargo_ministerial !== null && item.cargo_ministerial !== undefined);
                  }
                  return this;
                },
                ilike(c: string, p: string) {
                  const pat = p.replace(/%/g, '').toLowerCase();
                  res = res.filter((item) => ((item as any)[c] || '').toLowerCase().includes(pat));
                  return this;
                },
                order() {
                  return Promise.resolve({ data: res, error: null });
                },
                single() {
                  return Promise.resolve({ data: res[0] || null, error: null });
                },
                maybeSingle() {
                  return Promise.resolve({ data: res[0] || null, error: null });
                },
              };
            },
          };
        }

        if (table === 'agenda_escala_pregadores') {
          return {
            select(_cols: string) {
              let res = [...escalas];
              const queryObj: any = {
                eq(c: string, v: any) {
                  res = res.filter((item) => (item as any)[c] === v);
                  return this;
                },
                in(c: string, arr: any[]) {
                  res = res.filter((item) => arr.includes((item as any)[c]));
                  return this;
                },
                single() {
                  return Promise.resolve({ data: res[0] || null, error: res[0] ? null : { message: 'Not found' } });
                },
                maybeSingle() {
                  return Promise.resolve({ data: res[0] || null, error: null });
                },
                order() {
                  return {
                    limit(n: number) {
                      return Promise.resolve({ data: res.slice(0, n), error: null });
                    },
                    then(resolve: any) {
                      return Promise.resolve({ data: res, error: null }).then(resolve);
                    },
                  };
                },
                limit(n: number) {
                  res = res.slice(0, n);
                  return this;
                },
                then(resolve: any) {
                  return Promise.resolve({ data: res, error: null }).then(resolve);
                },
              };
              return queryObj;
            },
            insert(items: any[]) {
              // Simulação das triggers da Migration:
              for (const item of items) {
                const targetMember = membros.find((m) => m.id === item.member_id);
                if (!targetMember || !targetMember.cargo_ministerial) {
                  return {
                    select() {
                      return {
                        single() {
                          return Promise.resolve({
                            data: null,
                            error: new Error('O membro selecionado não possui cargo ministerial ativo.'),
                          });
                        },
                      };
                    },
                  };
                }

                // Verifica se o evento já tem pregador ativo
                const jaEscalado = escalas.find(
                  (e) =>
                    e.agenda_evento_id === item.agenda_evento_id &&
                    ['escalado', 'confirmado'].includes(e.status)
                );
                if (jaEscalado) {
                  return {
                    select() {
                      return {
                        single() {
                          return Promise.resolve({
                            data: null,
                            error: new Error('Este evento da agenda já possui um pregador escalado ativo.'),
                          });
                        },
                      };
                    },
                  };
                }
              }

              const inserted = items.map((i) => {
                const ev = eventos.find((e) => e.id === i.agenda_evento_id);
                return {
                  id: `esc-${Math.random().toString(36).substr(2, 9)}`,
                  created_at: new Date().toISOString(),
                  evento_data_inicio_snapshot: ev?.data_inicio || new Date().toISOString(),
                  ...i,
                };
              });
              escalas.push(...inserted);
              return {
                select() {
                  return {
                    single() {
                      return Promise.resolve({ data: inserted[0], error: null });
                    },
                  };
                },
              };
            },
            update(fields: any) {
              return {
                eq(c: string, v: any) {
                  return {
                    eq(_c2: string, _v2: any) {
                      escalas = escalas.map((item) => {
                        if ((item as any)[c] === v) {
                          return { ...item, ...fields };
                        }
                        return item;
                      });
                      return {
                        select() {
                          return {
                            single() {
                              const updated = escalas.find((i) => (i as any)[c] === v);
                              return Promise.resolve({ data: updated, error: null });
                            },
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }

        return {};
      },
    } as unknown as SupabaseClient;

    return { mockClient, eventos, membros, getEscalas: () => escalas };
  }

  // ─── Teste 1: Bloqueio de Ministros Não Elegíveis ──────────────────────────
  it('1. Homologação: deve rejeitar atribuição se membro não tiver status ministerial ativo', async () => {
    const { mockClient } = setupMockHomologacao();

    await assert.rejects(
      async () => {
        await EscalaPregadoresService.atribuirPregador(mockClient, {
          ministryId,
          agendaEventoId: 'evt-01',
          memberId: 'membro-comum', // Sem cargo ministerial
        });
      },
      /O membro selecionado não possui cargo ministerial ativo/
    );
  });

  // ─── Teste 2: Atribuição Válida com Sucesso ────────────────────────────────
  it('2. Homologação: deve permitir atribuir ministro ativo a evento da agenda', async () => {
    const { mockClient, getEscalas } = setupMockHomologacao();

    const escala = await EscalaPregadoresService.atribuirPregador(mockClient, {
      ministryId,
      agendaEventoId: 'evt-01',
      memberId: 'min-01',
      temaMensagem: 'A Doutrina dos Apóstolos',
    });

    assert.ok(escala.id);
    assert.equal(escala.member_id, 'min-01');
    assert.equal(escala.status, 'escalado');
    assert.equal(getEscalas().length, 1);
  });

  // ─── Teste 3: Prevenção de Escala Concorrente no Mesmo Culto ───────────────
  it('3. Homologação: deve impedir atribuição concorrente em culto já com escala ativa', async () => {
    const { mockClient } = setupMockHomologacao();

    await EscalaPregadoresService.atribuirPregador(mockClient, {
      ministryId,
      agendaEventoId: 'evt-01',
      memberId: 'min-01',
    });

    await assert.rejects(
      async () => {
        await EscalaPregadoresService.atribuirPregador(mockClient, {
          ministryId,
          agendaEventoId: 'evt-01',
          memberId: 'min-02',
        });
      },
      /Este evento da agenda já possui um pregador escalado/
    );
  });

  // ─── Teste 4: Substituição com Histórico e Motivo Obrigatório ──────────────
  it('4. Homologação: deve substituir pregador gerando nova escala e marcando anterior como substituída', async () => {
    const { mockClient, getEscalas } = setupMockHomologacao();

    const inicial = await EscalaPregadoresService.atribuirPregador(mockClient, {
      ministryId,
      agendaEventoId: 'evt-01',
      memberId: 'min-01',
    });

    // Tentativa de substituir sem motivo -> deve falhar
    await assert.rejects(
      async () => {
        await EscalaPregadoresService.editarEscala(mockClient, {
          escalaId: inicial.id,
          ministryId,
          novoMemberId: 'min-02',
          motivoSubstituicao: '',
        });
      },
      /É obrigatório informar o motivo da substituição/
    );

    // Substituição correta
    const nova = await EscalaPregadoresService.editarEscala(mockClient, {
      escalaId: inicial.id,
      ministryId,
      novoMemberId: 'min-02',
      motivoSubstituicao: 'Viagem de representação ministerial',
    });

    assert.equal(nova.member_id, 'min-02');
    assert.equal(nova.status, 'escalado');

    const historico = getEscalas();
    assert.equal(historico.length, 2);
    const antiga = historico.find((e) => e.id === inicial.id);
    assert.equal(antiga.status, 'substituido');
    assert.equal(antiga.substituido_por_member_id, 'min-02');
    assert.equal(antiga.motivo_alteracao, 'Viagem de representação ministerial');
  });

  // ─── Teste 5: Remanejamento de Pregador para Outro Culto Existente ──────────
  it('5. Homologação: deve remanejar pregador cancelando origem e criando no destino com justificativa', async () => {
    const { mockClient, getEscalas } = setupMockHomologacao();

    const escalaOrigem = await EscalaPregadoresService.atribuirPregador(mockClient, {
      ministryId,
      agendaEventoId: 'evt-01',
      memberId: 'min-01',
      temaMensagem: 'Princípios da Fé',
    });

    const remanejada = await EscalaPregadoresService.remanejarPregador(mockClient, {
      escalaOrigemId: escalaOrigem.id,
      novoAgendaEventoId: 'evt-03',
      ministryId,
      motivoRemanejamento: 'Necessidade pastoral na Congregação Canaã',
    });

    assert.equal(remanejada.agenda_evento_id, 'evt-03');
    assert.equal(remanejada.member_id, 'min-01');
    assert.equal(remanejada.status, 'escalado');
    assert.equal(remanejada.tema_mensagem, 'Princípios da Fé');

    const todas = getEscalas();
    const anterior = todas.find((e) => e.id === escalaOrigem.id);
    assert.equal(anterior.status, 'cancelado');
    assert.ok(anterior.motivo_alteracao.includes('Remanejado: Necessidade pastoral'));
  });

  // ─── Teste 6: Desfazimento de Escala (Liberando o Evento) ───────────────────
  it('6. Homologação: deve desfazer escala deixando o evento livre com motivo registrado', async () => {
    const { mockClient, getEscalas } = setupMockHomologacao();

    const escala = await EscalaPregadoresService.atribuirPregador(mockClient, {
      ministryId,
      agendaEventoId: 'evt-01',
      memberId: 'min-01',
    });

    await EscalaPregadoresService.desfazerEscala(mockClient, {
      escalaId: escala.id,
      ministryId,
      motivoCancelamento: 'Cancelamento por motivo de força maior',
    });

    const registro = getEscalas().find((e) => e.id === escala.id);
    assert.equal(registro.status, 'cancelado');
    assert.equal(registro.motivo_alteracao, 'Cancelamento por motivo de força maior');
  });

  // ─── Teste 7: Listagem e Filtragem de Eventos da Agenda Oficial ─────────────
  it('7. Homologação: deve listar exclusivamente eventos agendados da agenda oficial, ocultando cancelados', async () => {
    const { mockClient } = setupMockHomologacao();

    const lista = await EscalaPregadoresService.listarEventosComEscala(mockClient, {
      ministryId,
    });

    assert.equal(lista.length, 3, 'Deve listar apenas os 3 eventos agendados, ignorando o cancelado');
    const ids = lista.map((e) => e.id);
    assert.ok(!ids.includes('evt-cancelado'), 'Evento cancelado não deve ser listado para escala');
  });

  // ─── Teste 8: Indicadores de Rodízio Ministerial ───────────────────────────
  it('8. Homologação: deve calcular estatísticas de rodízio e destacar ministros menos escalados', async () => {
    const { mockClient } = setupMockHomologacao();

    // min-01 recebe 1 escala
    await EscalaPregadoresService.atribuirPregador(mockClient, {
      ministryId,
      agendaEventoId: 'evt-01',
      memberId: 'min-01',
    });

    const ministrosComRodizio = await EscalaPregadoresService.listarMinistrosComRodizio(
      mockClient,
      ministryId
    );

    assert.equal(ministrosComRodizio.length, 2, 'Apenas ministros com cargo devem ser listados');

    const m1 = ministrosComRodizio.find((m) => m.id === 'min-01');
    const m2 = ministrosComRodizio.find((m) => m.id === 'min-02');

    assert.equal(m1?.total_escalas_ano, 1);
    assert.equal(m2?.total_escalas_ano, 0);
    assert.equal(m2?.is_menos_escalado, true, 'min-02 com 0 escalas deve receber o indicador is_menos_escalado');
  });
});
