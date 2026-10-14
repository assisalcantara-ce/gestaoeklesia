import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { PresidenciaService } from '../src/services/presidencia-service.js';
import type { UserContextAuth } from '../src/services/dirigentes-service.js';

describe('Presidência — Central de Decisões Institucionais, Governança e Fila Unificada', () => {
  const ministryAlpha = '11111111-1111-1111-1111-111111111111';
  const ministryBeta = '22222222-2222-2222-2222-222222222222';

  const userPresidencia: UserContextAuth = {
    userId: 'user-pres-1',
    userName: 'Pastor Presidente da Silva',
    ministryId: ministryAlpha,
    nivel: 'presidencia',
    isAdmin: false,
  };

  const userAdmin: UserContextAuth = {
    userId: 'user-adm-1',
    userName: 'Administrador Geral',
    ministryId: ministryAlpha,
    nivel: 'administrador',
    isAdmin: true,
  };

  const userSecretaria: UserContextAuth = {
    userId: 'user-sec-1',
    userName: 'Secretário Executivo',
    ministryId: ministryAlpha,
    nivel: 'secretario_geral',
    isAdmin: false,
  };

  const userOperador: UserContextAuth = {
    userId: 'user-op-1',
    userName: 'Operador Local',
    ministryId: ministryAlpha,
    nivel: 'operador',
    isAdmin: false,
  };

  test('1. RBAC Institucional: Apenas Presidência ou Administrador possuem autoridade na Central de Decisões', () => {
    assert.equal(PresidenciaService.isPresidenciaOuAdmin(userPresidencia), true);
    assert.equal(PresidenciaService.isPresidenciaOuAdmin(userAdmin), true);
    assert.equal(PresidenciaService.isPresidenciaOuAdmin(userSecretaria), false);
    assert.equal(PresidenciaService.isPresidenciaOuAdmin(userOperador), false);
  });

  test('2. Isolamento Multi-tenant estrito: impede decisões ou consultas cruzadas entre ministérios', () => {
    assert.doesNotThrow(() => {
      PresidenciaService.validarTenant(ministryAlpha, ministryAlpha);
    });

    assert.throws(
      () => {
        PresidenciaService.validarTenant(ministryAlpha, ministryBeta);
      },
      {
        message: /Violação de segurança multi-tenant/,
      }
    );
  });

  test('3. Agregação da Fila Unificada e Indicadores Reais: unifica propostas de dirigentes e cartas ministeriais', async () => {
    // Mock Supabase Client com movimentações de dirigentes e cartas de pedidos
    const mockSupabase = {
      from: (tabela: string) => {
        if (tabela === 'congregacoes') {
          return {
            select: () => ({
              eq: (col: string, val: string) => {
                assert.equal(col, 'ministry_id');
                assert.equal(val, ministryAlpha);
                return Promise.resolve({
                  data: [
                    { id: 'cong-1', nome: 'Congregação Central' },
                    { id: 'cong-2', nome: 'Congregação Monte Sinai' },
                  ],
                  error: null,
                });
              },
            }),
          };
        }

        if (tabela === 'dirigentes_movimentacoes') {
          return {
            select: () => ({
              eq: (col: string, val: string) => {
                assert.equal(col, 'ministry_id');
                assert.equal(val, ministryAlpha);
                return {
                  in: (_statusCol: string, statuses: string[]) => {
                    assert.deepEqual(statuses, ['proposta', 'aprovada']);
                    return {
                      order: () =>
                        Promise.resolve({
                          data: [
                            {
                              id: 'mov-1',
                              ministry_id: ministryAlpha,
                              tipo_movimentacao: 'transferencia_extraordinaria',
                              status: 'proposta',
                              congregacao_destino_id: 'cong-1',
                              dirigente_novo_nome: 'Evangelista Marcos',
                              dirigente_novo_cargo: 'Evangelista',
                              solicitante_nome: 'Secretaria Geral',
                              solicitante_user_id: 'user-sec-1',
                              motivo: 'Substituição por transferência',
                              data_prevista: '2026-11-01',
                              created_at: '2026-10-14T10:00:00Z',
                              requer_termo_patrimonial: true,
                              status_conferencia_patrimonial: 'pendente',
                            },
                            {
                              id: 'mov-2',
                              ministry_id: ministryAlpha,
                              tipo_movimentacao: 'rodizio_anual',
                              status: 'aprovada',
                              congregacao_destino_id: 'cong-2',
                              dirigente_novo_nome: 'Pastor João',
                              dirigente_novo_cargo: 'Pastor',
                              solicitante_nome: 'Secretaria Geral',
                              solicitante_user_id: 'user-sec-1',
                              motivo: 'Rodízio ministerial',
                              data_prevista: '2026-10-20',
                              created_at: '2026-10-10T10:00:00Z',
                              requer_termo_patrimonial: false,
                              status_conferencia_patrimonial: 'nao_se_aplica',
                            },
                          ],
                          error: null,
                        }),
                    };
                  },
                };
              },
            }),
          };
        }

        if (tabela === 'carta_pedidos') {
          return {
            select: () => ({
              eq: (_c1: string, _v1: string) => ({
                eq: (statusCol: string, statusVal: string) => {
                  assert.equal(statusCol, 'status');
                  assert.equal(statusVal, 'pendente');
                  return {
                    order: () =>
                      Promise.resolve({
                        data: [
                          {
                            id: 'carta-1',
                            ministry_id: ministryAlpha,
                            congregacao_id: 'cong-1',
                            membro_nome: 'Diácono Lucas',
                            membro_cargo: 'Diácono',
                            tipo_carta: 'mudanca',
                            destino: 'Igreja Central de Curitiba',
                            solicitante_nome: 'Secretaria Local',
                            solicitante_id: 'user-op-1',
                            observacoes: 'Mudança de estado a trabalho',
                            status: 'pendente',
                            created_at: '2026-10-14T11:00:00Z',
                          },
                          {
                            id: 'carta-2',
                            ministry_id: ministryAlpha,
                            congregacao_id: 'cong-2',
                            membro_nome: 'Irmão Pedro',
                            membro_cargo: 'Membro',
                            tipo_carta: 'desligamento',
                            destino: null,
                            solicitante_nome: 'Secretaria Local',
                            solicitante_id: 'user-op-1',
                            observacoes: 'Solicitação pessoal de desligamento',
                            status: 'pendente',
                            created_at: '2026-10-13T09:00:00Z',
                          },
                        ],
                        error: null,
                      }),
                  };
                },
              }),
            }),
          };
        }

        if (tabela === 'dirigentes_designacoes') {
          return {
            select: () => ({
              eq: (_c1: string, _v1: string) => ({
                eq: (_c2: string, _v2: string) =>
                  Promise.resolve({ count: 12, error: null }),
              }),
            }),
          };
        }

        throw new Error(`Tabela não mockada: ${tabela}`);
      },
    };

    const { fila, resumo } = await PresidenciaService.carregarCentralDecisoes(
      mockSupabase,
      ministryAlpha
    );

    // 1. Resumo Real
    assert.equal(resumo.totalPendencias, 4);
    assert.equal(resumo.dirigentesPropostas, 1);
    assert.equal(resumo.dirigentesAprovadosAguardandoPosse, 1);
    assert.equal(resumo.cartasMudanca, 1);
    assert.equal(resumo.cartasDesligamento, 1);
    assert.equal(resumo.outrasCartas, 0);
    assert.equal(resumo.totalLiderancasAtivas, 12);

    // 2. Fila Unificada mapeada
    assert.equal(fila.length, 4);

    // O processo mais recente deve vir primeiro (ordenado por created_at)
    assert.equal(fila[0].id, 'carta-1');
    assert.equal(fila[0].tipoCategoria, 'carta_mudanca');
    assert.equal(fila[0].tipoLabel, 'Carta Ministerial de Mudança');
    assert.equal(fila[0].pessoaNome, 'Diácono Lucas');
    assert.equal(fila[0].congregacaoNome, 'Congregação Central');
    assert.equal(fila[0].acaoRequerida, 'Autorizar / Assinar Carta');

    // Movimentação em proposta
    const movProposta = fila.find((f) => f.id === 'mov-1');
    assert.ok(movProposta);
    assert.equal(movProposta.tipoCategoria, 'dirigente');
    assert.equal(movProposta.statusLabel, 'Proposta em Análise');
    assert.equal(movProposta.acaoRequerida, 'Deliberar Proposta');

    // Movimentação aprovada
    const movAprovada = fila.find((f) => f.id === 'mov-2');
    assert.ok(movAprovada);
    assert.equal(movAprovada.statusLabel, 'Aprovada — Aguardando Efetivação');
    assert.equal(movAprovada.acaoRequerida, 'Efetivar Posse');
  });

  test('4. Deliberação de Proposta: Aprovação da Presidência não altera líder nem efetiva antecipadamente', async () => {
    let updateChamado = false;
    const mockSupabase = {
      from: (tabela: string) => {
        if (tabela === 'dirigentes_movimentacoes') {
          return {
            select: () => ({
              eq: (_col: string, _val: string) => ({
                eq: (_c2: string, _v2: string) => ({
                  single: () =>
                    Promise.resolve({
                      data: {
                        id: 'mov-10',
                        ministry_id: ministryAlpha,
                        status: 'proposta',
                      },
                      error: null,
                    }),
                }),
              }),
            }),
            update: (payload: any) => {
              updateChamado = true;
              assert.equal(payload.status, 'aprovada');
              assert.equal(payload.aprovador_user_id, userPresidencia.userId);
              assert.equal(payload.aprovador_nome, userPresidencia.userName);
              return {
                eq: (_c1: string, _v1: string) => ({
                  eq: (_c2: string, _v2: string) => ({
                    select: () => ({
                      single: () =>
                        Promise.resolve({
                          data: { id: 'mov-10', status: 'aprovada' },
                          error: null,
                        }),
                    }),
                  }),
                }),
              };
            },
          };
        }
        throw new Error(`Tabela inesperada: ${tabela}`);
      },
    };

    const res = await PresidenciaService.deliberarPropostaDirigente(mockSupabase, userPresidencia, {
      movimentacaoId: 'mov-10',
      decisao: 'aprovar',
      justificativa: 'Aprovado pelo conselho presidencial',
    });

    assert.equal(updateChamado, true);
    assert.equal(res.status, 'aprovada');
  });

  test('5. Deliberação de Proposta: Rejeição exige justificativa institucional obrigatória', async () => {
    const mockSupabase = {};

    // Falha sem justificativa
    await assert.rejects(
      async () => {
        await PresidenciaService.deliberarPropostaDirigente(mockSupabase, userPresidencia, {
          movimentacaoId: 'mov-10',
          decisao: 'rejeitar',
          justificativa: '   ',
        });
      },
      {
        message: /O motivo da rejeição da proposta é obrigatório/,
      }
    );
  });

  test('6. Deliberação de Cartas Ministeriais: Autorização registra assinatura e aprovador no banco', async () => {
    let updateChamado = false;
    const mockSupabase = {
      from: (tabela: string) => {
        assert.equal(tabela, 'carta_pedidos');
        return {
          select: () => ({
            eq: (_c1: string, val1: string) => ({
              eq: (_c2: string, val2: string) => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: val1,
                      ministry_id: val2,
                      status: 'pendente',
                    },
                    error: null,
                  }),
              }),
            }),
          }),
          update: (payload: any) => {
            updateChamado = true;
            assert.equal(payload.status, 'autorizado');
            assert.equal(payload.autorizador_id, userPresidencia.userId);
            assert.equal(payload.autorizador_nome, userPresidencia.userName);
            assert.ok(payload.data_autorizacao);
            return {
              eq: (_c1: string, _v1: string) => ({
                eq: (_c2: string, _v2: string) => ({
                  select: () => ({
                    single: () =>
                      Promise.resolve({
                        data: { id: 'carta-5', status: 'autorizado' },
                        error: null,
                      }),
                  }),
                }),
              }),
            };
          },
        };
      },
    };

    const res = await PresidenciaService.deliberarCartaPedido(mockSupabase, userPresidencia, {
      pedido_id: 'carta-5',
      decisao: 'autorizar',
    });

    assert.equal(updateChamado, true);
    assert.equal(res.status, 'autorizado');
  });

  test('7. Deliberação de Cartas: Indeferimento exige justificativa formal e impede deliberação em carta já julgada', async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: 'carta-6',
                    ministry_id: ministryAlpha,
                    status: 'autorizado', // já deliberada
                  },
                  error: null,
                }),
            }),
          }),
        }),
      }),
    };

    // 1. Tentar deliberar carta que já está autorizada
    await assert.rejects(
      async () => {
        await PresidenciaService.deliberarCartaPedido(mockSupabase, userPresidencia, {
          pedido_id: 'carta-6',
          decisao: 'autorizar',
        });
      },
      {
        message: /já se encontra autorizado/,
      }
    );

    // 2. Tentar rejeitar sem motivo
    const mockSupabasePendente = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: 'carta-7',
                    ministry_id: ministryAlpha,
                    status: 'pendente',
                  },
                  error: null,
                }),
            }),
          }),
        }),
      }),
    };

    await assert.rejects(
      async () => {
        await PresidenciaService.deliberarCartaPedido(mockSupabasePendente, userPresidencia, {
          pedido_id: 'carta-7',
          decisao: 'rejeitar',
          motivo_rejeicao: '',
        });
      },
      {
        message: /O motivo do indeferimento da carta é obrigatório/,
      }
    );
  });

  test('8. Histórico de Resoluções: Carrega movimentações e cartas concluídas/indeferidas ordenadas', async () => {
    const mockSupabase = {
      from: (tabela: string) => {
        if (tabela === 'congregacoes') {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [{ id: 'cong-1', nome: 'Sede' }],
                  error: null,
                }),
            }),
          };
        }
        if (tabela === 'dirigentes_movimentacoes') {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  order: () => ({
                    limit: () =>
                      Promise.resolve({
                        data: [
                          {
                            id: 'mov-hist-1',
                            status: 'efetivada',
                            tipo_movimentacao: 'rodizio_anual',
                            dirigente_novo_nome: 'Pastor Barnabé',
                            congregacao_destino_id: 'cong-1',
                            created_at: '2026-09-01T00:00:00Z',
                            data_efetiva: '2026-09-05',
                            updated_at: '2026-09-05T15:00:00Z',
                          },
                        ],
                        error: null,
                      }),
                  }),
                }),
              }),
            }),
          };
        }
        if (tabela === 'carta_pedidos') {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  order: () => ({
                    limit: () =>
                      Promise.resolve({
                        data: [
                          {
                            id: 'carta-hist-1',
                            status: 'autorizado',
                            tipo_carta: 'mudanca',
                            membro_nome: 'Irmã Maria',
                            congregacao_id: 'cong-1',
                            created_at: '2026-09-10T00:00:00Z',
                            updated_at: '2026-09-11T12:00:00Z',
                          },
                        ],
                        error: null,
                      }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`Tabela inesperada: ${tabela}`);
      },
    };

    const historico = await PresidenciaService.carregarHistoricoDecisoes(
      mockSupabase,
      ministryAlpha
    );

    assert.equal(historico.length, 2);
    // Mais recente primeiro (carta-hist-1 foi updated em 11 de setembro, mov-hist-1 em 5 de setembro)
    assert.equal(historico[0].id, 'carta-hist-1');
    assert.equal(historico[0].statusLabel, 'Autorizada / Assinada');
    assert.equal(historico[1].id, 'mov-hist-1');
    assert.equal(historico[1].statusLabel, 'Efetivada / Posse Homologada');
  });
});
