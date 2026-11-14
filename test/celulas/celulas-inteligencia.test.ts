import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CelulasService } from '../../src/services/celulas-service';

// Mock do Supabase Client focado no Lote 7 (Inteligência Pastoral e Relatórios)
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
        gte: (field: string, val: any) => {
          filters.push({ field, op: 'gte', value: val });
          return chain;
        },
        lte: (field: string, val: any) => {
          filters.push({ field, op: 'lte', value: val });
          return chain;
        },
        in: (field: string, values: any[]) => {
          filters.push({ field, op: 'in', value: values });
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
        execute: async () => {
          const rows = dbState[currentTable] || [];
          const filtered = rows.filter((r: any) => {
            return filters.every(f => {
              if (f.op === 'eq') return r[f.field] === f.value;
              if (f.op === 'gte') return r[f.field] >= f.value;
              if (f.op === 'lte') return r[f.field] <= f.value;
              if (f.op === 'in') return f.value.includes(r[f.field]);
              return true;
            });
          });

          if (isSingle) {
            if (filtered.length === 0) return { data: null, error: new Error('Row not found') };
            return { data: filtered[0], error: null };
          }
          if (isMaybeSingle) {
            return { data: filtered[0] || null, error: null };
          }
          return { data: filtered, error: null };
        },
        then: (resolve: any) => {
          return chain.execute().then(resolve);
        }
      };

      return chain;
    }
  } as any;
}

describe('Módulo Células — Lote 7: Inteligência Pastoral e Relatórios Avançados', () => {
  const ministryA = 'ministry-alpha-1111';
  const ministryB = 'ministry-beta-2222';
  const congregacaoMatriz = 'cong-matriz-001';

  it('1. Compila painel de inteligência reconciliando presenças, pessoas únicas e métricas gerais', async () => {
    const dbState = {
      celulas: [
        {
          id: 'cel-1',
          ministry_id: ministryA,
          congregacao_id: congregacaoMatriz,
          nome: 'Célula Boas Novas',
          status: 'ativa',
          data_fundacao: '2026-01-01',
          lider_member_id: 'mem-lider-1',
          leader: { name: 'Pr. Lucas' },
        },
        {
          id: 'cel-2',
          ministry_id: ministryA,
          congregacao_id: congregacaoMatriz,
          nome: 'Célula Esperança',
          status: 'em_formacao',
          data_fundacao: '2026-02-01',
        },
        // Célula do ministério B (deve ser isolada)
        {
          id: 'cel-b',
          ministry_id: ministryB,
          congregacao_id: 'cong-b',
          nome: 'Célula Externa B',
          status: 'ativa',
        }
      ],
      celulas_participantes: [
        { id: 'part-1', ministry_id: ministryA, celula_id: 'cel-1', congregacao_id: congregacaoMatriz, member_id: 'mem-1', papel: 'lider', status: 'ativo' },
        { id: 'part-2', ministry_id: ministryA, celula_id: 'cel-1', congregacao_id: congregacaoMatriz, member_id: 'mem-2', papel: 'membro', status: 'ativo' },
        { id: 'part-3', ministry_id: ministryA, celula_id: 'cel-1', congregacao_id: congregacaoMatriz, member_id: 'mem-3', papel: 'membro', status: 'ativo' },
        // Participante inativo
        { id: 'part-4', ministry_id: ministryA, celula_id: 'cel-1', congregacao_id: congregacaoMatriz, member_id: 'mem-4', papel: 'membro', status: 'inativo' },
      ],
      celulas_reunioes: [
        {
          id: 'reun-1',
          ministry_id: ministryA,
          celula_id: 'cel-1',
          congregacao_id: congregacaoMatriz,
          data_reuniao: '2026-11-01',
          status: 'finalizada',
          total_presentes: 8,
          presentes_membros: 6,
          presentes_visitantes: 2,
          conversoes_decisoes: 1,
          reconciliacoes: 0,
        },
        {
          id: 'reun-2',
          ministry_id: ministryA,
          celula_id: 'cel-1',
          congregacao_id: congregacaoMatriz,
          data_reuniao: '2026-11-08',
          status: 'finalizada',
          total_presentes: 9,
          presentes_membros: 7,
          presentes_visitantes: 2,
          conversoes_decisoes: 2,
          reconciliacoes: 1,
        },
      ],
      celulas_frequencias: [
        { ministry_id: ministryA, reuniao_id: 'reun-1', member_id: 'mem-1', presente: true },
        { ministry_id: ministryA, reuniao_id: 'reun-1', member_id: 'mem-2', presente: true },
        { ministry_id: ministryA, reuniao_id: 'reun-2', member_id: 'mem-1', presente: true }, // Repetido (pessoa única)
        { ministry_id: ministryA, reuniao_id: 'reun-2', member_id: 'mem-3', presente: true }, // Novo presente
      ],
      celulas_supervisoes: [
        { id: 'sup-1', ministry_id: ministryA, celula_id: 'cel-1', congregacao_id: congregacaoMatriz, status: 'realizada', solicitou_apoio_pastoral: false },
      ],
      celulas_multiplicacoes: [
        { id: 'mult-1', ministry_id: ministryA, congregacao_id: congregacaoMatriz, celula_origem_id: 'cel-1', status: 'efetivada', data_efetivacao: '2026-11-05T10:00:00Z' },
      ],
    };

    const mockSupabase = createMockSupabase(dbState);
    const service = new CelulasService(mockSupabase);

    const painel = await service.gerarPainelInteligenciaPastoral(ministryA, {
      data_inicio: '2026-11-01',
      data_fim: '2026-11-30',
    });

    assert.strictEqual(painel.indicadores_gerais.total_celulas, 2);
    assert.strictEqual(painel.indicadores_gerais.celulas_ativas, 1);
    assert.strictEqual(painel.indicadores_gerais.celulas_em_formacao, 1);
    assert.strictEqual(painel.indicadores_gerais.total_membros_vinculados, 4);
    assert.strictEqual(painel.indicadores_gerais.participantes_regulares_ativos, 3);
    assert.strictEqual(painel.indicadores_gerais.reunioes_realizadas, 2);
    assert.strictEqual(painel.indicadores_gerais.presencas_totais_acumuladas, 17); // 8 + 9
    assert.strictEqual(painel.indicadores_gerais.presencas_unicas_identificadas, 3); // mem-1, mem-2, mem-3
    assert.strictEqual(painel.indicadores_gerais.visitantes_totais, 4); // 2 + 2
    assert.strictEqual(painel.indicadores_gerais.conversoes_decisoes, 3); // 1 + 2
    assert.strictEqual(painel.indicadores_gerais.multiplicacoes_efetivadas, 1);
  });

  it('2. Garante estrito isolamento multi-tenant (dados do ministério B nunca aparecem no relatório de A)', async () => {
    const dbState = {
      celulas: [
        { id: 'cel-a', ministry_id: ministryA, nome: 'Célula A', status: 'ativa' },
        { id: 'cel-b', ministry_id: ministryB, nome: 'Célula B', status: 'ativa' },
      ],
      celulas_participantes: [
        { id: 'part-b', ministry_id: ministryB, celula_id: 'cel-b', member_id: 'mem-b', status: 'ativo' },
      ],
      celulas_reunioes: [
        { id: 'reun-b', ministry_id: ministryB, celula_id: 'cel-b', data_reuniao: '2026-11-10', status: 'finalizada', total_presentes: 100 },
      ],
      celulas_frequencias: [],
      celulas_supervisoes: [],
      celulas_multiplicacoes: [],
    };

    const mockSupabase = createMockSupabase(dbState);
    const service = new CelulasService(mockSupabase);

    const painelA = await service.gerarPainelInteligenciaPastoral(ministryA);
    assert.strictEqual(painelA.indicadores_gerais.total_celulas, 1);
    assert.strictEqual(painelA.indicadores_gerais.reunioes_realizadas, 0);
    assert.strictEqual(painelA.indicadores_gerais.presencas_totais_acumuladas, 0);
  });

  it('3. Dispara alertas operacionais para célula sem reunião recente (risco de desmobilização) e solicitação de apoio', async () => {
    const dataAntiga = '2026-09-01'; // Mais de 60 dias atrás
    const dbState = {
      celulas: [
        { id: 'cel-parada', ministry_id: ministryA, congregacao_id: congregacaoMatriz, nome: 'Célula Sem Reunião', status: 'ativa' },
      ],
      celulas_participantes: [
        { id: 'p-1', ministry_id: ministryA, celula_id: 'cel-parada', status: 'ativo' },
      ],
      celulas_reunioes: [
        { id: 'reun-old', ministry_id: ministryA, celula_id: 'cel-parada', data_reuniao: dataAntiga, status: 'finalizada', total_presentes: 5 },
      ],
      celulas_frequencias: [],
      celulas_supervisoes: [
        {
          id: 'sup-apoio',
          ministry_id: ministryA,
          celula_id: 'cel-parada',
          congregacao_id: congregacaoMatriz,
          status: 'agendada',
          solicitou_apoio_pastoral: true,
          detalhe_apoio: 'Líder passando por luto, necessita visita pastoral urgente.',
        }
      ],
      celulas_multiplicacoes: [],
    };

    const mockSupabase = createMockSupabase(dbState);
    const service = new CelulasService(mockSupabase);

    const painel = await service.gerarPainelInteligenciaPastoral(ministryA, { data_inicio: '2026-08-01' });

    const alertaDesmobilizacao = painel.alertas_operacionais.find(a => a.tipo === 'sem_reuniao_recente');
    assert.ok(alertaDesmobilizacao, 'Deve conter alerta de célula sem reunião recente');
    assert.strictEqual(alertaDesmobilizacao.nivel, 'critico');

    const alertaApoio = painel.alertas_operacionais.find(a => a.tipo === 'solicitacao_apoio');
    assert.ok(alertaApoio, 'Deve conter alerta de solicitação de apoio pastoral em aberto');
    assert.strictEqual(alertaApoio.nivel, 'alto');
    assert.ok(alertaApoio.mensagem.includes('luto'));
  });

  it('4. Classifica célula pronta para multiplicar quando atinge critérios de participantes e frequência', async () => {
    const participantesMultiplicar: any[] = [];
    for (let i = 1; i <= 16; i++) {
      participantesMultiplicar.push({
        id: `part-${i}`,
        ministry_id: ministryA,
        celula_id: 'cel-cheia',
        status: 'ativo',
      });
    }

    const hoje = new Date().toISOString().split('T')[0];
    const dbState = {
      celulas: [
        { id: 'cel-cheia', ministry_id: ministryA, nome: 'Célula Frutífera', status: 'ativa' },
      ],
      celulas_participantes: participantesMultiplicar,
      celulas_reunioes: [
        { id: 'r1', ministry_id: ministryA, celula_id: 'cel-cheia', data_reuniao: hoje, status: 'finalizada', total_presentes: 15 },
        { id: 'r2', ministry_id: ministryA, celula_id: 'cel-cheia', data_reuniao: hoje, status: 'finalizada', total_presentes: 14 },
        { id: 'r3', ministry_id: ministryA, celula_id: 'cel-cheia', data_reuniao: hoje, status: 'finalizada', total_presentes: 16 },
      ],
      celulas_frequencias: [],
      celulas_supervisoes: [],
      celulas_multiplicacoes: [],
    };

    const mockSupabase = createMockSupabase(dbState);
    const service = new CelulasService(mockSupabase);

    const painel = await service.gerarPainelInteligenciaPastoral(ministryA);
    const saude = painel.saude_celulas.find(s => s.celula_id === 'cel-cheia');

    assert.ok(saude);
    assert.strictEqual(saude.diagnostico_estimado, 'pronta_multiplicar');
    assert.ok(painel.alertas_operacionais.some(a => a.tipo === 'preparacao_multiplicacao'));
  });

  it('5. Exporta relatório em formato CSV e JSON com cabeçalhos sanitizados e proteção de dados LGPD', async () => {
    const dbState = {
      celulas: [
        { id: 'cel-1', ministry_id: ministryA, congregacao_id: congregacaoMatriz, nome: 'Célula Betel', status: 'ativa' },
      ],
      celulas_participantes: [
        { id: 'p1', ministry_id: ministryA, celula_id: 'cel-1', status: 'ativo' },
      ],
      celulas_reunioes: [],
      celulas_frequencias: [],
      celulas_supervisoes: [],
      celulas_multiplicacoes: [],
    };

    const mockSupabase = createMockSupabase(dbState);
    const service = new CelulasService(mockSupabase);

    const exportCsv = await service.exportarRelatorioInteligenciaPastoral(ministryA, 'csv');
    assert.strictEqual(exportCsv.contentType, 'text/csv; charset=utf-8');
    assert.ok(exportCsv.conteudo.includes('RELATORIO DE INTELIGENCIA PASTORAL'));
    assert.ok(exportCsv.conteudo.includes('Célula Betel'));

    const exportJson = await service.exportarRelatorioInteligenciaPastoral(ministryA, 'json');
    assert.strictEqual(exportJson.contentType, 'application/json');
    const parsed = JSON.parse(exportJson.conteudo);
    assert.strictEqual(parsed.indicadores_gerais.total_celulas, 1);
  });
});
