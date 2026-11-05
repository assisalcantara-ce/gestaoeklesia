import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DiscipuladoService } from '../../src/services/discipulado-service.ts';

describe('REGRA DEFINITIVA: Início de Jornada por Congregado Existente em members', () => {
  const fakeMinistryId = '00000000-0000-0000-0000-000000000001';
  const fakeMemberId = '11111111-1111-1111-1111-111111111111';

  test('1. Rejeita início de jornada se memberId for nulo ou vazio', async () => {
    await assert.rejects(
      async () => {
        await DiscipuladoService.iniciarJornadaParaCongregado({} as any, {
          ministryId: fakeMinistryId,
          memberId: '',
        });
      },
      {
        message: 'O congregado selecionado é obrigatório.',
      }
    );
  });

  test('2. Rejeita se o membro não for localizado ou pertencer a outro ministério', async () => {
    const mockSupabase = {
      from: (table: string) => {
        assert.strictEqual(table, 'members');
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: { message: 'Not found' } }),
              }),
            }),
          }),
        };
      },
    };

    await assert.rejects(
      async () => {
        await DiscipuladoService.iniciarJornadaParaCongregado(mockSupabase as any, {
          ministryId: fakeMinistryId,
          memberId: fakeMemberId,
        });
      },
      {
        message: 'Congregado não encontrado ou não pertence a este ministério.',
      }
    );
  });

  test('3. Rejeita início se o registro do membro NÃO tiver tipo_cadastro = "congregado"', async () => {
    const mockSupabase = {
      from: (_table: string) => {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: fakeMemberId,
                    name: 'Pastor João Silva',
                    tipo_cadastro: 'ministro',
                    congregacao_id: null,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      },
    };

    await assert.rejects(
      async () => {
        await DiscipuladoService.iniciarJornadaParaCongregado(mockSupabase as any, {
          ministryId: fakeMinistryId,
          memberId: fakeMemberId,
        });
      },
      {
        message: 'Apenas congregados podem ser acolhidos no Discipulado. O registro atual deste membro é: MINISTRO.',
      }
    );
  });

  test('4. Bloqueia duplicidade se o congregado já possuir jornada com status "ativo"', async () => {
    const mockSupabase = {
      from: (table: string) => {
        if (table === 'members') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: fakeMemberId,
                      name: 'Novo Decidido Carlos',
                      tipo_cadastro: 'congregado',
                      congregacao_id: null,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'discipulado_jornadas') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: {
                        id: 'jornada-ativa-existente',
                        fase: 'primeiros_passos',
                        status: 'ativo',
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`Tabela inesperada: ${table}`);
      },
    };

    await assert.rejects(
      async () => {
        await DiscipuladoService.iniciarJornadaParaCongregado(mockSupabase as any, {
          ministryId: fakeMinistryId,
          memberId: fakeMemberId,
        });
      },
      {
        message:
          'Este congregado já possui uma jornada de discipulado ATIVA em andamento (Fase: primeiros_passos). Não é permitida duplicidade.',
      }
    );
  });

  test('5. Inicia a jornada com sucesso vinculando ao member_id SEM alterar membresia ou tocar em visitantes', async () => {
    let jornadaInserida: any = null;

    const mockSupabase = {
      from: (table: string) => {
        if (table === 'members') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: fakeMemberId,
                      name: 'Irmã Maria Congregada',
                      tipo_cadastro: 'congregado',
                      congregacao_id: 'cong-sede-01',
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'discipulado_jornadas') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
            insert: (payload: any) => {
              jornadaInserida = payload;
              return {
                select: () => ({
                  single: async () => ({ data: { id: 'nova-jornada-123' }, error: null }),
                }),
              };
            },
          };
        }
        throw new Error(`Tabela inesperada: ${table}`);
      },
    };

    const res = await DiscipuladoService.iniciarJornadaParaCongregado(mockSupabase as any, {
      ministryId: fakeMinistryId,
      memberId: fakeMemberId,
      dataDecisao: '2026-11-05',
      observacoes: 'Decisão no culto de celebração',
    });

    assert.strictEqual(res.sucesso, true);
    assert.strictEqual(res.memberId, fakeMemberId);
    assert.strictEqual(res.jornadaId, 'nova-jornada-123');
    assert.strictEqual(res.isNovoMember, false);
    assert.strictEqual(res.tipoCadastroFinal, 'congregado');
    assert.strictEqual(res.visitanteVinculado, false);

    assert.deepStrictEqual(jornadaInserida, {
      ministry_id: fakeMinistryId,
      congregacao_id: 'cong-sede-01',
      member_id: fakeMemberId,
      responsavel_id: null,
      origem: 'culto',
      fase: 'primeiros_passos',
      status: 'ativo',
      data_decisao: '2026-11-05',
      data_inicio: new Date().toISOString().slice(0, 10),
      observacoes: 'Decisão no culto de celebração',
    });
  });
});
