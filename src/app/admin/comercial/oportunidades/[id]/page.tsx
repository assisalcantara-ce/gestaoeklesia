'use client'

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import AdminSidebar from '@/components/AdminSidebar'
import {
  ChevronRight,
  RefreshCw,
  MoreHorizontal,
  ArrowLeft,
  Briefcase,
  AlertCircle,
  Inbox,
} from 'lucide-react'

export default function OportunidadePerfilPage() {
  const { isLoading, isAuthenticated } = useAdminAuth()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'resumo' | 'interacoes' | 'timeline' | 'financeiro' | 'documentos'>('resumo')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen bg-gray-900">
        <div className="w-64 bg-gray-950 border-r border-gray-800 shrink-0 animate-pulse" />
        <div className="flex-1 p-8 space-y-6 animate-pulse">
          <div className="h-8 bg-gray-800 rounded-2xl w-64" />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-800 rounded-2xl border border-gray-700" />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 h-96 bg-gray-800 rounded-2xl" />
            <div className="h-96 bg-gray-800 rounded-2xl" />
          </div>
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
            <button onClick={() => router.push('/admin')} className="hover:text-gray-300 transition cursor-pointer">Admin</button>
            <ChevronRight className="h-3 w-3 text-gray-700" />
            <button onClick={() => router.push('/admin/comercial')} className="hover:text-gray-300 transition cursor-pointer">Comercial</button>
            <ChevronRight className="h-3 w-3 text-gray-700" />
            <button onClick={() => router.push('/admin/comercial/oportunidades')} className="hover:text-gray-300 transition cursor-pointer">Oportunidades</button>
            <ChevronRight className="h-3 w-3 text-gray-700" />
            <span className="text-gray-300">Perfil</span>
          </nav>

          {/* Título + Ações */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-950/60 border border-blue-900/60 rounded-xl text-blue-400">
                  <Briefcase className="h-4 w-4" />
                </div>
                Ministério Exemplo
              </h1>
              <p className="text-gray-400 text-xs mt-1.5 max-w-xl">
                Resumo do relacionamento comercial.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => router.push('/admin/comercial/oportunidades')}
                className="flex items-center gap-2 px-3.5 py-2 bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-white border border-gray-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar
              </button>

              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-3.5 py-2 bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-white border border-gray-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar
              </button>

              <div className="relative group">
                <button
                  disabled
                  aria-disabled="true"
                  className="flex items-center gap-2 px-3.5 py-2 bg-blue-700/40 text-blue-400/60 border border-blue-800/40 rounded-xl text-xs font-bold cursor-not-allowed select-none opacity-60"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                  Mais ações
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

          {/* ── FAIXA DE KPIS VAZIOS ──────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 shrink-0">
            {[
              { label: 'Lifecycle', value: '—' },
              { label: 'Plano',     value: '—' },
              { label: 'Responsável', value: '—' },
              { label: 'Situação Financeira', value: '—' },
              { label: 'Próxima Ação', value: '—' },
            ].map((kpi, idx) => (
              <div 
                key={idx}
                className="bg-gray-950 border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs transition hover:shadow-md duration-200"
              >
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                  {kpi.label}
                </span>
                <p className="text-lg font-black text-gray-400 tracking-tight mt-1">
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          {/* ── GRID DE DUAS COLUNAS ──────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start flex-1 min-h-0">
            
            {/* Coluna Esquerda (Principal) */}
            <div className="lg:col-span-2 flex flex-col h-full bg-gray-950/20 border border-gray-850 rounded-2xl overflow-hidden min-h-[400px]">
              
              {/* Abas */}
              <div className="border-b border-gray-850/80 bg-gray-950/60 px-4 py-2 flex gap-1.5 shrink-0 overflow-x-auto">
                {(['resumo', 'interacoes', 'timeline', 'financeiro', 'documentos'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition capitalize cursor-pointer outline-none ${
                      activeTab === tab
                        ? 'bg-blue-950/60 text-blue-400 border border-blue-900/50'
                        : 'text-gray-400 hover:text-gray-250 border border-transparent'
                    }`}
                  >
                    {tab === 'interacoes' ? 'Interações' : tab}
                  </button>
                ))}
              </div>

              {/* Conteúdo da Aba (Empty State) */}
              <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-gray-900 border border-gray-850 rounded-2xl flex items-center justify-center mb-3">
                  <Inbox className="h-5 w-5 text-gray-600" />
                </div>
                <h4 className="text-xs font-bold text-gray-400 capitalize">Aba {activeTab === 'interacoes' ? 'Interações' : activeTab}</h4>
                <p className="text-[10px] text-gray-600 mt-1 max-w-[200px]">
                  Os dados desta seção serão carregados na próxima etapa.
                </p>
              </div>
            </div>

            {/* Coluna Direita (Sidebar) */}
            <div className="space-y-4 h-full overflow-y-auto pr-1">
              {[
                { label: 'Informações do Ministério', desc: 'Dados institucionais do cliente.' },
                { label: 'Contatos',                  desc: 'E-mails, telefones e responsáveis.' },
                { label: 'Histórico Comercial',       desc: 'Registro consolidado de interações.' },
                { label: 'Próximas Ações',            desc: 'Tarefas e agendamentos planejados.' },
              ].map((card, idx) => (
                <div 
                  key={idx}
                  className="bg-gray-950 border border-gray-850 rounded-2xl p-4.5 flex flex-col shadow-xs"
                >
                  <h3 className="text-xs font-bold text-gray-300 border-b border-gray-900 pb-2.5 mb-3.5">
                    {card.label}
                  </h3>
                  
                  {/* Empty State na sidebar */}
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="w-9 h-9 bg-gray-900 border border-gray-850 rounded-xl flex items-center justify-center mb-2">
                      <Inbox className="h-4 w-4 text-gray-650" />
                    </div>
                    <h5 className="text-[10px] font-bold text-gray-500">Sem informações</h5>
                    <p className="text-[9px] text-gray-600 mt-0.5 max-w-[160px]">
                      {card.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

          </div>

        </div>
      </main>
    </div>
  )
}
