/**
 * financial-balance-service.ts
 *
 * Módulo Canônico de Padronização de Saldos e Fechamentos Financeiros (Lote 2)
 * Referência Arquitetural: docs/AUDITORIA_ESTRUTURAL_TESOURARIA.md
 *
 * Princípios e Invariantes:
 * 1. Continuidade Temporal:
 *    Saldo Final do Período N = Saldo Inicial do Período N+1 (para o mesmo escopo).
 * 2. Precedência de Homologação:
 *    - Se existe registro com status = 'fechado' em tesouraria_fechamentos para o mês anterior M-1,
 *      o saldo_final desse fechamento é o saldo inicial canônico.
 *    - Se não existe fechamento formal para M-1, o sistema calcula recursivamente/retroativamente:
 *      Saldo Inicial = Saldo de Implantação (fin_contas.saldo_inicial) +
 *                      Lançamentos anteriores a dataInicio (entradas - saídas),
 *                      ou ancorado no último fechamento fechado K < M-1.
 * 3. Distinção de Estado de Auditoria:
 *    - 'homologado': Período formalmente fechado (tesouraria_fechamentos com status 'fechado').
 *    - 'apurado': Período em aberto, saldo calculado matematicamente a partir das movimentações e saldos anteriores.
 * 4. Precisão Monetária:
 *    Arredondamento contábil rigoroso em 2 casas decimais (centavos) para evitar resíduos de ponto flutuante.
 */

export interface FinancialScopeFilter {
  ministryId: string;
  congregacaoId?: string | null;
  contaId?: string | null;
}

export interface PeriodBalanceParams extends FinancialScopeFilter {
  dataInicio: string; // 'YYYY-MM-DD'
  dataFim: string;    // 'YYYY-MM-DD'
  mesReferencia?: string; // 'YYYY-MM'
}

export interface PeriodBalanceResult {
  saldoInicial: number;
  entradas: number;
  saidas: number;
  saldoFinal: number;
  statusFechamento: 'fechado' | 'aberto';
  tipoSaldo: 'homologado' | 'apurado';
  fechamentoId: string | null;
  fechamentoRegistro: any | null;
  ultimoFechamentoAnterior: any | null;
  totalLancamentosPeriodo: number;
}

export interface PureLancamento {
  id?: string;
  data_lancamento: string;
  tipo_movimento: 'entrada' | 'saida' | string;
  valor: number | string;
  congregacao_id?: string | null;
  conta_id?: string | null;
}

export interface PureConta {
  id: string;
  saldo_inicial?: number | string | null;
  is_ativa?: boolean;
  congregacao_id?: string | null;
}

export interface PureFechamento {
  id: string;
  mes_referencia: string;
  congregacao_id?: string | null;
  saldo_inicial: number | string;
  total_entradas?: number | string;
  entradas?: number | string;
  total_saidas?: number | string;
  saidas?: number | string;
  saldo_final: number | string;
  status: 'fechado' | 'aberto' | string;
  data_inicio?: string | null;
  data_fim?: string | null;
  created_at?: string | null;
}

/**
 * Arredonda valor monetário para 2 casas decimais de forma exata.
 */
export function roundCurrency(val: number): number {
  if (isNaN(val) || !isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Formata valor em BRL.
 */
export function formatCurrencyBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

/**
 * Calcula o saldo inicial puro em memória a partir de listas de contas, fechamentos e lançamentos.
 * Usado tanto para backend (com dados do Supabase) quanto para frontend e testes unitários.
 */
export function computeCanonicalInitialBalance(params: {
  dataInicio: string;
  congregacaoId?: string | null;
  contaId?: string | null;
  contas: PureConta[];
  fechamentos: PureFechamento[];
  lancamentosHistoricos: PureLancamento[];
}): { saldoInicial: number; ancoragem: 'fechamento_anterior' | 'saldo_implantacao'; fechamentoAnterior: PureFechamento | null } {
  const { dataInicio, congregacaoId, contaId, contas, fechamentos, lancamentosHistoricos } = params;

  // Filtrar fechamentos homologados anteriores a dataInicio para o escopo
  const fechamentosValidos = fechamentos
    .filter(f => {
      if (f.status !== 'fechado') return false;
      // Filtro de congregação: se congregacaoId for informado, match exato; se null, match com congregacao_id null
      if (congregacaoId !== undefined) {
        const cF = f.congregacao_id || null;
        const cTarget = congregacaoId || null;
        if (cF !== cTarget) return false;
      }
      // Data fim do fechamento deve ser anterior à dataInicio
      const fFim = f.data_fim || (f.mes_referencia ? `${f.mes_referencia}-31` : null);
      if (fFim && fFim >= dataInicio) return false;
      return true;
    })
    .sort((a, b) => {
      const dateA = a.data_fim || (a.mes_referencia ? `${a.mes_referencia}-01` : '');
      const dateB = b.data_fim || (b.mes_referencia ? `${b.mes_referencia}-01` : '');
      return dateB.localeCompare(dateA);
    });

  const fechamentoAnterior = fechamentosValidos.length > 0 ? fechamentosValidos[0] : null;

  if (fechamentoAnterior) {
    // Ancorar no saldo final do fechamento anterior mais recente
    const baseSaldo = roundCurrency(Number(fechamentoAnterior.saldo_final) || 0);
    const dataCorte = fechamentoAnterior.data_fim || (fechamentoAnterior.mes_referencia ? `${fechamentoAnterior.mes_referencia}-31` : '');

    // Somar movimentações entre dataCorte (exclusivo) e dataInicio (exclusivo)
    let delta = 0;
    for (const l of lancamentosHistoricos) {
      if (congregacaoId !== undefined) {
        const cL = l.congregacao_id || null;
        const cTarget = congregacaoId || null;
        if (cL !== cTarget) continue;
      }
      if (contaId && l.conta_id !== contaId) continue;

      if (l.data_lancamento > dataCorte && l.data_lancamento < dataInicio) {
        const v = roundCurrency(Number(l.valor) || 0);
        if (l.tipo_movimento === 'entrada') delta += v;
        else if (l.tipo_movimento === 'saida') delta -= v;
      }
    }

    return {
      saldoInicial: roundCurrency(baseSaldo + delta),
      ancoragem: 'fechamento_anterior',
      fechamentoAnterior,
    };
  }

  // Se não houver nenhum fechamento anterior homologado:
  // Saldo Inicial = Soma dos saldos de implantação das contas (ativas ou inativas com saldo histórico) + Lançamentos anteriores a dataInicio
  let saldoImplantacao = 0;
  for (const c of contas) {
    if (congregacaoId !== undefined) {
      const cCong = c.congregacao_id || null;
      const cTarget = congregacaoId || null;
      // Se filtrando congregação específica, só conta da congregação
      if (cCong !== cTarget) continue;
    }
    if (contaId && c.id !== contaId) continue;

    saldoImplantacao += roundCurrency(Number(c.saldo_inicial) || 0);
  }

  let deltaHistorico = 0;
  for (const l of lancamentosHistoricos) {
    if (congregacaoId !== undefined) {
      const cL = l.congregacao_id || null;
      const cTarget = congregacaoId || null;
      if (cL !== cTarget) continue;
    }
    if (contaId && l.conta_id !== contaId) continue;

    if (l.data_lancamento < dataInicio) {
      const v = roundCurrency(Number(l.valor) || 0);
      if (l.tipo_movimento === 'entrada') deltaHistorico += v;
      else if (l.tipo_movimento === 'saida') deltaHistorico -= v;
    }
  }

  return {
    saldoInicial: roundCurrency(saldoImplantacao + deltaHistorico),
    ancoragem: 'saldo_implantacao',
    fechamentoAnterior: null,
  };
}

/**
 * Calcula os totais do período em memória a partir de lançamentos e do saldo inicial.
 */
export function computePeriodTotals(params: {
  saldoInicial: number;
  dataInicio: string;
  dataFim: string;
  congregacaoId?: string | null;
  contaId?: string | null;
  lancamentos: PureLancamento[];
}): {
  entradas: number;
  saidas: number;
  saldoFinal: number;
  totalLancamentos: number;
} {
  const { saldoInicial, dataInicio, dataFim, congregacaoId, contaId, lancamentos } = params;

  let entradas = 0;
  let saidas = 0;
  let totalLancamentos = 0;

  for (const l of lancamentos) {
    if (congregacaoId !== undefined) {
      const cL = l.congregacao_id || null;
      const cTarget = congregacaoId || null;
      if (cL !== cTarget) continue;
    }
    if (contaId && l.conta_id !== contaId) continue;

    if (l.data_lancamento >= dataInicio && l.data_lancamento <= dataFim) {
      totalLancamentos++;
      const v = roundCurrency(Number(l.valor) || 0);
      if (l.tipo_movimento === 'entrada') entradas += v;
      else if (l.tipo_movimento === 'saida') saidas += v;
    }
  }

  entradas = roundCurrency(entradas);
  saidas = roundCurrency(saidas);
  const saldoFinal = roundCurrency(saldoInicial + entradas - saidas);

  return {
    entradas,
    saidas,
    saldoFinal,
    totalLancamentos,
  };
}

/**
 * Executa o cálculo canônico completo de saldos de um período via Supabase Client.
 */
export async function calculatePeriodBalanceFromSupabase(
  supabase: any,
  params: PeriodBalanceParams
): Promise<PeriodBalanceResult> {
  const { ministryId, dataInicio, dataFim, congregacaoId, contaId } = params;
  const mesRef = params.mesReferencia || dataFim.substring(0, 7);

  // 1. Verificar se o período atual já possui fechamento homologado
  let fechamentoAtualQuery = supabase
    .from('tesouraria_fechamentos')
    .select('*')
    .eq('ministry_id', ministryId)
    .eq('mes_referencia', mesRef);

  if (congregacaoId) {
    fechamentoAtualQuery = fechamentoAtualQuery.eq('congregacao_id', congregacaoId);
  } else {
    fechamentoAtualQuery = fechamentoAtualQuery.is('congregacao_id', null);
  }

  const { data: fechsAtuais } = await fechamentoAtualQuery;
  const fechamentoAtual = Array.isArray(fechsAtuais) && fechsAtuais.length > 0 ? fechsAtuais[0] : null;

  if (fechamentoAtual && fechamentoAtual.status === 'fechado') {
    const sIni = roundCurrency(Number(fechamentoAtual.saldo_inicial) || 0);
    const ent = roundCurrency(Number(fechamentoAtual.total_entradas ?? fechamentoAtual.entradas) || 0);
    const sai = roundCurrency(Number(fechamentoAtual.total_saidas ?? fechamentoAtual.saidas) || 0);
    const sFin = roundCurrency(Number(fechamentoAtual.saldo_final) || 0);

    return {
      saldoInicial: sIni,
      entradas: ent,
      saidas: sai,
      saldoFinal: sFin,
      statusFechamento: 'fechado',
      tipoSaldo: 'homologado',
      fechamentoId: fechamentoAtual.id,
      fechamentoRegistro: fechamentoAtual,
      ultimoFechamentoAnterior: null,
      totalLancamentosPeriodo: 0,
    };
  }

  // 2. Não há fechamento formal para o período atual (está em aberto).
  // Buscar contas (para saldo inicial de implantação, incluindo inativas que possuem saldo de implantação histórico)
  let contasQuery = supabase
    .from('fin_contas')
    .select('id, saldo_inicial, is_ativa, congregacao_id')
    .eq('ministry_id', ministryId);
  if (congregacaoId) {
    contasQuery = contasQuery.eq('congregacao_id', congregacaoId);
  }
  const { data: contasData } = await contasQuery;
  const contas: PureConta[] = contasData || [];

  // Buscar todos os fechamentos homologados anteriores do ministério
  let fechsHistQuery = supabase
    .from('tesouraria_fechamentos')
    .select('*')
    .eq('ministry_id', ministryId)
    .eq('status', 'fechado');
  if (congregacaoId) {
    fechsHistQuery = fechsHistQuery.eq('congregacao_id', congregacaoId);
  } else {
    fechsHistQuery = fechsHistQuery.is('congregacao_id', null);
  }
  const { data: fechsHistData } = await fechsHistQuery;
  const fechamentos: PureFechamento[] = fechsHistData || [];

  // Buscar lançamentos até dataFim com paginação automática
  let allLancs: PureLancamento[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    let q = supabase
      .from('tesouraria_lancamentos')
      .select('id, data_lancamento, tipo_movimento, valor, congregacao_id, conta_id')
      .eq('ministry_id', ministryId)
      .lte('data_lancamento', dataFim)
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order('data_lancamento', { ascending: true });

    if (congregacaoId) {
      q = q.eq('congregacao_id', congregacaoId);
    }
    if (contaId) {
      q = q.eq('conta_id', contaId);
    }

    const { data: pageData, error } = await q;
    if (error || !pageData || pageData.length === 0) break;
    allLancs = allLancs.concat(pageData);
    if (pageData.length < pageSize) break;
    page++;
  }

  // 3. Calcular Saldo Inicial canônico
  const initialResult = computeCanonicalInitialBalance({
    dataInicio,
    congregacaoId,
    contaId,
    contas,
    fechamentos,
    lancamentosHistoricos: allLancs,
  });

  // 4. Calcular Totais do Período
  const totals = computePeriodTotals({
    saldoInicial: initialResult.saldoInicial,
    dataInicio,
    dataFim,
    congregacaoId,
    contaId,
    lancamentos: allLancs,
  });

  return {
    saldoInicial: initialResult.saldoInicial,
    entradas: totals.entradas,
    saidas: totals.saidas,
    saldoFinal: totals.saldoFinal,
    statusFechamento: 'aberto',
    tipoSaldo: 'apurado',
    fechamentoId: null,
    fechamentoRegistro: null,
    ultimoFechamentoAnterior: initialResult.fechamentoAnterior,
    totalLancamentosPeriodo: totals.totalLancamentos,
  };
}
