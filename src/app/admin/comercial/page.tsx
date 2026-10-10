'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import AdminSidebar from '@/components/AdminSidebar'
import CrmSummaryCards from '@/components/crm/CrmSummaryCards'
import CrmNextActions from '@/components/crm/CrmNextActions'
import { ComercialViewModel } from '@/lib/platform/commercial/types'
import {
  Briefcase,
  TrendingUp,
  RefreshCw,
  ArrowRight
} from 'lucide-react'


export default function ComercialDashboardPage() {
  const { isLoading, isAuthenticated } = useAdminAuth()
  const router = useRouter()

  const [oportunidades, setOportunidades] = useState<ComercialViewModel[]>([])

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
      { key: 'LEAD',            label: 'Leads',          desc: 'Pré-cadastros sem ação', statusMatch: ['LEAD'],                             accent: '#6366f1', bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.3)'  },
      { key: 'TRIAL',           label: 'Trial Ativo',    desc: 'Em teste gratuito',     statusMatch: ['TRIAL', 'TRIAL_EXPIRING'],          accent: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.3)'  },
      { key: 'TRIAL_EXPIRED',   label: 'Trial Expirado', desc: 'Aguardando conversão',  statusMatch: ['TRIAL_EXPIRED'],                    accent: '#f43f5e', bg: 'rgba(244,63,94,0.08)',   border: 'rgba(244,63,94,0.3)'   },
      { key: 'NEGOTIATION',     label: 'Negociação',     desc: 'Alinhando contrato',    statusMatch: ['NEGOTIATION'],                      accent: '#06b6d4', bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.3)'   },
      { key: 'PAYMENT_PENDING', label: 'Pagamento',      desc: 'Aguardando ASAAS',      statusMatch: ['PAYMENT_PENDING'],                  accent: '#ec4899', bg: 'rgba(236,72,153,0.08)',  border: 'rgba(236,72,153,0.3)'  },
      { key: 'ACTIVE',          label: 'Ativos',         desc: 'Clientes operacionais', statusMatch: ['ACTIVE', 'CONVERTIDO'],             accent: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.3)'  },
      { key: 'RENEWAL',         label: 'Renovação',      desc: 'Próximos a vencer',     statusMatch: ['RENEWAL'],                          accent: '#0284c7', bg: 'rgba(2,132,199,0.08)',   border: 'rgba(2,132,199,0.3)'   },
    ]

    const withData = stages.map((stage) => {
      const matching = oportunidades.filter(o => {
        const s = (o.lifecycle?.status || o.status || '').toUpperCase().trim()
        return stage.statusMatch.includes(s)
      })
      const count = matching.length
      const valor = matching.reduce((acc, o) => acc + getPlanoPrice(o.plano_solicitado || o.plano), 0)
      return { ...stage, count, valor }
    })

    const totalCount = withData.reduce((s, st) => s + st.count, 0)

    return withData.map((stage) => ({
      ...stage,
      percentual: totalCount > 0 ? Math.round((stage.count / totalCount) * 100) : 0
    }))
  }, [oportunidades])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen bg-gray-900">
        <div className="w-64 bg-gray-950 border-r border-gray-800 shrink-0 animate-pulse" />
        <div className="flex-1 p-8 space-y-6">
          <div className="h-10 bg-gray-800 rounded-2xl w-72 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-800 rounded-2xl border border-gray-700 animate-pulse" />
            ))}
          </div>
          <div className="h-48 bg-gray-800 rounded-2xl border border-gray-700 animate-pulse" />
          <div className="h-64 bg-gray-800 rounded-2xl border border-gray-700 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#032C28]">
      <AdminSidebar />

      <main className="flex-1 overflow-auto bg-[#032C28]">
        {/* Top Header */}
        <div className="sticky top-0 bg-[#02201d]/90 backdrop-blur-md border-b border-[#0E4D43]/70 px-6 py-4 z-10 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-[#F8FAFC] flex items-center gap-2">
              <Briefcase className="text-[#10B981]" />
              CRM: Dashboard Comercial
            </h2>
            <p className="text-[#A7C4BC] text-xs mt-1">
              Visão geral das negociações, taxas de conversão e receita prevista.
            </p>
          </div>
          <button
            onClick={fetchOportunidades}
            className="flex items-center gap-2 px-4 py-2 bg-[#073B34] hover:bg-[#0B453B] border border-[#0E4D43] text-[#F8FAFC] rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <RefreshCw size={15} />
            Atualizar
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-8">
          
          {/* 1. Indicadores Executivos Oficiais (Topo da Página) */}
          <CrmSummaryCards />

          {/* 2. Prioridade Operacional: Fila de Trabalho Comercial */}
          <CrmNextActions onRefresh={fetchOportunidades} />


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

        </div>
      </main>
    </div>
  )
}
