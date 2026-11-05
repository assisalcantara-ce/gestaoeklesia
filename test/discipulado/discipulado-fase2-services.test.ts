import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DiscipuladoPedagogicoService } from '../../src/services/discipulado-pedagogico-service.ts';

describe('FASE 2.2: Camada de Serviços e APIs do Discipulado — Verificação e Blindagem', () => {
  const fakeMinistryId = '00000000-0000-0000-0000-000000000001';
  const fakeTurmaId = '11111111-1111-1111-1111-111111111111';
  const fakeJornadaId = '22222222-2222-2222-2222-222222222222';
  const fakeMemberId = '33333333-3333-3333-3333-333333333333';
  const fakeLicaoId = '44444444-4444-4444-4444-444444444444';
  const fakeProfId = '55555555-5555-5555-5555-555555555555';

  test('1. Consulta do Catálogo CPAD: Retorna as 26 lições canônicas ordenadas', async () => {
    const mockSupabase = {
      from: (table: string) => {
        assert.strictEqual(table, 'discipulado_licoes');
        return {
          select: () => ({
            eq: (_field: string, val: boolean) => {
              assert.strictEqual(val, true);
              return {
                order: (_col: string, _opts: any) => ({
                  data: Array.from({ length: 26 }, (_, i) => ({
                    id: `lic-${i + 1}`,
                    volume: i < 13 ? 1 : 2,
                    numero: i + 1,
                    identificador_referencia: `VOL${i < 13 ? 1 : 2}-LIC${String(i + 1).padStart(2, '0')}`,
                    titulo_padrao: `Lição ${String(i + 1).padStart(2, '0')} - Volume ${i < 13 ? 1 : 2}`,
                    titulo_validado: false,
                    ativo: true
                  })),
                  error: null
                })
              };
            }
          })
        };
      }
    };

    const licoes = await DiscipuladoPedagogicoService.listarCatalogoLicoes(mockSupabase);
    assert.strictEqual(licoes.length, 26);
    assert.strictEqual(licoes[0].numero, 1);
    assert.strictEqual(licoes[0].volume, 1);
    assert.strictEqual(licoes[25].numero, 26);
    assert.strictEqual(licoes[25].volume, 2);
  });

  test('2. Matrícula com Isolamento Multi-tenant e Prevenção de Invasão de Tenant', async () => {
    // Cenário onde o aluno/jornada pertence a OUTRO ministério
    const mockSupabaseTenantInvalido = {
      from: (table: string) => {
        if (table === 'discipulado_turmas') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({
                    data: { id: fakeTurmaId, ministry_id: fakeMinistryId, status: 'ativa' },
                    error: null
                  })
                })
              })
            })
          };
        }
        if (table === 'discipulado_jornadas') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({
                    data: null, // Não encontra no ministério fornecido
                    error: { message: 'Not found' }
                  })
                })
              })
            })
          };
        }
        return {};
      }
    };

    await assert.rejects(
      async () => {
        await DiscipuladoPedagogicoService.matricularAluno(
          mockSupabaseTenantInvalido,
          fakeMinistryId,
          fakeTurmaId,
          'jornada-outro-tenant'
        );
      },
      /Jornada de discipulado informada não existe ou pertence a outro ministério/
    );
  });

  test('3. Matrícula Regular Registra Evento no Histórico Auditável', async () => {
    let eventoHistoricoRegistrado: any = null;

    const mockSupabase = {
      from: (table: string) => {
        if (table === 'discipulado_turmas') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({
                    data: { id: fakeTurmaId, ministry_id: fakeMinistryId, status: 'ativa', capacidade: 30 },
                    error: null
                  })
                })
              })
            })
          };
        }
        if (table === 'discipulado_jornadas') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({
                    data: { id: fakeJornadaId, ministry_id: fakeMinistryId, member_id: fakeMemberId, status: 'ativo' },
                    error: null
                  })
                })
              })
            })
          };
        }
        if (table === 'discipulado_turma_alunos') {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: { id: 'mat-100' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'discipulado_turma_historico') {
          return {
            insert: async (payload: any) => {
              eventoHistoricoRegistrado = payload;
              return { data: null, error: null };
            }
          };
        }
        return {};
      }
    };

    const res = await DiscipuladoPedagogicoService.matricularAluno(
      mockSupabase,
      fakeMinistryId,
      fakeTurmaId,
      fakeJornadaId
    );

    assert.strictEqual(res.sucesso, true);
    assert.strictEqual(res.matriculaId, 'mat-100');
    assert.ok(eventoHistoricoRegistrado);
    assert.strictEqual(eventoHistoricoRegistrado.tipo_evento, 'matricula_inicial');
    assert.strictEqual(eventoHistoricoRegistrado.matricula_id, 'mat-100');
  });

  test('4. Registro de Aula com Chamada e Presença Segregada da Conclusão Pedagógica', async () => {
    let rpcArgsRecebidos: any = null;

    const mockSupabase = {
      rpc: async (fnName: string, args: any) => {
        if (fnName === 'registrar_aula_e_chamada_turma_rpc') {
          rpcArgsRecebidos = args;
          return {
            data: {
              sucesso: true,
              aula_id: 'aula-500',
              status_aula: args.p_status_aula,
              presentes: 2,
              validadas_pedagogicamente: args.p_validar_pedagogico_presentes ? 2 : 0,
              mensagem: 'Diário de classe e frequência processados com segurança.'
            },
            error: null
          };
        }
        return { data: null, error: { message: 'RPC não encontrada' } };
      }
    };

    // Caso 1: Chamada pura SEM validação pedagógica automática
    const resChamadaPura = await DiscipuladoPedagogicoService.registrarAulaEChamada(mockSupabase, {
      turmaId: fakeTurmaId,
      licaoId: fakeLicaoId,
      professorId: fakeProfId,
      dataAula: '2026-11-05',
      statusAula: 'realizada',
      chamadas: [
        { jornada_id: fakeJornadaId, member_id: fakeMemberId, status: 'presente' },
        { jornada_id: 'jor-2', member_id: 'mem-2', status: 'ausente', justificativa: 'Viagem de trabalho' }
      ],
      validarPedagogicoPresentes: false
    });

    assert.strictEqual(resChamadaPura.presentes, 2);
    assert.strictEqual(resChamadaPura.validadas_pedagogicamente, 0); // Presença NÃO validou lição automaticamente!
    assert.strictEqual(rpcArgsRecebidos.p_validar_pedagogico_presentes, false);

    // Caso 2: Chamada COM validação pedagógica autorizada pelo professor
    const resChamadaComValidacao = await DiscipuladoPedagogicoService.registrarAulaEChamada(mockSupabase, {
      turmaId: fakeTurmaId,
      licaoId: fakeLicaoId,
      professorId: fakeProfId,
      dataAula: '2026-11-05',
      statusAula: 'realizada',
      chamadas: [
        { jornada_id: fakeJornadaId, member_id: fakeMemberId, status: 'presente' }
      ],
      validarPedagogicoPresentes: true
    });

    assert.strictEqual(resChamadaComValidacao.validadas_pedagogicamente, 2);
    assert.strictEqual(rpcArgsRecebidos.p_validar_pedagogico_presentes, true);
  });

  test('5. Validação Pedagógica Individual / Reposição de Lição Invoca RPC Atômica', async () => {
    let rpcArgsRecebidos: any = null;

    const mockSupabase = {
      rpc: async (fnName: string, args: any) => {
        if (fnName === 'validar_licao_individual_rpc') {
          rpcArgsRecebidos = args;
          return {
            data: {
              sucesso: true,
              progresso_id: 'prog-999',
              jornada_id: args.p_jornada_id,
              licao_id: args.p_licao_id,
              mensagem: 'Lição validada pedagogicamente com sucesso.'
            },
            error: null
          };
        }
        return { data: null, error: { message: 'RPC não encontrada' } };
      }
    };

    const res = await DiscipuladoPedagogicoService.validarLicaoIndividual(mockSupabase, {
      jornadaId: fakeJornadaId,
      licaoId: fakeLicaoId,
      validadorId: fakeProfId,
      modalidade: 'reposicao_individual',
      dataValidacao: '2026-11-05',
      aproveitamentoNota: 9.5,
      observacoes: 'Excelente compreensão dos conceitos.'
    });

    assert.strictEqual(res.sucesso, true);
    assert.strictEqual(res.progresso_id, 'prog-999');
    assert.strictEqual(rpcArgsRecebidos.p_modalidade, 'reposicao_individual');
    assert.strictEqual(rpcArgsRecebidos.p_nota, 9.5);
  });

  test('6. Transição de Turma Registra Encerramento da Matrícula Anterior e Criação da Nova', async () => {
    let matriculaAtualizada: any = null;
    let novaMatriculaCriada: any = null;
    let historicoRegistrado: any = null;

    const mockSupabase = {
      from: (table: string) => {
        if (table === 'discipulado_turma_alunos') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: 'mat-old',
                      ministry_id: fakeMinistryId,
                      turma_id: fakeTurmaId,
                      jornada_id: fakeJornadaId,
                      member_id: fakeMemberId,
                      status: 'ativo'
                    },
                    error: null
                  })
                })
              })
            }),
            update: (payload: any) => ({
              eq: (_f: string, id: string) => {
                matriculaAtualizada = { id, ...payload };
                return Promise.resolve({ error: null });
              }
            }),
            insert: (payload: any) => ({
              select: () => ({
                single: async () => {
                  novaMatriculaCriada = payload;
                  return { data: { id: 'mat-nova' }, error: null };
                }
              })
            })
          };
        }
        if (table === 'discipulado_turmas') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({
                    data: { id: 'turma-destino-id', ministry_id: fakeMinistryId, status: 'ativa' },
                    error: null
                  })
                })
              })
            })
          };
        }
        if (table === 'discipulado_turma_historico') {
          return {
            insert: async (payload: any) => {
              historicoRegistrado = payload;
              return { data: null, error: null };
            }
          };
        }
        return {};
      }
    };

    const res = await DiscipuladoPedagogicoService.transferirTurma(
      mockSupabase,
      fakeMinistryId,
      'mat-old',
      'turma-destino-id',
      'Mudança de congregação/horário'
    );

    assert.strictEqual(res.sucesso, true);
    assert.strictEqual(res.novaMatriculaId, 'mat-nova');
    assert.strictEqual(matriculaAtualizada.status, 'transferido');
    assert.strictEqual(novaMatriculaCriada.status, 'ativo');
    assert.strictEqual(historicoRegistrado.tipo_evento, 'transferencia');
    assert.strictEqual(historicoRegistrado.turma_origem_id, fakeTurmaId);
    assert.strictEqual(historicoRegistrado.turma_destino_id, 'turma-destino-id');
  });

});
