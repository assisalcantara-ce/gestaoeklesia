import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { CelulasService } from '../../src/services/celulas-service';

function createMockSupabase(dbState: any) {
  return {
    rpc: async (fnName: string, args: any) => {
      if (fnName === 'registrar_chamada_rapida_celula') {
        const tokenRow = (dbState.celulas_chamada_tokens || []).find(
          (t: any) => t.token_hash === args.p_token_hash
        );
        if (!tokenRow) {
          return { data: null, error: { code: 'P0002', message: 'Link de chamada rápida não encontrado ou inválido.' } };
        }
        if (tokenRow.status === 'revogado') {
          return { data: null, error: { code: '22023', message: 'Este link de chamada foi revogado.' } };
        }
        if (tokenRow.status === 'finalizado') {
          return { data: null, error: { code: '22023', message: 'Esta chamada já foi finalizada e não pode ser reenviada pelo link.' } };
        }
        if (new Date(tokenRow.expires_at) < new Date()) {
          return { data: null, error: { code: '22023', message: 'Este link de chamada expirou.' } };
        }

        const celula = (dbState.celulas || []).find((c: any) => c.id === tokenRow.celula_id && c.ministry_id === tokenRow.ministry_id);
        if (!celula) {
          return { data: null, error: { code: 'P0002', message: 'Célula vinculada ao token não encontrada ou inconsistente.' } };
        }

        let reuniao = null;
        if (tokenRow.reuniao_id) {
          reuniao = (dbState.celulas_reunioes || []).find((r: any) => r.id === tokenRow.reuniao_id);
          if (reuniao && reuniao.status === 'finalizada') {
            return { data: null, error: { code: '22023', message: 'Esta reunião já foi finalizada e homologada no sistema.' } };
          }
        }

        const reuniaoId = reuniao ? reuniao.id : `reuniao-mock-${Date.now()}`;
        const statusFinal = args.p_finalizar ? 'finalizada' : 'em_andamento';

        // Atomicidade simulada: se p_finalizar, marca token como finalizado
        if (args.p_finalizar) {
          tokenRow.status = 'finalizado';
        }

        // Grava frequências nominais
        if (args.p_frequencias && Array.isArray(args.p_frequencias)) {
          dbState.celulas_frequencias = (dbState.celulas_frequencias || []).filter(
            (f: any) => f.reuniao_id !== reuniaoId
          );
          for (const item of args.p_frequencias) {
            dbState.celulas_frequencias.push({
              reuniao_id: reuniaoId,
              ministry_id: tokenRow.ministry_id,
              ...item,
            });
          }
        }

        return {
          data: {
            reuniao_id: reuniaoId,
            status: statusFinal,
            total_presentes: (args.p_presentes_membros || 0) + (args.p_presentes_visitantes || 0),
            finalizada: Boolean(args.p_finalizar),
          },
          error: null,
        };
      }
      return { data: null, error: { message: `RPC ${fnName} not implemented` } };
    },
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
          maybeSingle: async () => ({ data: targetData || null, error: null }),
        }),
        single: async () => ({ data: targetData, error: null }),
        maybeSingle: async () => ({ data: targetData || null, error: null }),
      });

      const builder: any = {
        select: () => builder,
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
              return {
                eq: (c2: string, v2: any) => {
                  filters[c2] = v2;
                  return updateHandler;
                },
                select: () => ({
                  single: async () => ({ data: updatedRow, error: null }),
                  maybeSingle: async () => ({ data: updatedRow || null, error: null }),
                }),
                single: async () => ({ data: updatedRow, error: null }),
                maybeSingle: async () => ({ data: updatedRow || null, error: null }),
                then: (resolve: any) => resolve({ data: updatedRow, error: null }),
              };
            },
          };
          return updateHandler;
        },
        delete: () => ({
          eq: (col: string, val: any) => {
            filters[col] = val;
            return {
              eq: (col2: string, val2: any) => {
                filters[col2] = val2;
                dbState[currentTable] = (dbState[currentTable] || []).filter((r: any) => {
                  return !(r[col] === val && r[col2] === val2);
                });
                return Promise.resolve({ error: null });
              },
            };
          },
        }),
        upsert: (payload: any) => {
          if (!dbState[currentTable]) dbState[currentTable] = [];
          const idx = dbState[currentTable].findIndex(
            (r: any) => r.celula_id === payload.celula_id && r.reuniao_id === payload.reuniao_id
          );
          let item = { id: payload.id || `token-${Date.now()}`, ...payload };
          if (idx >= 0) {
            dbState[currentTable][idx] = { ...dbState[currentTable][idx], ...payload };
            item = dbState[currentTable][idx];
          } else {
            dbState[currentTable].push(item);
          }
          return createChainable(item);
        },
      };

      return builder;
    },
  } as any;
}

describe('Módulo Células — Chamada Rápida Pública & Segurança de Tokens', () => {
  const ministryA = 'ministry-alpha';
  const ministryB = 'ministry-beta';

  const mockDb: any = {
    celulas: [
      {
        id: 'cel-01',
        ministry_id: ministryA,
        nome: 'Célula Ágape',
        congregacao_id: 'cong-01',
        status: 'ativa',
        horario: '20:00:00',
        modalidade: 'presencial',
      },
      {
        id: 'cel-02',
        ministry_id: ministryB,
        nome: 'Célula Betel (Outro Tenant)',
        congregacao_id: 'cong-02',
        status: 'ativa',
        horario: '19:30:00',
        modalidade: 'presencial',
      },
    ],
    celulas_reunioes: [
      {
        id: 'reuniao-01',
        ministry_id: ministryA,
        celula_id: 'cel-01',
        data_reuniao: '2026-11-20',
        horario_inicio: '20:00',
        modalidade: 'presencial',
        status: 'planejada',
        presentes_membros: 0,
        presentes_visitantes: 0,
      },
      {
        id: 'reuniao-finalizada',
        ministry_id: ministryA,
        celula_id: 'cel-01',
        data_reuniao: '2026-11-13',
        horario_inicio: '20:00',
        modalidade: 'presencial',
        status: 'finalizada',
        presentes_membros: 10,
        presentes_visitantes: 2,
      },
    ],
    celulas_chamada_tokens: [],
    celulas_participantes: [
      {
        id: 'part-01',
        ministry_id: ministryA,
        celula_id: 'cel-01',
        nome_completo: 'João da Silva',
        papel: 'membro',
        status: 'ativo',
      },
      {
        id: 'part-02',
        ministry_id: ministryA,
        celula_id: 'cel-01',
        nome_completo: 'Maria Oliveira',
        papel: 'lider',
        status: 'ativo',
      },
    ],
    celulas_frequencias: [],
  };

  const supabase = createMockSupabase(mockDb);
  const service = new CelulasService(supabase);

  it('1. Emite token rápido com hash SHA-256 e sem expor token bruto no banco', async () => {
    const res = await service.gerarTokenChamadaRapida(ministryA, {
      celula_id: 'cel-01',
      reuniao_id: 'reuniao-01',
      duracao_horas: 24,
    });

    assert.ok(res.rawToken, 'Deve retornar rawToken para o link');
    assert.strictEqual(res.rawToken.length, 64, 'RawToken deve ter 64 caracteres hex (32 bytes)');

    const expectedHash = crypto.createHash('sha256').update(res.rawToken).digest('hex');
    assert.strictEqual(res.tokenItem.token_hash, expectedHash, 'token_hash deve ser SHA-256');

    // Assegura que o banco NÃO tem o rawToken gravado
    assert.notStrictEqual(res.tokenItem.token_hash, res.rawToken);
  });

  it('2. Valida token válido com retorno de dados da célula e reunião', async () => {
    const resGerado = await service.gerarTokenChamadaRapida(ministryA, {
      celula_id: 'cel-01',
      reuniao_id: 'reuniao-01',
    });

    const validacao = await service.validarTokenChamadaRapida(resGerado.rawToken);
    assert.strictEqual(validacao.valido, true);
    assert.strictEqual(validacao.celula?.nome, 'Célula Ágape');
    assert.strictEqual(validacao.reuniao?.id, 'reuniao-01');
  });

  it('3. Rejeita token expirado', async () => {
    const rawExpirado = 'a'.repeat(64);
    const hashExpirado = crypto.createHash('sha256').update(rawExpirado).digest('hex');

    mockDb.celulas_chamada_tokens.push({
      id: 'token-expirado',
      ministry_id: ministryA,
      celula_id: 'cel-01',
      token_hash: hashExpirado,
      tipo_acesso: 'frequencia_reuniao',
      status: 'ativo',
      expires_at: new Date(Date.now() - 3600 * 1000).toISOString(), // 1 hora atrás
    });

    const validacao = await service.validarTokenChamadaRapida(rawExpirado);
    assert.strictEqual(validacao.valido, false);
    assert.match(validacao.motivo || '', /expirou/i);
  });

  it('4. Rejeita token revogado', async () => {
    const rawRevogado = 'b'.repeat(64);
    const hashRevogado = crypto.createHash('sha256').update(rawRevogado).digest('hex');

    mockDb.celulas_chamada_tokens.push({
      id: 'token-revogado',
      ministry_id: ministryA,
      celula_id: 'cel-01',
      token_hash: hashRevogado,
      tipo_acesso: 'frequencia_reuniao',
      status: 'revogado',
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    });

    const validacao = await service.validarTokenChamadaRapida(rawRevogado);
    assert.strictEqual(validacao.valido, false);
    assert.match(validacao.motivo || '', /revogado/i);
  });

  it('5. Impede alteração de reunião finalizada sem justificativa (Governança)', async () => {
    await assert.rejects(
      async () => {
        await service.salvarReuniao(ministryA, {
          id: 'reuniao-finalizada',
          celula_id: 'cel-01',
          data_reuniao: '2026-11-13',
          presentes_membros: 15,
          justificativa_edicao: '', // sem justificativa
        });
      },
      /justificativa/i
    );
  });

  it('6. Impede geração de token para célula de outro ministério (Anti Cross-tenant)', async () => {
    await assert.rejects(
      async () => {
        await service.gerarTokenChamadaRapida(ministryA, {
          celula_id: 'cel-02', // pertence ao ministryB
        });
      },
      /não pertence a este ministério|não encontrada/i
    );
  });

  it('7. Executa chamada rápida transacional atômica com sucesso e idempotência', async () => {
    const resGerado = await service.gerarTokenChamadaRapida(ministryA, {
      celula_id: 'cel-01',
      reuniao_id: 'reuniao-01',
    });

    // Primeira submissão com rascunho
    const resRascunho = await service.registrarChamadaRapidaTransacional(resGerado.rawToken, {
      tema_estudo: 'Estudo em Comunhão',
      presentes_membros: 5,
      presentes_visitantes: 2,
      frequencias: [
        { nome_participante: 'João da Silva', presente: true },
        { nome_participante: 'Maria Oliveira', presente: false, justificativa_ausencia: 'Viagem' },
      ],
      finalizar: false,
    });

    assert.strictEqual(resRascunho.reuniao_id, 'reuniao-01');
    assert.strictEqual(resRascunho.status, 'em_andamento');
    assert.strictEqual(resRascunho.finalizada, false);

    // Segunda submissão finalizando a reunião
    const resFinal = await service.registrarChamadaRapidaTransacional(resGerado.rawToken, {
      tema_estudo: 'Estudo em Comunhão - Fechado',
      presentes_membros: 6,
      presentes_visitantes: 2,
      finalizar: true,
    });

    assert.strictEqual(resFinal.status, 'finalizada');
    assert.strictEqual(resFinal.finalizada, true);

    // Tentativa concorrente/posterior com o mesmo token (Idempotência e Bloqueio)
    await assert.rejects(
      async () => {
        await service.registrarChamadaRapidaTransacional(resGerado.rawToken, {
          tema_estudo: 'Tentativa Invasiva',
          finalizar: true,
        });
      },
      /finalizada/i
    );
  });
});
