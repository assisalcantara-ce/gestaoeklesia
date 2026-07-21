'use client'

export const dynamic = 'force-dynamic';

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import AdminSidebar from '@/components/AdminSidebar'
import {
  GitBranch,
  RefreshCw,
  Settings,
  ChevronRight,
  AlertCircle,
  TrendingUp,
  DollarSign,
  PieChart,
  Target,
  Inbox,
} from 'lucide-react'

// ─── Colunas Fixas do Kanban ──────────────────────────────────────────────────
const KANBAN_COLUMNS = [
  { key: 'lead',           label: 'Lead',            color: 'border-t-indigo-500 bg-indigo-950/5' },
  { key: 'trial',          label: 'Trial',           color: 'border-t-blue-500 bg-blue-950/5' },
  { key: 'negociacao',     label: 'Negociação',      color: 'border-t-cyan-500 bg-cyan-950/5' },
  { key: 'pagamento',      label: 'Pagamento',       color: 'border-t-pink-500 bg-pink-950/5' },
  { key: 'cliente_ativo',  label: 'Cliente Ativo',   color: 'border-t-emerald-500 bg-emerald-950/5' },
  { key: 'renovacao',      label: 'Renovação',       color: 'border-t-sky-500 bg-sky-950/5' },
  { key: 'cancelado',      label: 'Cancelado',       color: 'border-t-slate-500 bg-slate-950/5' },
]

export default function PipelinePage() {
  const { isLoading, isAuthenticated } = useAdminAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen bg-gray-900">
        <div className="w-64 bg-gray-950 border-r border-gray-800 shrink-0 animate-pulse" />
        <div className="flex-1 p-8 space-y-6">
          <div className="h-8 bg-gray-800 rounded-2xl w-64 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-800 rounded-2xl border border-gray-700 animate-pulse" />
            ))}
          </div>
          <div className="h-96 bg-gray-800 rounded-2xl w-full animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />

      <main className="flex-1 overflow-auto flex flex-col h-full">

        {/* ── HEADER STICKY ───────────────────────────────────────────── */}
        <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 z-20 shrink-0">

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] text-gray-500 font-semibold mb-3">
            <button
              onClick={() => router.push('/admin')}
              className="hover:text-gray-300 transition cursor-pointer"
            >
              Admin
            </button>
            <ChevronRight className="h-3 w-3 text-gray-700" />
            <button
              onClick={() => router.push('/admin/comercial')}
              className="hover:text-gray-300 transition cursor-pointer"
            >
              Comercial
            </button>
            <ChevronRight className="h-3 w-3 text-gray-700" />
            <span className="text-gray-300">Pipeline</span>
          </nav>

          {/* Título + Ações */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-950/60 border border-blue-900/60 rounded-xl text-blue-400">
                  <GitBranch className="h-4 w-4" />
                </div>
                Pipeline Comercial
              </h1>
              <p className="text-gray-400 text-xs mt-1.5 max-w-xl">
                Gerencie visualmente o avanço das oportunidades no funil comercial.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar
              </button>

              <div className="relative group">
                <button
                  disabled
                  aria-disabled="true"
                  title="Disponível em breve"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-700/40 text-blue-400/60 border border-blue-800/40 rounded-xl text-xs font-bold cursor-not-allowed select-none opacity-60"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Configurar
                </button>
                <div className="absolute right-0 top-full mt-2 z-30 hidden group-hover:flex items-center gap-1.5 bg-gray-900 border border-gray-700 text-gray-300 text-[10px] font-semibold px-3 py-1.5 rounded-xl shadow-xl whitespace-nowrap">
                  <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />
                  Disponível em breve
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CONTENT AREA ──────────────────────────────────────────────── */}
        <div className="p-6 space-y-6 flex-1 flex flex-col min-h-0">

          {/* ── CARDS INFORMATIVOS VAZIOS ─────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
            {[
              { label: 'Total de Oportunidades', icon: <TrendingUp className="h-4 w-4" />, value: '—', desc: 'Negociações ativas' },
              { label: 'Valor Estimado',        icon: <DollarSign className="h-4 w-4" />, value: '—', desc: 'Volume financeiro previsto' },
              { label: 'Conversão',             icon: <PieChart className="h-4 w-4" />,  value: '—', desc: 'Taxa média de fechamento' },
              { label: 'Ticket Médio',          icon: <Target className="h-4 w-4" />,    value: '—', desc: 'Valor por contrato ativo' },
            ].map((kpi, idx) => (
              <div 
                key={idx} 
                className="bg-gray-950 border border-gray-800 rounded-2xl p-4 md:p-5 flex flex-col justify-between shadow-xs transition hover:shadow-md duration-200"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                      {kpi.label}
                    </span>
                    <p className="text-xl font-black text-gray-400 tracking-tight leading-none">
                      {kpi.value}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-900 text-gray-500 shrink-0">
                    {kpi.icon}
                  </div>
                </div>
                <div className="text-[10px] text-gray-500 font-medium truncate mt-3 pt-2.5 border-t border-gray-900">
                  {kpi.desc}
                </div>
              </div>
            ))}
          </div>

          {/* ── KANBAN BOARD ──────────────────────────────────────────── */}
          <div className="flex-1 min-h-[450px] flex gap-4 overflow-x-auto pb-4">
            {KANBAN_COLUMNS.map((column) => (
              <div 
                key={column.key}
                className={`w-72 shrink-0 border-t-2 ${column.color} border-x border-b border-gray-850 bg-gray-950/20 rounded-2xl flex flex-col h-full overflow-hidden shadow-xs`}
              >
                {/* Cabeçalho da coluna */}
                <div className="px-4 py-3.5 border-b border-gray-850/60 bg-gray-950/60 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300">
                    {column.label}
                  </span>
                  <span className="text-[10px] font-bold bg-gray-900 text-gray-500 border border-gray-800 px-2 py-0.5 rounded-full">
                    0
                  </span>
                </div>

                {/* Área para cards com Empty State */}
                <div className="flex-1 p-4 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-gray-900 border border-gray-850 rounded-2xl flex items-center justify-center mb-2.5">
                    <Inbox className="h-5 w-5 text-gray-600" />
                  </div>
                  <h4 className="text-xs font-bold text-gray-400">Nenhuma oportunidade</h4>
                  <p className="text-[10px] text-gray-600 mt-1 max-w-[160px]">
                    Nenhum registro ativo nesta etapa.
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </main>
    </div>
  )
}
