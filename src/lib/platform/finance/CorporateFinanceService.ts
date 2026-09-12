import { SupabaseClient } from '@supabase/supabase-js'
import {
  CorporateFinancialReportFilter,
  CorporateFinancialSummary,
  MonthlyEvolutionData,
  ExpenseByCategory,
  RevenueByPlan,
  PlatformDRE,
  ExecutiveStatementData,
} from './types'

export class CorporateFinanceService {
  /**
   * Converte períodos amigáveis em intervalo de datas (startDate / endDate)
   */
  static resolveDateRange(filter: CorporateFinancialReportFilter): { startDate: string | null; endDate: string | null; year: number; month: number } {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1 // 1-indexed

    if (filter.startDate && filter.endDate) {
      const d = new Date(filter.startDate)
      return {
        startDate: filter.startDate,
        endDate: filter.endDate,
        year: d.getFullYear(),
        month: d.getMonth() + 1,
      }
    }

    switch (filter.periodo) {
      case 'este_mes': {
        const start = new Date(currentYear, currentMonth - 1, 1).toISOString()
        const end = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999).toISOString()
        return { startDate: start, endDate: end, year: currentYear, month: currentMonth }
      }
      case 'mes_passado': {
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear
        const start = new Date(prevYear, prevMonth - 1, 1).toISOString()
        const end = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999).toISOString()
        return { startDate: start, endDate: end, year: prevYear, month: prevMonth }
      }
      case '1_trimestre': {
        const start = new Date(currentYear, 0, 1).toISOString()
        const end = new Date(currentYear, 2, 31, 23, 59, 59, 999).toISOString()
        return { startDate: start, endDate: end, year: currentYear, month: 1 }
      }
      case '2_trimestre': {
        const start = new Date(currentYear, 3, 1).toISOString()
        const end = new Date(currentYear, 5, 30, 23, 59, 59, 999).toISOString()
        return { startDate: start, endDate: end, year: currentYear, month: 4 }
      }
      case '3_trimestre': {
        const start = new Date(currentYear, 6, 1).toISOString()
        const end = new Date(currentYear, 8, 30, 23, 59, 59, 999).toISOString()
        return { startDate: start, endDate: end, year: currentYear, month: 7 }
      }
      case '4_trimestre': {
        const start = new Date(currentYear, 9, 1).toISOString()
        const end = new Date(currentYear, 11, 31, 23, 59, 59, 999).toISOString()
        return { startDate: start, endDate: end, year: currentYear, month: 10 }
      }
      case '90_dias': {
        const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
        const end = now.toISOString()
        return { startDate: start, endDate: end, year: currentYear, month: currentMonth }
      }
      case 'este_ano': {
        const start = new Date(currentYear, 0, 1).toISOString()
        const end = new Date(currentYear, 11, 31, 23, 59, 59, 999).toISOString()
        return { startDate: start, endDate: end, year: currentYear, month: currentMonth }
      }
      case 'todos':
      default:
        return { startDate: null, endDate: null, year: currentYear, month: currentMonth }
    }
  }

  /**
   * Consolida métricas executivas da Central Financeira Corporativa
   */
  static async getFinancialSummary(
    supabase: SupabaseClient,
    filter: CorporateFinancialReportFilter = { periodo: 'este_mes' }
  ): Promise<CorporateFinancialSummary> {
    const { startDate, endDate, year, month } = this.resolveDateRange(filter)

    // 1. Consultar Saldo Inicial do período
    let saldoInicial = 0
    const { data: balanceRow } = await supabase
      .from('platform_financial_balances')
      .select('initial_balance')
      .eq('reference_year', year)
      .eq('reference_month', month)
      .maybeSingle()

    if (balanceRow) {
      saldoInicial = Number(balanceRow.initial_balance || 0)
    }

    // 2. Consultar Faturas do SaaS (platform_billing_invoices)
    let invoicesQuery = supabase
      .from('platform_billing_invoices')
      .select('id, amount, status, paid_at, due_date, ministry_id, plano_slug')

    if (filter.ministryId && filter.ministryId !== 'todos') {
      invoicesQuery = invoicesQuery.eq('ministry_id', filter.ministryId)
    }
    if (filter.planoSlug && filter.planoSlug !== 'todos') {
      invoicesQuery = invoicesQuery.eq('plano_slug', filter.planoSlug)
    }
    if (filter.statusCobranca && filter.statusCobranca !== 'todos') {
      invoicesQuery = invoicesQuery.eq('status', filter.statusCobranca)
    }

    const { data: invoices, error: invError } = await invoicesQuery
    if (invError) throw invError

    const invoiceList = invoices || []

    let receitaAutomaticaRecebida = 0
    let receitaAutomaticaPrevista = 0
    let inadimplenciaValor = 0
    let inadimplenciaQtd = 0
    let totalFaturasPagas = 0
    let totalFaturasPendentes = 0
    let totalFaturasVencidas = 0
    const payingMinistries = new Set<string>()
    const planRevenueMap: Record<string, { amount: number; count: number }> = {}

    for (const inv of invoiceList) {
      const amt = Number(inv.amount || 0)
      const st = (inv.status || '').toLowerCase()
      const planKey = (inv.plano_slug || 'outros').toLowerCase()

      // Filtro de data para recebidas (baseado em paid_at)
      const paidDate = inv.paid_at ? new Date(inv.paid_at).toISOString() : null
      const isPaidInDateRange = !startDate || !endDate || (paidDate && paidDate >= startDate && paidDate <= endDate)

      // Filtro de data para pendentes/vencidas (baseado em due_date)
      const dueDate = inv.due_date ? new Date(inv.due_date).toISOString() : null
      const isDueInDateRange = !startDate || !endDate || (dueDate && dueDate >= startDate && dueDate <= endDate)

      if (st === 'paid') {
        if (isPaidInDateRange) {
          receitaAutomaticaRecebida += amt
          totalFaturasPagas++
          if (inv.ministry_id) payingMinistries.add(inv.ministry_id)

          if (!planRevenueMap[planKey]) planRevenueMap[planKey] = { amount: 0, count: 0 }
          planRevenueMap[planKey].amount += amt
          planRevenueMap[planKey].count++
        }
      } else if (st === 'pending') {
        if (isDueInDateRange) {
          receitaAutomaticaPrevista += amt
          totalFaturasPendentes++
        }
      } else if (st === 'overdue') {
        if (isDueInDateRange) {
          inadimplenciaValor += amt
          inadimplenciaQtd++
          totalFaturasVencidas++
        }
      }
    }

    // 2.1 Consultar Planos Oficiais de subscription_plans para mapear nomes reais
    const { data: dbPlans } = await supabase
      .from('subscription_plans')
      .select('slug, name')

    const officialPlanNames: Record<string, string> = {}
    if (dbPlans) {
      for (const p of dbPlans) {
        if (p.slug) {
          officialPlanNames[p.slug.toLowerCase()] = p.name
        }
      }
    }

    const revenueByPlan: RevenueByPlan[] = Object.entries(planRevenueMap).map(([slug, data]) => {
      const pct = receitaAutomaticaRecebida > 0 ? (data.amount / receitaAutomaticaRecebida) * 100 : 0
      return {
        planSlug: slug,
        planName: officialPlanNames[slug.toLowerCase()] || (slug === 'outros' ? 'Outros / Avulso' : slug.toUpperCase()),
        amount: data.amount,
        percentage: Number(pct.toFixed(1)),
        count: data.count,
      }
    })

    // 3. Consultar Receitas Manuais (platform_manual_revenues)
    let manualRevQuery = supabase
      .from('platform_manual_revenues')
      .select('id, amount, status, received_at, reference_date')

    if (startDate && endDate) {
      manualRevQuery = manualRevQuery
        .gte('reference_date', startDate.split('T')[0])
        .lte('reference_date', endDate.split('T')[0])
    }

    const { data: manualRevenues, error: manRevError } = await manualRevQuery
    if (manRevError && manRevError.code !== '42P01') throw manRevError

    let receitaManualRecebida = 0
    let receitaManualPendente = 0
    const manualRevList = manualRevenues || []

    for (const rev of manualRevList) {
      const amt = Number(rev.amount || 0)
      if (rev.status === 'received') {
        receitaManualRecebida += amt
      } else if (rev.status === 'pending') {
        receitaManualPendente += amt
      }
    }

    // 4. Consultar Despesas Corporativas (platform_expenses)
    let expensesQuery = supabase
      .from('platform_expenses')
      .select('id, category_id, amount, status, paid_at, due_date, reference_date, platform_financial_categories(name)')

    if (startDate && endDate) {
      expensesQuery = expensesQuery
        .gte('reference_date', startDate.split('T')[0])
        .lte('reference_date', endDate.split('T')[0])
    }

    const { data: expenses, error: expError } = await expensesQuery
    if (expError && expError.code !== '42P01') throw expError

    let despesasPagas = 0
    let despesasPendentes = 0
    const expenseList = expenses || []
    const expenseCategoryMap: Record<string, { name: string; amount: number; count: number }> = {}

    for (const exp of expenseList) {
      const amt = Number(exp.amount || 0)
      const catId = exp.category_id || 'sem_categoria'
      const catName = (exp.platform_financial_categories as any)?.name || 'Outras Despesas'

      if (exp.status === 'paid') {
        despesasPagas += amt
        if (!expenseCategoryMap[catId]) expenseCategoryMap[catId] = { name: catName, amount: 0, count: 0 }
        expenseCategoryMap[catId].amount += amt
        expenseCategoryMap[catId].count++
      } else if (exp.status === 'pending') {
        despesasPendentes += amt
      }
    }

    const expensesByCategory: ExpenseByCategory[] = Object.entries(expenseCategoryMap).map(([catId, data]) => {
      const pct = despesasPagas > 0 ? (data.amount / despesasPagas) * 100 : 0
      return {
        categoryId: catId === 'sem_categoria' ? null : catId,
        categoryName: data.name,
        amount: data.amount,
        percentage: Number(pct.toFixed(1)),
        count: data.count,
      }
    })

    // 5. Cálculos Consolidados de Domínio
    const totalEntradasRecebidas = receitaAutomaticaRecebida + receitaManualRecebida
    const totalEntradasPrevistas = receitaAutomaticaPrevista + receitaManualPendente
    const totalDespesas = despesasPagas + despesasPendentes
    const resultadoLiquido = totalEntradasRecebidas - despesasPagas
    const saldoFinal = saldoInicial + totalEntradasRecebidas - despesasPagas

    const activeInvoicesCount = totalFaturasPagas + totalFaturasPendentes + totalFaturasVencidas
    const inadimplenciaTaxa = activeInvoicesCount > 0 ? (totalFaturasVencidas / activeInvoicesCount) * 100 : 0
    const totalClientesAtivos = payingMinistries.size
    const ticketMedioRecebido = totalClientesAtivos > 0 ? receitaAutomaticaRecebida / totalClientesAtivos : 0

    return {
      saldoInicial,
      saldoFinal,
      resultadoLiquido,
      receitaAutomaticaRecebida,
      receitaManualRecebida,
      totalEntradasRecebidas,
      receitaAutomaticaPrevista,
      receitaManualPendente,
      totalEntradasPrevistas,
      despesasPagas,
      despesasPendentes,
      totalDespesas,
      inadimplenciaValor,
      inadimplenciaQtd,
      inadimplenciaTaxa: Number(inadimplenciaTaxa.toFixed(2)),
      totalFaturasPagas,
      totalFaturasPendentes,
      totalFaturasVencidas,
      totalClientesAtivos,
      ticketMedioRecebido: Number(ticketMedioRecebido.toFixed(2)),
      expensesByCategory,
      revenueByPlan,
    }
  }

  /**
   * Obtém evolução mensal real de receitas e despesas
   */
  static async getMonthlyEvolution(
    supabase: SupabaseClient,
    monthsCount: number = 6
  ): Promise<MonthlyEvolutionData[]> {
    const now = new Date()
    const months: MonthlyEvolutionData[] = []

    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = d.getMonth() + 1
      const mesRef = `${year}-${String(month).padStart(2, '0')}`

      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      const mesLabel = `${monthNames[month - 1]}/${year}`

      const filter: CorporateFinancialReportFilter = {
        startDate: new Date(year, month - 1, 1).toISOString(),
        endDate: new Date(year, month, 0, 23, 59, 59, 999).toISOString(),
      }

      const summary = await this.getFinancialSummary(supabase, filter)

      months.push({
        mesReferencia: mesRef,
        mesLabel,
        receitaSaaSRecebida: summary.receitaAutomaticaRecebida,
        receitaManualRecebida: summary.receitaManualRecebida,
        totalReceitasRecebidas: summary.totalEntradasRecebidas,
        receitaPrevista: summary.totalEntradasPrevistas,
        despesasPagas: summary.despesasPagas,
        despesasPendentes: summary.despesasPendentes,
        resultadoLiquido: summary.resultadoLiquido,
      })
    }

    return months
  }

  /**
   * Obtém demonstração financeira executiva e DRE detalhada para prestação de contas dos sócios
   */
  static async getExecutiveStatement(
    supabase: SupabaseClient,
    filter: CorporateFinancialReportFilter = { periodo: 'este_mes' }
  ): Promise<ExecutiveStatementData> {
    const summary = await this.getFinancialSummary(supabase, filter)
    const { startDate, endDate } = this.resolveDateRange(filter)

    // 1. DRE Estruturada
    const receitaBruta = summary.totalEntradasRecebidas
    const despesasOperacionais = summary.expensesByCategory.map((exp) => ({
      name: exp.categoryName,
      amount: exp.amount,
      percentage: receitaBruta > 0 ? Number(((exp.amount / receitaBruta) * 100).toFixed(1)) : 0,
    }))

    const dre: PlatformDRE = {
      receitaSaaS: summary.receitaAutomaticaRecebida,
      receitasManuais: summary.receitaManualRecebida,
      receitaBruta,
      despesasOperacionais,
      totalDespesas: summary.despesasPagas,
      resultadoLiquido: summary.resultadoLiquido,
      margemLiquida: receitaBruta > 0 ? Number(((summary.resultadoLiquido / receitaBruta) * 100).toFixed(1)) : 0,
    }

    // 2. Faturas SaaS Pagas no Período
    let invQuery = supabase
      .from('platform_billing_invoices')
      .select('id, amount, paid_at, due_date, plano_slug, ministries(name)')
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(100)

    if (startDate && endDate) {
      invQuery = invQuery.gte('paid_at', startDate).lte('paid_at', endDate)
    }

    const { data: invData } = await invQuery
    const recentPaidInvoices = (invData || []).map((inv: any) => ({
      id: inv.id,
      ministryName: inv.ministries?.name || 'Cliente SaaS',
      planName: (inv.plano_slug || 'SaaS').toUpperCase(),
      amount: Number(inv.amount || 0),
      paidAt: inv.paid_at,
      dueDate: inv.due_date,
    }))

    // 3. Receitas Manuais no Período
    let manRevQuery = supabase
      .from('platform_manual_revenues')
      .select('id, description, payer_name, amount, reference_date, received_at, status, platform_financial_categories(name)')
      .order('reference_date', { ascending: false })
      .limit(100)

    if (startDate && endDate) {
      manRevQuery = manRevQuery
        .gte('reference_date', startDate.split('T')[0])
        .lte('reference_date', endDate.split('T')[0])
    }

    const { data: manRevData } = await manRevQuery
    const recentManualRevenues = (manRevData || []).map((rev: any) => ({
      id: rev.id,
      description: rev.description,
      payerName: rev.payer_name,
      categoryName: rev.platform_financial_categories?.name || 'Receitas Avulsas',
      amount: Number(rev.amount || 0),
      referenceDate: rev.reference_date,
      receivedAt: rev.received_at,
    }))

    // 4. Despesas Pagas no Período
    let expPaidQuery = supabase
      .from('platform_expenses')
      .select('id, description, recipient_name, amount, due_date, paid_at, is_recurring, platform_financial_categories(name)')
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(100)

    if (startDate && endDate) {
      expPaidQuery = expPaidQuery
        .gte('reference_date', startDate.split('T')[0])
        .lte('reference_date', endDate.split('T')[0])
    }

    const { data: expPaidData } = await expPaidQuery
    const recentPaidExpenses = (expPaidData || []).map((exp: any) => ({
      id: exp.id,
      description: exp.description,
      recipientName: exp.recipient_name,
      categoryName: exp.platform_financial_categories?.name || 'Geral',
      amount: Number(exp.amount || 0),
      dueDate: exp.due_date,
      paidAt: exp.paid_at,
      isRecurring: Boolean(exp.is_recurring),
    }))

    // 5. Despesas Pendentes (A Pagar)
    let expPendingQuery = supabase
      .from('platform_expenses')
      .select('id, description, recipient_name, amount, due_date, platform_financial_categories(name)')
      .eq('status', 'pending')
      .order('due_date', { ascending: true })
      .limit(100)

    if (startDate && endDate) {
      expPendingQuery = expPendingQuery
        .gte('reference_date', startDate.split('T')[0])
        .lte('reference_date', endDate.split('T')[0])
    }

    const { data: expPendingData } = await expPendingQuery
    const pendingExpenses = (expPendingData || []).map((exp: any) => ({
      id: exp.id,
      description: exp.description,
      recipientName: exp.recipient_name,
      categoryName: exp.platform_financial_categories?.name || 'Geral',
      amount: Number(exp.amount || 0),
      dueDate: exp.due_date,
    }))

    return {
      summary,
      dre,
      recentPaidInvoices,
      recentManualRevenues,
      recentPaidExpenses,
      pendingExpenses,
    }
  }
}
