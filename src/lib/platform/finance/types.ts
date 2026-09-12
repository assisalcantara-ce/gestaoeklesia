/**
 * Tipos e Interfaces da Central Financeira Corporativa (Gestão Eklésia Platform)
 * 100% Isolado do domínio financeiro dos tenants/igrejas.
 */

export type PlatformFinancialCategoryType = 'INCOME' | 'EXPENSE'

export interface PlatformFinancialCategory {
  id: string
  name: string
  type: PlatformFinancialCategoryType
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type PlatformManualRevenueStatus = 'pending' | 'received' | 'canceled'

export interface PlatformManualRevenue {
  id: string
  category_id: string | null
  description: string
  amount: number
  reference_date: string
  received_at: string | null
  status: PlatformManualRevenueStatus
  payment_method: string | null
  payer_name: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  category?: PlatformFinancialCategory | null
}

export type PlatformExpenseStatus = 'pending' | 'paid' | 'canceled'

export interface PlatformExpense {
  id: string
  category_id: string | null
  description: string
  amount: number
  reference_date: string
  due_date: string
  paid_at: string | null
  status: PlatformExpenseStatus
  payment_method: string | null
  is_recurring: boolean
  recipient_name: string | null
  receipt_url: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  category?: PlatformFinancialCategory | null
}

export interface PlatformFinancialBalance {
  id: string
  account_name: string
  reference_year: number
  reference_month: number
  initial_balance: number
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CorporateFinancialReportFilter {
  periodo?: 'este_mes' | 'mes_passado' | '1_trimestre' | '2_trimestre' | '3_trimestre' | '4_trimestre' | '90_dias' | 'este_ano' | 'todos' | 'customizado'
  startDate?: string
  endDate?: string
  ministryId?: string
  planoSlug?: string
  statusCobranca?: string
}

export interface ExpenseByCategory {
  [key: string]: string | number | null
  categoryId: string | null
  categoryName: string
  amount: number
  percentage: number
  count: number
}

export interface RevenueByPlan {
  [key: string]: string | number
  planSlug: string
  planName: string
  amount: number
  percentage: number
  count: number
}

export interface DRECategoryItem {
  name: string
  amount: number
  percentage: number
}

export interface PlatformDRE {
  receitaSaaS: number
  receitasManuais: number
  receitaBruta: number
  despesasOperacionais: DRECategoryItem[]
  totalDespesas: number
  resultadoLiquido: number
  margemLiquida: number // percentual
}

export interface ExecutiveStatementData {
  summary: CorporateFinancialSummary
  dre: PlatformDRE
  recentPaidInvoices: {
    id: string
    ministryName: string
    planName: string
    amount: number
    paidAt: string | null
    dueDate: string | null
  }[]
  recentManualRevenues: {
    id: string
    description: string
    payerName: string | null
    categoryName: string
    amount: number
    referenceDate: string
    receivedAt: string | null
  }[]
  recentPaidExpenses: {
    id: string
    description: string
    recipientName: string | null
    categoryName: string
    amount: number
    dueDate: string
    paidAt: string | null
    isRecurring: boolean
  }[]
  pendingExpenses: {
    id: string
    description: string
    recipientName: string | null
    categoryName: string
    amount: number
    dueDate: string
  }[]
}

export interface CorporateFinancialSummary {
  // Saldo
  saldoInicial: number
  saldoFinal: number
  resultadoLiquido: number // (totalEntradasRecebidas - totalDespesasPagas)

  // Entradas
  receitaAutomaticaRecebida: number
  receitaManualRecebida: number
  totalEntradasRecebidas: number
  receitaAutomaticaPrevista: number
  receitaManualPendente: number
  totalEntradasPrevistas: number

  // Saídas
  despesasPagas: number
  despesasPendentes: number
  totalDespesas: number

  // Inadimplência
  inadimplenciaValor: number
  inadimplenciaQtd: number
  inadimplenciaTaxa: number // percentual

  // Contagens
  totalFaturasPagas: number
  totalFaturasPendentes: number
  totalFaturasVencidas: number
  totalClientesAtivos: number
  ticketMedioRecebido: number

  // Detalhamento analítico
  expensesByCategory: ExpenseByCategory[]
  revenueByPlan: RevenueByPlan[]
}

export interface MonthlyEvolutionData {
  mesReferencia: string // 'YYYY-MM'
  mesLabel: string      // 'Jan/2026'
  receitaSaaSRecebida: number
  receitaManualRecebida: number
  totalReceitasRecebidas: number
  receitaPrevista: number
  despesasPagas: number
  despesasPendentes: number
  resultadoLiquido: number
}
