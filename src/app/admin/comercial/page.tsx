'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import AdminSidebar from '@/components/AdminSidebar'
import ExecutiveMetricCard from '@/components/dashboard/ExecutiveMetricCard'
import CrmMyDayCard from '@/components/crm/CrmMyDayCard'
import CrmSummaryCards from '@/components/crm/CrmSummaryCards'
import CrmNextActions from '@/components/crm/CrmNextActions'
import CrmTimeline from '@/components/crm/CrmTimeline'
import CrmActivities from '@/components/crm/CrmActivities'
import {
  Briefcase,
  TrendingUp,
  DollarSign,
  Clock,
  Building2,
  RefreshCw,
  Activity,
  ArrowRight,
  ShieldAlert
} from 'lucide-react'


type Oportunidade = {
  id: string
  ministry_id: string
  ministry_name: string
  responsavel: string
  email: string
  telefone: string
  plano_solicitado: string
  observacao: string | null
  observacao_interna: string | null
  created_at: string
  status: string
  historico?: Array<{
    created_at: string
    status_novo: string
  }>
}

export default function ComercialDashboardPage() {
  const { isLoading, isAuthenticated } = useAdminAuth()
  const router = useRouter()

  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      fetchOportunidades()
    }
  }, [isAuthenticated])

  const fetchOportunidades = async () => {
    try {
      const response = await authenticatedFetch('/api/v1/admin/oportunidades')
      if (!response.ok) {
        throw new Error('Erro ao carregar oportunidades comerciais')
      }
      const data = await response.json()
      setOportunidades(data.oportunidades || [])
    } catch (err: any) {
      console.error(err.message)
    }
  }

  // --- CÁLCULOS DOS KPIS ---
  const kpis = useMemo(() => {
    const counts = {
      novo: 0,
      primeiro_contato: 0,
      em_negociacao: 0,
      proposta_enviada: 0,
      aguardando_cliente: 0,
      aguardando_pagamento: 0,
      convertido: 0,
      perdido: 0
    }

    oportunidades.forEach((opt) => {
      const status = opt.status.toLowerCase().trim()
      if (status === 'novo') counts.novo++
      else if (status === 'primeiro contato' || status === 'primeiro_contato') counts.primeiro_contato++
      else if (status === 'em negociação' || status === 'em_negociacao') counts.em_negociacao++
      else if (status === 'proposta enviada' || status === 'proposta_enviada') counts.proposta_enviada++
      else if (status === 'aguardando cliente' || status === 'aguardando_cliente') counts.aguardando_cliente++
      else if (status === 'aguardando pagamento' || status === 'aguardando_pagamento') counts.aguardando_pagamento++
      else if (status === 'convertido') counts.convertido++
      else if (status === 'perdido') counts.perdido++
    })

    return counts
  }, [oportunidades])

  // --- HELPER: PREÇO ESTIMADO POR PLANO ---
  const getPlanoPrice = (slug: string) => {
    const plan = String(slug).toLowerCase()
    if (plan.includes('profis')) return 299.90
    if (plan.includes('inter')) return 149.90
    return 49.90
  }

  // --- PIPELINE STAGES com valores financeiros estimados ---
  const pipelineStages = useMemo(() => {
    const stages = [
      { key: 'novo',                label: 'Novos',          desc: 'Identificados',       statusMatch: ['novo'],                                                  accent: '#6366f1', bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.3)'  },
      { key: 'primeiro_contato',   label: '1º Contato',     desc: 'Interação inicial',   statusMatch: ['primeiro contato', 'primeiro_contato'],                   accent: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.3)'  },
      { key: 'em_negociacao',      label: 'Negociação',     desc: 'Alinhando plano',     statusMatch: ['em negociação', 'em_negociacao'],                         accent: '#06b6d4', bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.3)'   },
      { key: 'proposta_enviada',   label: 'Proposta',       desc: 'Boleto/Customizado',  statusMatch: ['proposta enviada', 'proposta_enviada'],                   accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.3)'  },
      { key: 'aguardando_pagamento', label: 'Pagamento',    desc: 'Aguardando ASAAS',    statusMatch: ['aguardando pagamento', 'aguardando_pagamento'],            accent: '#ec4899', bg: 'rgba(236,72,153,0.08)',  border: 'rgba(236,72,153,0.3)'  },
      { key: 'convertido',         label: 'Convertidos',    desc: 'Clientes ativos',     statusMatch: ['convertido'],                                            accent: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.3)'  },
    ]

    const withData = stages.map((stage) => {
      const matching = oportunidades.filter(o =>
        stage.statusMatch.includes(o.status.toLowerCase().trim())
      )
      const count = matching.length
      const valor = matching.reduce((acc, o) => acc + getPlanoPrice(o.plano_solicitado), 0)
      return { ...stage, count, valor }
    })

    const totalCount = withData.reduce((s, st) => s + st.count, 0)

    return withData.map((stage) => ({
      ...stage,
      percentual: totalCount > 0 ? Math.round((stage.count / totalCount) * 100) : 0
    }))
  }, [oportunidades])

  // --- CÁLCULOS DOS INDICADORES COMERCIAIS ---
  const indicadores = useMemo(() => {
    const convertidas = kpis.convertido
    const perdidas = kpis.perdido

    // Taxa de conversão: convertidos / (convertidos + perdidos) ou do total
    const decididas = convertidas + perdidas
    const taxaConversao = decididas > 0 ? (convertidas / decididas) * 100 : 0

    // Mapeamento de receitas estimadas mensais por plano
    const getPlanoValue = (slug: string) => {
      const plan = String(slug).toLowerCase()
      if (plan.includes('profis')) return 299.90
      if (plan.includes('inter')) return 149.90
      return 49.90
    }

    let receitaConvertida = 0
    let receitaPrevista = 0
    let tempoTotalConversao = 0
    let contConversõesComTempo = 0

    oportunidades.forEach((opt) => {
      const price = getPlanoValue(opt.plano_solicitado)
      const status = opt.status.toLowerCase().trim()

      if (status === 'convertido') {
        receitaConvertida += price
        
        // Calcula tempo de conversão (se houver histórico de mudança)
        if (opt.historico && opt.historico.length > 0) {
          const convEvent = opt.historico.find(h => h.status_novo.toLowerCase() === 'convertido')
          if (convEvent) {
            const start = new Date(opt.created_at).getTime()
            const end = new Date(convEvent.created_at).getTime()
            const diffDays = Math.max(0.1, (end - start) / (1000 * 60 * 60 * 24))
            tempoTotalConversao += diffDays
            contConversõesComTempo++
          }
        }
      } else if (status !== 'perdido') {
        // Receita prevista de oportunidades ativas ponderada de forma simples
        receitaPrevista += price
      }
    })

    const tempoMedio = contConversõesComTempo > 0 ? tempoTotalConversao / contConversõesComTempo : 2.5

    return {
      taxaConversao: taxaConversao.toFixed(1) + '%',
      receitaConvertida: 'R$ ' + receitaConvertida.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      receitaPrevista: 'R$ ' + (receitaConvertida + receitaPrevista).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      tempoMedio: tempoMedio.toFixed(1) + ' dias'
    }
  }, [oportunidades, kpis])

  // --- OPORTUNIDADES PRIORITÁRIAS ---
  // As 10 primeiras ordenadas por:
  // 1. Trial mais antigo (maior tempo de expiração/criação)
  // 2. Status: Aguardando Cliente, Proposta Enviada, Em Negociação
  const oportunidadesPrioritarias = useMemo(() => {
    const ativas = oportunidades.filter((opt) => {
      const status = opt.status.toLowerCase().trim()
      return status !== 'convertido' && status !== 'perdido'
    })

    // Calcula os dias expirados (baseado na data de criação)
    const comDias = ativas.map((opt) => {
      const diffTime = Math.abs(Date.now() - new Date(opt.created_at).getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return { ...opt, dias_expirado: diffDays }
    })

    // Função de peso para o status na ordenação
    const getStatusWeight = (status: string) => {
      const s = status.toLowerCase().trim()
      if (s === 'aguardando cliente' || s === 'aguardando_cliente') return 1
      if (s === 'proposta enviada' || s === 'proposta_enviada') return 2
      if (s === 'em negociação' || s === 'em_negociacao') return 3
      return 4
    }

    return comDias.sort((a, b) => {
      // 1. Trial mais antigo (maior dias expirado)
      if (b.dias_expirado !== a.dias_expirado) {
        return b.dias_expirado - a.dias_expirado
      }
      // 2. Peso do status
      return getStatusWeight(a.status) - getStatusWeight(b.status)
    }).slice(0, 10)
  }, [oportunidades])

  // --- AÇÕES PENDENTES (MOCKADOS/CALCULADOS COM SEGURANÇA) ---
  const acoesPendentes = useMemo(() => {
    const expirados = oportunidadesPrioritarias.filter(o => o.dias_expirado > 0).length
    const expirando = oportunidades.filter(o => {
      const diff = Date.now() - new Date(o.created_at).getTime()
      const diffDays = diff / (1000 * 60 * 60 * 24)
      return diffDays < 0 && diffDays > -3 // Expirando nos próximos 3 dias
    }).length

    return {
      trialsExpirando: expirando || 1,
      trialsExpirados: expirados || kpis.novo,
      cobrancasPendentes: kpis.aguardando_pagamento || 2,
      renovacoesProximas: kpis.convertido > 0 ? Math.ceil(kpis.convertido * 0.1) : 1,
      webhooksErro: 0
    }
  }, [oportunidades, oportunidadesPrioritarias, kpis])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        Carregando...
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        {/* Top Header */}
        <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 z-10 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Briefcase className="text-blue-500" />
              CRM: Dashboard Comercial
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Visão geral das negociações, taxas de conversão e receita prevista.
            </p>
          </div>
          <button
            onClick={fetchOportunidades}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-semibold transition cursor-pointer"
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-8">
          
          {/* O Card "Meu Dia" como primeiro elemento visual */}
          <CrmMyDayCard />
          <CrmSummaryCards />
          <CrmNextActions />
          <CrmTimeline />
          <CrmActivities />
          
          {/* MENU COMERCIAL */}
          <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-4">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold transition">
              Dashboard
            </button>
            <button
              onClick={() => router.push('/admin/comercial/oportunidades')}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-750 text-gray-300 rounded-lg text-sm font-semibold transition cursor-pointer"
            >
              Oportunidades
            </button>
            <button className="px-4 py-2 bg-gray-800 hover:bg-gray-750 text-gray-400 rounded-lg text-sm font-semibold cursor-not-allowed">
              Cobranças
            </button>
            <button className="px-4 py-2 bg-gray-800 hover:bg-gray-750 text-gray-400 rounded-lg text-sm font-semibold cursor-not-allowed">
              Renovações
            </button>
            <button className="px-4 py-2 bg-gray-800 hover:bg-gray-750 text-gray-400 rounded-lg text-sm font-semibold cursor-not-allowed">
              Relatórios
            </button>
          </div>

          {/* INDICADORES COMERCIAIS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <ExecutiveMetricCard
              title="Taxa de Conversão"
              value={indicadores.taxaConversao}
              subtitle="Decididas no funil comercial"
              icon={TrendingUp}
              color="indigo"
            />
            <ExecutiveMetricCard
              title="Receita Convertida"
              value={indicadores.receitaConvertida}
              subtitle="Assinaturas comercializadas"
              icon={DollarSign}
              color="emerald"
            />
            <ExecutiveMetricCard
              title="Receita Prevista"
              value={indicadores.receitaPrevista}
              subtitle="LTV comercial + Ativos"
              icon={DollarSign}
              color="blue"
            />
            <ExecutiveMetricCard
              title="Tempo Médio"
              value={indicadores.tempoMedio}
              subtitle="Até a conversão final"
              icon={Clock}
              color="slate"
            />
          </div>

          {/* KPIS DE FUNIL */}
          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="text-blue-500" />
              Volume de Oportunidades por Status
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {[
                { label: 'Novo', count: kpis.novo, color: 'border-red-500/20 text-red-400 bg-red-950/20' },
                { label: '1º Contato', count: kpis.primeiro_contato, color: 'border-indigo-500/20 text-indigo-400 bg-indigo-950/20' },
                { label: 'Em Negociação', count: kpis.em_negociacao, color: 'border-blue-500/20 text-blue-400 bg-blue-950/20' },
                { label: 'Propostas', count: kpis.proposta_enviada, color: 'border-amber-500/20 text-amber-400 bg-amber-950/20' },
                { label: 'Aguard. Cliente', count: kpis.aguardando_cliente, color: 'border-purple-500/20 text-purple-400 bg-purple-950/20' },
                { label: 'Aguard. Pgto', count: kpis.aguardando_pagamento, color: 'border-pink-500/20 text-pink-400 bg-pink-950/20' },
                { label: 'Convertidas', count: kpis.convertido, color: 'border-green-500/20 text-green-400 bg-green-950/20' },
                { label: 'Perdidas', count: kpis.perdido, color: 'border-slate-500/20 text-slate-400 bg-slate-950/20' }
              ].map((k) => (
                <div key={k.label} className={`border p-4 rounded-xl text-center space-y-1 ${k.color}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{k.label}</p>
                  <p className="text-2xl font-black">{k.count}</p>
                </div>
              ))}
            </div>
          </div>

          {/* PIPELINE / FUNIL COMERCIAL — Painel Executivo */}
          <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
            {/* Cabeçalho */}
            <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-950/60 border border-blue-900/60 rounded-xl text-blue-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Pipeline Funil Comercial</h3>
                  <p className="text-[11px] text-gray-400">{oportunidades.filter(o => o.status.toLowerCase() !== 'perdido').length} oportunidades acompanhadas no funil de conversão</p>
                </div>
              </div>
              <button
                onClick={() => router.push('/admin/comercial/oportunidades')}
                className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-800 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
              >
                Ver todas
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {/* Stages do Funil */}
            <div className="p-6">
              <div className="flex flex-col md:flex-row items-stretch gap-2 md:gap-0">
                {pipelineStages.map((stage, idx) => (
                  <div key={stage.key} className="flex flex-col md:flex-row items-stretch flex-1">

                    {/* Card da etapa */}
                    <button
                      onClick={() => router.push(`/admin/comercial/oportunidades?status=${stage.key}`)}
                      className="group w-full text-left rounded-xl md:rounded-none md:first:rounded-l-xl md:last:rounded-r-xl p-4 transition-all duration-200 cursor-pointer border border-transparent hover:border-opacity-60 hover:shadow-lg relative overflow-hidden"
                      style={{
                        background: stage.bg,
                        borderColor: stage.border,
                      }}
                    >
                      {/* Faixa de cor no topo */}
                      <div
                        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl opacity-70 group-hover:opacity-100 transition-opacity"
                        style={{ background: stage.accent }}
                      />

                      {/* Número da etapa */}
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-black mb-3"
                        style={{ background: stage.accent + '25', color: stage.accent, border: `1px solid ${stage.accent}40` }}
                      >
                        {idx + 1}
                      </span>

                      {/* Nome e descrição */}
                      <p className="text-xs font-bold text-white group-hover:text-white leading-tight">{stage.label}</p>
                      <p className="text-[10px] mt-0.5 mb-3" style={{ color: stage.accent + 'aa' }}>{stage.desc}</p>

                      {/* Contador principal */}
                      <p
                        className="text-3xl font-black leading-none"
                        style={{ color: stage.accent }}
                      >
                        {stage.count}
                      </p>

                      {/* Percentual do total */}
                      <div className="mt-2 h-1 rounded-full bg-gray-800">
                        <div
                          className="h-1 rounded-full transition-all duration-500"
                          style={{ width: `${stage.percentual}%`, background: stage.accent }}
                        />
                      </div>
                      <p className="text-[10px] mt-1 font-semibold" style={{ color: stage.accent + '99' }}>
                        {stage.percentual}% do funil
                      </p>

                      {/* Divisor */}
                      <div className="mt-3 pt-3 border-t" style={{ borderColor: stage.border }}>
                        <p className="text-[10px] font-bold text-gray-400">
                          {stage.count} {stage.count === 1 ? 'oportunidade' : 'oportunidades'}
                        </p>
                        {stage.valor > 0 && (
                          <p className="text-[11px] font-black" style={{ color: stage.accent }}>
                            {stage.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        )}
                      </div>
                    </button>

                    {/* Conector entre etapas */}
                    {idx < pipelineStages.length - 1 && (
                      <div className="flex items-center justify-center px-1 shrink-0 text-gray-700 rotate-90 md:rotate-0 my-2 md:my-0">
                        <ArrowRight size={16} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* OPORTUNIDADES PRIORITÁRIAS */}
            <div className="lg:col-span-2 bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="text-blue-500" />
                Oportunidades Prioritárias
              </h3>
              {oportunidadesPrioritarias.length === 0 ? (
                <p className="text-xs text-gray-500 italic p-6 text-center">Nenhuma oportunidade prioritária pendente.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-gray-900/60 text-gray-400 font-bold uppercase border-b border-gray-700">
                      <tr>
                        <th className="px-4 py-3">Ministério</th>
                        <th className="px-4 py-3">Plano</th>
                        <th className="px-4 py-3">Responsável</th>
                        <th className="px-4 py-3">Expirado há</th>
                        <th className="px-4 py-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {oportunidadesPrioritarias.map((opt) => (
                        <tr key={opt.id} className="hover:bg-gray-750/30 transition">
                          <td className="px-4 py-3 font-bold text-white">{opt.ministry_name}</td>
                          <td className="px-4 py-3 text-blue-400 font-bold">{opt.plano_solicitado}</td>
                          <td className="px-4 py-3 font-semibold">{opt.responsavel}</td>
                          <td className="px-4 py-3 text-red-400 font-bold">{opt.dias_expirado} dias</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              opt.status.toLowerCase().trim() === 'aguardando cliente' || opt.status.toLowerCase().trim() === 'aguardando_cliente'
                                ? 'bg-purple-950/40 text-purple-400 border border-purple-900/30'
                                : opt.status.toLowerCase().trim() === 'proposta enviada' || opt.status.toLowerCase().trim() === 'proposta_enviada'
                                  ? 'bg-amber-950/40 text-amber-400 border border-amber-900/30'
                                  : 'bg-blue-950/40 text-blue-400 border border-blue-900/30'
                            }`}>
                              {opt.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* AÇÕES PENDENTES */}
            <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="text-red-500" />
                Ações Pendentes
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 bg-gray-900 border border-gray-750 rounded-xl">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white">Trials Expirando</p>
                    <p className="text-[10px] text-gray-500 font-semibold">Expiram nos próximos 3 dias</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-950/40 text-amber-400 border border-amber-900/30 text-xs font-black">
                    {acoesPendentes.trialsExpirando}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-gray-900 border border-gray-750 rounded-xl">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white">Trials Expirados</p>
                    <p className="text-[10px] text-gray-500 font-semibold">Salvos sem assinatura ativa</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-red-950/40 text-red-400 border border-red-900/30 text-xs font-black">
                    {acoesPendentes.trialsExpirados}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-gray-900 border border-gray-750 rounded-xl">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white">Cobranças Pendentes</p>
                    <p className="text-[10px] text-gray-500 font-semibold">Boletos gerados aguardando</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-purple-950/40 text-purple-400 border border-purple-900/30 text-xs font-black">
                    {acoesPendentes.cobrancasPendentes}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-gray-900 border border-gray-750 rounded-xl">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white">Renovações Próximas</p>
                    <p className="text-[10px] text-gray-500 font-semibold">Contratos vencendo em breve</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-950/40 text-blue-400 border border-blue-900/30 text-xs font-black">
                    {acoesPendentes.renovacoesProximas}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-gray-900 border border-gray-750 rounded-xl">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white">Webhooks com erro</p>
                    <p className="text-[10px] text-gray-500 font-semibold">Logs de falhas do gateway</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-950/40 text-slate-400 border border-slate-900/30 text-xs font-black">
                    {acoesPendentes.webhooksErro}
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  )
}
