'use client'

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import { authenticatedFetch } from '@/lib/api-client'
import AdminSidebar from '@/components/AdminSidebar'
import CrmInteractionModal from '@/components/crm/CrmInteractionModal'
import {
  ChevronRight,
  RefreshCw,
  MoreHorizontal,
  ArrowLeft,
  Briefcase,
  AlertCircle,
  Inbox,
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  AlertTriangle,
  MessageSquare,
  Users,
  Calendar as CalendarIcon,
  FileText,
  Plus,
} from 'lucide-react'
import { CrmActivityData } from '@/components/crm/CrmActivities'
import { InteractionRecord } from '@/components/crm/CrmActivityDrawer'

function formatDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

function formatRelativeDate(iso?: string): string {
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

// ─── Componentes de Skeletons ────────────────────────────────────────────────
function HeaderSkeleton() {
  return (
    <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 z-20 shrink-0 animate-pulse">
      <div className="h-3 bg-gray-800 rounded w-48 mb-3" />
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-6 bg-gray-800 rounded w-64" />
          <div className="h-4 bg-gray-800 rounded w-96" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 bg-gray-800 rounded-xl w-20" />
          <div className="h-8 bg-gray-800 rounded-xl w-24" />
        </div>
      </div>
    </div>
  )
}

function KpisSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 shrink-0 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-gray-950 border border-gray-800/80 rounded-2xl p-4 h-20 space-y-2">
          <div className="h-3 bg-gray-900 rounded w-16" />
          <div className="h-5 bg-gray-800 rounded w-24" />
        </div>
      ))}
    </div>
  )
}

function ResumoSkeleton() {
  return (
    <div className="flex-1 p-6 space-y-6 animate-pulse">
      <div className="h-4 bg-gray-900 rounded w-32" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 bg-gray-900 rounded w-20" />
            <div className="h-4 bg-gray-800 rounded w-2/3" />
          </div>
        ))}
      </div>
    </div>
  )
}

function InteracoesSkeleton() {
  return (
    <div className="flex-1 p-6 space-y-4 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="p-4 bg-gray-900/30 border border-gray-800 rounded-xl space-y-2">
          <div className="flex justify-between">
            <div className="h-4 bg-gray-800 rounded w-24" />
            <div className="h-3.5 bg-gray-900 rounded w-16" />
          </div>
          <div className="h-3.5 bg-gray-800 rounded w-full" />
          <div className="h-3 bg-gray-900 rounded w-1/3" />
        </div>
      ))}
    </div>
  )
}

function SidebarSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-gray-950 border border-gray-850 rounded-2xl p-4.5 space-y-3">
          <div className="h-4 bg-gray-900 rounded w-32" />
          <div className="h-3 bg-gray-900 rounded w-2/3" />
          <div className="h-10 bg-gray-900/40 rounded-xl w-full" />
        </div>
      ))}
    </div>
  )
}

export default function OportunidadePerfilPage() {
  const { isLoading, isAuthenticated } = useAdminAuth()
  const router = useRouter()
  const params = useParams()
  const id = params?.id ? String(params.id) : ''

  const [activeTab, setActiveTab] = useState<'resumo' | 'interacoes' | 'timeline' | 'financeiro' | 'documentos'>('resumo')

  // Dados Básicos da Oportunidade
  const [activities, setActivities] = useState<CrmActivityData[]>([])
  const [loadingDetails, setLoadingDetails] = useState<boolean>(true)
  const [detailsError, setDetailsError] = useState<string | null>(null)

  // Dados das Interações
  const [interactions, setInteractions] = useState<InteractionRecord[]>([])
  const [loadingInteractions, setLoadingInteractions] = useState<boolean>(false)
  const [interactionsError, setInteractionsError] = useState<string | null>(null)

  // Modal de Nova Interação
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)

  // Mensagem temporária de sucesso
  const [successToast, setSuccessToast] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isLoading, isAuthenticated, router])

  // Fetch Detalhes
  const fetchDetails = useCallback(async () => {
    setLoadingDetails(true)
    setDetailsError(null)
    try {
      const res = await authenticatedFetch('/api/v1/admin/crm/activities')
      if (!res.ok) throw new Error('Erro ao carregar detalhes do perfil')
      const data = await res.json()
      setActivities(data || [])
    } catch (err: any) {
      setDetailsError(err?.message || 'Erro ao carregar informações da oportunidade')
    } finally {
      setLoadingDetails(false)
    }
  }, [])

  // Fetch Interações
  const fetchInteractions = useCallback(async () => {
    if (!id) return
    setLoadingInteractions(true)
    setInteractionsError(null)
    try {
      const res = await authenticatedFetch(`/api/v1/admin/crm/interactions?ministryId=${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error('Erro ao carregar interações')
      const data = await res.json()
      setInteractions(data || [])
    } catch (err: any) {
      setInteractionsError(err?.message || 'Erro ao carregar lista de interações')
    } finally {
      setLoadingInteractions(false)
    }
  }, [id])

  useEffect(() => {
    if (isAuthenticated) {
      fetchDetails()
      fetchInteractions()
    }
  }, [isAuthenticated, fetchDetails, fetchInteractions])

  // Localiza a oportunidade correspondente
  const opportunity = useMemo(() => {
    if (!id || activities.length === 0) return null
    return activities.find((a) => a.id === id || a.oportunidadeId === id) || null
  }, [activities, id])

  const handleInteractionSaved = useCallback(() => {
    setSuccessToast('Interação registrada com sucesso!')
    setTimeout(() => setSuccessToast(null), 3500)
    
    // Atualiza tudo localmente sem F5 completo
    fetchInteractions()
    fetchDetails()
  }, [fetchInteractions, fetchDetails])

  const getTipoIcon = (tipo: string) => {
    switch (tipo.toLowerCase()) {
      case 'whatsapp':
        return <MessageSquare className="h-4 w-4 text-emerald-450" />
      case 'ligação':
        return <Phone className="h-4 w-4 text-blue-450" />
      case 'e-mail':
        return <Mail className="h-4 w-4 text-violet-450" />
      case 'reunião':
        return <CalendarIcon className="h-4 w-4 text-amber-450" />
      case 'visita':
        return <Users className="h-4 w-4 text-rose-450" />
      default:
        return <FileText className="h-4 w-4 text-gray-500" />
    }
  }

  const getTipoBadgeColor = (tipo: string) => {
    switch (tipo.toLowerCase()) {
      case 'whatsapp':
        return 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30'
      case 'ligação':
        return 'bg-blue-950/40 text-blue-400 border-blue-900/30'
      case 'e-mail':
        return 'bg-violet-950/40 text-violet-450 border-violet-900/30'
      case 'reunião':
        return 'bg-amber-950/40 text-amber-400 border-amber-900/30'
      case 'visita':
        return 'bg-rose-950/40 text-rose-405 border-rose-900/30'
      default:
        return 'bg-gray-900 text-gray-400 border-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-900">
        <div className="w-64 bg-gray-950 border-r border-gray-800 shrink-0" />
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <HeaderSkeleton />
          <div className="p-6 space-y-6 flex-1 overflow-auto">
            <KpisSkeleton />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-gray-950/20 border border-gray-850 rounded-2xl h-96"><ResumoSkeleton /></div>
              <SidebarSkeleton />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  const isProfileLoading = loadingDetails || loadingInteractions

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />

      {/* Success Toast */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-950 border border-emerald-800 text-emerald-300 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-200">
          <span className="w-1.5 h-1.5 bg-emerald-450 rounded-full" />
          <span className="text-xs font-semibold">{successToast}</span>
        </div>
      )}

      <main className="flex-1 overflow-auto flex flex-col h-full">

        {/* ── HEADER STICKY ───────────────────────────────────────────── */}
        {loadingDetails && !detailsError ? (
          <HeaderSkeleton />
        ) : (
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
                  {opportunity?.nome || 'Perfil da Oportunidade'}
                </h1>
                <p className="text-gray-400 text-xs mt-1.5 max-w-xl">
                  {opportunity?.dataCriacao 
                    ? `Criado em ${formatDate(opportunity.dataCriacao)} • Resumo do relacionamento comercial.`
                    : 'Resumo do relacionamento comercial.'
                  }
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
                  onClick={() => {
                    fetchDetails()
                    fetchInteractions()
                  }}
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
        )}

        {/* ── CONTENT AREA ──────────────────────────────────────────────── */}
        <div className="p-6 space-y-6 flex-1 flex flex-col min-h-0">

          {/* Estado de Erro Detalhes */}
          {detailsError && (
            <div className="flex items-center gap-3 p-4 bg-rose-950/30 border border-rose-900/50 text-rose-400 rounded-2xl text-xs shrink-0">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-bold">Falha ao carregar informações</p>
                <p className="text-rose-500 mt-0.5">{detailsError}</p>
              </div>
              <button onClick={fetchDetails} className="ml-auto px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-900/60 text-rose-400 rounded-xl text-xs font-semibold transition cursor-pointer">
                Tentar novamente
              </button>
            </div>
          )}

          {/* Skeletons ou KPIs */}
          {loadingDetails && !detailsError ? (
            <KpisSkeleton />
          ) : !detailsError && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 shrink-0">
              <div className="bg-gray-950 border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Lifecycle</span>
                <p className="text-sm font-black text-blue-400 mt-1 uppercase tracking-wider">
                  {opportunity?.lifecycle?.status || opportunity?.status || '—'}
                </p>
              </div>
              <div className="bg-gray-950 border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Plano</span>
                <p className="text-sm font-black text-white mt-1">
                  {opportunity?.lifecycle?.plano || '—'}
                </p>
              </div>
              <div className="bg-gray-950 border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Responsável</span>
                <p className="text-sm font-black text-white mt-1 truncate" title={opportunity?.responsavel}>
                  {opportunity?.responsavel || '—'}
                </p>
              </div>
              <div className="bg-gray-950 border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Situação Financeira</span>
                <p className="text-sm font-black text-white mt-1">
                  {opportunity?.lifecycle?.statusFinanceiro 
                    ? String(opportunity.lifecycle.statusFinanceiro).toUpperCase() 
                    : '—'
                  }
                </p>
              </div>
              <div className="bg-gray-950 border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Próxima Ação</span>
                <p className="text-sm font-black text-white mt-1 truncate" title={opportunity?.nextAction?.acao}>
                  {opportunity?.nextAction?.acao || '—'}
                </p>
              </div>
            </div>
          )}

          {/* Grid de colunas principal/sidebar */}
          {!detailsError && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start flex-1 min-h-0">
              
              {/* Coluna Esquerda (Principal) */}
              <div className="lg:col-span-2 flex flex-col h-full bg-gray-950/20 border border-gray-850 rounded-2xl overflow-hidden min-h-[400px]">
                
                {/* Abas */}
                <div className="border-b border-gray-850/80 bg-gray-950/60 px-4 py-2 flex items-center justify-between gap-1.5 shrink-0 overflow-x-auto">
                  <div className="flex gap-1.5">
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

                  {activeTab === 'interacoes' && !loadingInteractions && !interactionsError && (
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-650 hover:bg-blue-600 border border-blue-700/30 text-white rounded-xl text-xs font-bold cursor-pointer transition select-none mr-2 outline-none focus:ring-1 focus:ring-blue-650"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nova interação
                    </button>
                  )}
                </div>

                {/* Conteúdo da Aba */}
                {activeTab === 'resumo' ? (
                  loadingDetails ? (
                    <ResumoSkeleton />
                  ) : (
                    <div className="flex-1 p-6 overflow-auto">
                      <div className="space-y-6">
                        <h2 className="text-sm font-bold text-white border-b border-gray-900 pb-2">
                          Dados Gerais do Ministério
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Responsável Principal</span>
                            <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-gray-500" />
                              {opportunity?.responsavel || 'Não definido'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">E-mail de Contato</span>
                            <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 text-gray-500" />
                              {opportunity?.email || 'Sem registro'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Telefone</span>
                            <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-gray-500" />
                              {opportunity?.telefone || 'Sem registro'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Localização</span>
                            <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-gray-500" />
                              {(opportunity as any)?.cidade || (opportunity as any)?.estado 
                                ? `${(opportunity as any).cidade || ''} - ${(opportunity as any).estado || ''}`
                                : 'Sem registro'
                              }
                            </span>
                          </div>

                          <div className="space-y-1 md:col-span-2">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Congregações</span>
                            <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-gray-500" />
                              {(opportunity as any)?.congregaçoes || 'Nenhuma congregação filiada cadastrada'}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1 pt-4 border-t border-gray-900">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Observações Comerciais</span>
                          <p className="text-gray-400 text-xs leading-relaxed bg-gray-950/40 p-4 border border-gray-900 rounded-2xl whitespace-pre-wrap">
                            {(opportunity as any)?.observacoes || 'Nenhuma observação interna registrada.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                ) : activeTab === 'interacoes' ? (
                  loadingInteractions ? (
                    <InteracoesSkeleton />
                  ) : interactionsError ? (
                    <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
                      <AlertTriangle className="h-8 w-8 text-rose-500 mb-2" />
                      <h4 className="text-xs font-bold text-gray-400">Falha ao carregar interações</h4>
                      <p className="text-[10px] text-gray-650 mt-1 max-w-[240px]">{interactionsError}</p>
                      <button onClick={fetchInteractions} className="mt-3.5 px-3.5 py-2 bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl text-[10px] font-semibold transition cursor-pointer">
                        Tentar novamente
                      </button>
                    </div>
                  ) : interactions.length === 0 ? (
                    <div className="flex-1 p-6 flex flex-col items-center justify-center text-center py-16">
                      <div className="w-12 h-12 bg-gray-900 border border-gray-850 rounded-2xl flex items-center justify-center mb-3">
                        <Inbox className="h-5 w-5 text-gray-600" />
                      </div>
                      <h4 className="text-xs font-bold text-gray-400">Nenhuma interação registrada</h4>
                      <p className="text-[10px] text-gray-600 mt-1 max-w-[200px]">
                        Registre o primeiro contato, proposta ou whatsapp enviado.
                      </p>
                      <button
                        onClick={() => setIsModalOpen(true)}
                        className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-blue-650 hover:bg-blue-600 border border-blue-700/30 text-white rounded-xl text-xs font-bold cursor-pointer transition select-none outline-none focus:ring-1 focus:ring-blue-650"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Registrar primeira interação
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 p-6 overflow-auto space-y-4">
                      {interactions.map((rec) => (
                        <div 
                          key={rec.id}
                          className="p-4 bg-gray-950 border border-gray-850 hover:border-gray-800 rounded-xl space-y-3 shadow-2xs relative"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 bg-gray-900 rounded-lg shrink-0">
                                {getTipoIcon(rec.tipo)}
                              </div>
                              <span className={`text-[8.5px] font-extrabold px-2 py-0.5 rounded border uppercase ${getTipoBadgeColor(rec.tipo)}`}>
                                {rec.tipo}
                              </span>
                            </div>
                            <span className="text-[9px] text-gray-500 font-semibold">
                              {formatDateTime(rec.created_at)}
                            </span>
                          </div>

                          <p className="text-xs text-gray-300 leading-relaxed font-medium whitespace-pre-wrap">
                            {rec.descricao}
                          </p>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-900 text-[9px] text-gray-500 font-semibold">
                            <span className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5 text-gray-650" />
                              Registrado por: {rec.created_by || 'Sistema'}
                            </span>
                            
                            {rec.proxima_acao && (
                              <span className="text-amber-500 bg-amber-950/20 border border-amber-900/30 px-2 py-0.5 rounded flex items-center gap-1 font-bold">
                                Próxima Ação: {rec.proxima_acao} ({formatDate(rec.data_proxima_acao!)})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-gray-900 border border-gray-850 rounded-2xl flex items-center justify-center mb-3">
                      <Inbox className="h-5 w-5 text-gray-600" />
                    </div>
                    <h4 className="text-xs font-bold text-gray-400 capitalize">Aba {activeTab}</h4>
                    <p className="text-[10px] text-gray-600 mt-1 max-w-[200px]">
                      Os dados desta seção serão implementados e carregados na próxima etapa.
                    </p>
                  </div>
                )}
              </div>

              {/* Coluna Direita (Sidebar) */}
              <div className="space-y-4 h-full overflow-y-auto pr-1">
                {isProfileLoading ? (
                  <SidebarSkeleton />
                ) : (
                  <>
                    {/* Informações do Ministério */}
                    <div className="bg-gray-950 border border-gray-850 rounded-2xl p-4.5 flex flex-col shadow-xs">
                      <h3 className="text-xs font-bold text-gray-300 border-b border-gray-900 pb-2.5 mb-3.5">
                        Informações do Ministério
                      </h3>
                      <div className="space-y-3 text-[11px]">
                        <div>
                          <span className="text-gray-500 block font-semibold">Nome Oficial</span>
                          <span className="text-gray-300 font-bold">{opportunity?.nome || '—'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block font-semibold">Plano Selecionado</span>
                          <span className="text-gray-300 font-bold">{opportunity?.lifecycle?.plano || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Contatos */}
                    <div className="bg-gray-950 border border-gray-850 rounded-2xl p-4.5 flex flex-col shadow-xs">
                      <h3 className="text-xs font-bold text-gray-300 border-b border-gray-900 pb-2.5 mb-3.5">
                        Contatos
                      </h3>
                      <div className="space-y-3 text-[11px]">
                        <div>
                          <span className="text-gray-500 block font-semibold">E-mail</span>
                          <span className="text-gray-300 select-all font-bold">{opportunity?.email || '—'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block font-semibold">Telefone</span>
                          <span className="text-gray-300 select-all font-bold">{opportunity?.telefone || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Histórico Comercial */}
                    <div className="bg-gray-950 border border-gray-850 rounded-2xl p-4.5 flex flex-col shadow-xs">
                      <h3 className="text-xs font-bold text-gray-300 border-b border-gray-900 pb-2.5 mb-3.5">
                        Histórico Comercial
                      </h3>
                      <div className="space-y-3 text-[11px]">
                        <div>
                          <span className="text-gray-500 block font-semibold">Última Interação</span>
                          <span className="text-gray-300 font-bold">
                            {opportunity?.ultimaAtualizacao ? formatRelativeDate(opportunity.ultimaAtualizacao) : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block font-semibold">Total de Interações</span>
                          <span className="text-gray-300 font-bold">{interactions.length} registradas</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block font-semibold">Data de Cadastro</span>
                          <span className="text-gray-300 font-bold">
                            {opportunity?.dataCriacao ? formatDate(opportunity.dataCriacao) : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Próximas Ações */}
                    <div className="bg-gray-950 border border-gray-850 rounded-2xl p-4.5 flex flex-col shadow-xs">
                      <h3 className="text-xs font-bold text-gray-300 border-b border-gray-900 pb-2.5 mb-3.5">
                        Próximas Ações
                      </h3>
                      {opportunity?.nextAction ? (
                        <div className="p-3 bg-gray-900/30 border border-gray-900 rounded-xl space-y-1.5 text-[11px]">
                          <span className="text-rose-450 font-bold block">{opportunity.nextAction.acao}</span>
                          <span className="text-gray-500 text-[10px] font-semibold block">
                            Vencimento: {formatDate(opportunity.nextAction.vencimento)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-4 text-center">
                          <Inbox className="h-4 w-4 text-gray-700 mb-1" />
                          <span className="text-[10px] text-gray-500 font-bold">Nenhuma ação agendada</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

            </div>
          )}

        </div>
      </main>

      {/* ── MODAL DE NOVA INTERAÇÃO REUTILIZADO ────────────────────────── */}
      {opportunity && (
        <CrmInteractionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          clienteNome={opportunity.nome}
          ministryId={opportunity.id}
          onSuccess={handleInteractionSaved}
        />
      )}
    </div>
  )
}
