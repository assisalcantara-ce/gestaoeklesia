'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { authenticatedFetch } from '@/lib/api-client'
import { ExecutiveStatementData, DRECategoryItem } from '@/lib/platform/finance'
import {
  Printer,
  Download,
  RefreshCw,
  FileCheck,
  Calendar,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Scale,
  PieChart as PieIcon,
  CheckCircle2,
  Clock,
} from 'lucide-react'

export default function ExecutiveStatementTab({
  onDataChanged,
}: {
  onDataChanged?: () => void
}) {
  const [data, setData] = useState<ExecutiveStatementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')

  // Filtros de Período
  const [periodo, setPeriodo] = useState<string>('este_mes')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Formatação BRL
  const formatCurrency = (val: number | undefined | null) => {
    return (val || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  // Formatação de Data
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  }

  // Carregar dados da prestação de contas
  const fetchStatement = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      params.append('periodo', periodo)
      if (periodo === 'custom') {
        if (startDate) params.append('startDate', startDate)
        if (endDate) params.append('endDate', endDate)
      }

      const res = await authenticatedFetch(
        `/api/v1/admin/corporate-finance/statement?${params.toString()}`
      )
      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Erro ao carregar prestação de contas.')
      }

      const result = await res.json()
      if (result.success && result.data) {
        setData(result.data)
      } else {
        throw new Error('Formato de resposta inválido.')
      }
    } catch (err: any) {
      console.error('Erro na prestação de contas:', err)
      setError(err.message || 'Falha ao buscar demonstrativo financeiro.')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [periodo, startDate, endDate])

  useEffect(() => {
    fetchStatement()
  }, [fetchStatement])

  // Identificação do período amigável
  const periodLabel = useMemo(() => {
    switch (periodo) {
      case 'este_mes':
        return 'Mês Atual'
      case 'mes_passado':
        return 'Mês Anterior'
      case '1_trimestre':
        return '1º Trimestre'
      case '2_trimestre':
        return '2º Trimestre'
      case '3_trimestre':
        return '3º Trimestre'
      case '4_trimestre':
        return '4º Trimestre'
      case 'este_ano':
        return 'Ano Atual'
      case 'ano_passado':
        return 'Ano Anterior'
      case 'custom':
        return startDate && endDate
          ? `${formatDate(startDate)} a ${formatDate(endDate)}`
          : 'Período Personalizado'
      default:
        return 'Período Selecionado'
    }
  }, [periodo, startDate, endDate])

  // Ação de Impressão
  const handlePrint = () => {
    window.print()
  }

  // Exportação CSV
  const handleExportCSV = () => {
    if (!data) return

    const summary = data.summary
    const dre = data.dre

    const rows: string[][] = [
      ['GESTAO EKLESIA - PRESTACAO DE CONTAS EXECUTIVA'],
      [`Periodo:`, periodLabel],
      [`Data de Geracao:`, new Date().toLocaleString('pt-BR')],
      [''],
      ['--- DEMONSTRATIVO DE FLUXO DE CAIXA REALIZADO ---'],
      ['Item', 'Valor (R$)'],
      ['Saldo Inicial do Periodo (+)', summary.saldoInicial.toFixed(2)],
      ['Receitas Assinaturas SaaS (+)', summary.receitaAutomaticaRecebida.toFixed(2)],
      ['Receitas Manuais / Outras (+)', summary.receitaManualRecebida.toFixed(2)],
      ['Total Entradas Realizadas (=)', summary.totalEntradasRecebidas.toFixed(2)],
      ['Despesas Corporativas Pagas (-)', summary.despesasPagas.toFixed(2)],
      ['Resultado Operacional do Periodo (=)', summary.resultadoLiquido.toFixed(2)],
      ['SALDO FINAL REALIZADO EM CAIXA (=)', summary.saldoFinal.toFixed(2)],
      [''],
      ['--- PROJECAO E PENDENCIAS (NAO IMPACTAM CAIXA REAL) ---'],
      ['Receitas SaaS Previstas / Em Aberto', summary.receitaAutomaticaPrevista.toFixed(2)],
      ['Receitas Manuais Pendentes', summary.receitaManualPendente.toFixed(2)],
      ['Despesas Corporativas Pendentes', summary.despesasPendentes.toFixed(2)],
      ['Inadimplencia SaaS (Vencidas)', summary.inadimplenciaValor.toFixed(2)],
      ['Taxa de Inadimplencia (%)', `${summary.inadimplenciaTaxa.toFixed(1)}%`],
      ['Total Entradas Previstas', summary.totalEntradasPrevistas.toFixed(2)],
      ['Total Despesas Previstas', summary.totalDespesas.toFixed(2)],
      [''],
      ['--- DRE SIMPLIFICADA (COMPETENCIA / REALIZADO) ---'],
      ['Conta', 'Valor (R$)', '% Receita Bruta'],
      ['(+) Receita SaaS Recebida', dre.receitaSaaS.toFixed(2), dre.receitaBruta > 0 ? `${((dre.receitaSaaS / dre.receitaBruta) * 100).toFixed(1)}%` : '0%'],
      ['(+) Outras Receitas Corporativas', dre.receitasManuais.toFixed(2), dre.receitaBruta > 0 ? `${((dre.receitasManuais / dre.receitaBruta) * 100).toFixed(1)}%` : '0%'],
      ['(=) RECEITA BRUTA TOTAL', dre.receitaBruta.toFixed(2), '100.0%'],
      ...dre.despesasOperacionais.map((d: DRECategoryItem) => [
        `(-) ${d.name}`,
        d.amount.toFixed(2),
        `${d.percentage.toFixed(1)}%`,
      ]),
      ['(=) TOTAL DE DESPESAS OPERACIONAIS', dre.totalDespesas.toFixed(2), dre.receitaBruta > 0 ? `${((dre.totalDespesas / dre.receitaBruta) * 100).toFixed(1)}%` : '0%'],
      ['(=) RESULTADO LIQUIDO DO PERIODO', dre.resultadoLiquido.toFixed(2), `${dre.margemLiquida.toFixed(1)}%`],
      [''],
      ['--- FATURAS SAAS PAGAS NO PERIODO ---'],
      ['ID', 'Tenant / Igreja', 'Plano', 'Valor (R$)', 'Data Pagamento'],
      ...data.recentPaidInvoices.map((inv) => [
        inv.id,
        `"${inv.ministryName.replace(/"/g, '""')}"`,
        `"${inv.planName}"`,
        inv.amount.toFixed(2),
        inv.paidAt ? formatDate(inv.paidAt) : '-',
      ]),
      [''],
      ['--- RECEITAS MANUAIS REALIZADAS ---'],
      ['Descricao', 'Pagador / Origem', 'Categoria', 'Valor (R$)', 'Data Recebimento'],
      ...data.recentManualRevenues.map((rec) => [
        `"${rec.description.replace(/"/g, '""')}"`,
        `"${(rec.payerName || '-').replace(/"/g, '""')}"`,
        `"${rec.categoryName}"`,
        rec.amount.toFixed(2),
        rec.receivedAt ? formatDate(rec.receivedAt) : formatDate(rec.referenceDate),
      ]),
      [''],
      ['--- DESPESAS CORPORATIVAS PAGAS ---'],
      ['Descricao', 'Fornecedor / Beneficiario', 'Categoria', 'Valor (R$)', 'Data Pagamento'],
      ...data.recentPaidExpenses.map((exp) => [
        `"${exp.description.replace(/"/g, '""')}"`,
        `"${(exp.recipientName || '-').replace(/"/g, '""')}"`,
        `"${exp.categoryName}"`,
        exp.amount.toFixed(2),
        exp.paidAt ? formatDate(exp.paidAt) : formatDate(exp.dueDate),
      ]),
      [''],
      ['--- DESPESAS PENDENTES / A PAGAR ---'],
      ['Descricao', 'Fornecedor', 'Categoria', 'Valor (R$)', 'Vencimento'],
      ...data.pendingExpenses.map((exp) => [
        `"${exp.description.replace(/"/g, '""')}"`,
        `"${(exp.recipientName || '-').replace(/"/g, '""')}"`,
        `"${exp.categoryName}"`,
        exp.amount.toFixed(2),
        formatDate(exp.dueDate),
      ]),
    ]

    const csvContent = '\uFEFF' + rows.map((r) => r.join(';')).join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `prestacao_contas_eklesia_${periodo}_${new Date().toISOString().split('T')[0]}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* 1. BARRA DE CONTROLE E FILTROS (Oculta na impressão) */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 backdrop-blur print:hidden space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
              <FileCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Prestação de Contas Executiva & Sócios
              </h2>
              <p className="text-xs text-gray-400">
                Consolidação financeira oficial, DRE estruturada e demonstrativo de caixa para reuniões de sócios e auditoria.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => {
                fetchStatement(true)
                if (onDataChanged) onDataChanged()
              }}
              disabled={loading || isRefreshing}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              title="Atualizar dados"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`}
              />
              Atualizar
            </button>

            <button
              onClick={handleExportCSV}
              disabled={!data || loading}
              className="flex items-center gap-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white border border-emerald-600/50 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer shadow-sm shadow-emerald-700/20 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </button>

            <button
              onClick={handlePrint}
              disabled={!data || loading}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer shadow-sm shadow-blue-500/20 disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir / Salvar PDF
            </button>
          </div>
        </div>

        {/* Filtros de Período */}
        <div className="pt-3 border-t border-gray-800/80 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
            <Calendar className="h-3.5 w-3.5 text-blue-400" />
            <span>Período do Relatório:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'este_mes', label: 'Este Mês' },
              { id: 'mes_passado', label: 'Mês Passado' },
              { id: '1_trimestre', label: '1º Trimestre' },
              { id: '2_trimestre', label: '2º Trimestre' },
              { id: '3_trimestre', label: '3º Trimestre' },
              { id: '4_trimestre', label: '4º Trimestre' },
              { id: 'este_ano', label: 'Este Ano' },
              { id: 'ano_passado', label: 'Ano Passado' },
              { id: 'custom', label: 'Personalizado' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  periodo === p.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-950 text-gray-400 hover:text-gray-200 border border-gray-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {periodo === 'custom' && (
            <div className="flex items-center gap-2 bg-gray-950 px-3 py-1 rounded-lg border border-gray-800 ml-auto">
              <span className="text-[11px] text-gray-500 font-medium">De:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-gray-200 border-0 focus:ring-0 p-0"
              />
              <span className="text-[11px] text-gray-500 font-medium">Até:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-gray-200 border-0 focus:ring-0 p-0"
              />
            </div>
          )}
        </div>
      </div>

      {/* Alerta de Erro */}
      {error && (
        <div className="bg-rose-950/60 border border-rose-800 text-rose-300 p-4 rounded-xl flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            onClick={() => fetchStatement(true)}
            className="text-xs font-bold text-rose-400 underline hover:text-rose-300"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* ESTADO DE CARREGAMENTO */}
      {loading ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 flex flex-col items-center justify-center space-y-4">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-400">Consolidando demonstrativos para os sócios...</p>
        </div>
      ) : data ? (
        /* ÁREA DO RELATÓRIO EXECUTIVO (FORMATADO PARA TELA E IMPRESSÃO) */
        <div className="space-y-8 print:text-black print:bg-white print:p-0 print:m-0 print:space-y-6">
          
          {/* CABEÇALHO FORMAL PARA IMPRESSÃO (Visível na impressão ou topo do relatório) */}
          <div className="hidden print:block border-b-2 border-gray-900 pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-gray-950">
                  GESTÃO EKLÉSIA
                </h1>
                <p className="text-sm font-semibold text-gray-700">
                  Relatório Executivo e Prestação de Contas aos Sócios
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Período de Referência: <strong className="text-gray-900">{periodLabel}</strong>
                </p>
              </div>
              <div className="text-right text-xs text-gray-600">
                <p>Emissão: {new Date().toLocaleString('pt-BR')}</p>
                <p>Status: Consolidado Oficial</p>
                <p>Moeda: Real Brasileiro (BRL)</p>
              </div>
            </div>
          </div>

          {/* 2. DEMONSTRATIVO DE FLUXO DE CAIXA REALIZADO (EQUAÇÃO OFICIAL) */}
          <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-6 backdrop-blur shadow-xl print:bg-white print:border-gray-300 print:shadow-none print:p-4">
            <div className="flex items-center justify-between border-b border-gray-800 print:border-gray-300 pb-4 mb-6">
              <div className="flex items-center gap-2.5">
                <Scale className="h-5 w-5 text-blue-400 print:text-gray-800" />
                <h3 className="text-base font-bold text-white print:text-gray-900">
                  Demonstrativo de Fluxo de Caixa Realizado
                </h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full print:bg-gray-100 print:text-gray-800 print:border-gray-300">
                Base Efetiva / Caixa
              </span>
            </div>

            {/* Grid da Equação Financeira */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {/* Saldo Inicial */}
              <div className="bg-gray-950/70 border border-gray-800 rounded-xl p-4 print:bg-gray-50 print:border-gray-300">
                <p className="text-[11px] font-medium text-gray-400 print:text-gray-600">
                  (+) Saldo Inicial do Período
                </p>
                <p className="text-xl font-bold text-gray-200 print:text-gray-900 mt-1">
                  {formatCurrency(data.summary.saldoInicial)}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">
                  Saldo de abertura cadastrado
                </p>
              </div>

              {/* Total de Entradas Realizadas */}
              <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4 print:bg-gray-50 print:border-gray-300">
                <p className="text-[11px] font-medium text-emerald-400 print:text-gray-700">
                  (+) Total Receitas Recebidas
                </p>
                <p className="text-xl font-bold text-emerald-400 print:text-gray-900 mt-1">
                  {formatCurrency(data.summary.totalEntradasRecebidas)}
                </p>
                <div className="text-[10px] text-emerald-500/80 print:text-gray-600 mt-1 space-y-0.5">
                  <div>SaaS: {formatCurrency(data.summary.receitaAutomaticaRecebida)}</div>
                  <div>Manuais: {formatCurrency(data.summary.receitaManualRecebida)}</div>
                </div>
              </div>

              {/* Total de Despesas Pagas */}
              <div className="bg-rose-950/20 border border-rose-800/40 rounded-xl p-4 print:bg-gray-50 print:border-gray-300">
                <p className="text-[11px] font-medium text-rose-400 print:text-gray-700">
                  (-) Despesas Pagas
                </p>
                <p className="text-xl font-bold text-rose-400 print:text-gray-900 mt-1">
                  {formatCurrency(data.summary.despesasPagas)}
                </p>
                <p className="text-[10px] text-rose-400/80 print:text-gray-600 mt-1">
                  Custos operacionais liquidados
                </p>
              </div>

              {/* Saldo Final Realizado */}
              <div
                className={`border rounded-xl p-4 print:border-gray-900 ${
                  data.summary.saldoFinal >= 0
                    ? 'bg-blue-950/30 border-blue-600/50 print:bg-gray-100'
                    : 'bg-rose-950/30 border-rose-600/50 print:bg-gray-100'
                }`}
              >
                <p className="text-[11px] font-bold text-blue-300 print:text-gray-800">
                  (=) Saldo Final Real em Caixa
                </p>
                <p
                  className={`text-2xl font-black mt-1 ${
                    data.summary.saldoFinal >= 0
                      ? 'text-blue-400 print:text-gray-950'
                      : 'text-rose-400 print:text-rose-700'
                  }`}
                >
                  {formatCurrency(data.summary.saldoFinal)}
                </p>
                <div className="flex items-center justify-between text-[10px] text-gray-400 print:text-gray-600 mt-1">
                  <span>Resultado Operacional:</span>
                  <span
                    className={`font-semibold ${
                      data.summary.resultadoLiquido >= 0
                        ? 'text-emerald-400 print:text-gray-900'
                        : 'text-rose-400 print:text-gray-900'
                    }`}
                  >
                    {formatCurrency(data.summary.resultadoLiquido)}
                  </span>
                </div>
              </div>
            </div>

            {/* Régua de Conciliação em Linha */}
            <div className="bg-gray-950/80 border border-gray-800/80 rounded-xl p-3.5 print:bg-gray-50 print:border-gray-300 text-xs text-gray-300 print:text-gray-800 font-mono flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-gray-400 print:text-gray-600">
                Fórmula de Fechamento:
              </span>
              <span>
                {formatCurrency(data.summary.saldoInicial)} (Inicial) +{' '}
                {formatCurrency(data.summary.totalEntradasRecebidas)} (Recebido) -{' '}
                {formatCurrency(data.summary.despesasPagas)} (Despesas) ={' '}
                <strong className="text-white print:text-black font-bold">
                  {formatCurrency(data.summary.saldoFinal)} (Caixa Real)
                </strong>
              </span>
            </div>
          </div>

          {/* 3. DRE SIMPLIFICADA DA PLATAFORMA (Demonstração do Resultado) */}
          <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-6 backdrop-blur shadow-xl print:bg-white print:border-gray-300 print:shadow-none print:p-4">
            <div className="flex items-center justify-between border-b border-gray-800 print:border-gray-300 pb-4 mb-6">
              <div className="flex items-center gap-2.5">
                <PieIcon className="h-5 w-5 text-indigo-400 print:text-gray-800" />
                <h3 className="text-base font-bold text-white print:text-gray-900">
                  DRE Corporativa Simplificada (Estruturada)
                </h3>
              </div>
              <div className="text-xs text-gray-400 print:text-gray-600">
                Margem Líquida:{' '}
                <strong
                  className={`font-bold ${
                    data.dre.margemLiquida >= 0
                      ? 'text-emerald-400 print:text-gray-900'
                      : 'text-rose-400 print:text-gray-900'
                  }`}
                >
                  {data.dre.margemLiquida.toFixed(1)}%
                </strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 print:border-gray-300 text-gray-400 print:text-gray-700 uppercase tracking-wider font-semibold">
                    <th className="pb-3 pl-2">Conta / Grupo Contábil</th>
                    <th className="pb-3 text-right">Valor (R$)</th>
                    <th className="pb-3 pr-2 text-right">Representatividade (% RB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 print:divide-gray-200 font-medium">
                  {/* Receitas */}
                  <tr className="bg-emerald-950/10 print:bg-transparent">
                    <td className="py-2.5 pl-2 text-emerald-400 print:text-gray-800">
                      (+) Receita de Assinaturas SaaS (Software)
                    </td>
                    <td className="py-2.5 text-right text-gray-200 print:text-gray-900">
                      {formatCurrency(data.dre.receitaSaaS)}
                    </td>
                    <td className="py-2.5 pr-2 text-right text-gray-400 print:text-gray-600">
                      {data.dre.receitaBruta > 0
                        ? `${((data.dre.receitaSaaS / data.dre.receitaBruta) * 100).toFixed(1)}%`
                        : '0.0%'}
                    </td>
                  </tr>
                  <tr className="bg-emerald-950/10 print:bg-transparent">
                    <td className="py-2.5 pl-2 text-emerald-400 print:text-gray-800">
                      (+) Receitas Avulsas / Manuais / Serviços
                    </td>
                    <td className="py-2.5 text-right text-gray-200 print:text-gray-900">
                      {formatCurrency(data.dre.receitasManuais)}
                    </td>
                    <td className="py-2.5 pr-2 text-right text-gray-400 print:text-gray-600">
                      {data.dre.receitaBruta > 0
                        ? `${((data.dre.receitasManuais / data.dre.receitaBruta) * 100).toFixed(1)}%`
                        : '0.0%'}
                    </td>
                  </tr>
                  <tr className="bg-emerald-900/20 font-bold print:bg-gray-100 border-t border-emerald-800/50 print:border-gray-300">
                    <td className="py-2.5 pl-2 text-emerald-300 print:text-gray-950">
                      (=) RECEITA BRUTA TOTAL
                    </td>
                    <td className="py-2.5 text-right text-emerald-300 print:text-gray-950">
                      {formatCurrency(data.dre.receitaBruta)}
                    </td>
                    <td className="py-2.5 pr-2 text-right text-emerald-300 print:text-gray-950">
                      100.0%
                    </td>
                  </tr>

                  {/* Despesas Operacionais por Categoria Dinâmica */}
                  {data.dre.despesasOperacionais.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-3 text-center text-gray-500 italic">
                        Nenhuma despesa operacional paga no período.
                      </td>
                    </tr>
                  ) : (
                    data.dre.despesasOperacionais.map((cat, idx) => (
                      <tr key={idx} className="hover:bg-gray-800/30 print:hover:bg-transparent">
                        <td className="py-2 pl-4 text-rose-400/90 print:text-gray-800">
                          (-) {cat.name}
                        </td>
                        <td className="py-2 text-right text-gray-200 print:text-gray-900">
                          {formatCurrency(cat.amount)}
                        </td>
                        <td className="py-2 pr-2 text-right text-gray-400 print:text-gray-600">
                          {cat.percentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  )}

                  <tr className="bg-rose-900/20 font-bold print:bg-gray-100 border-t border-rose-800/50 print:border-gray-300">
                    <td className="py-2.5 pl-2 text-rose-300 print:text-gray-950">
                      (=) TOTAL DE DESPESAS OPERACIONAIS
                    </td>
                    <td className="py-2.5 text-right text-rose-300 print:text-gray-950">
                      {formatCurrency(data.dre.totalDespesas)}
                    </td>
                    <td className="py-2.5 pr-2 text-right text-rose-300 print:text-gray-950">
                      {data.dre.receitaBruta > 0
                        ? `${((data.dre.totalDespesas / data.dre.receitaBruta) * 100).toFixed(1)}%`
                        : '0.0%'}
                    </td>
                  </tr>

                  {/* Resultado Líquido Final */}
                  <tr
                    className={`font-black text-sm border-t-2 ${
                      data.dre.resultadoLiquido >= 0
                        ? 'bg-blue-950/40 text-blue-300 print:bg-gray-200 print:text-gray-950 border-blue-500/50'
                        : 'bg-rose-950/40 text-rose-300 print:bg-gray-200 print:text-gray-950 border-rose-500/50'
                    }`}
                  >
                    <td className="py-3 pl-2">(=) RESULTADO LÍQUIDO DO PERÍODO (LUCRO / PREJUÍZO)</td>
                    <td className="py-3 text-right">
                      {formatCurrency(data.dre.resultadoLiquido)}
                    </td>
                    <td className="py-3 pr-2 text-right">
                      {data.dre.margemLiquida.toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. SEÇÃO ANALÍTICA: PROJEÇÃO, INADIMPLÊNCIA E CONTAS PENDENTES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 print:grid-cols-3">
            {/* Contas a Receber & Previsões */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 print:bg-white print:border-gray-300">
              <h4 className="text-xs font-bold text-gray-300 print:text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                Previsões a Receber
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 print:text-gray-600">SaaS a Vencer:</span>
                  <span className="font-semibold text-gray-200 print:text-gray-900">
                    {formatCurrency(data.summary.receitaAutomaticaPrevista)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 print:text-gray-600">Manuais Pendentes:</span>
                  <span className="font-semibold text-gray-200 print:text-gray-900">
                    {formatCurrency(data.summary.receitaManualPendente)}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-800 print:border-gray-200 flex justify-between items-center text-xs font-bold">
                  <span className="text-gray-300 print:text-gray-800">Total Previsto:</span>
                  <span className="text-amber-400 print:text-gray-950">
                    {formatCurrency(data.summary.totalEntradasPrevistas)}
                  </span>
                </div>
              </div>
            </div>

            {/* Inadimplência SaaS */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 print:bg-white print:border-gray-300">
              <h4 className="text-xs font-bold text-gray-300 print:text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400" />
                Inadimplência SaaS (Vencidas)
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 print:text-gray-600">Valor Inadimplente:</span>
                  <span className="font-semibold text-rose-400 print:text-rose-700">
                    {formatCurrency(data.summary.inadimplenciaValor)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 print:text-gray-600">Faturas Vencidas:</span>
                  <span className="font-semibold text-gray-200 print:text-gray-900">
                    {data.summary.inadimplenciaQtd} faturas
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-800 print:border-gray-200 flex justify-between items-center text-xs font-bold">
                  <span className="text-gray-300 print:text-gray-800">Taxa de Inadimplência:</span>
                  <span className="text-rose-400 print:text-rose-700">
                    {data.summary.inadimplenciaTaxa.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Contas a Pagar / Pendentes */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 print:bg-white print:border-gray-300">
              <h4 className="text-xs font-bold text-gray-300 print:text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-rose-400" />
                Contas a Pagar (Pendentes)
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 print:text-gray-600">Despesas Pendentes:</span>
                  <span className="font-semibold text-rose-400 print:text-rose-700">
                    {formatCurrency(data.summary.despesasPendentes)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 print:text-gray-600">Qtd. a Liquidar:</span>
                  <span className="font-semibold text-gray-200 print:text-gray-900">
                    {data.pendingExpenses.length} títulos
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-800 print:border-gray-200 flex justify-between items-center text-xs font-bold">
                  <span className="text-gray-300 print:text-gray-800">Total Despesas:</span>
                  <span className="font-semibold text-rose-400 print:text-rose-700">
                    {formatCurrency(data.summary.totalDespesas)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. TABELAS ANALÍTICAS DETALHADAS */}
          <div className="space-y-6">
            
            {/* Tabela de Faturas SaaS Recebidas */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 print:bg-white print:border-gray-300">
              <div className="flex items-center justify-between pb-3 border-b border-gray-800 print:border-gray-300 mb-4">
                <h4 className="text-sm font-bold text-white print:text-gray-900 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Assinaturas SaaS Liquidadas no Período ({data.recentPaidInvoices.length})
                </h4>
                <span className="text-xs font-bold text-emerald-400 print:text-gray-900">
                  Total: {formatCurrency(data.summary.receitaAutomaticaRecebida)}
                </span>
              </div>

              {data.recentPaidInvoices.length === 0 ? (
                <p className="text-xs text-gray-500 italic py-2">
                  Nenhuma fatura SaaS com pagamento registrado neste período.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 print:border-gray-300 text-gray-400 print:text-gray-700 font-semibold">
                        <th className="pb-2">Tenant / Igreja</th>
                        <th className="pb-2">Plano</th>
                        <th className="pb-2">Data Pgto</th>
                        <th className="pb-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40 print:divide-gray-200">
                      {data.recentPaidInvoices.slice(0, 50).map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-800/20">
                          <td className="py-2 text-gray-200 print:text-gray-900 font-medium">
                            {inv.ministryName}
                          </td>
                          <td className="py-2 text-gray-400 print:text-gray-700">
                            {inv.planName}
                          </td>
                          <td className="py-2 text-gray-400 print:text-gray-700">
                            {formatDate(inv.paidAt)}
                          </td>
                          <td className="py-2 text-right font-semibold text-emerald-400 print:text-gray-900">
                            {formatCurrency(inv.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Tabela de Receitas Manuais Realizadas */}
            {data.recentManualRevenues.length > 0 && (
              <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 print:bg-white print:border-gray-300">
                <div className="flex items-center justify-between pb-3 border-b border-gray-800 print:border-gray-300 mb-4">
                  <h4 className="text-sm font-bold text-white print:text-gray-900 flex items-center gap-2">
                    <ArrowDownRight className="h-4 w-4 text-emerald-400" />
                    Receitas Manuais e Avulsas Realizadas ({data.recentManualRevenues.length})
                  </h4>
                  <span className="text-xs font-bold text-emerald-400 print:text-gray-900">
                    Total: {formatCurrency(data.summary.receitaManualRecebida)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 print:border-gray-300 text-gray-400 print:text-gray-700 font-semibold">
                        <th className="pb-2">Descrição</th>
                        <th className="pb-2">Pagador / Origem</th>
                        <th className="pb-2">Categoria</th>
                        <th className="pb-2">Data</th>
                        <th className="pb-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40 print:divide-gray-200">
                      {data.recentManualRevenues.map((rec) => (
                        <tr key={rec.id} className="hover:bg-gray-800/20">
                          <td className="py-2 text-gray-200 print:text-gray-900 font-medium">
                            {rec.description}
                          </td>
                          <td className="py-2 text-gray-400 print:text-gray-700">
                            {rec.payerName || '-'}
                          </td>
                          <td className="py-2 text-gray-400 print:text-gray-700">
                            {rec.categoryName}
                          </td>
                          <td className="py-2 text-gray-400 print:text-gray-700">
                            {formatDate(rec.receivedAt || rec.referenceDate)}
                          </td>
                          <td className="py-2 text-right font-semibold text-emerald-400 print:text-gray-900">
                            {formatCurrency(rec.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tabela de Despesas Pagas */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 print:bg-white print:border-gray-300">
              <div className="flex items-center justify-between pb-3 border-b border-gray-800 print:border-gray-300 mb-4">
                <h4 className="text-sm font-bold text-white print:text-gray-900 flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-rose-400" />
                  Despesas Corporativas Pagas ({data.recentPaidExpenses.length})
                </h4>
                <span className="text-xs font-bold text-rose-400 print:text-gray-900">
                  Total: {formatCurrency(data.summary.despesasPagas)}
                </span>
              </div>

              {data.recentPaidExpenses.length === 0 ? (
                <p className="text-xs text-gray-500 italic py-2">
                  Nenhuma despesa paga registrada neste período.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 print:border-gray-300 text-gray-400 print:text-gray-700 font-semibold">
                        <th className="pb-2">Descrição</th>
                        <th className="pb-2">Fornecedor / Beneficiário</th>
                        <th className="pb-2">Categoria</th>
                        <th className="pb-2">Data Pgto</th>
                        <th className="pb-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40 print:divide-gray-200">
                      {data.recentPaidExpenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-gray-800/20">
                          <td className="py-2 text-gray-200 print:text-gray-900 font-medium">
                            {exp.description}
                          </td>
                          <td className="py-2 text-gray-400 print:text-gray-700">
                            {exp.recipientName || '-'}
                          </td>
                          <td className="py-2 text-gray-400 print:text-gray-700">
                            {exp.categoryName}
                          </td>
                          <td className="py-2 text-gray-400 print:text-gray-700">
                            {formatDate(exp.paidAt || exp.dueDate)}
                          </td>
                          <td className="py-2 text-right font-semibold text-rose-400 print:text-gray-900">
                            {formatCurrency(exp.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Tabela de Despesas Pendentes */}
            {data.pendingExpenses.length > 0 && (
              <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 print:bg-white print:border-gray-300">
                <div className="flex items-center justify-between pb-3 border-b border-gray-800 print:border-gray-300 mb-4">
                  <h4 className="text-sm font-bold text-white print:text-gray-900 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-400" />
                    Despesas Corporativas a Pagar ({data.pendingExpenses.length})
                  </h4>
                  <span className="text-xs font-bold text-amber-400 print:text-gray-900">
                    Total: {formatCurrency(data.summary.despesasPendentes)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 print:border-gray-300 text-gray-400 print:text-gray-700 font-semibold">
                        <th className="pb-2">Descrição</th>
                        <th className="pb-2">Fornecedor</th>
                        <th className="pb-2">Categoria</th>
                        <th className="pb-2">Vencimento</th>
                        <th className="pb-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40 print:divide-gray-200">
                      {data.pendingExpenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-gray-800/20">
                          <td className="py-2 text-gray-200 print:text-gray-900 font-medium">
                            {exp.description}
                          </td>
                          <td className="py-2 text-gray-400 print:text-gray-700">
                            {exp.recipientName || '-'}
                          </td>
                          <td className="py-2 text-gray-400 print:text-gray-700">
                            {exp.categoryName}
                          </td>
                          <td className="py-2 text-gray-400 print:text-gray-700">
                            {formatDate(exp.dueDate)}
                          </td>
                          <td className="py-2 text-right font-semibold text-amber-400 print:text-gray-900">
                            {formatCurrency(exp.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* 6. RODAPÉ FORMAL E ASSINATURA PARA SÓCIOS (Visível na impressão) */}
          <div className="hidden print:block pt-12 mt-12 border-t border-gray-300 page-break-inside-avoid">
            <div className="text-xs text-gray-600 mb-8">
              <p className="font-semibold text-gray-800 mb-1">Notas e Declaração da Diretoria:</p>
              <p>
                Declaramos que o presente demonstrativo financeiro reflete fidedignamente todas as transações,
                entradas de mensalidades SaaS e aportes de serviços, bem como as despesas operacionais liquidadas
                e obrigações pendentes da Gestão Eklésia referente ao período de <strong>{periodLabel}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-12 pt-8">
              <div className="text-center">
                <div className="border-t border-gray-900 w-3/4 mx-auto mb-2"></div>
                <p className="text-xs font-bold text-gray-900">Diretoria Executiva</p>
                <p className="text-[10px] text-gray-600">Gestão Eklésia Plataforma SaaS</p>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-900 w-3/4 mx-auto mb-2"></div>
                <p className="text-xs font-bold text-gray-900">Conselho de Sócios / Auditoria</p>
                <p className="text-[10px] text-gray-600">Gestão Eklésia</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
          Nenhum dado encontrado para o período selecionado.
        </div>
      )}
    </div>
  )
}
