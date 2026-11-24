/**
 * financial-indicators-service.ts
 *
 * Serviço Canônico de Indicadores e Métricas Financeiras (Lote 4)
 * Referência Arquitetural: docs/AUDITORIA_ESTRUTURAL_TESOURARIA.md
 * Protocolo de Segurança: docs/PROTOCOLO_SEGURANCA_PRODUCAO.md
 *
 * Princípios e Invariantes:
 * 1. Padronização Conceitual:
 *    - "Resultado Operacional do Período (Superávit / Déficit)": Total de Entradas - Total de Saídas no período selecionado.
 *    - "Saldo Final em Caixa / Bancos": Saldo Inicial (Base Anterior) + Entradas - Saídas.
 *    - "Arrecadação Digital PIX": Arrecadação Bruta Efetivamente Paga (status pago/concluída/received/confirmed).
 * 2. Precisão Centesimal:
 *    Todas as operações utilizam roundCurrency (Math.round centesimal) para eliminar floating point drift.
 * 3. Paridade Transversal:
 *    Garante que Dashboard, Tesouraria, Financeiro, Presidência e Relatórios utilizem
 *    exatamente a mesma lógica contábil quando consultarem o mesmo universo de dados.
 */

import { roundCurrency } from './financial-balance-service.ts';

export interface FinancialIndicators {
  totalReceitas: number;
  totalDespesas: number;
  resultadoOperacional: number;
  isSuperavit: boolean;
  totalDizimos: number;
  totalOfertas: number;
  totalOutros: number;
  margemOperacionalPercentual: number;
  totalLancamentos: number;
}

export interface CanonicalBalanceSummary {
  saldoInicial: number;
  totalEntradas: number;
  totalSaidas: number;
  resultadoOperacional: number;
  saldoFinal: number;
  tipoSaldoInicial: 'homologado' | 'apurado';
}

export interface AccountBalanceSummary {
  contaId: string | null;
  nome: string;
  tipo: string;
  saldoInicial: number;
  entradasPeriodo: number;
  saidasPeriodo: number;
  saldoEstimado: number;
  isAtiva: boolean;
}

export interface PixIndicatorsSummary {
  totalArrecadadoBruto: number;
  totalTransacoesPagas: number;
  ticketMedio: number;
  destinosDistintos: number;
}

export interface GenericLancamentoItem {
  id?: string;
  tipo_movimento: string;
  tipo_recebimento?: string | null;
  valor: number | string;
  conta_id?: string | null;
  congregacao_id?: string | null;
  categoria_id?: string | null;
  data_lancamento?: string;
}

/**
 * Apura os indicadores financeiros de um conjunto de lançamentos com precisão centesimal.
 */
export function computeCanonicalIndicators(
  lancamentos: GenericLancamentoItem[]
): FinancialIndicators {
  let totalReceitas = 0;
  let totalDespesas = 0;
  let totalDizimos = 0;
  let totalOfertas = 0;
  let totalOutros = 0;

  for (const l of lancamentos) {
    const val = roundCurrency(Number(l.valor) || 0);
    const mov = String(l.tipo_movimento || '').toLowerCase().trim();
    const rec = String(l.tipo_recebimento || '').toLowerCase().trim();

    if (mov === 'entrada') {
      totalReceitas += val;
      if (rec === 'dizimo') {
        totalDizimos += val;
      } else if (rec === 'oferta' || rec === 'oferta_especial') {
        totalOfertas += val;
      } else {
        totalOutros += val;
      }
    } else if (mov === 'saida') {
      totalDespesas += val;
    }
  }

  totalReceitas = roundCurrency(totalReceitas);
  totalDespesas = roundCurrency(totalDespesas);
  totalDizimos = roundCurrency(totalDizimos);
  totalOfertas = roundCurrency(totalOfertas);
  totalOutros = roundCurrency(totalOutros);

  const resultadoOperacional = roundCurrency(totalReceitas - totalDespesas);
  const isSuperavit = resultadoOperacional >= 0;
  const margemOperacionalPercentual = totalReceitas > 0
    ? roundCurrency((resultadoOperacional / totalReceitas) * 100)
    : 0;

  return {
    totalReceitas,
    totalDespesas,
    resultadoOperacional,
    isSuperavit,
    totalDizimos,
    totalOfertas,
    totalOutros,
    margemOperacionalPercentual,
    totalLancamentos: lancamentos.length,
  };
}

/**
 * Apura o saldo acumulado histórico por conta bancária/caixa físico.
 */
export function computeCanonicalAccountBalances(
  contas: Array<{ id: string; nome: string; tipo: string; saldo_inicial: number | string; is_ativa: boolean }>,
  lancamentosHistorico: GenericLancamentoItem[],
  lancamentosPeriodo: GenericLancamentoItem[]
): AccountBalanceSummary[] {
  const map = new Map<string | null, AccountBalanceSummary>();

  for (const c of contas) {
    const sIni = roundCurrency(Number(c.saldo_inicial) || 0);
    map.set(c.id, {
      contaId: c.id,
      nome: c.nome,
      tipo: c.tipo,
      saldoInicial: sIni,
      entradasPeriodo: 0,
      saidasPeriodo: 0,
      saldoEstimado: sIni,
      isAtiva: c.is_ativa,
    });
  }

  map.set(null, {
    contaId: null,
    nome: 'Sem conta vinculada',
    tipo: '—',
    saldoInicial: 0,
    entradasPeriodo: 0,
    saidasPeriodo: 0,
    saldoEstimado: 0,
    isAtiva: true,
  });

  // Saldo acumulado histórico total
  for (const l of lancamentosHistorico) {
    const key = l.conta_id ?? null;
    const entry = map.get(key) ?? map.get(null)!;
    const v = roundCurrency(Number(l.valor) || 0);
    if (l.tipo_movimento === 'entrada') {
      entry.saldoEstimado = roundCurrency(entry.saldoEstimado + v);
    } else if (l.tipo_movimento === 'saida') {
      entry.saldoEstimado = roundCurrency(entry.saldoEstimado - v);
    }
  }

  // Movimentações específicas do período selecionado
  for (const l of lancamentosPeriodo) {
    const key = l.conta_id ?? null;
    const entry = map.get(key) ?? map.get(null)!;
    const v = roundCurrency(Number(l.valor) || 0);
    if (l.tipo_movimento === 'entrada') {
      entry.entradasPeriodo = roundCurrency(entry.entradasPeriodo + v);
    } else if (l.tipo_movimento === 'saida') {
      entry.saidasPeriodo = roundCurrency(entry.saidasPeriodo + v);
    }
  }

  const semConta = map.get(null)!;
  if (semConta.entradasPeriodo === 0 && semConta.saidasPeriodo === 0 && semConta.saldoEstimado === 0) {
    map.delete(null);
  }

  return Array.from(map.values());
}

/**
 * Apura as métricas de Arrecadação Digital PIX a partir de cobranças pagas.
 */
export function computeCanonicalPixSummary(
  charges: Array<{
    valor_pago?: number | string | null;
    valor_solicitado?: number | string | null;
    status: string;
    destination_id?: string | null;
  }>
): PixIndicatorsSummary {
  const statusValidos = new Set(['pago', 'paid', 'concluida', 'received', 'confirmed']);
  let totalArrecadadoBruto = 0;
  let totalTransacoesPagas = 0;
  const distinctDestinos = new Set<string>();

  for (const c of charges) {
    const st = String(c.status || '').toLowerCase().trim();
    if (statusValidos.has(st)) {
      const v = roundCurrency(Number(c.valor_pago ?? c.valor_solicitado ?? 0));
      totalArrecadadoBruto = roundCurrency(totalArrecadadoBruto + v);
      totalTransacoesPagas++;
      if (c.destination_id) {
        distinctDestinos.add(c.destination_id);
      }
    }
  }

  const ticketMedio = totalTransacoesPagas > 0
    ? roundCurrency(totalArrecadadoBruto / totalTransacoesPagas)
    : 0;

  return {
    totalArrecadadoBruto,
    totalTransacoesPagas,
    ticketMedio,
    destinosDistintos: distinctDestinos.size,
  };
}

/**
 * Retorna as propriedades visuais canônicas para o resultado operacional (Superávit / Déficit).
 */
export function getFinancialBadge(resultado: number): {
  label: string;
  isSuperavit: boolean;
  colorClass: string;
  bgClass: string;
  borderClass: string;
} {
  const isSuperavit = resultado >= 0;
  return {
    label: isSuperavit ? 'Superávit' : 'Déficit',
    isSuperavit,
    colorClass: isSuperavit ? 'text-emerald-700' : 'text-rose-700',
    bgClass: isSuperavit ? 'bg-emerald-50' : 'bg-rose-50',
    borderClass: isSuperavit ? 'border-emerald-200' : 'border-rose-200',
  };
}
