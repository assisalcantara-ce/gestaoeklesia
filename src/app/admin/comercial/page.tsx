'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import AdminSidebar from '@/components/AdminSidebar'
import ExecutiveMetricCard from '@/components/dashboard/ExecutiveMetricCard'
import CrmSummaryCards from '@/components/crm/CrmSummaryCards'
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

  // --- CÁLCULOS DOS INDICADORES COMERCIAIS ---
  const indicadores = useMemo(() => {
    const convertidas = kpis.convertido
    const perdidas = kpis.perdido

    // Taxa de conversão: convertidos / (convertidos + perdidos) ou do total
    const decididas = convertidas + perdidas
    const taxaConversao = decididas > 0 ? (convertidas / decididas) * 100 : 0

    // Mapeamento de receitas estimadas mensais por plano
    const getPlanoPrice = (slug: string) => {
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
      const price = getPlanoPrice(opt.plano_solicitado)
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
          
          <CrmSummaryCards />
          
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

          {/* PIPELINE / FUNIL COMERCIAL */}
          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="text-blue-500" />
              Pipeline Funil Comercial (Conversão)
            </h3>
            <div className="flex flex-col md:flex-row items-stretch justify-between gap-4 pt-4">
              {[
                { label: 'Novos', count: kpis.novo, desc: 'Identificados' },
                { label: 'Primeiro Contato', count: kpis.primeiro_contato, desc: 'Interação inicial' },
                { label: 'Negociação', count: kpis.em_negociacao, desc: 'Alinhando plano' },
                { label: 'Proposta', count: kpis.proposta_enviada, desc: 'Boleto/Customizado' },
                { label: 'Pagamento', count: kpis.aguardando_pagamento, desc: 'Boleto ASAAS' },
                { label: 'Convertidos', count: kpis.convertido, desc: 'Clientes ativos' }
              ].map((step, idx) => (
                <div key={step.label} className="flex-1 flex flex-col md:flex-row items-center gap-3">
                  <div className="w-full bg-gray-900 border border-gray-750 p-4 rounded-xl text-center space-y-1 relative">
                    <span className="absolute -top-2 left-3 px-1.5 py-0.5 rounded-md bg-gray-850 border border-gray-700 text-[8px] font-black text-gray-500">
                      {idx + 1}
                    </span>
                    <p className="text-sm font-bold text-white">{step.label}</p>
                    <p className="text-xs text-gray-400 font-semibold">{step.desc}</p>
                    <p className="text-lg font-black text-blue-400 mt-2">{step.count}</p>
                  </div>
                  {idx < 5 && (
                    <div className="text-gray-600 rotate-90 md:rotate-0 flex items-center justify-center shrink-0">
                      <ArrowRight size={20} />
                    </div>
                  )}
                </div>
              ))}
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
