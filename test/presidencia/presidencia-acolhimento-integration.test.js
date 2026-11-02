import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Testes Unitários Direcionados:
 * Módulo Presidência — Integração Oficial com Acolhimento e Livro Espiritual (Etapa 3)
 * 
 * Regras Validadas:
 * 1. Agregação e consolidação estrita de relatorio_espiritual_registros.
 * 2. Diferenciação precisa entre:
 *    - Ausência de dados (temDados: false)
 *    - Cultos realizados com contagem 0 (temDados: true, valores: 0)
 * 3. Status de fechamento:
 *    - 'Fechada' quando fechamento formalizado existe com status 'Fechada'
 *    - 'Aberta' (dados preliminares) quando não há fechamento ou status é 'Aberta'
 *    - 'Sem Fechamento' quando ministério não possui registros nem fechamentos
 * 4. Comparativo sustentado mês anterior:
 *    - Só calcula variação percentual quando temDadosAnterior: true
 *    - Retorna null ou cálculo seguro sem divisão por zero
 * 5. Isolamento estrito por ministry_id.
 */

// Simulação mock da lógica de PresidenciaService.obterIndicadoresEspirituaisConsolidados
async function obterIndicadoresEspirituaisConsolidadosMock(
  supabaseMock,
  ministryId,
  mesRef,
  anoRef
) {
  const hoje = new Date();
  const mes = mesRef || hoje.getMonth() + 1;
  const ano = anoRef || hoje.getFullYear();

  const MESES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  const mesNome = MESES[mes - 1] || 'Mês Atual';

  if (!ministryId) {
    return {
      periodo: { mes, ano, mesNome, label: `${mesNome}/${ano}` },
      temDados: false,
      statusFechamento: 'Sem Fechamento',
      congregaçõesParticipantesCount: 0,
      totalAtividadesRegistradas: 0,
      almasAlcancadas: 0,
      reconciliacoes: 0,
      batismosEspiritoSanto: 0,
      visitantesPresentes: 0,
      membrosCearam: 0,
      cultosRealizados: 0,
    };
  }

  const prevMes = mes === 1 ? 12 : mes - 1;
  const prevAno = mes === 1 ? ano - 1 : ano;

  const [fechamentoRes, registrosMesRes] = await Promise.all([
    supabaseMock
      .from('relatorio_espiritual_fechamentos')
      .select('*')
      .eq('ministry_id', ministryId)
      .eq('mes', mes)
      .eq('ano', ano),
    supabaseMock
      .from('relatorio_espiritual_registros')
      .select('*')
      .eq('ministry_id', ministryId),
  ]);

  const fechamentos = fechamentoRes.data || [];
  const todosRegistros = registrosMesRes.data || [];

  const registrosMes = todosRegistros.filter((r) => {
    const d = new Date(r.data_atividade);
    return d.getUTCMonth() + 1 === mes && d.getUTCFullYear() === ano;
  });

  const registrosPrev = todosRegistros.filter((r) => {
    const d = new Date(r.data_atividade);
    return d.getUTCMonth() + 1 === prevMes && d.getUTCFullYear() === prevAno;
  });

  let statusFechamento = 'Sem Fechamento';
  if (fechamentos.length > 0) {
    const temAberta = fechamentos.some((f) => f.status === 'Aberta');
    statusFechamento = temAberta ? 'Aberta' : 'Fechada';
  } else if (registrosMes.length > 0) {
    statusFechamento = 'Aberta';
  }

  const congsSet = new Set();
  let almas = 0;
  let reconciliacoes = 0;
  let batismos = 0;
  let visitantes = 0;
  let ceia = 0;
  let cultos = 0;

  registrosMes.forEach((r) => {
    if (r.congregacao_id) congsSet.add(r.congregacao_id);
    almas += Number(r.almas_alcancadas || 0);
    reconciliacoes += Number(r.reconciliacoes || 0);
    batismos += Number(r.batismos_espirito_santo || 0);
    visitantes += Number(r.visitantes_presentes || 0);
    ceia += Number(r.membros_cearam || 0);
    cultos += Number(r.cultos_realizados || 0);
  });

  let prevAlmas = 0;
  let prevReconciliacoes = 0;
  let prevBatismos = 0;
  let prevVisitantes = 0;

  registrosPrev.forEach((r) => {
    prevAlmas += Number(r.almas_alcancadas || 0);
    prevReconciliacoes += Number(r.reconciliacoes || 0);
    prevBatismos += Number(r.batismos_espirito_santo || 0);
    prevVisitantes += Number(r.visitantes_presentes || 0);
  });

  const calcVar = (atual, anterior) => {
    if (anterior === 0) return atual > 0 ? 100 : null;
    return Number((((atual - anterior) / anterior) * 100).toFixed(1));
  };

  const temDados = registrosMes.length > 0;
  const temDadosAnterior = registrosPrev.length > 0;

  return {
    periodo: { mes, ano, mesNome, label: `${mesNome}/${ano}` },
    temDados,
    statusFechamento,
    congregaçõesParticipantesCount: congsSet.size,
    totalAtividadesRegistradas: registrosMes.length,
    almasAlcancadas: almas,
    reconciliacoes,
    batismosEspiritoSanto: batismos,
    visitantesPresentes: visitantes,
    membrosCearam: ceia,
    cultosRealizados: cultos,
    comparativoMesAnterior: {
      temDadosAnterior,
      almasVarPct: temDadosAnterior ? calcVar(almas, prevAlmas) : null,
      reconciliacoesVarPct: temDadosAnterior ? calcVar(reconciliacoes, prevReconciliacoes) : null,
      batismosVarPct: temDadosAnterior ? calcVar(batismos, prevBatismos) : null,
      visitantesVarPct: temDadosAnterior ? calcVar(visitantes, prevVisitantes) : null,
    },
  };
}

test('Presidência — Integração de Vida Espiritual & Acolhimento (Etapa 3)', async (t) => {
  const ministryAlpha = 'ministry-alpha-111';
  const ministryBeta = 'ministry-beta-222';

  const bancoMock = {
    fechamentos: [
      {
        id: 'fech-1',
        ministry_id: ministryAlpha,
        mes: 10,
        ano: 2026,
        status: 'Fechada',
      },
      {
        id: 'fech-2',
        ministry_id: ministryAlpha,
        mes: 11,
        ano: 2026,
        status: 'Aberta',
      },
    ],
    registros: [
      // Mês 10 (Outubro/2026) - Ministério Alpha
      {
        id: 'reg-out-1',
        ministry_id: ministryAlpha,
        congregacao_id: 'cong-sede',
        data_atividade: '2026-10-15T19:30:00Z',
        almas_alcancadas: 5,
        reconciliacoes: 2,
        batismos_espirito_santo: 3,
        visitantes_presentes: 20,
        membros_cearam: 80,
        cultos_realizados: 4,
      },
      // Mês 11 (Novembro/2026) - Ministério Alpha
      {
        id: 'reg-nov-1',
        ministry_id: ministryAlpha,
        congregacao_id: 'cong-sede',
        data_atividade: '2026-11-01T19:00:00Z',
        almas_alcancadas: 8,
        reconciliacoes: 3,
        batismos_espirito_santo: 6,
        visitantes_presentes: 25,
        membros_cearam: 90,
        cultos_realizados: 3,
      },
      {
        id: 'reg-nov-2',
        ministry_id: ministryAlpha,
        congregacao_id: 'cong-bairro',
        data_atividade: '2026-11-02T19:00:00Z',
        almas_alcancadas: 2,
        reconciliacoes: 1,
        batismos_espirito_santo: 1,
        visitantes_presentes: 10,
        membros_cearam: 30,
        cultos_realizados: 2,
      },
      // Registro do Ministério Beta (Isolamento Multi-tenant)
      {
        id: 'reg-beta-1',
        ministry_id: ministryBeta,
        congregacao_id: 'cong-beta-1',
        data_atividade: '2026-11-01T19:00:00Z',
        almas_alcancadas: 50,
        reconciliacoes: 20,
        batismos_espirito_santo: 30,
        visitantes_presentes: 100,
        membros_cearam: 200,
        cultos_realizados: 5,
      },
    ],
  };

  const createSupabaseMock = () => ({
    from: (tabela) => ({
      select: () => ({
        eq: (col1, val1) => ({
          eq: (col2, val2) => ({
            eq: (col3, val3) => {
              if (tabela === 'relatorio_espiritual_fechamentos') {
                const data = bancoMock.fechamentos.filter(
                  (f) => f.ministry_id === val1 && f.mes === val2 && f.ano === val3
                );
                return Promise.resolve({ data, error: null });
              }
              return Promise.resolve({ data: [], error: null });
            },
          }),
          then: (resolve) => {
            if (tabela === 'relatorio_espiritual_registros') {
              const data = bancoMock.registros.filter((r) => r.ministry_id === val1);
              return resolve({ data, error: null });
            }
            return resolve({ data: [], error: null });
          },
        }),
      }),
    }),
  });

  await t.test('1. Agregação e consolidação oficial em Novembro/2026', async () => {
    const supabase = createSupabaseMock();
    const ind = await obterIndicadoresEspirituaisConsolidadosMock(supabase, ministryAlpha, 11, 2026);

    assert.equal(ind.temDados, true);
    assert.equal(ind.totalAtividadesRegistradas, 2);
    assert.equal(ind.congregaçõesParticipantesCount, 2); // cong-sede e cong-bairro
    assert.equal(ind.cultosRealizados, 5); // 3 + 2
    assert.equal(ind.almasAlcancadas, 10); // 8 + 2
    assert.equal(ind.reconciliacoes, 4); // 3 + 1
    assert.equal(ind.batismosEspiritoSanto, 7); // 6 + 1
    assert.equal(ind.visitantesPresentes, 35); // 25 + 10
    assert.equal(ind.statusFechamento, 'Aberta'); // Fechamento de novembro está 'Aberta' (dados preliminares)
  });

  await t.test('2. Comparativo mensal sustentado contra Outubro/2026', async () => {
    const supabase = createSupabaseMock();
    const ind = await obterIndicadoresEspirituaisConsolidadosMock(supabase, ministryAlpha, 11, 2026);

    assert.equal(ind.comparativoMesAnterior?.temDadosAnterior, true);
    // Outubro: 5 almas. Novembro: 10 almas -> +100%
    assert.equal(ind.comparativoMesAnterior?.almasVarPct, 100);
    // Outubro: 2 reconciliações. Novembro: 4 reconciliações -> +100%
    assert.equal(ind.comparativoMesAnterior?.reconciliacoesVarPct, 100);
    // Outubro: 20 visitantes. Novembro: 35 visitantes -> +75%
    assert.equal(ind.comparativoMesAnterior?.visitantesVarPct, 75);
  });

  await t.test('3. Reconhecimento de competência oficialmente Fechada (Outubro/2026)', async () => {
    const supabase = createSupabaseMock();
    const ind = await obterIndicadoresEspirituaisConsolidadosMock(supabase, ministryAlpha, 10, 2026);

    assert.equal(ind.statusFechamento, 'Fechada');
    assert.equal(ind.almasAlcancadas, 5);
    assert.equal(ind.congregaçõesParticipantesCount, 1);
  });

  await t.test('4. Tratamento explícito de ausência de dados vs. resultado zero', async () => {
    const supabase = createSupabaseMock();
    // Mês sem registros (ex: Janeiro/2026)
    const indVazio = await obterIndicadoresEspirituaisConsolidadosMock(supabase, ministryAlpha, 1, 2026);

    assert.equal(indVazio.temDados, false);
    assert.equal(indVazio.totalAtividadesRegistradas, 0);
    assert.equal(indVazio.statusFechamento, 'Sem Fechamento');
    assert.equal(indVazio.comparativoMesAnterior?.temDadosAnterior, false);
  });

  await t.test('5. Isolamento estrito multi-tenant (dados do ministério Alpha não vazam para Beta)', async () => {
    const supabase = createSupabaseMock();
    const indAlpha = await obterIndicadoresEspirituaisConsolidadosMock(supabase, ministryAlpha, 11, 2026);
    const indBeta = await obterIndicadoresEspirituaisConsolidadosMock(supabase, ministryBeta, 11, 2026);

    assert.equal(indAlpha.almasAlcancadas, 10);
    assert.equal(indBeta.almasAlcancadas, 50); // Somente os dados de Beta
    assert.equal(indBeta.congregaçõesParticipantesCount, 1);
  });
});
