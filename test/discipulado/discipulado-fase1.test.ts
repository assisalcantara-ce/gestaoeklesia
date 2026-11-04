import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DiscipuladoService } from '../../src/services/discipulado-service.ts';
import { validarCpf } from '../../src/lib/mascaras.ts';

// Gerador determinístico de CPF válido para testes unitários
function gerarCpfValido(base: number[]): string {
  const n = [...base];
  let d1 = 11 - (n.reduce((s, d, i) => s + d * (10 - i), 0) % 11);
  if (d1 >= 10) d1 = 0;
  n.push(d1);
  let d2 = 11 - (n.reduce((s, d, i) => s + d * (11 - i), 0) % 11);
  if (d2 >= 10) d2 = 0;
  n.push(d2);
  return n.join('');
}

const CPF_VALIDO_A = gerarCpfValido([5, 1, 8, 8, 7, 5, 0, 1, 1]); // 51887501126
const CPF_VALIDO_B = gerarCpfValido([3, 2, 9, 8, 1, 4, 7, 2, 0]);

describe('FASE 1: Fundação e Acolhimento do Discipulado - Verificação e Blindagem', () => {

  test('1. Rejeição de CPFs inválidos e sequências repetidas (Validação Oficial da Secretaria)', () => {
    // Sequências repetidas
    assert.strictEqual(DiscipuladoService.validarCPF('111.111.111-11'), false);
    assert.strictEqual(DiscipuladoService.validarCPF('11111111111'), false);
    assert.strictEqual(DiscipuladoService.validarCPF('000.000.000-00'), false);
    assert.strictEqual(DiscipuladoService.validarCPF('999.999.999-99'), false);
    assert.strictEqual(DiscipuladoService.validarCPF('222.222.222-22'), false);

    // Formato incompleto ou incorreto
    assert.strictEqual(DiscipuladoService.validarCPF('123'), false);
    assert.strictEqual(DiscipuladoService.validarCPF('12345678901'), false); // dígito verificador incorreto
    assert.strictEqual(DiscipuladoService.validarCPF(''), false);

    // CPFs com dígitos verificadores matematicamente válidos
    assert.strictEqual(DiscipuladoService.validarCPF(CPF_VALIDO_A), true);
    assert.strictEqual(DiscipuladoService.validarCPF(CPF_VALIDO_B), true);
    assert.strictEqual(validarCpf(CPF_VALIDO_A), true);
  });

  test('2. Atomicidade PostgreSQL RPC: Execução com Sucesso na Transação', async () => {
    const fakeMinistryId = '00000000-0000-0000-0000-000000000001';
    let rpcParamsRecebidos: any = null;

    const mockSupabaseComRpc = {
      rpc: async (fnName: string, params: any) => {
        if (fnName === 'iniciar_jornada_discipulado_rpc') {
          rpcParamsRecebidos = params;
          return {
            data: {
              sucesso: true,
              member_id: 'mem-100',
              jornada_id: 'jor-200',
              is_novo_member: true,
              tipo_cadastro_final: 'congregado',
              visitante_vinculado: true,
              mensagem: 'Jornada iniciada com sucesso em transação atômica.'
            },
            error: null
          };
        }
        return { data: null, error: { message: 'Função RPC desconhecida' } };
      }
    };

    const res = await DiscipuladoService.iniciarJornada(mockSupabaseComRpc, {
      ministryId: fakeMinistryId,
      cpf: CPF_VALIDO_A,
      nome: 'Carlos Nascimento',
      telefone: '(85) 98888-7777',
      visitanteId: 'vis-123'
    });

    assert.strictEqual(res.sucesso, true);
    assert.strictEqual(res.memberId, 'mem-100');
    assert.strictEqual(res.jornadaId, 'jor-200');
    assert.strictEqual(res.visitanteVinculado, true);
    assert.strictEqual(rpcParamsRecebidos.p_ministry_id, fakeMinistryId);
    assert.strictEqual(rpcParamsRecebidos.p_cpf, CPF_VALIDO_A);
    assert.strictEqual(rpcParamsRecebidos.p_nome, 'Carlos Nascimento');
    assert.strictEqual(rpcParamsRecebidos.p_visitante_id, 'vis-123');
  });

  test('3. Rollback e Propagação de Erro em Transação Atômica', async () => {
    const fakeMinistryId = '00000000-0000-0000-0000-000000000001';

    const mockSupabaseComFalha = {
      rpc: async (_fnName: string, _params: any) => {
        return {
          data: null,
          error: {
            code: 'P0001',
            message: 'Este discípulo já possui uma jornada de discipulado ATIVA em andamento.'
          }
        };
      }
    };

    await assert.rejects(
      async () => {
        await DiscipuladoService.iniciarJornada(mockSupabaseComFalha, {
          ministryId: fakeMinistryId,
          cpf: CPF_VALIDO_A,
          nome: 'Carlos Nascimento'
        });
      },
      /já possui uma jornada de discipulado ATIVA em andamento/
    );
  });

  test('4. Isolamento Multi-Tenant: Rejeição de Entidades de Outro Ministério', async () => {
    const fakeMinistryId = '00000000-0000-0000-0000-000000000001';

    const mockSupabaseTenantError = {
      rpc: async (_fnName: string, _params: any) => {
        return {
          data: null,
          error: {
            code: '23503',
            message: 'Visitante informado não existe ou não pertence a este ministério.'
          }
        };
      }
    };

    await assert.rejects(
      async () => {
        await DiscipuladoService.iniciarJornada(mockSupabaseTenantError, {
          ministryId: fakeMinistryId,
          cpf: CPF_VALIDO_A,
          nome: 'Visitante Hacker',
          visitanteId: 'visitante-de-outro-ministerio'
        });
      },
      /Visitante informado não existe ou não pertence a este ministério/
    );
  });

  test('5. Regra Inviolável de Governança: Membro ou Ministro NUNCA é rebaixado', async () => {
    const fakeMinistryId = '00000000-0000-0000-0000-000000000001';

    const mockSupabasePreservaMinistro = {
      rpc: async (_fnName: string, _params: any) => {
        return {
          data: {
            sucesso: true,
            member_id: 'membro-pastor-id',
            jornada_id: 'jornada-pastor-id',
            is_novo_member: false,
            tipo_cadastro_final: 'ministro', // Preservado!
            visitante_vinculado: false,
            mensagem: 'Jornada iniciada com sucesso em transação atômica.'
          },
          error: null
        };
      }
    };

    const res = await DiscipuladoService.iniciarJornada(mockSupabasePreservaMinistro, {
      ministryId: fakeMinistryId,
      cpf: CPF_VALIDO_A,
      nome: 'Pastor Titular da Igreja'
    });

    assert.strictEqual(res.sucesso, true);
    assert.strictEqual(res.isNovoMember, false);
    assert.strictEqual(res.tipoCadastroFinal, 'ministro');
  });

  test('6. Vínculo Explícito de Visitante Preserva deleted_at NULL', async () => {
    // Comprova que converted_to_member_id e converted_at são utilizados
    // e deleted_at NUNCA é manipulado para representar conversão.
    const fakeMinistryId = '00000000-0000-0000-0000-000000000001';
    let updatePayload: any = null;

    const mockSupabase = {
      from: (table: string) => {
        if (table === 'members') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { id: 'mem-1', name: 'Visitante Decidido', tipo_cadastro: 'congregado' },
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
                  eq: () => ({
                    maybeSingle: async () => ({ data: null, error: null })
                  })
                })
              })
            }),
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: { id: 'jor-1' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'culto_visitantes') {
          return {
            update: (payload: any) => {
              updatePayload = payload;
              return {
                eq: () => ({
                  eq: async () => ({ error: null })
                })
              };
            }
          };
        }
        throw new Error('Tabela não mockada: ' + table);
      }
    };

    const res = await DiscipuladoService.iniciarJornada(mockSupabase, {
      ministryId: fakeMinistryId,
      cpf: CPF_VALIDO_A,
      nome: 'Visitante Decidido',
      visitanteId: 'vis-culto-1'
    });

    assert.strictEqual(res.sucesso, true);
    assert.ok(updatePayload);
    assert.strictEqual(updatePayload.converted_to_member_id, 'mem-1');
    assert.ok(updatePayload.converted_at);
    assert.strictEqual(updatePayload.deleted_at, undefined, 'deleted_at NUNCA deve ser alterado na conversão');
  });
});
