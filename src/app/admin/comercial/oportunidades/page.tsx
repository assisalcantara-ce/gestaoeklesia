'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import { authenticatedFetch } from '@/lib/api-client'
import AdminSidebar from '@/components/AdminSidebar'
import CrmActivityDrawer from '@/components/crm/CrmActivityDrawer'
import { CrmActivityData } from '@/components/crm/CrmActivities'
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
  ArrowUpRight,
  Clock,
  CheckCircle2,
  CreditCard,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'

// ─── Tipos dos filtros ─────────────────────────────────────────────────────────
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

type SortField = 'nome' | 'responsavel' | 'lifecycle' | 'prioridade' | 'nextAction' | 'dataCriacao' | null
type SortDirection = 'asc' | 'desc' | null

// ─── Opções dos selects ────────────────────────────────────────────────────────
const LIFECYCLE_OPTIONS = [
  { value: '',                     label: 'Todos os estágios' },
  { value: 'novo',                 label: 'Novo' },
  { value: 'primeiro_contato',     label: 'Primeiro Contato' },
  { value: 'em_negociacao',        label: 'Em Negociação' },
  { value: 'proposta_enviada',     label: 'Proposta Enviada' },
  { value: 'aguardando_cliente',   label: 'Aguardando Cliente' },
  { value: 'aguardando_pagamento', label: 'Aguardando Pagamento' },
  { value: 'convertido',           label: 'Convertido' },
  { value: 'perdido',              label: 'Perdido' },
]

const PRIORIDADE_OPTIONS = [
  { value: '',      label: 'Todas as prioridades' },
  { value: 'alta',  label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
]

const RESPONSAVEL_OPTIONS = [
  { value: '',       label: 'Todos os responsáveis' },
  { value: 'equipe', label: 'Equipe Comercial' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hasFiltrosAtivos(f: OportunidadeFiltros): boolean {
  return Object.values(f).some((v) => v !== '')
}

function getPrioridadeWeight(p: string): number {
  if (p === 'alta')  return 3
  if (p === 'media') return 2
  return 1
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function isVencido(iso: string): boolean {
  return new Date(iso).getTime() < Date.now()
}

// ─── Badge de Prioridade ──────────────────────────────────────────────────────
function PrioridadeBadge({ prioridade }: { prioridade: string }) {
  const styles: Record<string, string> = {
    alta:  'bg-rose-950/60 text-rose-400 border-rose-900/60',
    media: 'bg-amber-950/60 text-amber-400 border-amber-900/60',
    baixa: 'bg-gray-800 text-gray-400 border-gray-700',
  }
  const label: Record<string, string> = {
    alta: 'Alta', media: 'Média', baixa: 'Baixa',
  }
  const key = (prioridade || '').toLowerCase()
  return (
    <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${styles[key] || styles.baixa}`}>
      {label[key] || prioridade || '—'}
    </span>
  )
}

// ─── Badge de Lifecycle ───────────────────────────────────────────────────────
function LifecycleBadge({ status }: { status: string }) {
  const s = (status || '').toUpperCase()
  const map: Record<string, string> = {
    TRIAL:               'bg-blue-950/60 text-blue-300 border-blue-900/60',
    TRIAL_EXPIRING:      'bg-amber-950/60 text-amber-300 border-amber-900/60',
    TRIAL_EXPIRED:       'bg-rose-950/60 text-rose-300 border-rose-900/60',
    ACTIVE:              'bg-emerald-950/60 text-emerald-300 border-emerald-900/60',
    RENEWAL:             'bg-sky-950/60 text-sky-300 border-sky-900/60',
    PAYMENT_PENDING:     'bg-rose-950/60 text-rose-300 border-rose-900/60',
    CANCELLED:           'bg-slate-800 text-slate-400 border-slate-700',
    LEAD:                'bg-indigo-950/60 text-indigo-300 border-indigo-900/60',
  }
  return (
    <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${map[s] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
      {status || '—'}
    </span>
  )
}

// ─── Badge de Situação Financeira ─────────────────────────────────────────────
function FinanceiroBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-gray-600 text-xs">—</span>
  const s = status.toLowerCase()
  const map: Record<string, string> = {
    ok:       'text-emerald-400',
    pendente: 'text-amber-400',
    atrasado: 'text-rose-400',
    isento:   'text-gray-400',
  }
  const icons: Record<string, React.ReactNode> = {
    ok:       <CheckCircle2 className="h-3 w-3" />,
    pendente: <Clock className="h-3 w-3" />,
    atrasado: <CreditCard className="h-3 w-3" />,
    isento:   <span className="h-3 w-3" />,
  }
  const color = map[s] || 'text-gray-400'
  return (
    <span className={`flex items-center gap-1 text-xs font-semibold ${color}`}>
      {icons[s]}
      {status}
    </span>
  )
}

// ─── Componentes de formulário ────────────────────────────────────────────────
interface FieldLabelProps { icon?: React.ReactNode; label: string }
function FieldLabel({ icon, label }: FieldLabelProps) {
  return (
    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 mb-1.5 block">
      {icon}{label}
    </label>
  )
}

const inputBase =
  'w-full px-3 py-2.5 bg-gray-900 border border-gray-800 hover:border-gray-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30 rounded-xl text-white text-xs placeholder-gray-600 outline-none transition'

const selectBase =
  'w-full px-3 py-2.5 bg-gray-900 border border-gray-800 hover:border-gray-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30 rounded-xl text-xs outline-none transition cursor-pointer appearance-none'

// ─── Skeleton de loading da tabela ────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="divide-y divide-gray-800/60">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-gray-800 rounded w-40" />
            <div className="h-3 bg-gray-800/60 rounded w-24" />
          </div>
          <div className="h-5 bg-gray-800 rounded-full w-20" />
          <div className="h-3.5 bg-gray-800 rounded w-20" />
          <div className="h-3.5 bg-gray-800 rounded w-28" />
          <div className="h-3.5 bg-gray-800 rounded w-24" />
          <div className="h-3.5 bg-gray-800 rounded w-20" />
          <div className="h-5 bg-gray-800 rounded-full w-12" />
          <div className="h-7 bg-gray-800 rounded-xl w-16" />
        </div>
      ))}
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function OportunidadesPage() {
  const { isLoading, isAuthenticated } = useAdminAuth()
  const router = useRouter()

  // ── Filtros ───────────────────────────────────────────────────────────────
  const [filtros, setFiltros] = useState<OportunidadeFiltros>(FILTROS_INICIAIS)

  // ── Ordenação ─────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  // ── Dados da tabela ────────────────────────────────────────────────────────
  const [activities, setActivities] = useState<CrmActivityData[]>([])
  const [tableLoading, setTableLoading] = useState<boolean>(true)
  const [tableError, setTableError] = useState<string | null>(null)

  // ── Drawer ────────────────────────────────────────────────────────────────
  const [selectedActivity, setSelectedActivity] = useState<CrmActivityData | null>(null)

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/admin/login')
  }, [isLoading, isAuthenticated, router])

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchActivities = useCallback(async () => {
    setTableLoading(true)
    setTableError(null)
    try {
      const res = await authenticatedFetch('/api/v1/admin/crm/activities')
      if (!res.ok) throw new Error('Erro ao carregar oportunidades')
      const data = await res.json()
      setActivities(data || [])
    } catch (err: any) {
      setTableError(err?.message || 'Erro ao carregar oportunidades')
    } finally {
      setTableLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) fetchActivities()
  }, [isAuthenticated, fetchActivities])

  const handleSuccess = useCallback(() => {
    fetchActivities()
  }, [fetchActivities])

  // ── Handler para alternar ordenação por coluna ─────────────────────────────
  const handleSort = useCallback((field: SortField) => {
    setSortField((currentField) => {
      if (currentField !== field) {
        setSortDirection('asc')
        return field
      }
      
      setSortDirection((currentDir) => {
        if (currentDir === 'asc') return 'desc'
        return null // Remove ordenação no 3º clique
      })
      
      return field
    })
  }, [])

  // Limpa o campo de ordenação se a direção foi resetada para null
  useEffect(() => {
    if (sortDirection === null) {
      setSortField(null)
    }
  }, [sortDirection])

  // ── Componente de cabeçalho ordenável com indicador visual ─────────────────
  const HeaderCell = ({ field, label }: { field: SortField; label: string }) => {
    const isCurrent = sortField === field
    return (
      <th 
        onClick={() => handleSort(field)}
        className="py-3 px-4 font-bold cursor-pointer hover:bg-gray-800 hover:text-white transition group select-none"
      >
        <span className="flex items-center gap-1">
          {label}
          <span className="inline-flex shrink-0">
            {isCurrent && sortDirection === 'asc' && <ArrowUp className="h-3 w-3 text-blue-400" />}
            {isCurrent && sortDirection === 'desc' && <ArrowDown className="h-3 w-3 text-blue-400" />}
            {!isCurrent && <ArrowUp className="h-3 w-3 text-gray-700 opacity-0 group-hover:opacity-100 transition" />}
          </span>
        </span>
      </th>
    )
  }

  // ── Filtragem em memória (cumulativa) via useMemo ───────────────────────
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // 1. Pesquisa (ministério, email, telefone, responsável)
      if (filtros.pesquisa) {
        const query = filtros.pesquisa.toLowerCase().trim()
        const matchNome = act.nome?.toLowerCase().includes(query)
        const matchEmail = act.email?.toLowerCase().includes(query)
        const matchTelefone = act.telefone?.toLowerCase().includes(query)
        const matchResponsavel = act.responsavel?.toLowerCase().includes(query)

        if (!matchNome && !matchEmail && !matchTelefone && !matchResponsavel) {
          return false
        }
      }

      // 2. Lifecycle
      if (filtros.lifecycle) {
        const status = (act.lifecycle?.status || act.status || '').toLowerCase()
        if (status !== filtros.lifecycle.toLowerCase()) {
          return false
        }
      }

      // 3. Prioridade
      if (filtros.prioridade) {
        const prioridade = (act.prioridade || '').toLowerCase()
        if (prioridade !== filtros.prioridade.toLowerCase()) {
          return false
        }
      }

      // 4. Responsável
      if (filtros.responsavel) {
        if (filtros.responsavel === 'equipe') {
          if (!act.responsavel) return false
        }
      }

      // 5. Período (filtrar pela data da próxima ação)
      if (filtros.periodoInicio || filtros.periodoFim) {
        const vencAction = act.nextAction?.vencimento
        if (!vencAction) return false

        const timeAction = new Date(vencAction).getTime()

        if (filtros.periodoInicio) {
          const timeInicio = new Date(`${filtros.periodoInicio}T00:00:00`).getTime()
          if (timeAction < timeInicio) return false
        }

        if (filtros.periodoFim) {
          const timeFim = new Date(`${filtros.periodoFim}T23:59:59`).getTime()
          if (timeAction > timeFim) return false
        }
      }

      return true
    })
  }, [activities, filtros])

  // ── Ordenação final (Padrão ou Dinâmica) via useMemo ────────────────────
  const sortedActivities = useMemo(() => {
    const list = [...filteredActivities]

    // Se houver campo e direção definidos, aplica a ordenação dinâmica
    if (sortField && sortDirection) {
      const isAsc = sortDirection === 'asc'

      list.sort((a, b) => {
        let valA: any = ''
        let valB: any = ''

        switch (sortField) {
          case 'nome':
            valA = a.nome || ''
            valB = b.nome || ''
            return isAsc ? valA.localeCompare(valB, 'pt-BR') : valB.localeCompare(valA, 'pt-BR')

          case 'responsavel':
            valA = a.responsavel || ''
            valB = b.responsavel || ''
            return isAsc ? valA.localeCompare(valB, 'pt-BR') : valB.localeCompare(valA, 'pt-BR')

          case 'lifecycle':
            valA = a.lifecycle?.status || a.status || ''
            valB = b.lifecycle?.status || b.status || ''
            return isAsc ? valA.localeCompare(valB, 'pt-BR') : valB.localeCompare(valA, 'pt-BR')

          case 'prioridade':
            valA = getPrioridadeWeight(a.prioridade)
            valB = getPrioridadeWeight(b.prioridade)
            return isAsc ? valA - valB : valB - valA

          case 'nextAction':
            valA = a.nextAction ? new Date(a.nextAction.vencimento).getTime() : Infinity
            valB = b.nextAction ? new Date(b.nextAction.vencimento).getTime() : Infinity
            // Deixa nulos ou infinitos sempre no final
            if (valA === Infinity && valB === Infinity) return 0
            if (valA === Infinity) return 1
            if (valB === Infinity) return -1
            return isAsc ? valA - valB : valB - valA

          case 'dataCriacao':
            valA = a.dataCriacao ? new Date(a.dataCriacao).getTime() : 0
            valB = b.dataCriacao ? new Date(b.dataCriacao).getTime() : 0
            return isAsc ? valA - valB : valB - valA

          default:
            return 0
        }
      })

      return list
    }

    // Ordenação padrão da central comercial:
    // 1. Prioridade (alta → baixa)
    // 2. Próxima ação vencida
    // 3. Próxima ação mais próxima
    // 4. Nome do ministério
    return list.sort((a, b) => {
      const wA = getPrioridadeWeight(a.prioridade)
      const wB = getPrioridadeWeight(b.prioridade)
      if (wB !== wA) return wB - wA

      const now = Date.now()
      const vA = a.nextAction ? new Date(a.nextAction.vencimento).getTime() : Infinity
      const vB = b.nextAction ? new Date(b.nextAction.vencimento).getTime() : Infinity
      const expA = vA < now
      const expB = vB < now
      if (expA !== expB) return expA ? -1 : 1
      if (vA !== vB) return vA - vB

      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
  }, [filteredActivities, sortField, sortDirection])

  // ── Handlers dos filtros ───────────────────────────────────────────────────
  const handleChange = useCallback(
    (field: keyof OportunidadeFiltros) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setFiltros((prev) => ({ ...prev, [field]: e.target.value })),
    []
  )
  const handleLimpar = useCallback(() => {
    setFiltros(FILTROS_INICIAIS)
    setSortField(null)
    setSortDirection(null)
  }, [])
  const filtrosAtivos = hasFiltrosAtivos(filtros)

  // ── Loading skeleton de autenticação ──────────────────────────────────────
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen bg-gray-900">
        <div className="w-64 bg-gray-950 border-r border-gray-800 shrink-0 animate-pulse" />
        <div className="flex-1 p-8 space-y-6">
          <div className="h-8 bg-gray-800 rounded-2xl w-64 animate-pulse" />
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
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] text-gray-500 font-semibold mb-3">
            <button onClick={() => router.push('/admin')} className="hover:text-gray-300 transition cursor-pointer">Admin</button>
            <ChevronRight className="h-3 w-3 text-gray-700" />
            <button onClick={() => router.push('/admin/comercial')} className="hover:text-gray-300 transition cursor-pointer">Comercial</button>
            <ChevronRight className="h-3 w-3 text-gray-700" />
            <span className="text-gray-300">Oportunidades</span>
          </nav>

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
                onClick={fetchActivities}
                className="flex items-center gap-2 px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar
              </button>
              <div className="relative group">
                <button
                  disabled
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

          {/* ── TOOLBAR ───────────────────────────────────────────────── */}
          <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-gray-800 bg-gray-900/40 flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Filtros</span>
              {(filtrosAtivos || sortField) && (
                <span className="ml-1 flex items-center gap-1 bg-blue-950/60 text-blue-400 border border-blue-900/60 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <span className="w-1 h-1 bg-blue-400 rounded-full" />
                  Ativos
                </span>
              )}
              {(filtrosAtivos || sortField) ? (
                <button onClick={handleLimpar} className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-gray-500 hover:text-rose-400 transition cursor-pointer" title="Limpar todos os filtros">
                  <FilterX className="h-3.5 w-3.5" />
                  Limpar filtros
                </button>
              ) : (
                <span className="ml-auto text-[10px] text-gray-700 font-semibold">Nenhum filtro ativo</span>
              )}
            </div>

            {/* Linha 1 */}
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2">
                <FieldLabel icon={<Search className="h-3 w-3" />} label="Pesquisa" />
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
                    <button onClick={() => setFiltros((p) => ({ ...p, pesquisa: '' }))} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition cursor-pointer">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <FieldLabel icon={<Layers className="h-3 w-3" />} label="Lifecycle" />
                <div className="relative">
                  <select id="filtro-lifecycle" value={filtros.lifecycle} onChange={handleChange('lifecycle')} className={`${selectBase} ${filtros.lifecycle ? 'text-white' : 'text-gray-500'}`}>
                    {LIFECYCLE_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-gray-900 text-white">{o.label}</option>)}
                  </select>
                  <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600 rotate-90 pointer-events-none" />
                </div>
              </div>
              <div>
                <FieldLabel icon={<AlertCircle className="h-3 w-3" />} label="Prioridade" />
                <div className="relative">
                  <select id="filtro-prioridade" value={filtros.prioridade} onChange={handleChange('prioridade')} className={`${selectBase} ${filtros.prioridade ? 'text-white' : 'text-gray-500'}`}>
                    {PRIORIDADE_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-gray-900 text-white">{o.label}</option>)}
                  </select>
                  <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600 rotate-90 pointer-events-none" />
                </div>
              </div>
              <div>
                <FieldLabel icon={<User className="h-3 w-3" />} label="Responsável" />
                <div className="relative">
                  <select id="filtro-responsavel" value={filtros.responsavel} onChange={handleChange('responsavel')} className={`${selectBase} ${filtros.responsavel ? 'text-white' : 'text-gray-500'}`}>
                    {RESPONSAVEL_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-gray-900 text-white">{o.label}</option>)}
                  </select>
                  <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600 rotate-90 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Linha 2 — Período */}
            <div className="px-5 pb-5 flex flex-wrap items-end gap-4">
              <div className="min-w-[160px]">
                <FieldLabel icon={<Calendar className="h-3 w-3" />} label="Período — de" />
                <input type="date" id="filtro-periodo-inicio" value={filtros.periodoInicio} onChange={handleChange('periodoInicio')} className={`${inputBase} [color-scheme:dark]`} />
              </div>
              <div className="min-w-[160px]">
                <FieldLabel icon={<Calendar className="h-3 w-3" />} label="Até" />
                <input type="date" id="filtro-periodo-fim" value={filtros.periodoFim} min={filtros.periodoInicio || undefined} onChange={handleChange('periodoFim')} className={`${inputBase} [color-scheme:dark]`} />
              </div>
              <div className="ml-auto">
                <button
                  onClick={handleLimpar}
                  disabled={!filtrosAtivos && !sortField}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition ${(filtrosAtivos || sortField) ? 'bg-gray-900 hover:bg-rose-950/40 text-gray-400 hover:text-rose-400 border-gray-800 hover:border-rose-900/60 cursor-pointer' : 'bg-gray-900/40 text-gray-700 border-gray-800 cursor-not-allowed opacity-50 select-none'}`}
                >
                  <FilterX className="h-3.5 w-3.5" />
                  Limpar filtros
                </button>
              </div>
            </div>

            {/* Pills dos filtros ativos */}
            {filtrosAtivos && (
              <div className="px-5 pb-4 flex flex-wrap gap-2">
                {filtros.pesquisa && (
                  <span className="flex items-center gap-1 bg-blue-950/40 text-blue-400 border border-blue-900/40 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    "{filtros.pesquisa}"
                    <button onClick={() => setFiltros((p) => ({ ...p, pesquisa: '' }))} className="cursor-pointer hover:text-white ml-1"><X className="h-2.5 w-2.5" /></button>
                  </span>
                )}
                {filtros.lifecycle && (
                  <span className="flex items-center gap-1 bg-indigo-950/40 text-indigo-400 border border-indigo-900/40 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    {LIFECYCLE_OPTIONS.find(o => o.value === filtros.lifecycle)?.label}
                    <button onClick={() => setFiltros((p) => ({ ...p, lifecycle: '' }))} className="cursor-pointer hover:text-white ml-1"><X className="h-2.5 w-2.5" /></button>
                  </span>
                )}
                {filtros.prioridade && (
                  <span className="flex items-center gap-1 bg-amber-950/40 text-amber-400 border border-amber-900/40 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    Prioridade: {filtros.prioridade}
                    <button onClick={() => setFiltros((p) => ({ ...p, prioridade: '' }))} className="cursor-pointer hover:text-white ml-1"><X className="h-2.5 w-2.5" /></button>
                  </span>
                )}
                {filtros.responsavel && (
                  <span className="flex items-center gap-1 bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    {RESPONSAVEL_OPTIONS.find(o => o.value === filtros.responsavel)?.label}
                    <button onClick={() => setFiltros((p) => ({ ...p, responsavel: '' }))} className="cursor-pointer hover:text-white ml-1"><X className="h-2.5 w-2.5" /></button>
                  </span>
                )}
                {(filtros.periodoInicio || filtros.periodoFim) && (
                  <span className="flex items-center gap-1 bg-cyan-950/40 text-cyan-400 border border-cyan-900/40 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    {filtros.periodoInicio || '...'} → {filtros.periodoFim || '...'}
                    <button onClick={() => setFiltros((p) => ({ ...p, periodoInicio: '', periodoFim: '' }))} className="cursor-pointer hover:text-white ml-1"><X className="h-2.5 w-2.5" /></button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── TABELA DE OPORTUNIDADES ────────────────────────────────── */}
          <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-sm">

            {/* Cabeçalho do card */}
            <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-950/60 border border-blue-900/60 rounded-xl text-blue-400">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Lista de Oportunidades</h2>
                  <p className="text-[11px] text-gray-400">
                    {sortField ? 'Ordenação personalizada ativa' : 'Ordenação padrão do CRM ativo'}
                  </p>
                </div>
              </div>
              {!tableLoading && !tableError && (
                <span className="text-[10px] bg-gray-900 text-gray-400 border border-gray-800 font-semibold px-3 py-1 rounded-full">
                  {sortedActivities.length} {sortedActivities.length === 1 ? 'registro' : 'registros'}
                </span>
              )}
            </div>

            {/* ── Estado de erro ── */}
            {tableError && (
              <div className="m-6 flex items-center gap-3 p-4 bg-rose-950/30 border border-rose-900/50 text-rose-400 rounded-xl text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <div>
                  <p className="font-bold">Erro ao carregar oportunidades</p>
                  <p className="text-rose-500 mt-0.5">{tableError}</p>
                </div>
                <button onClick={fetchActivities} className="ml-auto px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-900/60 text-rose-400 rounded-lg text-xs font-semibold transition cursor-pointer">
                  Tentar novamente
                </button>
              </div>
            )}

            {/* ── Loading skeleton ── */}
            {tableLoading && !tableError && <TableSkeleton />}

            {/* ── Empty state (Se a base estiver vazia) ── */}
            {!tableLoading && !tableError && activities.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-4">
                <div className="w-16 h-16 bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center">
                  <Inbox className="h-7 w-7 text-gray-600" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-white">Nenhuma oportunidade encontrada</h3>
                  <p className="text-xs text-gray-500">Não há oportunidades cadastradas no CRM comercial no momento.</p>
                </div>
                <button onClick={fetchActivities} className="px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white rounded-xl text-xs font-semibold transition cursor-pointer">
                  Recarregar
                </button>
              </div>
            )}

            {/* ── Empty state específico de filtros (Se houver registros na base mas a busca resultar em 0) ── */}
            {!tableLoading && !tableError && activities.length > 0 && sortedActivities.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-4">
                <div className="w-16 h-16 bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center">
                  <Search className="h-7 w-7 text-gray-600" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-white">Nenhuma oportunidade encontrada para os filtros selecionados</h3>
                  <p className="text-xs text-gray-500">Tente ajustar seus termos de busca ou filtros aplicados.</p>
                </div>
                <button onClick={handleLimpar} className="px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white rounded-xl text-xs font-semibold transition cursor-pointer">
                  Limpar filtros
                </button>
              </div>
            )}

            {/* ── Tabela ── */}
            {!tableLoading && !tableError && sortedActivities.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-[10px] text-gray-500 uppercase tracking-wider bg-gray-900/40">
                      <HeaderCell field="nome" label="Ministério" />
                      <HeaderCell field="lifecycle" label="Lifecycle" />
                      <th className="py-3 px-4 font-bold">Plano</th>
                      <HeaderCell field="responsavel" label="Responsável" />
                      <th className="py-3 px-4 font-bold">Próxima Ação</th>
                      <HeaderCell field="nextAction" label="Vencimento" />
                      <HeaderCell field="dataCriacao" label="Data de Criação" />
                      <HeaderCell field="prioridade" label="Prioridade" />
                      <th className="py-3 px-4 font-bold">Situação Fin.</th>
                      <th className="py-3 px-4 font-bold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 text-xs text-gray-300">
                    {sortedActivities.map((act) => {
                      const vencimento = act.nextAction?.vencimento
                      const vencidoHoje = vencimento && isVencido(vencimento)

                      return (
                        <tr
                          key={act.id}
                          className="hover:bg-gray-900/50 transition group"
                        >
                          {/* Ministério */}
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-white group-hover:text-blue-400 transition">{act.nome}</p>
                            {act.email && <p className="text-gray-600 text-[10px] mt-0.5 truncate max-w-[160px]">{act.email}</p>}
                          </td>

                          {/* Lifecycle */}
                          <td className="py-3.5 px-4">
                            <LifecycleBadge status={act.lifecycle?.status || act.status} />
                          </td>

                          {/* Plano */}
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-gray-200">
                              {act.lifecycle?.plano || '—'}
                            </span>
                          </td>

                          {/* Responsável */}
                          <td className="py-3.5 px-4">
                            <span className="flex items-center gap-1.5">
                              <User className="h-3 w-3 text-gray-600 shrink-0" />
                              {act.responsavel || '—'}
                            </span>
                          </td>

                          {/* Próxima Ação */}
                          <td className="py-3.5 px-4 max-w-[180px]">
                            {act.nextAction ? (
                              <p className="truncate text-gray-200 font-medium">{act.nextAction.acao}</p>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>

                          {/* Data da Próxima Ação */}
                          <td className="py-3.5 px-4">
                            {vencimento ? (
                              <span className={`flex items-center gap-1 font-semibold ${vencidoHoje ? 'text-rose-400' : 'text-gray-300'}`}>
                                {vencidoHoje && <Clock className="h-3 w-3 text-rose-400 shrink-0" />}
                                {formatDate(vencimento)}
                              </span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>

                          {/* Data de Criação */}
                          <td className="py-3.5 px-4 text-gray-500">
                            {formatDate(act.dataCriacao)}
                          </td>

                          {/* Prioridade */}
                          <td className="py-3.5 px-4">
                            <PrioridadeBadge prioridade={act.prioridade} />
                          </td>

                          {/* Situação Financeira */}
                          <td className="py-3.5 px-4">
                            <FinanceiroBadge status={act.lifecycle?.statusFinanceiro} />
                          </td>

                          {/* Ações */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => setSelectedActivity(act)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-900 hover:bg-blue-600 text-gray-400 hover:text-white border border-gray-800 hover:border-blue-500 rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
                            >
                              Abrir
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── DRAWER COMERCIAL REUTILIZADO ──────────────────────────────── */}
      <CrmActivityDrawer
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
