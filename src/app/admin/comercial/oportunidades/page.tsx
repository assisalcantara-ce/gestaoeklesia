'use client'

export const dynamic = 'force-dynamic';

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import AdminSidebar from '@/components/AdminSidebar'
import {
  Briefcase,
  RefreshCw,
  Plus,
  Search,
  ChevronRight,
  Layers,
  AlertCircle,
  User,
  Calendar,
  Inbox,
} from 'lucide-react'

export default function OportunidadesPage() {
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
          <div className="h-14 bg-gray-800 rounded-2xl w-full animate-pulse" />
          <div className="h-16 bg-gray-800 rounded-2xl w-full animate-pulse" />
          <div className="h-96 bg-gray-800 rounded-2xl w-full animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">

        {/* ── HEADER STICKY ───────────────────────────────────────────── */}
        <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 z-20">

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
            <span className="text-gray-300">Oportunidades</span>
          </nav>

          {/* Título + Ações */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-950/60 border border-blue-900/60 rounded-xl text-blue-400">
                  <Briefcase className="h-4 w-4" />
                </div>
                Oportunidades
              </h1>
              <p className="text-gray-400 text-xs mt-1.5 max-w-xl">
                Central operacional do CRM Comercial. Gerencie, acompanhe e converta todas as negociações ativas do Gestão Eklésia.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Botão Atualizar */}
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar
              </button>

              {/* Botão Novo — desabilitado */}
              <div className="relative group">
                <button
                  disabled
                  aria-disabled="true"
                  title="Disponível em breve"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-700/40 text-blue-400/60 border border-blue-800/40 rounded-xl text-xs font-bold cursor-not-allowed select-none opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Novo
                </button>
                {/* Tooltip */}
                <div className="absolute right-0 top-full mt-2 z-30 hidden group-hover:flex items-center gap-1.5 bg-gray-900 border border-gray-700 text-gray-300 text-[10px] font-semibold px-3 py-1.5 rounded-xl shadow-xl whitespace-nowrap">
                  <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />
                  Disponível em breve
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CONTENT ─────────────────────────────────────────────────── */}
        <div className="p-6 space-y-5">

          {/* ── TOOLBAR DE FILTROS (Preparada — sem lógica) ─────────── */}
          <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-gray-800 bg-gray-900/40 flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Filtros</span>
              <span className="ml-auto text-[10px] text-gray-600 font-semibold italic">Disponíveis na próxima etapa</span>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">

              {/* Pesquisa */}
              <div className="lg:col-span-2 space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                  Pesquisa
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
                  <div className="w-full pl-9 pr-4 py-2.5 bg-gray-900/60 border border-gray-800 rounded-xl text-gray-600 text-xs cursor-not-allowed select-none">
                    Nome do ministério ou responsável...
                  </div>
                </div>
              </div>

              {/* Lifecycle */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 block">
                  <Layers className="h-3 w-3" />
                  Lifecycle
                </label>
                <div className="w-full px-3 py-2.5 bg-gray-900/60 border border-gray-800 rounded-xl text-gray-600 text-xs cursor-not-allowed select-none">
                  Todos os estágios
                </div>
              </div>

              {/* Prioridade */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 block">
                  <AlertCircle className="h-3 w-3" />
                  Prioridade
                </label>
                <div className="w-full px-3 py-2.5 bg-gray-900/60 border border-gray-800 rounded-xl text-gray-600 text-xs cursor-not-allowed select-none">
                  Todas
                </div>
              </div>

              {/* Responsável */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 block">
                  <User className="h-3 w-3" />
                  Responsável
                </label>
                <div className="w-full px-3 py-2.5 bg-gray-900/60 border border-gray-800 rounded-xl text-gray-600 text-xs cursor-not-allowed select-none">
                  Todos
                </div>
              </div>

            </div>

            {/* Segunda linha — Período */}
            <div className="px-4 pb-4">
              <div className="w-full sm:w-64 space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 block">
                  <Calendar className="h-3 w-3" />
                  Período
                </label>
                <div className="w-full px-3 py-2.5 bg-gray-900/60 border border-gray-800 rounded-xl text-gray-600 text-xs cursor-not-allowed select-none">
                  Todos os períodos
                </div>
              </div>
            </div>
          </div>

          {/* ── CARD LISTA DE OPORTUNIDADES ─────────────────────────── */}
          <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-sm">

            {/* Cabeçalho do Card */}
            <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-950/60 border border-blue-900/60 rounded-xl text-blue-400">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Lista de Oportunidades</h2>
                  <p className="text-[11px] text-gray-400">Central operacional do funil de vendas comercial</p>
                </div>
              </div>
              <span className="text-[10px] bg-gray-900 text-gray-500 border border-gray-800 font-semibold px-3 py-1 rounded-full">
                0 registros
              </span>
            </div>

            {/* Empty State Elegante */}
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center space-y-5">

              {/* Ícone decorativo */}
              <div className="relative">
                <div className="w-20 h-20 bg-gray-900 border border-gray-800 rounded-3xl flex items-center justify-center shadow-inner">
                  <Inbox className="h-9 w-9 text-gray-600" />
                </div>
                {/* Glow decorativo */}
                <div className="absolute inset-0 -z-10 bg-blue-600/5 rounded-3xl blur-2xl scale-150 pointer-events-none" />
              </div>

              {/* Textos */}
              <div className="space-y-2 max-w-sm">
                <h3 className="text-base font-bold text-white">
                  Nenhuma oportunidade carregada
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  A listagem de oportunidades será implementada na próxima etapa do CRM Comercial.
                </p>
              </div>

              {/* Badge de status da feature */}
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-950/40 border border-blue-900/50 rounded-xl">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                <span className="text-[11px] font-bold text-blue-400">CRM Fase 2 — Em desenvolvimento</span>
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
