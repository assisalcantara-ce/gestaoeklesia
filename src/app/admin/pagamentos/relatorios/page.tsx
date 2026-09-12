'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import { authenticatedFetch } from '@/lib/api-client'
import AdminSidebar from '@/components/AdminSidebar'
import { temAcessoAdmin } from '@/lib/access-control'
import {
  CorporateFinancialSummary,
  MonthlyEvolutionData,
} from '@/lib/platform/finance'
import FinanceNavTabs, { FinanceTabKey } from '@/components/admin/finance/FinanceNavTabs'
import ManualRevenuesTab from '@/components/admin/finance/ManualRevenuesTab'
import CorporateExpensesTab from '@/components/admin/finance/CorporateExpensesTab'
import FinancialCategoriesTab from '@/components/admin/finance/FinancialCategoriesTab'
import FinancialBalancesTab from '@/components/admin/finance/FinancialBalancesTab'
import ExecutiveStatementTab from '@/components/admin/finance/ExecutiveStatementTab'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  BarChart3,
  TrendingUp,
  Filter,
  RefreshCw,
  RotateCcw,
  ArrowLeft,
  DollarSign,
  AlertTriangle,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  PieChart as PieIcon,
  Layers,
  FileText,
  Tag,
} from 'lucide-react'

const PIE_COLORS = ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6']

export default function RelatoriosFinanceirosPage() {
  const { isLoading: isAuthLoading, isAuthenticated, adminUser } = useAdminAuth()
  const router = useRouter()

  // Aba Ativa da Central Financeira
  const [activeTab, setActiveTab] = useState<FinanceTabKey>('overview')

  // Estados dos Filtros Globais
  const [periodo, setPeriodo] = useState<string>('este_mes')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [clienteId, setClienteId] = useState<string>('todos')
  const [statusCobranca, setStatusCobranca] = useState<string>('todos')
  const [planoSlug, setPlanoSlug] = useState<string>('todos')

  // Dados Reais da API
  const [summary, setSummary] = useState<CorporateFinancialSummary | null>(null)
  const [evolution, setEvolution] = useState<MonthlyEvolutionData[]>([])
  const [ministriesList, setMinistriesList] = useState<{ id: string; name: string }[]>([])
  const [plansList, setPlansList] = useState<{ slug: string; name: string }[]>([])

  // Estados de Carregamento e Erro
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')

  // Formatação em Moeda BRL
  const formatCurrency = (value: number | undefined | null) => {
    return (value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  // Carregar lista de clientes e planos para os filtros
  const fetchAuxiliaryFilters = useCallback(async () => {
    try {
      const minRes = await authenticatedFetch('/api/v1/admin/ministries?limit=200')
      if (minRes.ok) {
        const minData = await minRes.json()
        setMinistriesList(
          (minData.data || []).map((m: any) => ({
            id: m.id,
            name: m.name,
          }))
        )
      }

      const planRes = await authenticatedFetch('/api/v1/admin/plans')
      if (planRes.ok) {
        const planData = await planRes.json()
        setPlansList(
          (planData.data || []).map((p: any) => ({
            slug: p.slug,
            name: p.name,
          }))
        )
      }
    } catch (err) {
      console.warn('Erro ao carregar filtros auxiliares:', err)
    }
  }, [])

  // Buscar dados consolidados da Central Financeira
  const fetchFinancialData = useCallback(async () => {
    try {
      setError('')
      const params = new URLSearchParams()
      params.append('periodo', periodo)
      if (periodo === 'customizado' && startDate && endDate) {
        params.append('startDate', new Date(startDate).toISOString())
        params.append('endDate', new Date(endDate + 'T23:59:59').toISOString())
      }
      if (clienteId !== 'todos') params.append('ministryId', clienteId)
      if (planoSlug !== 'todos') params.append('planoSlug', planoSlug)
      if (statusCobranca !== 'todos') params.append('statusCobranca', statusCobranca)

      const response = await authenticatedFetch('/api/v1/admin/corporate-finance/summary?' + params.toString())
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login')
          return
        }
        if (response.status === 403) {
          setError('Acesso negado para este módulo.')
          return
        }
        throw new Error('Erro ao carregar dados financeiros da plataforma')
      }

      const resData = await response.json()
      setSummary(resData.summary || null)
      setEvolution(resData.evolution || [])
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao consultar a API.')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [periodo, startDate, endDate, clienteId, planoSlug, statusCobranca, router])

  useEffect(() => {
    if (!isAuthLoading) {
      if (!isAuthenticated) {
        router.push('/admin/login')
        return
      }
      if (!temAcessoAdmin(adminUser?.role, 'pagamentos')) {
        router.push('/admin/dashboard')
        return
      }
      fetchAuxiliaryFilters()
      fetchFinancialData()
    }
  }, [isAuthLoading, isAuthenticated, adminUser, router, fetchAuxiliaryFilters, fetchFinancialData])

  const handleLimparFiltros = () => {
    setPeriodo('este_mes')
    setStartDate('')
    setEndDate('')
    setClienteId('todos')
    setStatusCobranca('todos')
    setPlanoSlug('todos')
  }

  const handleAtualizar = () => {
    setIsRefreshing(true)
    fetchFinancialData()
  }

  const resultadoStatus = useMemo(() => {
    const r = summary?.resultadoLiquido || 0
    if (r > 0) return { label: 'Superávit Operacional', color: 'emerald', icon: ArrowUpRight }
    if (r < 0) return { label: 'Déficit Operacional', color: 'rose', icon: ArrowDownRight }
    return { label: 'Equilíbrio Financeiro', color: 'slate', icon: TrendingUp }
  }, [summary?.resultadoLiquido])

  if (isAuthLoading) {
    return (
      <div className="flex h-screen bg-gray-950 text-white items-center justify-center">
        <p className="text-sm text-gray-400">Carregando Central Financeira...</p>
      </div>
    )
  }

    return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden print:bg-white print:text-black print:h-auto print:overflow-visible">
      <AdminSidebar />

      <main className="flex-1 flex flex-col overflow-y-auto print:overflow-visible print:p-0 print:m-0 print:w-full print:max-w-none">
        {/* Cabeçalho Executivo */}
        <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur px-8 py-6 sticky top-0 z-10 print:hidden">
          <div className="max-w-7xl mx-auto space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
              <Link href="/admin/dashboard" className="hover:text-white transition">
                Painel Admin
              </Link>
              <span>/</span>
              <Link href="/admin/pagamentos" className="hover:text-white transition">
                Financeiro
              </Link>
              <span>/</span>
              <span className="text-blue-400 font-bold">Central Financeira</span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                  <BarChart3 className="text-blue-500 h-7 w-7" />
                  Central Financeira da Plataforma
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  Visão executiva e consolidada de faturamento SaaS, receitas avulsas, despesas e fluxo de caixa.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setActiveTab('revenues')}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-semibold transition shadow-sm shadow-blue-500/20 cursor-pointer"
                >
                  <ArrowDownRight className="h-3.5 w-3.5" />
                  Nova Receita
                </button>
                <button
                  onClick={() => setActiveTab('expenses')}
                  className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white px-3 py-2 rounded-lg text-xs font-semibold transition shadow-sm shadow-rose-500/20 cursor-pointer"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Nova Despesa
                </button>
                <button
                  onClick={() => setActiveTab('balances')}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  <Wallet className="h-3.5 w-3.5 text-amber-400" />
                  Configurar Saldo
                </button>
                <button
                  onClick={() => setActiveTab('categories')}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  <Tag className="h-3.5 w-3.5 text-purple-400" />
                  Categorias
                </button>
                <button
                  onClick={() => router.push('/admin/pagamentos')}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 border border-gray-700 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer"
                  title="Cobranças SaaS"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Cobranças
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl w-full mx-auto space-y-6 print:p-0 print:m-0 print:max-w-none print:w-full">
          {/* Navegação por Abas da Central Financeira */}
          <div className="print:hidden">
            <FinanceNavTabs activeTab={activeTab} onSelectTab={(tab) => setActiveTab(tab)} />
          </div>

          {/* Renderização Condicional das Abas Operacionais */}
          {activeTab === 'statement' && (
            <ExecutiveStatementTab onDataChanged={fetchFinancialData} />
          )}

          {activeTab === 'revenues' && (
            <ManualRevenuesTab onDataChanged={fetchFinancialData} />
          )}

          {activeTab === 'expenses' && (
            <CorporateExpensesTab onDataChanged={fetchFinancialData} />
          )}

          {activeTab === 'categories' && (
            <FinancialCategoriesTab onDataChanged={fetchFinancialData} />
          )}

          {activeTab === 'balances' && (
            <FinancialBalancesTab onDataChanged={fetchFinancialData} />
          )}

          {/* Conteúdo da Visão Geral Executiva */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in">
              {/* Alerta de Erro */}
              {error && (
                <div className="bg-red-950/60 border border-red-800 text-red-300 p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
                    <span className="text-xs font-semibold">{error}</span>
                  </div>
                  <button
                    onClick={handleAtualizar}
                    className="text-xs text-red-200 underline hover:text-white font-bold cursor-pointer"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

          {/* Barra de Filtros Globais Reais */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-blue-400" />
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-gray-300">
                  Filtros de Análise Financeira
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleLimparFiltros}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg text-xs font-semibold border border-gray-700 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Limpar Filtros
                </button>

                <button
                  onClick={handleAtualizar}
                  disabled={isRefreshing || loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={'w-3.5 h-3.5 ' + (isRefreshing ? 'animate-spin' : '')} />
                  Atualizar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Período */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Período
                </label>
                <select
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:border-blue-500 focus:outline-none cursor-pointer transition"
                >
                  <option value="este_mes">Este Mês</option>
                  <option value="mes_passado">Mês Passado</option>
                  <option value="90_dias">Últimos 90 dias</option>
                  <option value="este_ano">Este Ano (2026)</option>
                  <option value="todos">Todo o Período</option>
                  <option value="customizado">Personalizado</option>
                </select>
              </div>

              {/* 2. Cliente (Ministério) Dinâmico */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Cliente / Ministério
                </label>
                <select
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:border-blue-500 focus:outline-none cursor-pointer transition"
                >
                  <option value="todos">Todos os Clientes</option>
                  {ministriesList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Plano Dinâmico */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Plano Comercial
                </label>
                <select
                  value={planoSlug}
                  onChange={(e) => setPlanoSlug(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:border-blue-500 focus:outline-none cursor-pointer transition"
                >
                  <option value="todos">Todos os Planos</option>
                  {plansList.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Status de Cobrança */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Status de Cobrança
                </label>
                <select
                  value={statusCobranca}
                  onChange={(e) => setStatusCobranca(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:border-blue-500 focus:outline-none cursor-pointer transition"
                >
                  <option value="todos">Todos os Status</option>
                  <option value="paid">Pago (Recebido)</option>
                  <option value="pending">Pendente (Previsto)</option>
                  <option value="overdue">Vencido (Inadimplente)</option>
                </select>
              </div>
            </div>

            {/* Inputs de Data para Período Personalizado */}
            {periodo === 'customizado' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-800/80">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Data Inicial
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Data Final
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 6 Cards Executivos Reais */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              Indicadores Financeiros Executivos
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* CARD 1: Saldo Financeiro */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-xl flex flex-col justify-between hover:border-gray-700 transition">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Saldo em Caixa</span>
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                    <Wallet className="h-4 w-4" />
                  </div>
                </div>
                <div className="my-2">
                  <p className="text-xl font-extrabold text-white tracking-tight">
                    {loading ? '...' : formatCurrency(summary?.saldoFinal)}
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-800/80 text-[11px] text-gray-400 flex items-center justify-between">
                  <span>Inicial:</span>
                  <span className="font-semibold text-gray-300">{formatCurrency(summary?.saldoInicial)}</span>
                </div>
              </div>

              {/* CARD 2: Entradas Recebidas */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-xl flex flex-col justify-between hover:border-gray-700 transition">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Entradas Recebidas</span>
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <DollarSign className="h-4 w-4" />
                  </div>
                </div>
                <div className="my-2">
                  <p className="text-xl font-extrabold text-emerald-400 tracking-tight">
                    {loading ? '...' : formatCurrency(summary?.totalEntradasRecebidas)}
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-800/80 text-[11px] text-gray-400 flex items-center justify-between">
                  <span>SaaS:</span>
                  <span className="font-semibold text-gray-300">{formatCurrency(summary?.receitaAutomaticaRecebida)}</span>
                </div>
              </div>

              {/* CARD 3: Despesas Pagas */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-xl flex flex-col justify-between hover:border-gray-700 transition">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Despesas Pagas</span>
                  <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                    <ArrowDownRight className="h-4 w-4" />
                  </div>
                </div>
                <div className="my-2">
                  <p className="text-xl font-extrabold text-rose-400 tracking-tight">
                    {loading ? '...' : formatCurrency(summary?.despesasPagas)}
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-800/80 text-[11px] text-gray-400 flex items-center justify-between">
                  <span>Pendentes:</span>
                  <span className="font-semibold text-gray-300">{formatCurrency(summary?.despesasPendentes)}</span>
                </div>
              </div>

              {/* CARD 4: Resultado do Período */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-xl flex flex-col justify-between hover:border-gray-700 transition">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Resultado Líquido</span>
                  <div className={'p-2 rounded-lg ' + (resultadoStatus.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400' : resultadoStatus.color === 'rose' ? 'bg-rose-500/10 text-rose-400' : 'bg-gray-800 text-gray-300')}>
                    <resultadoStatus.icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="my-2">
                  <p className={'text-xl font-extrabold tracking-tight ' + (resultadoStatus.color === 'emerald' ? 'text-emerald-400' : resultadoStatus.color === 'rose' ? 'text-rose-400' : 'text-gray-200')}>
                    {loading ? '...' : formatCurrency(summary?.resultadoLiquido)}
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-800/80 text-[11px] text-gray-400 flex items-center justify-between">
                  <span>Status:</span>
                  <span className={'font-semibold ' + (resultadoStatus.color === 'emerald' ? 'text-emerald-400' : resultadoStatus.color === 'rose' ? 'text-rose-400' : 'text-gray-300')}>
                    {resultadoStatus.label}
                  </span>
                </div>
              </div>

              {/* CARD 5: A Receber */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-xl flex flex-col justify-between hover:border-gray-700 transition">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">A Receber</span>
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
                <div className="my-2">
                  <p className="text-xl font-extrabold text-indigo-400 tracking-tight">
                    {loading ? '...' : formatCurrency(summary?.totalEntradasPrevistas)}
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-800/80 text-[11px] text-gray-400 flex items-center justify-between">
                  <span>Faturas:</span>
                  <span className="font-semibold text-gray-300">{(summary?.totalFaturasPendentes || 0)} pendentes</span>
                </div>
              </div>

              {/* CARD 6: Inadimplência */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-xl flex flex-col justify-between hover:border-gray-700 transition">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Inadimplência</span>
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                </div>
                <div className="my-2">
                  <p className="text-xl font-extrabold text-amber-400 tracking-tight">
                    {loading ? '...' : formatCurrency(summary?.inadimplenciaValor)}
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-800/80 text-[11px] text-gray-400 flex items-center justify-between">
                  <span>{(summary?.totalFaturasVencidas || 0)} faturas</span>
                  <span className="font-semibold text-amber-400">{(summary?.inadimplenciaTaxa || 0)}% taxa</span>
                </div>
              </div>
            </div>
          </section>

          {/* Seção de Fluxo Financeiro do Período */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-400" />
                  Demonstrativo de Fluxo Financeiro
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Conciliação patrimonial consolidada para prestação de contas executiva.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-7 items-center gap-3 bg-gray-950/80 border border-gray-800 p-5 rounded-xl text-center">
              {/* Saldo Inicial */}
              <div className="p-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Saldo Inicial</p>
                <p className="text-lg font-black text-gray-200 mt-1">{formatCurrency(summary?.saldoInicial)}</p>
              </div>

              {/* Operador + */}
              <div className="text-emerald-400 text-xl font-black hidden md:block">+</div>

              {/* Entradas */}
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-lg">
                <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Entradas Recebidas</p>
                <p className="text-lg font-black text-emerald-400 mt-1">{formatCurrency(summary?.totalEntradasRecebidas)}</p>
              </div>

              {/* Operador - */}
              <div className="text-rose-400 text-xl font-black hidden md:block">-</div>

              {/* Saídas */}
              <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-lg">
                <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Despesas Pagas</p>
                <p className="text-lg font-black text-rose-400 mt-1">{formatCurrency(summary?.despesasPagas)}</p>
              </div>

              {/* Operador = */}
              <div className="text-blue-400 text-xl font-black hidden md:block">=</div>

              {/* Saldo Final */}
              <div className="p-3 bg-blue-950/20 border border-blue-900/40 rounded-lg">
                <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">Saldo Final</p>
                <p className="text-lg font-black text-blue-400 mt-1">{formatCurrency(summary?.saldoFinal)}</p>
              </div>
            </div>
          </section>

          {/* Gráficos de Evolução e Composição */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico 1: Evolução Financeira (Recharts BarChart) - 2 Colunas */}
            <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  Evolução Financeira Mensal
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Comparativo de receitas recebidas, despesas pagas e resultado líquido.
                </p>
              </div>

              <div className="h-72 w-full pt-4">
                {evolution.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-gray-500">
                    Não foram encontradas movimentações para o período selecionado.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={evolution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis dataKey="mesLabel" stroke="#9ca3af" fontSize={11} />
                      <YAxis
                        stroke="#9ca3af"
                        fontSize={11}
                        tickFormatter={(v) => 'R$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px' }}
                        formatter={(val: any) => [formatCurrency(val), '']}
                        labelStyle={{ color: '#ffffff', fontWeight: 'bold', marginBottom: '4px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar dataKey="totalReceitasRecebidas" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="despesasPagas" name="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="resultadoLiquido" name="Resultado" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Gráfico 2: Composição de Receita por Plano */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <PieIcon className="w-5 h-5 text-indigo-400" />
                  Receitas por Plano
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Distribuição do faturamento por categoria de licença.
                </p>
              </div>

              <div className="h-72 w-full flex flex-col items-center justify-center">
                {(!summary?.revenueByPlan || summary.revenueByPlan.length === 0) ? (
                  <div className="text-center text-xs text-gray-500">
                    Sem faturamento registrado para o filtro.
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={summary.revenueByPlan}
                          dataKey="amount"
                          nameKey="planName"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          innerRadius={40}
                          paddingAngle={3}
                        >
                          {summary.revenueByPlan.map((_, index) => (
                            <Cell key={'cell-' + index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px' }}
                          formatter={(val: any) => [formatCurrency(val), '']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="w-full space-y-1 mt-2 text-xs">
                      {summary.revenueByPlan.map((item, idx) => (
                        <div key={item.planSlug} className="flex items-center justify-between text-gray-300">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                            <span>{item.planName}</span>
                          </div>
                          <span className="font-bold text-white">{item.percentage}% ({formatCurrency(item.amount)})</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Despesas por Categoria */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl space-y-4">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Tag className="w-5 h-5 text-rose-400" />
                Despesas Corporativas por Categoria
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Alocação de custos operacionais e administrativos da empresa.
              </p>
            </div>

            {(!summary?.expensesByCategory || summary.expensesByCategory.length === 0) ? (
              <div className="p-8 text-center text-xs text-gray-500 bg-gray-950/60 rounded-xl border border-gray-800/80">
                Não foram registradas despesas operacionais para o período selecionado.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {summary.expensesByCategory.map((cat, idx) => (
                  <div key={idx} className="bg-gray-950/60 border border-gray-800 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">{cat.categoryName}</p>
                      <p className="text-[11px] text-gray-400">{cat.count} lançamentos ({cat.percentage}%)</p>
                    </div>
                    <span className="text-sm font-extrabold text-rose-400">{formatCurrency(cat.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Resumo Analítico do Período (DRE Consolidado) */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl space-y-4">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Resumo Financeiro e Demonstrativo do Período
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Demonstrativo analítico consolidado das receitas, despesas e variação patrimonial.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-gray-950 text-gray-400 uppercase font-bold border-b border-gray-800">
                  <tr>
                    <th className="py-3 px-4">Grupo Contábil</th>
                    <th className="py-3 px-4">Detalhamento</th>
                    <th className="py-3 px-4 text-right">Valor Consolidado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {/* Entradas */}
                  <tr className="bg-emerald-950/10">
                    <td className="py-2.5 px-4 font-bold text-emerald-400" rowSpan={3}>
                      ENTRADAS
                    </td>
                    <td className="py-2.5 px-4 text-gray-300">Receitas Recorrentes SaaS (Assinaturas Pagas)</td>
                    <td className="py-2.5 px-4 font-bold text-right text-emerald-400">
                      {formatCurrency(summary?.receitaAutomaticaRecebida)}
                    </td>
                  </tr>
                  <tr className="bg-emerald-950/10">
                    <td className="py-2.5 px-4 text-gray-300">Receitas Manuais / Serviços / Consultoria</td>
                    <td className="py-2.5 px-4 font-bold text-right text-emerald-400">
                      {formatCurrency(summary?.receitaManualRecebida)}
                    </td>
                  </tr>
                  <tr className="bg-emerald-950/20 font-extrabold border-b border-emerald-900/40">
                    <td className="py-2.5 px-4 text-emerald-300">Total de Entradas Recebidas</td>
                    <td className="py-2.5 px-4 text-right text-emerald-300">
                      {formatCurrency(summary?.totalEntradasRecebidas)}
                    </td>
                  </tr>

                  {/* Saídas */}
                  <tr className="bg-rose-950/10">
                    <td className="py-2.5 px-4 font-bold text-rose-400" rowSpan={2}>
                      SAÍDAS
                    </td>
                    <td className="py-2.5 px-4 text-gray-300">Despesas Operacionais e Administrativas Pagas</td>
                    <td className="py-2.5 px-4 font-bold text-right text-rose-400">
                      {formatCurrency(summary?.despesasPagas)}
                    </td>
                  </tr>
                  <tr className="bg-rose-950/20 font-extrabold border-b border-rose-900/40">
                    <td className="py-2.5 px-4 text-rose-300">Total de Despesas Pagas</td>
                    <td className="py-2.5 px-4 text-right text-rose-300">
                      {formatCurrency(summary?.despesasPagas)}
                    </td>
                  </tr>

                  {/* Resultados */}
                  <tr className="bg-gray-950 font-bold">
                    <td className="py-3 px-4 text-white" rowSpan={3}>
                      RESULTADO & CAIXA
                    </td>
                    <td className="py-2.5 px-4 text-gray-300">Resultado Operacional Líquido</td>
                    <td className={'py-2.5 px-4 font-black text-right ' + (resultadoStatus.color === 'emerald' ? 'text-emerald-400' : resultadoStatus.color === 'rose' ? 'text-rose-400' : 'text-gray-200')}>
                      {formatCurrency(summary?.resultadoLiquido)}
                    </td>
                  </tr>
                  <tr className="bg-gray-950">
                    <td className="py-2.5 px-4 text-gray-400">Saldo Inicial em Caixa</td>
                    <td className="py-2.5 px-4 font-semibold text-right text-gray-300">
                      {formatCurrency(summary?.saldoInicial)}
                    </td>
                  </tr>
                  <tr className="bg-blue-950/20 font-extrabold">
                    <td className="py-3 px-4 text-blue-300">Saldo Final em Caixa</td>
                    <td className="py-3 px-4 font-black text-right text-blue-300 text-sm">
                      {formatCurrency(summary?.saldoFinal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
