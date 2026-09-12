'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Image from 'next/image'
import { BRAND } from '@/config/brand'
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
      ['GESTAO EKLESIA - ALCANTARA SISTEMAS'],
      ['RELATORIO EXECUTIVO E PRESTACAO DE CONTAS AOS SOCIOS'],
      [`Periodo de Referencia:`, periodLabel],
      [`Data de Emissao:`, new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR')],
      [`Status:`, 'Consolidado Oficial'],
      [''],
      ['=== 1. DEMONSTRATIVO DE FLUXO DE CAIXA REALIZADO ==='],
      ['Item', 'Valor (R$)'],
      ['(+) Saldo Inicial do Periodo', summary.saldoInicial.toFixed(2)],
      ['(+) Receitas Assinaturas SaaS', summary.receitaAutomaticaRecebida.toFixed(2)],
      ['(+) Receitas Manuais / Servicos', summary.receitaManualRecebida.toFixed(2)],
      ['(=) Total Entradas Realizadas', summary.totalEntradasRecebidas.toFixed(2)],
      ['(-) Despesas Corporativas Pagas', summary.despesasPagas.toFixed(2)],
      ['(=) Resultado Operacional do Periodo', summary.resultadoLiquido.toFixed(2)],
      ['(=) SALDO FINAL REALIZADO EM CAIXA', summary.saldoFinal.toFixed(2)],
      [''],
      ['=== 2. PROJECOES E CONTAS A RECEBER / A PAGAR ==='],
      ['Item', 'Valor (R$)'],
      ['Previsao SaaS a Vencer', summary.receitaAutomaticaPrevista.toFixed(2)],
      ['Receitas Manuais Pendentes', summary.receitaManualPendente.toFixed(2)],
      ['Total de Entradas Previstas', summary.totalEntradasPrevistas.toFixed(2)],
      ['Inadimplencia SaaS (Vencidas)', summary.inadimplenciaValor.toFixed(2)],
      ['Qtd Faturas Vencidas', String(summary.inadimplenciaQtd)],
      ['Taxa de Inadimplencia (%)', `${summary.inadimplenciaTaxa.toFixed(1)}%`],
      ['Despesas Corporativas a Pagar', summary.despesasPendentes.toFixed(2)],
      ['Total de Despesas do Periodo', summary.totalDespesas.toFixed(2)],
      [''],
      ['=== 3. DEMONSTRACAO DO RESULTADO DO EXERCICIO (DRE CORPORATIVA) ==='],
      ['Conta / Grupo Contabil', 'Valor (R$)', '% Receita Bruta'],
      ['(+) Receita de Assinaturas SaaS', dre.receitaSaaS.toFixed(2), dre.receitaBruta > 0 ? `${((dre.receitaSaaS / dre.receitaBruta) * 100).toFixed(1)}%` : '0%'],
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
      ['=== 4. FATURAS SAAS PAGAS NO PERIODO ==='],
      ['ID', 'Tenant / Igreja', 'Plano', 'Valor (R$)', 'Data Pagamento'],
      ...data.recentPaidInvoices.map((inv) => [
        inv.id,
        `"${inv.ministryName.replace(/"/g, '""')}"`,
        `"${inv.planName}"`,
        inv.amount.toFixed(2),
        inv.paidAt ? formatDate(inv.paidAt) : '-',
      ]),
      [''],
      ['=== 5. RECEITAS MANUAIS REALIZADAS ==='],
      ['Descricao', 'Pagador / Origem', 'Categoria', 'Valor (R$)', 'Data Recebimento'],
      ...data.recentManualRevenues.map((rec) => [
        `"${rec.description.replace(/"/g, '""')}"`,
        `"${(rec.payerName || '-').replace(/"/g, '""')}"`,
        `"${rec.categoryName}"`,
        rec.amount.toFixed(2),
        rec.receivedAt ? formatDate(rec.receivedAt) : formatDate(rec.referenceDate),
      ]),
      [''],
      ['=== 6. DESPESAS CORPORATIVAS PAGAS ==='],
      ['Descricao', 'Fornecedor / Beneficiario', 'Categoria', 'Valor (R$)', 'Data Pagamento'],
      ...data.recentPaidExpenses.map((exp) => [
        `"${exp.description.replace(/"/g, '""')}"`,
        `"${(exp.recipientName || '-').replace(/"/g, '""')}"`,
        `"${exp.categoryName}"`,
        exp.amount.toFixed(2),
        exp.paidAt ? formatDate(exp.paidAt) : formatDate(exp.dueDate),
      ]),
      [''],
      ['=== 7. DESPESAS CORPORATIVAS PENDENTES (A PAGAR) ==='],
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
    <div className="w-full space-y-8 animate-in fade-in print:space-y-6 print:w-full print:max-w-none print:m-0 print:p-0">
      
      {/* 1. BARRA DE CONTROLE E FILTROS (100% Oculta na impressão) */}
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
                Consolidação financeira oficial, DRE estruturada e demonstrativo de caixa para reuniões de sócios e arquivamento formal.
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
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 flex flex-col items-center justify-center space-y-4 print:hidden">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-400">Consolidando demonstrativos para os sócios...</p>
        </div>
      ) : data ? (
        /* ÁREA PRINCIPAL DO DOCUMENTO (FORMATADO COM ALTA QUALIDADE PARA TELA E IMPRESSÃO A4) */
        <div className="w-full space-y-8 print:space-y-5 print:w-full print:max-w-none print:m-0 print:p-0">
          
          {/* ========================================================================= */}
          {/* CABEÇALHO INSTITUCIONAL PROFISSIONAL (Exclusivo para Impressão e PDF) */}
          {/* ========================================================================= */}
          <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-4 print-section">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Image
                  src={BRAND.logoHorizontal}
                  alt="Gestão Eklésia"
                  width={140}
                  height={38}
                  priority
                  className="h-9 w-auto object-contain"
                />
                <div className="border-l-2 border-slate-300 pl-3">
                  <h1 className="text-base font-black tracking-tight text-slate-950 uppercase leading-none">
                    GESTÃO EKLÉSIA
                  </h1>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">
                    Alcântara Sistemas • Central Financeira Corporativa
                  </p>
                </div>
              </div>

              <div className="text-right text-[10px] text-slate-600 leading-tight">
                <p className="font-bold text-slate-900 text-xs">RELATÓRIO EXECUTIVO E PRESTAÇÃO DE CONTAS</p>
                <p className="mt-1">
                  Período de Referência: <strong className="text-slate-950">{periodLabel}</strong>
                </p>
                <p>Emissão: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                <p>Status: <span className="font-bold text-emerald-800 uppercase">Consolidado Oficial</span> | Moeda: BRL (R$)</p>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 2. DEMONSTRATIVO DE FLUXO DE CAIXA REALIZADO */}
          {/* ========================================================================= */}
          <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-6 backdrop-blur shadow-xl print:bg-white print:border print:border-slate-300 print:rounded-lg print:shadow-none print:p-4 print-avoid-break">
            <div className="flex items-center justify-between border-b border-gray-800 print:border-slate-300 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-blue-400 print:text-blue-900" />
                <h3 className="text-base font-bold text-white print:text-slate-950 print:text-sm">
                  1. Demonstrativo de Fluxo de Caixa Realizado
                </h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full print:bg-slate-100 print:text-slate-800 print:border-slate-300 print:text-[10px]">
                Base Efetiva de Caixa
              </span>
            </div>

            {/* Grid dos 4 Cards Financeiros (Aproveitamento Total da Largura em 4 Colunas) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-3 mb-4">
              {/* Card 1: Saldo Inicial */}
              <div className="bg-gray-950/70 border border-gray-800 rounded-xl p-4 print:bg-slate-50 print:border print:border-slate-300 print:rounded-md print:p-3">
                <p className="text-[11px] font-medium text-gray-400 print:text-slate-600 print:text-[10px]">
                  (+) Saldo Inicial do Período
                </p>
                <p className="text-xl font-bold text-gray-200 print:text-slate-950 print:text-lg mt-0.5">
                  {formatCurrency(data.summary.saldoInicial)}
                </p>
                <p className="text-[10px] text-gray-500 print:text-slate-500 print:text-[9px] mt-1">
                  Saldo de abertura cadastrado
                </p>
              </div>

              {/* Card 2: Total Entradas Recebidas */}
              <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4 print:bg-slate-50 print:border print:border-slate-300 print:rounded-md print:p-3">
                <p className="text-[11px] font-medium text-emerald-400 print:text-slate-700 print:text-[10px] font-semibold">
                  (+) Total Receitas Recebidas
                </p>
                <p className="text-xl font-bold text-emerald-400 print:text-slate-950 print:text-lg mt-0.5">
                  {formatCurrency(data.summary.totalEntradasRecebidas)}
                </p>
                <div className="text-[10px] text-emerald-500/80 print:text-slate-600 print:text-[9px] mt-1 space-y-0.5">
                  <div>SaaS: {formatCurrency(data.summary.receitaAutomaticaRecebida)}</div>
                  <div>Manuais: {formatCurrency(data.summary.receitaManualRecebida)}</div>
                </div>
              </div>

              {/* Card 3: Despesas Pagas */}
              <div className="bg-rose-950/20 border border-rose-800/40 rounded-xl p-4 print:bg-slate-50 print:border print:border-slate-300 print:rounded-md print:p-3">
                <p className="text-[11px] font-medium text-rose-400 print:text-slate-700 print:text-[10px] font-semibold">
                  (-) Despesas Pagas
                </p>
                <p className="text-xl font-bold text-rose-400 print:text-slate-950 print:text-lg mt-0.5">
                  {formatCurrency(data.summary.despesasPagas)}
                </p>
                <p className="text-[10px] text-rose-400/80 print:text-slate-500 print:text-[9px] mt-1">
                  Custos operacionais liquidados
                </p>
              </div>

              {/* Card 4: Saldo Final Realizado */}
              <div
                className={`border rounded-xl p-4 print:border print:border-slate-400 print:rounded-md print:p-3 ${
                  data.summary.saldoFinal >= 0
                    ? 'bg-blue-950/30 border-blue-600/50 print:bg-slate-100'
                    : 'bg-rose-950/30 border-rose-600/50 print:bg-slate-100'
                }`}
              >
                <p className="text-[11px] font-bold text-blue-300 print:text-slate-800 print:text-[10px]">
                  (=) Saldo Final Real em Caixa
                </p>
                <p
                  className={`text-2xl font-black print:text-xl mt-0.5 ${
                    data.summary.saldoFinal >= 0
                      ? 'text-blue-400 print:text-slate-950'
                      : 'text-rose-400 print:text-rose-800'
                  }`}
                >
                  {formatCurrency(data.summary.saldoFinal)}
                </p>
                <div className="flex items-center justify-between text-[10px] text-gray-400 print:text-slate-600 print:text-[9px] mt-1">
                  <span>Resultado Operacional:</span>
                  <span
                    className={`font-semibold ${
                      data.summary.resultadoLiquido >= 0
                        ? 'text-emerald-400 print:text-slate-900'
                        : 'text-rose-400 print:text-slate-900'
                    }`}
                  >
                    {formatCurrency(data.summary.resultadoLiquido)}
                  </span>
                </div>
              </div>
            </div>

            {/* Régua da Fórmula de Fechamento */}
            <div className="bg-gray-950/80 border border-gray-800/80 rounded-xl p-3 print:bg-slate-50 print:border print:border-slate-300 print:rounded-md text-xs print:text-[10px] text-gray-300 print:text-slate-900 font-mono flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-gray-400 print:text-slate-700">
                Equação Oficial de Fechamento do Caixa:
              </span>
              <span>
                {formatCurrency(data.summary.saldoInicial)} (Inicial) +{' '}
                {formatCurrency(data.summary.totalEntradasRecebidas)} (Recebido) -{' '}
                {formatCurrency(data.summary.despesasPagas)} (Despesas) ={' '}
                <strong className="text-white print:text-slate-950 font-bold">
                  {formatCurrency(data.summary.saldoFinal)} (Saldo Real)
                </strong>
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. DRE SIMPLIFICADA DA PLATAFORMA */}
          {/* ========================================================================= */}
          <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-6 backdrop-blur shadow-xl print:bg-white print:border print:border-slate-300 print:rounded-lg print:shadow-none print:p-4 print-avoid-break">
            <div className="flex items-center justify-between border-b border-gray-800 print:border-slate-300 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <PieIcon className="h-5 w-5 text-indigo-400 print:text-indigo-900" />
                <h3 className="text-base font-bold text-white print:text-slate-950 print:text-sm">
                  2. Demonstração do Resultado do Exercício (DRE Corporativa)
                </h3>
              </div>
              <div className="text-xs print:text-[10px] text-gray-400 print:text-slate-700">
                Margem Líquida:{' '}
                <strong
                  className={`font-bold ${
                    data.dre.margemLiquida >= 0
                      ? 'text-emerald-400 print:text-slate-950'
                      : 'text-rose-400 print:text-slate-950'
                  }`}
                >
                  {data.dre.margemLiquida.toFixed(1)}%
                </strong>
              </div>
            </div>

            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left text-xs print:text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 print:border-b-2 print:border-slate-400 text-gray-400 print:text-slate-800 uppercase tracking-wider font-semibold">
                    <th className="pb-2.5 pl-2 print:pl-1">Conta / Grupo Contábil</th>
                    <th className="pb-2.5 text-right">Valor (R$)</th>
                    <th className="pb-2.5 pr-2 print:pr-1 text-right">Representatividade (% RB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 print:divide-slate-200 font-medium text-slate-800">
                  {/* Receitas */}
                  <tr className="bg-emerald-950/10 print:bg-transparent">
                    <td className="py-2 pl-2 print:pl-1 text-emerald-400 print:text-slate-800">
                      (+) Receita de Assinaturas SaaS (Software Gestão Eklésia)
                    </td>
                    <td className="py-2 text-right text-gray-200 print:text-slate-900 font-semibold">
                      {formatCurrency(data.dre.receitaSaaS)}
                    </td>
                    <td className="py-2 pr-2 print:pr-1 text-right text-gray-400 print:text-slate-600">
                      {data.dre.receitaBruta > 0
                        ? `${((data.dre.receitaSaaS / data.dre.receitaBruta) * 100).toFixed(1)}%`
                        : '0.0%'}
                    </td>
                  </tr>
                  <tr className="bg-emerald-950/10 print:bg-transparent">
                    <td className="py-2 pl-2 print:pl-1 text-emerald-400 print:text-slate-800">
                      (+) Outras Receitas Corporativas / Serviços Avulsos
                    </td>
                    <td className="py-2 text-right text-gray-200 print:text-slate-900 font-semibold">
                      {formatCurrency(data.dre.receitasManuais)}
                    </td>
                    <td className="py-2 pr-2 print:pr-1 text-right text-gray-400 print:text-slate-600">
                      {data.dre.receitaBruta > 0
                        ? `${((data.dre.receitasManuais / data.dre.receitaBruta) * 100).toFixed(1)}%`
                        : '0.0%'}
                    </td>
                  </tr>
                  <tr className="bg-emerald-900/20 font-bold print:bg-slate-100 border-t border-emerald-800/50 print:border-t-2 print:border-slate-400">
                    <td className="py-2.5 pl-2 print:pl-1 text-emerald-300 print:text-slate-950 font-bold">
                      (=) RECEITA BRUTA TOTAL
                    </td>
                    <td className="py-2.5 text-right text-emerald-300 print:text-slate-950 font-bold">
                      {formatCurrency(data.dre.receitaBruta)}
                    </td>
                    <td className="py-2.5 pr-2 print:pr-1 text-right text-emerald-300 print:text-slate-950 font-bold">
                      100.0%
                    </td>
                  </tr>

                  {/* Despesas Operacionais por Categoria Dinâmica */}
                  {data.dre.despesasOperacionais.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-2.5 text-center text-gray-500 print:text-slate-500 italic">
                        Nenhuma despesa operacional liquidada no período.
                      </td>
                    </tr>
                  ) : (
                    data.dre.despesasOperacionais.map((cat, idx) => (
                      <tr key={idx} className="hover:bg-gray-800/30 print:hover:bg-transparent">
                        <td className="py-1.5 pl-4 print:pl-3 text-rose-400/90 print:text-slate-700">
                          (-) {cat.name}
                        </td>
                        <td className="py-1.5 text-right text-gray-200 print:text-slate-900">
                          {formatCurrency(cat.amount)}
                        </td>
                        <td className="py-1.5 pr-2 print:pr-1 text-right text-gray-400 print:text-slate-600">
                          {cat.percentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  )}

                  <tr className="bg-rose-900/20 font-bold print:bg-slate-100 border-t border-rose-800/50 print:border-t-2 print:border-slate-400">
                    <td className="py-2.5 pl-2 print:pl-1 text-rose-300 print:text-slate-950 font-bold">
                      (=) TOTAL DE DESPESAS OPERACIONAIS
                    </td>
                    <td className="py-2.5 text-right text-rose-300 print:text-slate-950 font-bold">
                      {formatCurrency(data.dre.totalDespesas)}
                    </td>
                    <td className="py-2.5 pr-2 print:pr-1 text-right text-rose-300 print:text-slate-950 font-bold">
                      {data.dre.receitaBruta > 0
                        ? `${((data.dre.totalDespesas / data.dre.receitaBruta) * 100).toFixed(1)}%`
                        : '0.0%'}
                    </td>
                  </tr>

                  {/* Resultado Líquido Final */}
                  <tr
                    className={`font-black text-xs print:text-[11px] border-t-2 ${
                      data.dre.resultadoLiquido >= 0
                        ? 'bg-blue-950/40 text-blue-300 print:bg-slate-200 print:text-slate-950 border-blue-500/50 print:border-slate-900'
                        : 'bg-rose-950/40 text-rose-300 print:bg-slate-200 print:text-slate-950 border-rose-500/50 print:border-slate-900'
                    }`}
                  >
                    <td className="py-2.5 pl-2 print:pl-1 uppercase">(=) RESULTADO LÍQUIDO DO PERÍODO (LUCRO / PREJUÍZO)</td>
                    <td className="py-2.5 text-right font-black">
                      {formatCurrency(data.dre.resultadoLiquido)}
                    </td>
                    <td className="py-2.5 pr-2 print:pr-1 text-right font-black">
                      {data.dre.margemLiquida.toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 4. PROJEÇÕES E OBRIGAÇÕES (3 COLUNAS UNIFORMES) */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 print:grid-cols-3 print:gap-3 print-avoid-break">
            {/* Contas a Receber & Previsões */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 print:bg-slate-50 print:border print:border-slate-300 print:rounded-md">
              <h4 className="text-xs print:text-[10px] font-bold text-gray-300 print:text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-400 print:text-amber-700" />
                Previsões a Receber
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs print:text-[9.5px]">
                  <span className="text-gray-400 print:text-slate-600">SaaS a Vencer:</span>
                  <span className="font-semibold text-gray-200 print:text-slate-900">
                    {formatCurrency(data.summary.receitaAutomaticaPrevista)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs print:text-[9.5px]">
                  <span className="text-gray-400 print:text-slate-600">Manuais Pendentes:</span>
                  <span className="font-semibold text-gray-200 print:text-slate-900">
                    {formatCurrency(data.summary.receitaManualPendente)}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-800 print:border-slate-200 flex justify-between items-center text-xs print:text-[10px] font-bold">
                  <span className="text-gray-300 print:text-slate-800">Total Previsto:</span>
                  <span className="text-amber-400 print:text-slate-950 font-bold">
                    {formatCurrency(data.summary.totalEntradasPrevistas)}
                  </span>
                </div>
              </div>
            </div>

            {/* Inadimplência SaaS */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 print:bg-slate-50 print:border print:border-slate-300 print:rounded-md">
              <h4 className="text-xs print:text-[10px] font-bold text-gray-300 print:text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-rose-400 print:text-rose-700" />
                Inadimplência SaaS (Vencidas)
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs print:text-[9.5px]">
                  <span className="text-gray-400 print:text-slate-600">Valor Inadimplente:</span>
                  <span className="font-semibold text-rose-400 print:text-rose-800">
                    {formatCurrency(data.summary.inadimplenciaValor)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs print:text-[9.5px]">
                  <span className="text-gray-400 print:text-slate-600">Faturas Vencidas:</span>
                  <span className="font-semibold text-gray-200 print:text-slate-900">
                    {data.summary.inadimplenciaQtd} faturas
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-800 print:border-slate-200 flex justify-between items-center text-xs print:text-[10px] font-bold">
                  <span className="text-gray-300 print:text-slate-800">Taxa de Inadimplência:</span>
                  <span className="text-rose-400 print:text-rose-800 font-bold">
                    {data.summary.inadimplenciaTaxa.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Contas a Pagar / Pendentes */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 print:bg-slate-50 print:border print:border-slate-300 print:rounded-md">
              <h4 className="text-xs print:text-[10px] font-bold text-gray-300 print:text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <ArrowUpRight className="h-4 w-4 text-rose-400 print:text-rose-700" />
                Contas a Pagar (Pendentes)
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs print:text-[9.5px]">
                  <span className="text-gray-400 print:text-slate-600">Despesas Pendentes:</span>
                  <span className="font-semibold text-rose-400 print:text-rose-800">
                    {formatCurrency(data.summary.despesasPendentes)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs print:text-[9.5px]">
                  <span className="text-gray-400 print:text-slate-600">Qtd. a Liquidar:</span>
                  <span className="font-semibold text-gray-200 print:text-slate-900">
                    {data.pendingExpenses.length} títulos
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-800 print:border-slate-200 flex justify-between items-center text-xs print:text-[10px] font-bold">
                  <span className="text-gray-300 print:text-slate-800">Total Despesas:</span>
                  <span className="font-semibold text-rose-400 print:text-rose-800 font-bold">
                    {formatCurrency(data.summary.totalDespesas)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 5. TABELAS ANALÍTICAS DETALHADAS */}
          {/* ========================================================================= */}
          <div className="space-y-6 print:space-y-4">
            
            {/* Tabela de Faturas SaaS Recebidas */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 print:bg-white print:border print:border-slate-300 print:rounded-lg print:p-3 print-avoid-break">
              <div className="flex items-center justify-between pb-2.5 border-b border-gray-800 print:border-slate-300 mb-3">
                <h4 className="text-sm print:text-xs font-bold text-white print:text-slate-950 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 print:text-emerald-700" />
                  Assinaturas SaaS Liquidadas no Período ({data.recentPaidInvoices.length})
                </h4>
                <span className="text-xs print:text-[10px] font-bold text-emerald-400 print:text-slate-950">
                  Total: {formatCurrency(data.summary.receitaAutomaticaRecebida)}
                </span>
              </div>

              {data.recentPaidInvoices.length === 0 ? (
                <p className="text-xs print:text-[10px] text-gray-500 print:text-slate-500 italic py-1">
                  Nenhuma fatura SaaS com pagamento registrado neste período.
                </p>
              ) : (
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-left text-xs print:text-[9.5px] border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 print:border-slate-300 text-gray-400 print:text-slate-700 font-semibold">
                        <th className="pb-1.5">Tenant / Igreja</th>
                        <th className="pb-1.5">Plano</th>
                        <th className="pb-1.5">Data Pgto</th>
                        <th className="pb-1.5 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40 print:divide-slate-200">
                      {data.recentPaidInvoices.slice(0, 50).map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-800/20">
                          <td className="py-1.5 text-gray-200 print:text-slate-900 font-medium">
                            {inv.ministryName}
                          </td>
                          <td className="py-1.5 text-gray-400 print:text-slate-700">
                            {inv.planName}
                          </td>
                          <td className="py-1.5 text-gray-400 print:text-slate-700">
                            {formatDate(inv.paidAt)}
                          </td>
                          <td className="py-1.5 text-right font-semibold text-emerald-400 print:text-slate-950">
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
              <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 print:bg-white print:border print:border-slate-300 print:rounded-lg print:p-3 print-avoid-break">
                <div className="flex items-center justify-between pb-2.5 border-b border-gray-800 print:border-slate-300 mb-3">
                  <h4 className="text-sm print:text-xs font-bold text-white print:text-slate-950 flex items-center gap-2">
                    <ArrowDownRight className="h-4 w-4 text-emerald-400 print:text-emerald-700" />
                    Receitas Manuais e Avulsas Realizadas ({data.recentManualRevenues.length})
                  </h4>
                  <span className="text-xs print:text-[10px] font-bold text-emerald-400 print:text-slate-950">
                    Total: {formatCurrency(data.summary.receitaManualRecebida)}
                  </span>
                </div>

                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-left text-xs print:text-[9.5px] border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 print:border-slate-300 text-gray-400 print:text-slate-700 font-semibold">
                        <th className="pb-1.5">Descrição</th>
                        <th className="pb-1.5">Pagador / Origem</th>
                        <th className="pb-1.5">Categoria</th>
                        <th className="pb-1.5">Data</th>
                        <th className="pb-1.5 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40 print:divide-slate-200">
                      {data.recentManualRevenues.map((rec) => (
                        <tr key={rec.id} className="hover:bg-gray-800/20">
                          <td className="py-1.5 text-gray-200 print:text-slate-900 font-medium">
                            {rec.description}
                          </td>
                          <td className="py-1.5 text-gray-400 print:text-slate-700">
                            {rec.payerName || '-'}
                          </td>
                          <td className="py-1.5 text-gray-400 print:text-slate-700">
                            {rec.categoryName}
                          </td>
                          <td className="py-1.5 text-gray-400 print:text-slate-700">
                            {formatDate(rec.receivedAt || rec.referenceDate)}
                          </td>
                          <td className="py-1.5 text-right font-semibold text-emerald-400 print:text-slate-950">
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
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 print:bg-white print:border print:border-slate-300 print:rounded-lg print:p-3 print-avoid-break">
              <div className="flex items-center justify-between pb-2.5 border-b border-gray-800 print:border-slate-300 mb-3">
                <h4 className="text-sm print:text-xs font-bold text-white print:text-slate-950 flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-rose-400 print:text-rose-700" />
                  Despesas Corporativas Pagas ({data.recentPaidExpenses.length})
                </h4>
                <span className="text-xs print:text-[10px] font-bold text-rose-400 print:text-slate-950">
                  Total: {formatCurrency(data.summary.despesasPagas)}
                </span>
              </div>

              {data.recentPaidExpenses.length === 0 ? (
                <p className="text-xs print:text-[10px] text-gray-500 print:text-slate-500 italic py-1">
                  Nenhuma despesa paga registrada neste período.
                </p>
              ) : (
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-left text-xs print:text-[9.5px] border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 print:border-slate-300 text-gray-400 print:text-slate-700 font-semibold">
                        <th className="pb-1.5">Descrição</th>
                        <th className="pb-1.5">Fornecedor / Beneficiário</th>
                        <th className="pb-1.5">Categoria</th>
                        <th className="pb-1.5">Data Pgto</th>
                        <th className="pb-1.5 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40 print:divide-slate-200">
                      {data.recentPaidExpenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-gray-800/20">
                          <td className="py-1.5 text-gray-200 print:text-slate-900 font-medium">
                            {exp.description}
                          </td>
                          <td className="py-1.5 text-gray-400 print:text-slate-700">
                            {exp.recipientName || '-'}
                          </td>
                          <td className="py-1.5 text-gray-400 print:text-slate-700">
                            {exp.categoryName}
                          </td>
                          <td className="py-1.5 text-gray-400 print:text-slate-700">
                            {formatDate(exp.paidAt || exp.dueDate)}
                          </td>
                          <td className="py-1.5 text-right font-semibold text-rose-400 print:text-slate-950">
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
              <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 print:bg-white print:border print:border-slate-300 print:rounded-lg print:p-3 print-avoid-break">
                <div className="flex items-center justify-between pb-2.5 border-b border-gray-800 print:border-slate-300 mb-3">
                  <h4 className="text-sm print:text-xs font-bold text-white print:text-slate-950 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-400 print:text-amber-700" />
                    Despesas Corporativas a Pagar ({data.pendingExpenses.length})
                  </h4>
                  <span className="text-xs print:text-[10px] font-bold text-amber-400 print:text-slate-950">
                    Total: {formatCurrency(data.summary.despesasPendentes)}
                  </span>
                </div>

                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-left text-xs print:text-[9.5px] border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 print:border-slate-300 text-gray-400 print:text-slate-700 font-semibold">
                        <th className="pb-1.5">Descrição</th>
                        <th className="pb-1.5">Fornecedor</th>
                        <th className="pb-1.5">Categoria</th>
                        <th className="pb-1.5">Vencimento</th>
                        <th className="pb-1.5 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40 print:divide-slate-200">
                      {data.pendingExpenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-gray-800/20">
                          <td className="py-1.5 text-gray-200 print:text-slate-900 font-medium">
                            {exp.description}
                          </td>
                          <td className="py-1.5 text-gray-400 print:text-slate-700">
                            {exp.recipientName || '-'}
                          </td>
                          <td className="py-1.5 text-gray-400 print:text-slate-700">
                            {exp.categoryName}
                          </td>
                          <td className="py-1.5 text-gray-400 print:text-slate-700">
                            {formatDate(exp.dueDate)}
                          </td>
                          <td className="py-1.5 text-right font-semibold text-amber-400 print:text-slate-950">
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

          {/* ========================================================================= */}
          {/* 6. DECLARAÇÃO, ASSINATURAS E RODAPÉ (Exclusivo para Impressão e PDF) */}
          {/* ========================================================================= */}
          <div className="hidden print:block pt-6 mt-6 border-t-2 border-slate-300 print-avoid-break">
            <div className="text-[9.5px] text-slate-700 mb-8 leading-relaxed">
              <p className="font-bold text-slate-900 mb-0.5">Declaração da Diretoria Executiva:</p>
              <p>
                Declaramos que o presente demonstrativo financeiro reflete com fidedignidade todas as entradas de mensalidades SaaS,
                aportes e serviços recebidos, bem como as despesas operacionais liquidadas e obrigações pendentes da Gestão Eklésia / Alcântara Sistemas,
                referentes ao período de <strong>{periodLabel}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-12 pt-6">
              <div className="text-center">
                <div className="border-t border-slate-900 w-4/5 mx-auto mb-1.5"></div>
                <p className="text-[11px] font-bold text-slate-950">Diretoria Executiva</p>
                <p className="text-[9px] text-slate-600">Gestão Eklésia • Alcântara Sistemas</p>
              </div>
              <div className="text-center">
                <div className="border-t border-slate-900 w-4/5 mx-auto mb-1.5"></div>
                <p className="text-[11px] font-bold text-slate-950">Conselho de Sócios / Auditoria</p>
                <p className="text-[9px] text-slate-600">Gestão Eklésia</p>
              </div>
            </div>

            <div className="pt-8 mt-8 border-t border-slate-200 flex justify-between items-center text-[8.5px] text-slate-500">
              <span>Gestão Eklésia • Alcântara Sistemas — Central Financeira Corporativa</span>
              <span>Relatório Confidencial de Uso Interno • Documento Gerado em {new Date().toLocaleDateString('pt-BR')}</span>
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
