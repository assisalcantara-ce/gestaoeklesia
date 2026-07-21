'use client'

export const dynamic = 'force-dynamic';

import { useState, useCallback } from 'react'
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
  X,
  FilterX,
} from 'lucide-react'

// ─── Tipos dos filtros ─────────────────────────────────────────────────────────
// Exportados para reuso pela tabela na próxima etapa (Fase 2b)
export type OportunidadeFiltros = {
  pesquisa: string
  lifecycle: string
  prioridade: string
  responsavel: string
  periodoInicio: string
  periodoFim: string
}

const FILTROS_INICIAIS: OportunidadeFiltros = {
  pesquisa: '',
  lifecycle: '',
  prioridade: '',
  responsavel: '',
  periodoInicio: '',
  periodoFim: '',
}

// ─── Opções dos selects ────────────────────────────────────────────────────────
const LIFECYCLE_OPTIONS = [
  { value: '',                  label: 'Todos os estágios' },
  { value: 'novo',              label: 'Novo' },
  { value: 'primeiro_contato',  label: 'Primeiro Contato' },
  { value: 'em_negociacao',     label: 'Em Negociação' },
  { value: 'proposta_enviada',  label: 'Proposta Enviada' },
  { value: 'aguardando_cliente',label: 'Aguardando Cliente' },
  { value: 'aguardando_pagamento', label: 'Aguardando Pagamento' },
  { value: 'convertido',        label: 'Convertido' },
  { value: 'perdido',           label: 'Perdido' },
]

const PRIORIDADE_OPTIONS = [
  { value: '',      label: 'Todas as prioridades' },
  { value: 'alta',  label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
]

const RESPONSAVEL_OPTIONS = [
  { value: '',        label: 'Todos os responsáveis' },
  { value: 'equipe',  label: 'Equipe Comercial' },
]

// ─── Helper: checar se há filtros ativos ──────────────────────────────────────
function hasFiltrosAtivos(f: OportunidadeFiltros): boolean {
  return Object.values(f).some((v) => v !== '')
}

// ─── Componentes de campo padronizados ────────────────────────────────────────
interface FieldLabelProps {
  icon?: React.ReactNode
  label: string
}
function FieldLabel({ icon, label }: FieldLabelProps) {
  return (
    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 mb-1.5 block">
      {icon}
      {label}
    </label>
  )
}

const inputBase =
  'w-full px-3 py-2.5 bg-gray-900 border border-gray-800 hover:border-gray-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30 rounded-xl text-white text-xs placeholder-gray-600 outline-none transition'

const selectBase =
  'w-full px-3 py-2.5 bg-gray-900 border border-gray-800 hover:border-gray-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30 rounded-xl text-xs outline-none transition cursor-pointer appearance-none'


// ─── Página ───────────────────────────────────────────────────────────────────
export default function OportunidadesPage() {
  const { isLoading, isAuthenticated } = useAdminAuth()
  const router = useRouter()

  // ── Estado dos filtros — pronto para ser consumido pela tabela na Fase 2b ──
  const [filtros, setFiltros] = useState<OportunidadeFiltros>(FILTROS_INICIAIS)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isLoading, isAuthenticated, router])

  // ── Handlers reutilizáveis ─────────────────────────────────────────────────
  const handleChange = useCallback(
    (field: keyof OportunidadeFiltros) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFiltros((prev) => ({ ...prev, [field]: e.target.value }))
      },
    []
  )

  const handleLimpar = useCallback(() => {
    setFiltros(FILTROS_INICIAIS)
  }, [])

  const filtrosAtivos = hasFiltrosAtivos(filtros)

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen bg-gray-900">
        <div className="w-64 bg-gray-950 border-r border-gray-800 shrink-0 animate-pulse" />
        <div className="flex-1 p-8 space-y-6">
          <div className="h-8 bg-gray-800 rounded-2xl w-64 animate-pulse" />
          <div className="h-14 bg-gray-800 rounded-2xl w-full animate-pulse" />
          <div className="h-28 bg-gray-800 rounded-2xl w-full animate-pulse" />
          <div className="h-96 bg-gray-800 rounded-2xl w-full animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">

        {/* ── HEADER STICKY ─────────────────────────────────────────────── */}
        <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 z-20">

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] text-gray-500 font-semibold mb-3">
            <button onClick={() => router.push('/admin')} className="hover:text-gray-300 transition cursor-pointer">
              Admin
            </button>
            <ChevronRight className="h-3 w-3 text-gray-700" />
            <button onClick={() => router.push('/admin/comercial')} className="hover:text-gray-300 transition cursor-pointer">
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
                  <Plus className="h-3.5 w-3.5" />
                  Novo
                </button>
                <div className="absolute right-0 top-full mt-2 z-30 hidden group-hover:flex items-center gap-1.5 bg-gray-900 border border-gray-700 text-gray-300 text-[10px] font-semibold px-3 py-1.5 rounded-xl shadow-xl whitespace-nowrap">
                  <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />
                  Disponível em breve
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CONTENT ───────────────────────────────────────────────────── */}
        <div className="p-6 space-y-5">

          {/* ── TOOLBAR DE FILTROS ────────────────────────────────────── */}
          <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-sm">

            {/* Cabeçalho da Toolbar */}
            <div className="px-5 py-3.5 border-b border-gray-800 bg-gray-900/40 flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Filtros</span>

              {/* Badge indicando filtros ativos */}
              {filtrosAtivos && (
                <span className="ml-1 flex items-center gap-1 bg-blue-950/60 text-blue-400 border border-blue-900/60 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <span className="w-1 h-1 bg-blue-400 rounded-full" />
                  Ativos
                </span>
              )}

              {/* Botão Limpar Filtros */}
              {filtrosAtivos && (
                <button
                  onClick={handleLimpar}
                  className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-gray-500 hover:text-rose-400 transition cursor-pointer"
                  title="Limpar todos os filtros"
                >
                  <FilterX className="h-3.5 w-3.5" />
                  Limpar filtros
                </button>
              )}

              {!filtrosAtivos && (
                <span className="ml-auto text-[10px] text-gray-700 font-semibold">
                  Nenhum filtro ativo
                </span>
              )}
            </div>

            {/* Campos — Linha 1 */}
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

              {/* Pesquisa — ocupa 2 colunas */}
              <div className="lg:col-span-2">
                <FieldLabel
                  icon={<Search className="h-3 w-3" />}
                  label="Pesquisa"
                />
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600 pointer-events-none" />
                  <input
                    type="text"
                    id="filtro-pesquisa"
                    placeholder="Nome do ministério ou responsável..."
                    value={filtros.pesquisa}
                    onChange={handleChange('pesquisa')}
                    className={`${inputBase} pl-9 pr-8`}
                  />
                  {filtros.pesquisa && (
                    <button
                      onClick={() => setFiltros((p) => ({ ...p, pesquisa: '' }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition cursor-pointer"
                      title="Limpar pesquisa"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Lifecycle */}
              <div>
                <FieldLabel
                  icon={<Layers className="h-3 w-3" />}
                  label="Lifecycle"
                />
                <div className="relative">
                  <select
                    id="filtro-lifecycle"
                    value={filtros.lifecycle}
                    onChange={handleChange('lifecycle')}
                    className={`${selectBase} ${filtros.lifecycle ? 'text-white' : 'text-gray-500'}`}
                  >
                    {LIFECYCLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-gray-900 text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600 rotate-90 pointer-events-none" />
                </div>
              </div>

              {/* Prioridade */}
              <div>
                <FieldLabel
                  icon={<AlertCircle className="h-3 w-3" />}
                  label="Prioridade"
                />
                <div className="relative">
                  <select
                    id="filtro-prioridade"
                    value={filtros.prioridade}
                    onChange={handleChange('prioridade')}
                    className={`${selectBase} ${filtros.prioridade ? 'text-white' : 'text-gray-500'}`}
                  >
                    {PRIORIDADE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-gray-900 text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600 rotate-90 pointer-events-none" />
                </div>
              </div>

              {/* Responsável */}
              <div>
                <FieldLabel
                  icon={<User className="h-3 w-3" />}
                  label="Responsável"
                />
                <div className="relative">
                  <select
                    id="filtro-responsavel"
                    value={filtros.responsavel}
                    onChange={handleChange('responsavel')}
                    className={`${selectBase} ${filtros.responsavel ? 'text-white' : 'text-gray-500'}`}
                  >
                    {RESPONSAVEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-gray-900 text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600 rotate-90 pointer-events-none" />
                </div>
              </div>

            </div>

            {/* Campos — Linha 2: Período + Limpar */}
            <div className="px-5 pb-5 flex flex-wrap items-end gap-4">

              {/* Período De */}
              <div className="min-w-[160px]">
                <FieldLabel
                  icon={<Calendar className="h-3 w-3" />}
                  label="Período — de"
                />
                <input
                  type="date"
                  id="filtro-periodo-inicio"
                  value={filtros.periodoInicio}
                  onChange={handleChange('periodoInicio')}
                  className={`${inputBase} [color-scheme:dark]`}
                />
              </div>

              {/* Período Até */}
              <div className="min-w-[160px]">
                <FieldLabel
                  icon={<Calendar className="h-3 w-3" />}
                  label="Até"
                />
                <input
                  type="date"
                  id="filtro-periodo-fim"
                  value={filtros.periodoFim}
                  min={filtros.periodoInicio || undefined}
                  onChange={handleChange('periodoFim')}
                  className={`${inputBase} [color-scheme:dark]`}
                />
              </div>

              {/* Botão Limpar — versão expandida na linha 2 */}
              <div className="ml-auto">
                <button
                  onClick={handleLimpar}
                  disabled={!filtrosAtivos}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition ${
                    filtrosAtivos
                      ? 'bg-gray-900 hover:bg-rose-950/40 text-gray-400 hover:text-rose-400 border-gray-800 hover:border-rose-900/60 cursor-pointer'
                      : 'bg-gray-900/40 text-gray-700 border-gray-800 cursor-not-allowed opacity-50 select-none'
                  }`}
                >
                  <FilterX className="h-3.5 w-3.5" />
                  Limpar filtros
                </button>
              </div>

            </div>

            {/* Resumo dos filtros ativos — debug visual */}
            {filtrosAtivos && (
              <div className="px-5 pb-4 flex flex-wrap gap-2">
                {filtros.pesquisa && (
                  <span className="flex items-center gap-1 bg-blue-950/40 text-blue-400 border border-blue-900/40 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    Pesquisa: "{filtros.pesquisa}"
                    <button onClick={() => setFiltros((p) => ({ ...p, pesquisa: '' }))} className="cursor-pointer hover:text-white ml-1">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )}
                {filtros.lifecycle && (
                  <span className="flex items-center gap-1 bg-indigo-950/40 text-indigo-400 border border-indigo-900/40 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    {LIFECYCLE_OPTIONS.find(o => o.value === filtros.lifecycle)?.label}
                    <button onClick={() => setFiltros((p) => ({ ...p, lifecycle: '' }))} className="cursor-pointer hover:text-white ml-1">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )}
                {filtros.prioridade && (
                  <span className="flex items-center gap-1 bg-amber-950/40 text-amber-400 border border-amber-900/40 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    Prioridade: {filtros.prioridade}
                    <button onClick={() => setFiltros((p) => ({ ...p, prioridade: '' }))} className="cursor-pointer hover:text-white ml-1">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )}
                {filtros.responsavel && (
                  <span className="flex items-center gap-1 bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    {RESPONSAVEL_OPTIONS.find(o => o.value === filtros.responsavel)?.label}
                    <button onClick={() => setFiltros((p) => ({ ...p, responsavel: '' }))} className="cursor-pointer hover:text-white ml-1">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )}
                {(filtros.periodoInicio || filtros.periodoFim) && (
                  <span className="flex items-center gap-1 bg-cyan-950/40 text-cyan-400 border border-cyan-900/40 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    Período: {filtros.periodoInicio || '...'} → {filtros.periodoFim || '...'}
                    <button
                      onClick={() => setFiltros((p) => ({ ...p, periodoInicio: '', periodoFim: '' }))}
                      className="cursor-pointer hover:text-white ml-1"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── CARD LISTA DE OPORTUNIDADES ───────────────────────────── */}
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

            {/* Empty State — permanece até a Fase 2b (tabela) */}
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center space-y-5">
              <div className="relative">
                <div className="w-20 h-20 bg-gray-900 border border-gray-800 rounded-3xl flex items-center justify-center shadow-inner">
                  <Inbox className="h-9 w-9 text-gray-600" />
                </div>
                <div className="absolute inset-0 -z-10 bg-blue-600/5 rounded-3xl blur-2xl scale-150 pointer-events-none" />
              </div>
              <div className="space-y-2 max-w-sm">
                <h3 className="text-base font-bold text-white">
                  Nenhuma oportunidade carregada
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  A listagem de oportunidades será implementada na próxima etapa do CRM Comercial.
                </p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-950/40 border border-blue-900/50 rounded-xl">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                <span className="text-[11px] font-bold text-blue-400">CRM Fase 2b — Tabela em desenvolvimento</span>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
