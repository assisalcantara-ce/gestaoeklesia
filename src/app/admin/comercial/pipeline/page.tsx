'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import { authenticatedFetch } from '@/lib/api-client'
import AdminSidebar from '@/components/AdminSidebar'
import CrmActivityDrawer from '@/components/crm/CrmActivityDrawer'
import {
  DndContext,
  useDroppable,
  useDraggable,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
  TouchSensor,
} from '@dnd-kit/core'
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
  User,
  Clock,
  AlertTriangle,
  MessageSquare,
  Loader2,
} from 'lucide-react'
import { CrmActivityData } from '@/components/crm/CrmActivities'

// ─── Colunas do Kanban ────────────────────────────────────────────────────────
const KANBAN_COLUMNS = [
  { key: 'lead',           label: 'Lead',            statusDb: 'Novo',                color: 'border-t-indigo-500 bg-indigo-950/5' },
  { key: 'trial',          label: 'Trial',           statusDb: 'Trial',               color: 'border-t-blue-500 bg-blue-950/5' },
  { key: 'negociacao',     label: 'Negociação',      statusDb: 'Em Negociação',        color: 'border-t-cyan-500 bg-cyan-950/5' },
  { key: 'pagamento',      label: 'Pagamento',       statusDb: 'Aguardando Pagamento', color: 'border-t-pink-500 bg-pink-950/5' },
  { key: 'cliente_ativo',  label: 'Cliente Ativo',   statusDb: 'Convertido',          color: 'border-t-emerald-500 bg-emerald-950/5' },
  { key: 'renovacao',      label: 'Renovação',       statusDb: 'Renovação',           color: 'border-t-sky-500 bg-sky-950/5' },
  { key: 'cancelado',      label: 'Cancelado',       statusDb: 'Cancelado',           color: 'border-t-slate-500 bg-slate-950/5' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getPlanoPrice(planoName?: string): number {
  if (!planoName) return 49.90
  const plan = String(planoName).toLowerCase()
  if (plan.includes('profis')) return 299.90
  if (plan.includes('inter')) return 149.90
  return 49.90
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

function isAtrasada(iso: string): boolean {
  const date = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
}

function isHoje(iso: string): boolean {
  const date = new Date(iso).toLocaleDateString('pt-BR')
  const today = new Date().toLocaleDateString('pt-BR')
  return date === today
}

function formatRelativeDate(iso: string): string {
  if (!iso) return 'Sem registro'
  const date = new Date(iso)
  const today = new Date()
  
  today.setHours(0, 0, 0, 0)
  const dateMidnight = new Date(date)
  dateMidnight.setHours(0, 0, 0, 0)

  const diffTime = today.getTime() - dateMidnight.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  return `Há ${diffDays} dias`
}

function mapLifecycleToKanbanKey(status?: string): string {
  if (!status) return 'lead'
  const s = status.toUpperCase().trim()

  if (s === 'LEAD') return 'lead'
  if (s === 'TRIAL' || s === 'TRIAL_EXPIRING') return 'trial'
  if (
    s === 'NOVO' || 
    s === 'PRIMEIRO_CONTATO' || 
    s === 'EM_NEGOCIACAO' || 
    s === 'PROPOSTA_ENVIADA' || 
    s === 'AGUARDANDO_CLIENTE'
  ) return 'negociacao'
  if (s === 'PAYMENT_PENDING' || s === 'AGUARDANDO_PAGAMENTO') return 'pagamento'
  if (s === 'ACTIVE' || s === 'CONVERTIDO') return 'cliente_ativo'
  if (s === 'RENEWAL' || s === 'RENOVACAO') return 'renovacao'
  if (s === 'CANCELLED' || s === 'CANCELADO' || s === 'TRIAL_EXPIRED') return 'cancelado'

  return 'lead'
}

// ─── Componentes Compartilhados do Kanban ────────────────────────────────────
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
    <span className={`text-[8px] font-bold px-2 py-0.5 rounded border uppercase shrink-0 ${styles[key] || styles.baixa}`}>
      {label[key] || prioridade || '—'}
    </span>
  )
}

function FinanceiroBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-gray-500 font-semibold">Sem dados</span>
  const s = status.toLowerCase()

  const map: Record<string, string> = {
    ok:       'bg-emerald-950/40 text-emerald-400 border-emerald-900/30',
    pendente: 'bg-amber-950/40 text-amber-400 border-amber-900/30',
    atrasado: 'bg-rose-950/40 text-rose-400 border-rose-900/30',
    isento:   'bg-gray-900 text-gray-400 border-gray-800',
  }
  const labels: Record<string, string> = {
    ok:       'Em dia',
    pendente: 'Pendente',
    atrasado: 'Inadimplente',
    isento:   'Isento',
  }
  return (
    <span className={`text-[8px] font-bold px-2 py-0.5 rounded border uppercase shrink-0 ${map[s] || map.isento}`}>
      {labels[s] || status}
    </span>
  )
}

// ─── Card do Kanban (Draggable) ──────────────────────────────────────────────
interface KanbanCardProps {
  act: CrmActivityData
  onCardClick: (act: CrmActivityData) => void
  isThisCardLoading: boolean
  isPendingPersistence: boolean
  styleOverlay?: boolean
}

function KanbanCard({
  act,
  onCardClick,
  isThisCardLoading,
  isPendingPersistence,
  styleOverlay,
}: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: act.id,
    disabled: isPendingPersistence,
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined

  const vencimento = act.nextAction?.vencimento
  const atrasado = vencimento && isAtrasada(vencimento)
  const hoje = vencimento && isHoje(vencimento)
  const isHighPrior = act.prioridade === 'alta'
  const isConverted =
    (act.lifecycle?.status || act.status || '').toLowerCase() === 'active' ||
    (act.lifecycle?.status || act.status || '').toLowerCase() === 'convertido'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onCardClick(act)}
      tabIndex={isPendingPersistence ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onCardClick(act)
        }
      }}
      className={`p-3.5 bg-gray-950 hover:bg-gray-900 border ${
        isHighPrior
          ? 'border-rose-900/50 hover:border-rose-700/60 shadow-[0_0_8px_rgba(244,63,94,0.04)]'
          : 'border-gray-850 hover:border-gray-800'
      } rounded-xl flex flex-col justify-between h-44 transition group cursor-grab active:cursor-grabbing duration-200 select-none relative focus:ring-1 focus:ring-blue-650 outline-none ${
        isDragging || styleOverlay ? 'opacity-40' : ''
      } ${isPendingPersistence ? 'pointer-events-none opacity-60' : ''}`}
      aria-label={`Oportunidade de ${act.nome}. Arraste para mover no pipeline.`}
    >
      <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
        {(isThisCardLoading || isPendingPersistence) && (
          <Loader2 className="h-3 w-3 text-blue-500 animate-spin shrink-0" />
        )}
        {isConverted && <span className="w-2 h-2 bg-emerald-500 rounded-full" title="Cliente ativo" />}
        {atrasado && <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" title="Ação atrasada" />}
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-white group-hover:text-blue-400 transition leading-tight pr-6 truncate" title={act.nome}>
          {act.nome}
        </h3>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-gray-400 font-semibold truncate max-w-[100px]">
            {act.lifecycle?.plano || 'Sem plano'}
          </span>
          <FinanceiroBadge status={act.lifecycle?.statusFinanceiro} />
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <PrioridadeBadge prioridade={act.prioridade} />
        </div>
      </div>

      <div className="pt-2.5 border-t border-gray-900 space-y-1.5 text-[9px] text-gray-500 shrink-0">
        <div className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-gray-600 shrink-0" />
          <span className="truncate max-w-[140px]" title={act.responsavel || 'Sem responsável'}>
            {act.responsavel || 'Sem responsável'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <Clock className={`h-3.5 w-3.5 shrink-0 ${atrasado ? 'text-rose-500' : 'text-gray-600'}`} />
          {act.nextAction ? (
            <span
              className={`truncate max-w-[150px] font-medium ${
                atrasado ? 'text-rose-400 font-semibold' : hoje ? 'text-amber-400 font-semibold' : 'text-gray-400'
              }`}
              title={`${act.nextAction.acao} (${formatDate(vencimento!)})`}
            >
              {act.nextAction.acao} ({formatDate(vencimento!)})
            </span>
          ) : (
            <span>Sem próxima ação</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[8.5px] text-gray-650">
          <MessageSquare className="h-3 w-3 shrink-0 text-gray-700" />
          <span>Int. {formatRelativeDate(act.ultimaAtualizacao)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Raias de Destino (Droppable) ───────────────────────────────────────────
interface KanbanColumnProps {
  colKey: string
  label: string
  color: string
  isHighlighted: boolean
  children: React.ReactNode
  count: number
}

function KanbanColumn({ colKey, label, color, isHighlighted, children, count }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: colKey,
  })

  return (
    <div
      ref={setNodeRef}
      className={`w-76 shrink-0 border-t-2 ${color} border-x border-b ${
        isOver 
          ? 'border-blue-500/80 bg-blue-950/20 shadow-lg' 
          : isHighlighted 
            ? 'border-blue-900/40 bg-gray-900/5' 
            : 'border-gray-850 bg-gray-950/20'
      } rounded-2xl flex flex-col max-h-full overflow-hidden shadow-xs transition-all duration-200`}
    >
      <div className="px-4 py-3.5 border-b border-gray-850/60 bg-gray-950/60 flex items-center justify-between shrink-0">
        <span className="text-xs font-bold text-gray-300">{label}</span>
        <span className="text-[10px] font-bold bg-gray-900 text-gray-400 border border-gray-800 px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[calc(100vh-360px)]">
        {children}
      </div>
    </div>
  )
}

// ─── Skeleton Loader das Colunas ──────────────────────────────────────────────
function KanbanSkeleton() {
  return (
    <div className="flex-1 min-h-[450px] flex gap-4 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((_, colIdx) => (
        <div 
          key={colIdx}
          className="w-72 shrink-0 border border-gray-850 bg-gray-950/10 rounded-2xl flex flex-col h-full overflow-hidden"
        >
          <div className="px-4 py-3.5 border-b border-gray-850/60 bg-gray-950/40 flex items-center justify-between animate-pulse">
            <div className="h-3.5 bg-gray-800 rounded w-24" />
            <div className="h-5 bg-gray-800 rounded-full w-8" />
          </div>
          <div className="flex-1 p-4 space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="p-3 bg-gray-900/30 border border-gray-800 rounded-xl space-y-2 animate-pulse">
                <div className="h-3.5 bg-gray-800 rounded w-2/3" />
                <div className="h-3 bg-gray-800 rounded w-1/3" />
                <div className="h-4 bg-gray-800 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function PipelinePage() {
  const { isLoading, isAuthenticated } = useAdminAuth()
  const router = useRouter()

  const [activities, setActivities] = useState<CrmActivityData[]>([])
  const [tableLoading, setTableLoading] = useState<boolean>(true)
  const [tableError, setTableError] = useState<string | null>(null)

  // Drawer
  const [selectedActivity, setSelectedActivity] = useState<CrmActivityData | null>(null)
  const [loadingCardId, setLoadingCardId] = useState<string | null>(null)

  // Drag and Drop
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [pendingCardId, setPendingCardId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastError, setToastError] = useState<string | null>(null)

  // Sensores do dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  )

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isLoading, isAuthenticated, router])

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

  const handleCardClick = useCallback((act: CrmActivityData) => {
    if (loadingCardId || pendingCardId) return
    setLoadingCardId(act.id)
    const t = setTimeout(() => {
      setSelectedActivity(act)
      setLoadingCardId(null)
    }, 200)
    return () => clearTimeout(t)
  }, [loadingCardId, pendingCardId])

  // Triggers de feedback
  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg)
    const t = setTimeout(() => setToastMessage(null), 3500)
    return () => clearTimeout(t)
  }, [])

  const triggerError = useCallback((msg: string) => {
    setToastError(msg)
    const t = setTimeout(() => setToastError(null), 4000)
    return () => clearTimeout(t)
  }, [])

  // ── Drag & Drop Handlers ────────────────────────────────────────────────────
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveCardId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveCardId(null)

      if (!over) return

      const cardId = active.id as string
      const colDest = over.id as string

      // Encontra a oportunidade atual
      const opportunity = activities.find((a) => a.id === cardId)
      if (!opportunity) return

      const colOrig = mapLifecycleToKanbanKey(opportunity.lifecycle?.status || opportunity.status)
      if (colOrig === colDest) return // Mesma coluna

      // Mapeia para a string de status aceita pelo backend
      const colDestConf = KANBAN_COLUMNS.find((c) => c.key === colDest)
      if (!colDestConf) return

      const statusNovo = colDestConf.statusDb

      // 1. Otimistic Update local
      setActivities((prev) =>
        prev.map((item) => {
          if (item.id === cardId) {
            return {
              ...item,
              status: statusNovo,
              lifecycle: item.lifecycle
                ? {
                    ...item.lifecycle,
                    status: statusNovo,
                  }
                : undefined,
            }
          }
          return item
        })
      )

      // Bloqueia interações no card
      setPendingCardId(cardId)

      try {
        // 2. Reutiliza rota PATCH existente
        const res = await authenticatedFetch(`/api/v1/admin/oportunidades/${opportunity.oportunidadeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: statusNovo }),
        })

        if (!res.ok) throw new Error('Erro ao salvar nova etapa')

        triggerToast(`Oportunidade movida para a coluna ${colDestConf.label}!`)
        fetchActivities() // Sincroniza dados com o banco
      } catch (err) {
        // 3. Rollback otimista se falhar
        triggerError('Não foi possível mover o card. Tente novamente.')
        setActivities((prev) =>
          prev.map((item) => {
            if (item.id === cardId) {
              return {
                ...item,
                status: opportunity.status,
                lifecycle: opportunity.lifecycle,
              }
            }
            return item
          })
        )
      } finally {
        setPendingCardId(null)
      }
    },
    [activities, fetchActivities, triggerToast, triggerError]
  )

  const activeDraggedCard = useMemo(() => {
    if (!activeCardId) return null
    return activities.find((a) => a.id === activeCardId) || null
  }, [activeCardId, activities])

  const kpis = useMemo(() => {
    const total = activities.length
    
    const valorEstimado = activities.reduce((acc, act) => {
      const status = (act.lifecycle?.status || act.status || '').toLowerCase()
      if (status === 'cancelled' || status === 'cancelado' || status === 'trial_expired') {
        return acc
      }
      return acc + getPlanoPrice(act.lifecycle?.plano)
    }, 0)

    const convertidos = activities.filter((act) => {
      const status = (act.lifecycle?.status || act.status || '').toLowerCase()
      return status === 'active' || status === 'convertido'
    }).length
    const conversao = total > 0 ? (convertidos / total) * 100 : 0

    const oportunidadesComValor = activities.filter((act) => {
      const status = (act.lifecycle?.status || act.status || '').toLowerCase()
      return status !== 'cancelled' && status !== 'cancelado' && status !== 'trial_expired'
    }).length
    const ticketMedio = oportunidadesComValor > 0 ? valorEstimado / oportunidadesComValor : 0

    return {
      total,
      valorEstimado,
      conversao,
      ticketMedio,
    }
  }, [activities])

  const kanbanData = useMemo(() => {
    const groups: Record<string, CrmActivityData[]> = {
      lead: [],
      trial: [],
      negociacao: [],
      pagamento: [],
      cliente_ativo: [],
      renovacao: [],
      cancelado: [],
    }

    activities.forEach((act) => {
      const statusKey = mapLifecycleToKanbanKey(act.lifecycle?.status || act.status)
      if (groups[statusKey]) {
        groups[statusKey].push(act)
      } else {
        groups.lead.push(act)
      }
    })

    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
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

        const cA = a.dataCriacao ? new Date(a.dataCriacao).getTime() : 0
        const cB = b.dataCriacao ? new Date(b.dataCriacao).getTime() : 0
        if (cA !== cB) return cA - cB

        return a.nome.localeCompare(b.nome, 'pt-BR')
      })
    })

    return groups
  }, [activities])

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen bg-gray-900">
        
        {/* Toast flutuante de sucesso */}
        {toastMessage && (
          <div className="fixed top-6 right-6 z-50 bg-emerald-950 border border-emerald-800 text-emerald-300 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3 duration-200">
            <span className="w-1.5 h-1.5 bg-emerald-450 rounded-full" />
            <span className="text-xs font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* Toast flutuante de erro */}
        {toastError && (
          <div className="fixed top-6 right-6 z-50 bg-rose-950 border border-rose-800 text-rose-300 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3 duration-200">
            <AlertTriangle className="h-4 w-4 text-rose-450 shrink-0" />
            <span className="text-xs font-semibold">{toastError}</span>
          </div>
        )}

        <AdminSidebar />

        <main className="flex-1 overflow-auto flex flex-col h-full">

          {/* ── HEADER STICKY ───────────────────────────────────────────── */}
          <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 z-20 shrink-0">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] text-gray-500 font-semibold mb-3">
              <button onClick={() => router.push('/admin')} className="hover:text-gray-300 transition cursor-pointer">Admin</button>
              <ChevronRight className="h-3 w-3 text-gray-700" />
              <button onClick={() => router.push('/admin/comercial')} className="hover:text-gray-300 transition cursor-pointer">Comercial</button>
              <ChevronRight className="h-3 w-3 text-gray-700" />
              <span className="text-gray-300">Pipeline</span>
            </nav>

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

            {/* ── Estado de erro ── */}
            {tableError && (
              <div className="flex items-center gap-3 p-4 bg-rose-950/30 border border-rose-900/50 text-rose-400 rounded-2xl text-xs shrink-0">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <div>
                  <p className="font-bold">Erro ao carregar o pipeline</p>
                  <p className="text-rose-500 mt-0.5">{tableError}</p>
                </div>
                <button onClick={fetchActivities} className="ml-auto px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-900/60 text-rose-400 rounded-xl text-xs font-semibold transition cursor-pointer">
                  Tentar novamente
                </button>
              </div>
            )}

            {/* ── CARDS INFORMATIVOS (MÉTRICAS) ─────────────────────────────── */}
            {!tableError && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 md:p-5 flex flex-col justify-between shadow-xs transition hover:shadow-md duration-200">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Total de Oportunidades</span>
                      <p className="text-xl font-black text-white tracking-tight leading-none">
                        {tableLoading ? '—' : kpis.total}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-gray-900 text-gray-400 shrink-0"><TrendingUp className="h-4 w-4" /></div>
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium truncate mt-3 pt-2.5 border-t border-gray-900">Negociações ativas</div>
                </div>

                <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 md:p-5 flex flex-col justify-between shadow-xs transition hover:shadow-md duration-200">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Valor Estimado</span>
                      <p className="text-xl font-black text-white tracking-tight leading-none">
                        {tableLoading ? '—' : `R$ ${kpis.valorEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-gray-900 text-gray-400 shrink-0"><DollarSign className="h-4 w-4" /></div>
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium truncate mt-3 pt-2.5 border-t border-gray-900">Volume financeiro previsto</div>
                </div>

                <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 md:p-5 flex flex-col justify-between shadow-xs transition hover:shadow-md duration-200">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Conversão</span>
                      <p className="text-xl font-black text-white tracking-tight leading-none">
                        {tableLoading ? '—' : `${kpis.conversao.toFixed(1)}%`}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-gray-900 text-gray-400 shrink-0"><PieChart className="h-4 w-4" /></div>
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium truncate mt-3 pt-2.5 border-t border-gray-900">Taxa média de fechamento</div>
                </div>

                <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 md:p-5 flex flex-col justify-between shadow-xs transition hover:shadow-md duration-200">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Ticket Médio</span>
                      <p className="text-xl font-black text-white tracking-tight leading-none">
                        {tableLoading ? '—' : `R$ ${kpis.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-gray-900 text-gray-400 shrink-0"><Target className="h-4 w-4" /></div>
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium truncate mt-3 pt-2.5 border-t border-gray-900">Valor por contrato ativo</div>
                </div>
              </div>
            )}

            {/* ── KANBAN BOARD ── */}
            {tableLoading && !tableError && <KanbanSkeleton />}

            {!tableLoading && !tableError && (
              <div className="flex-1 min-h-[450px] flex gap-4 overflow-x-auto pb-4 items-start">
                {KANBAN_COLUMNS.map((column) => {
                  const list = kanbanData[column.key] || []

                  return (
                    <KanbanColumn
                      key={column.key}
                      colKey={column.key}
                      label={column.label}
                      color={column.color}
                      count={list.length}
                      isHighlighted={!!activeCardId}
                    >
                      {list.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                          <div className="w-10 h-10 bg-gray-900 border border-gray-850 rounded-xl flex items-center justify-center mb-2">
                            <Inbox className="h-4 w-4 text-gray-600" />
                          </div>
                          <h4 className="text-[11px] font-bold text-gray-500">Nenhuma oportunidade</h4>
                          <p className="text-[9px] text-gray-600 mt-0.5">Sem registros nesta etapa.</p>
                        </div>
                      ) : (
                        list.map((act) => {
                          const isThisCardLoading = loadingCardId === act.id
                          const isPendingPersistence = pendingCardId === act.id

                          return (
                            <KanbanCard
                              key={act.id}
                              act={act}
                              onCardClick={handleCardClick}
                              isThisCardLoading={isThisCardLoading}
                              isPendingPersistence={isPendingPersistence}
                            />
                          )
                        })
                      )}
                    </KanbanColumn>
                  )
                })}
              </div>
            )}

          </div>
        </main>

        {/* ── DRAG OVERLAY ── */}
        <DragOverlay>
          {activeDraggedCard ? (
            <KanbanCard
              act={activeDraggedCard}
              onCardClick={() => {}}
              isThisCardLoading={false}
              isPendingPersistence={false}
              styleOverlay={true}
            />
          ) : null}
        </DragOverlay>

        {/* ── DRAWER COMERCIAL REUTILIZADO ──────────────────────────────── */}
        <CrmActivityDrawer
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
          onSuccess={handleSuccess}
        />
      </div>
    </DndContext>
  )
}
