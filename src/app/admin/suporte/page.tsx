'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import AdminSidebar from '@/components/AdminSidebar'
import type { SupportTicket, SupportTicketMessage, SupportTicketLanding } from '@/types/admin'
import { temAcessoAdmin } from '@/lib/access-control'
import ExecutiveMetricCard from '@/components/dashboard/ExecutiveMetricCard'
import DashboardEmptyState from '@/components/dashboard/DashboardEmptyState'
import { LifeBuoy, Clock, MessageSquare, AlertTriangle, CheckCircle2, Search, Plus, MoreVertical, X, Send } from 'lucide-react'

export default function SuportePage() {
  const { isLoading, isAuthenticated, adminUser } = useAdminAuth()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [landingTickets, setLandingTickets] = useState<SupportTicketLanding[]>([])
  const [loading, setLoading] = useState(true)
  const [landingLoading, setLandingLoading] = useState(false)
  const [landingUpdating, setLandingUpdating] = useState(false)
  const [landingNoteText, setLandingNoteText] = useState('')
  const [landingAddingNote, setLandingAddingNote] = useState(false)
  const [ticketView, setTicketView] = useState<'tenant' | 'landing'>('tenant')
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [landingStatusFilter, setLandingStatusFilter] = useState<string>('active')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [page, setPage] = useState(1)
  const [landingPage, setLandingPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [landingTotalPages, setLandingTotalPages] = useState(1)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [selectedLandingTicket, setSelectedLandingTicket] = useState<SupportTicketLanding | null>(null)
  const [messages, setMessages] = useState<SupportTicketMessage[]>([])
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  const [replyStatus, setReplyStatus] = useState<SupportTicket['status']>('waiting_customer')
  const [closingTicketId, setClosingTicketId] = useState<string | null>(null)
  const [closingTicket, setClosingTicket] = useState<SupportTicket | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [openMenuTicketId, setOpenMenuTicketId] = useState<string | null>(null)
  const router = useRouter()

  const [formData, setFormData] = useState({
    ministry_id: '',
    subject: '',
    description: '',
    category: 'technical',
    priority: 'medium',
  })

  // FASE 1: Cálculo dos KPIs Executivos do Suporte (sem novas consultas ao banco)
  const kpis = useMemo(() => {
    const currentList = ticketView === 'tenant' ? tickets : landingTickets
    const todayStr = new Date().toISOString().split('T')[0]

    const abertos = currentList.filter((t) => t.status === 'open').length
    const emAtendimento = currentList.filter(
      (t) => t.status === 'in_progress' || (t.status as string) === 'em_atendimento',
    ).length
    const aguardandoCliente = currentList.filter((t) => t.status === 'waiting_customer').length
    const altaPrioridade = currentList.filter((t) => t.priority === 'high' || t.priority === 'urgent').length
    const resolvidosHoje = currentList.filter((t) => {
      const isResolved =
        t.status === 'resolved' || t.status === 'closed' || (t.status as string) === 'contrato_finalizado'
      const updatedDate = t.updated_at ? t.updated_at.split('T')[0] : ''
      return isResolved && updatedDate === todayStr
    }).length

    return {
      abertos,
      emAtendimento,
      aguardandoCliente,
      altaPrioridade,
      resolvidosHoje,
    }
  }, [tickets, landingTickets, ticketView])

  const filteredTickets = useMemo(() => {
    if (!searchQuery.trim()) return tickets
    const q = searchQuery.toLowerCase().trim()
    return tickets.filter((t) => {
      const ticketNum = t.ticket_number?.toLowerCase() || ''
      const subject = t.subject?.toLowerCase() || ''
      const desc = t.description?.toLowerCase() || ''
      const ministry = t.ministry_name?.toLowerCase() || ''
      return ticketNum.includes(q) || subject.includes(q) || desc.includes(q) || ministry.includes(q)
    })
  }, [tickets, searchQuery])

  const filteredLandingTickets = useMemo(() => {
    if (!searchQuery.trim()) return landingTickets
    const q = searchQuery.toLowerCase().trim()
    return landingTickets.filter((t) => {
      const ticketNum = t.ticket_number?.toLowerCase() || ''
      const inst = t.institution_name?.toLowerCase() || ''
      const contact = t.contact_name?.toLowerCase() || ''
      const email = t.email?.toLowerCase() || ''
      const desc = t.description?.toLowerCase() || ''
      return (
        ticketNum.includes(q) || inst.includes(q) || contact.includes(q) || email.includes(q) || desc.includes(q)
      )
    })
  }, [landingTickets, searchQuery])

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/admin/login')
        return
      }
      if (!temAcessoAdmin(adminUser?.role, 'suporte')) {
        router.push('/admin/dashboard')
      }
    }
  }, [isLoading, isAuthenticated, adminUser, router])

  useEffect(() => {
    if (isAuthenticated && temAcessoAdmin(adminUser?.role, 'suporte')) {
      if (ticketView === 'tenant') {
        fetchTickets()
      } else {
        fetchLandingTickets()
      }
    }
  }, [page, statusFilter, priorityFilter, landingPage, landingStatusFilter, ticketView, isAuthenticated, adminUser])

  useEffect(() => {
    if (ticketView !== 'tenant' || !selectedTicket) return
    setReplyText('')
    setReplyStatus('waiting_customer')
    setSuccess('')
    setError('')
    fetchMessages(selectedTicket.id)
  }, [selectedTicket?.id, ticketView])

  useEffect(() => {
    if (ticketView === 'landing') {
      setShowForm(false)
      setSelectedTicket(null)
      setMessages([])
    } else {
      setSelectedLandingTicket(null)
    }
  }, [ticketView])

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        status: statusFilter,
      })
      if (priorityFilter !== 'all') params.append('priority', priorityFilter)

      const response = await authenticatedFetch(`/api/v1/admin/tickets?${params}`)
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login')
          return
        }
        if (response.status === 403) {
          setError('Acesso negado para este recurso.')
          return
        }
        throw new Error('Erro ao carregar tickets')
      }

      const data = await response.json()
      setTickets(data.data)
      setTotalPages(data.total_pages || 1)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchLandingTickets = async () => {
    try {
      setLandingLoading(true)
      const params = new URLSearchParams({
        page: landingPage.toString(),
        limit: '15',
        status: landingStatusFilter,
      })

      const response = await authenticatedFetch(`/api/v1/admin/tickets-landing?${params}`)
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login')
          return
        }
        if (response.status === 403) {
          setError('Acesso negado para este recurso.')
          return
        }
        throw new Error('Erro ao carregar tickets do site')
      }

      const data = await response.json()
      setLandingTickets(data.data || [])
      setLandingTotalPages(data.total_pages || 1)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLandingLoading(false)
    }
  }

  const fetchMessages = async (ticketId: string) => {
    try {
      const response = await authenticatedFetch(`/api/v1/admin/tickets/messages?ticket_id=${ticketId}`)
      if (!response.ok) {
        throw new Error('Erro ao carregar mensagens')
      }
      const data = await response.json()
      setMessages(data.data || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicket) return

    if (!replyText.trim()) {
      setError('Digite uma mensagem')
      return
    }

    if (!replyStatus) {
      setError('Selecione um status para o ticket')
      return
    }

    try {
      setReplying(true)
      setError('')

      const response = await authenticatedFetch('/api/v1/admin/tickets/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: selectedTicket.id,
          message: replyText,
          is_internal: false,
          next_status: replyStatus,
        }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Erro ao responder ticket')
      }

      setReplyText('')
      setReplyStatus('waiting_customer')
      setSelectedTicket((prev) =>
        prev
          ? {
              ...prev,
              status: replyStatus,
              response_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          : prev,
      )
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === selectedTicket.id
            ? {
                ...ticket,
                status: replyStatus as SupportTicket['status'],
                response_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            : ticket,
        ),
      )
      if (replyStatus !== statusFilter) {
        setStatusFilter(replyStatus)
        setPage(1)
      }
      await fetchMessages(selectedTicket.id)
      await fetchTickets()
      setSuccess('Resposta enviada!')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setReplying(false)
    }
  }

  const closeTicket = async (ticket: SupportTicket) => {
    if (ticket.status === 'closed') return

    try {
      setClosingTicketId(ticket.id)
      setError('')
      setSuccess('')

      const response = await authenticatedFetch('/api/v1/admin/tickets/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticket.id,
          message: 'Ticket fechado pelo suporte.',
          is_internal: false,
          next_status: 'closed',
        }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Erro ao fechar ticket')
      }

      const now = new Date().toISOString()
      setTickets((prev) =>
        prev.map((item) =>
          item.id === ticket.id
            ? {
                ...item,
                status: 'closed',
                response_at: now,
                updated_at: now,
              }
            : item,
        ),
      )
      setSelectedTicket((prev) =>
        prev && prev.id === ticket.id
          ? {
              ...prev,
              status: 'closed',
              response_at: now,
              updated_at: now,
            }
          : prev,
      )
      await fetchMessages(ticket.id)
      await fetchTickets()
      setSuccess('Ticket fechado.')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setClosingTicketId(null)
      setClosingTicket(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const response = await authenticatedFetch('/api/v1/admin/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar ticket')
      }

      setSuccess('Ticket criado com sucesso!')
      setFormData({
        ministry_id: '',
        subject: '',
        description: '',
        category: 'technical',
        priority: 'medium',
      })
      setShowForm(false)
      fetchTickets()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/20 text-red-400 border border-red-500/30'
      case 'high': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
      case 'low': return 'bg-green-500/20 text-green-400 border border-green-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
    }
  }

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'URGENTE'
      case 'high': return 'ALTA'
      case 'medium': return 'MÉDIA'
      case 'low': return 'BAIXA'
      default: return priority.toUpperCase()
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-500/20 text-red-400 border border-red-500/30'
      case 'in_progress': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
      case 'waiting_customer': return 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
      case 'em_atendimento': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
      case 'aguardando_contrato': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
      case 'contrato_finalizado': return 'bg-green-500/20 text-green-400 border border-green-500/30'
      case 'cancelado': return 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
      case 'resolved': return 'bg-green-500/20 text-green-400 border border-green-500/30'
      case 'closed': return 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'ABERTO'
      case 'in_progress': return 'EM PROGRESSO'
      case 'waiting_customer': return 'RESPOSTA DO SUPORTE'
      case 'em_atendimento': return 'EM ATENDIMENTO'
      case 'aguardando_contrato': return 'AGUARDANDO CONTRATO'
      case 'contrato_finalizado': return 'CONTRATO FINALIZADO'
      case 'cancelado': return 'CANCELADO'
      case 'closed': return 'FECHADO'
      default: return status
    }
  }

  const getStatusRowBorder = (status: string) => {
    switch (status) {
      case 'open': return 'border-l-red-500'
      case 'in_progress': return 'border-l-blue-500'
      case 'waiting_customer': return 'border-l-teal-500'
      case 'em_atendimento': return 'border-l-blue-400'
      case 'aguardando_contrato': return 'border-l-yellow-500'
      case 'contrato_finalizado': return 'border-l-green-500'
      case 'cancelado': return 'border-l-gray-500'
      case 'resolved': return 'border-l-green-500'
      case 'closed': return 'border-l-gray-600'
      default: return 'border-l-gray-700'
    }
  }

  const updateLandingStatus = async (ticketId: string, status: SupportTicketLanding['status']) => {
    try {
      setLandingUpdating(true)
      setError('')

      const response = await authenticatedFetch('/api/v1/admin/tickets-landing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ticketId, status }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Erro ao atualizar status do ticket')
      }

      const payload = await response.json()
      const updated = payload.data as SupportTicketLanding
      setLandingTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setSelectedLandingTicket((prev) => (prev && prev.id === updated.id ? updated : prev))
      setSuccess('Status atualizado!')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLandingUpdating(false)
    }
  }

  const addLandingNote = async () => {
    if (!selectedLandingTicket || !landingNoteText.trim()) return
    try {
      setLandingAddingNote(true)
      setError('')

      const response = await authenticatedFetch('/api/v1/admin/tickets-landing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedLandingTicket.id, note: landingNoteText.trim() }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Erro ao salvar comentário')
      }

      const payload = await response.json()
      const updated = payload.data as SupportTicketLanding
      setLandingTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setSelectedLandingTicket(updated)
      setLandingNoteText('')
      setSuccess('Comentário salvo!')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLandingAddingNote(false)
    }
  }

  const getReplyState = (ticket?: SupportTicket | null) => {
    if (!ticket) return 'none'
    if (ticket.status === 'closed') return 'none'
    if (ticket.last_message_sender_role === 'support') return 'support'
    if (ticket.last_message_sender_role === 'user') return 'customer'
    if (ticket.response_at) return 'support'
    if (ticket.last_message_user_id && ticket.user_id) {
      return ticket.last_message_user_id === ticket.user_id ? 'customer' : 'support'
    }
    return 'none'
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 z-10">
          <h2 className="text-2xl font-bold text-white">Suporte Técnico</h2>
          <p className="text-gray-400 text-sm mt-1">Gerenciamento de tickets e atendimentos</p>
        </div>

        <div className="p-6 space-y-6">
          {/* FASE 1: Painel Executivo do Suporte */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <ExecutiveMetricCard
              title="Tickets Abertos"
              value={kpis.abertos}
              subtitle="Primeiro atendimento"
              icon={LifeBuoy}
              color="blue"
            />

            <ExecutiveMetricCard
              title="Em Atendimento"
              value={kpis.emAtendimento}
              subtitle="Sendo analisados"
              icon={Clock}
              color="amber"
            />

            <ExecutiveMetricCard
              title="Aguardando Cliente"
              value={kpis.aguardandoCliente}
              subtitle="Retorno ou confirmação"
              icon={MessageSquare}
              color="indigo"
            />

            <ExecutiveMetricCard
              title="Alta Prioridade"
              value={kpis.altaPrioridade}
              subtitle="Urgentes e alta"
              icon={AlertTriangle}
              color="rose"
            />

            <ExecutiveMetricCard
              title="Resolvidos Hoje"
              value={kpis.resolvidosHoje}
              subtitle="Concluídos no dia"
              icon={CheckCircle2}
              color="emerald"
            />
          </div>

          {/* Mensagens */}
          {error && (
            <div className="p-4 bg-red-900/40 border border-red-700 text-red-300 rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="p-4 bg-green-900/40 border border-green-700 text-green-300 rounded-lg">
              {success}
            </div>
          )}

          {/* Toolbar Horizontal Unificada Suporte 2.0 */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Lado Esquerdo: Alternância de Abas + Campo de Busca + Filtros */}
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Alternância de Abas */}
              <div className="inline-flex rounded-lg border border-gray-800 bg-gray-950 p-1">
                <button
                  type="button"
                  onClick={() => setTicketView('tenant')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition ${
                    ticketView === 'tenant'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Tickets de Ministérios
                </button>
                <button
                  type="button"
                  onClick={() => setTicketView('landing')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition ${
                    ticketView === 'landing'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Tickets do Site
                </button>
              </div>

              {/* Campo de Pesquisa Rápida */}
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar por nº ticket, assunto, cliente ou solicitante..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none transition"
                />
              </div>

              {/* Filtros para Tickets de Ministérios */}
              {ticketView === 'tenant' && (
                <>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value)
                      setPage(1)
                    }}
                    className="bg-gray-950 border border-gray-800 text-gray-300 rounded-lg px-3 py-1.5 text-xs font-medium focus:border-blue-500 focus:outline-none cursor-pointer transition"
                  >
                    <option value="active">Status: Ativos</option>
                    <option value="open">Status: Aberto</option>
                    <option value="in_progress">Status: Em Atendimento</option>
                    <option value="waiting_customer">Status: Aguardando Cliente</option>
                    <option value="resolved">Status: Resolvido</option>
                    <option value="closed">Status: Fechado</option>
                  </select>

                  <select
                    value={priorityFilter}
                    onChange={(e) => {
                      setPriorityFilter(e.target.value)
                      setPage(1)
                    }}
                    className="bg-gray-950 border border-gray-800 text-gray-300 rounded-lg px-3 py-1.5 text-xs font-medium focus:border-blue-500 focus:outline-none cursor-pointer transition"
                  >
                    <option value="all">Prioridade: Todas</option>
                    <option value="urgent">Urgente</option>
                    <option value="high">Alta</option>
                    <option value="medium">Média</option>
                    <option value="low">Baixa</option>
                  </select>
                </>
              )}

              {/* Filtros para Tickets do Site */}
              {ticketView === 'landing' && (
                <select
                  value={landingStatusFilter}
                  onChange={(e) => {
                    setLandingStatusFilter(e.target.value)
                    setLandingPage(1)
                  }}
                  className="bg-gray-950 border border-gray-800 text-gray-300 rounded-lg px-3 py-1.5 text-xs font-medium focus:border-blue-500 focus:outline-none cursor-pointer transition"
                >
                  <option value="active">Status: Ativos</option>
                  <option value="open">Status: Aberto</option>
                  <option value="em_atendimento">Status: Em Atendimento</option>
                  <option value="aguardando_contrato">Status: Aguardando Contrato</option>
                  <option value="contrato_finalizado">Status: Contrato Finalizado</option>
                  <option value="closed">Status: Fechado</option>
                  <option value="cancelado">Status: Cancelado</option>
                </select>
              )}
            </div>

            {/* Lado Direito: Botão "Novo Ticket" */}
            {ticketView === 'tenant' && (
              <button
                type="button"
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition shrink-0"
              >
                <Plus className="h-4 w-4" />
                Novo Ticket
              </button>
            )}
          </div>

          {/* Formulário novo ticket */}
          {ticketView === 'tenant' && showForm && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h2 className="text-lg font-bold text-white mb-4">Novo Ticket de Suporte</h2>
              <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="ID do Ministério"
                  value={formData.ministry_id}
                  onChange={(e) => setFormData({ ...formData, ministry_id: e.target.value })}
                  required
                  className="col-span-2 px-4 py-2 bg-gray-900 border border-gray-700 text-white rounded-lg placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Assunto"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                  className="col-span-2 px-4 py-2 bg-gray-900 border border-gray-700 text-white rounded-lg placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="px-4 py-2 bg-gray-900 border border-gray-700 text-gray-300 rounded-lg"
                >
                  <option value="technical">Técnico</option>
                  <option value="billing">Faturamento</option>
                  <option value="bug">Bug</option>
                  <option value="feature_request">Solicitação</option>
                  <option value="general">Geral</option>
                </select>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="px-4 py-2 bg-gray-900 border border-gray-700 text-gray-300 rounded-lg"
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
                <textarea
                  placeholder="Descrição do Problema"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={4}
                  className="col-span-2 px-4 py-2 bg-gray-900 border border-gray-700 text-white rounded-lg placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500"
                />
                <div className="col-span-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setFormData({
                        ministry_id: '',
                        subject: '',
                        description: '',
                        category: 'technical',
                        priority: 'medium',
                      })
                      setError('')
                    }}
                    className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                  >
                    Criar Ticket
                  </button>
                </div>
              </form>
            </div>
          )}
          {/* Tabela Modernizada Suporte 2.0 */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-xl">
            {ticketView === 'tenant' && (
              loading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="animate-pulse bg-gray-950/80 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-gray-800 rounded w-1/3" />
                        <div className="h-3 bg-gray-850 rounded w-1/4" />
                      </div>
                      <div className="h-6 bg-gray-800 rounded-full w-24" />
                      <div className="h-8 bg-gray-800 rounded-lg w-20" />
                    </div>
                  ))}
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="p-8">
                  <DashboardEmptyState
                    icon={LifeBuoy}
                    title="Nenhum ticket encontrado"
                    description="Não foram encontrados chamados que correspondam aos filtros ou termo de busca aplicados."
                  />
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-950/80 border-b border-gray-800 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Ticket & Assunto</th>
                      <th className="px-6 py-3.5">Status & Prioridade</th>
                      <th className="px-6 py-3.5">Última Atualização</th>
                      <th className="px-6 py-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {filteredTickets.map((t) => {
                      const replyState = getReplyState(t)
                      const isMenuOpen = openMenuTicketId === t.id

                      return (
                        <tr
                          key={t.id}
                          className={`border-l-4 ${
                            replyState === 'support'
                              ? 'border-l-amber-500'
                              : replyState === 'customer'
                              ? 'border-l-emerald-500'
                              : getStatusRowBorder(t.status)
                          } hover:bg-gray-800/40 transition group`}
                        >
                          {/* Coluna 1: Ticket & Assunto (Linha Principal, Secundária e Terciária) */}
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              {/* Linha Principal: Assunto */}
                              <div
                                onClick={() => setSelectedTicket(t)}
                                className="font-bold text-gray-100 text-sm hover:text-blue-400 transition cursor-pointer flex items-center gap-2"
                              >
                                <span>{t.subject}</span>
                              </div>

                              {/* Linha Secundária: Ministério + Código do Ticket */}
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-semibold text-blue-400">
                                  {t.ministry_name || `Ministério #${t.ministry_id}`}
                                </span>
                                <span className="text-gray-600">•</span>
                                <span className="px-1.5 py-0.5 rounded bg-gray-950 border border-gray-800 text-gray-400 font-mono text-[10.5px]">
                                  {t.ticket_number}
                                </span>
                              </div>

                              {/* Linha Terciária: Descrição/Resumo */}
                              <p className="text-xs text-gray-400 line-clamp-1 max-w-xl mt-0.5">
                                {t.description}
                              </p>
                            </div>
                          </td>

                          {/* Coluna 2: Status & Prioridade Agrupados */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${getStatusColor(t.status)}`}>
                                {getStatusLabel(t.status)}
                              </span>
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${getPriorityColor(t.priority)}`}>
                                {getPriorityLabel(t.priority)}
                              </span>
                            </div>
                          </td>

                          {/* Coluna 3: Última Atualização (updated_at) */}
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 font-medium">
                            {new Date(t.updated_at || t.created_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>

                          {/* Coluna 4: Hierarquia de Ações (Responder Principal + Menu ⋮) */}
                          <td className="px-6 py-4 whitespace-nowrap text-right relative">
                            <div className="flex items-center justify-end gap-2">
                              {/* Ação Principal: Responder */}
                              <button
                                onClick={() => setSelectedTicket(t)}
                                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-gray-900"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                Responder
                              </button>

                              {/* Menu de Ações Secundárias (⋮) */}
                              <div className="relative">
                                <button
                                  onClick={() => setOpenMenuTicketId(isMenuOpen ? null : t.id)}
                                  className="p-1.5 text-gray-400 hover:text-white bg-gray-950 hover:bg-gray-800 border border-gray-800 rounded-lg transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  title="Mais ações"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>

                                {isMenuOpen && (
                                  <div className="absolute right-0 mt-1 w-44 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl py-1 z-20 text-left">
                                    <button
                                      onClick={() => {
                                        setSelectedTicket(t)
                                        setOpenMenuTicketId(null)
                                      }}
                                      className="w-full px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800 flex items-center gap-2 transition"
                                    >
                                      👁️ Ver Histórico
                                    </button>

                                    {t.status !== 'closed' ? (
                                      <button
                                        onClick={() => {
                                          closeTicket(t)
                                          setOpenMenuTicketId(null)
                                        }}
                                        disabled={closingTicketId === t.id}
                                        className="w-full px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 transition"
                                      >
                                        🔒 Fechar Ticket
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setSelectedTicket(t)
                                          setOpenMenuTicketId(null)
                                        }}
                                        className="w-full px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-950/40 flex items-center gap-2 transition"
                                      >
                                        🔓 Reabrir Ticket
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            )}

            {ticketView === 'landing' && (
              landingLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="animate-pulse bg-gray-950/80 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-gray-800 rounded w-1/3" />
                        <div className="h-3 bg-gray-850 rounded w-1/4" />
                      </div>
                      <div className="h-6 bg-gray-800 rounded-full w-24" />
                      <div className="h-8 bg-gray-800 rounded-lg w-20" />
                    </div>
                  ))}
                </div>
              ) : filteredLandingTickets.length === 0 ? (
                <div className="p-8">
                  <DashboardEmptyState
                    icon={LifeBuoy}
                    title="Nenhum ticket do site encontrado"
                    description="Não foram encontrados contatos ou pré-cadastros do site que correspondam à busca."
                  />
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-950/80 border-b border-gray-800 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Lead & Solicitação</th>
                      <th className="px-6 py-3.5">Contato</th>
                      <th className="px-6 py-3.5">Status & Prioridade</th>
                      <th className="px-6 py-3.5">Última Atualização</th>
                      <th className="px-6 py-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {filteredLandingTickets.map((t) => {
                      const isMenuOpen = openMenuTicketId === t.id

                      return (
                        <tr key={t.id} className={`border-l-4 ${getStatusRowBorder(t.status)} hover:bg-gray-800/40 transition group`}>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <div
                                onClick={() => setSelectedLandingTicket(t)}
                                className="font-bold text-gray-100 text-sm hover:text-blue-400 transition cursor-pointer flex items-center gap-2"
                              >
                                <span>{t.institution_name}</span>
                              </div>

                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-mono text-[10.5px] text-gray-400 bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800">
                                  {t.ticket_number}
                                </span>
                              </div>

                              <p className="text-xs text-gray-400 line-clamp-1 max-w-xl mt-0.5">
                                {t.description}
                              </p>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-xs text-gray-300">
                            <div className="flex flex-col">
                              <span className="font-semibold text-gray-200">{t.contact_name}</span>
                              <span className="text-gray-400">{t.email}</span>
                            </div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${getStatusColor(t.status)}`}>
                                {getStatusLabel(t.status)}
                              </span>
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${getPriorityColor(t.priority)}`}>
                                {getPriorityLabel(t.priority)}
                              </span>
                            </div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 font-medium">
                            {new Date(t.updated_at || t.created_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-right relative">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedLandingTicket(t)}
                                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                              >
                                Visualizar
                              </button>

                              <div className="relative">
                                <button
                                  onClick={() => setOpenMenuTicketId(isMenuOpen ? null : t.id)}
                                  className="p-1.5 text-gray-400 hover:text-white bg-gray-950 hover:bg-gray-800 border border-gray-800 rounded-lg transition cursor-pointer"
                                  title="Mais ações"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>

                                {isMenuOpen && (
                                  <div className="absolute right-0 mt-1 w-44 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl py-1 z-20 text-left">
                                    <button
                                      onClick={() => {
                                        setSelectedLandingTicket(t)
                                        setOpenMenuTicketId(null)
                                      }}
                                      className="w-full px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800 flex items-center gap-2 transition"
                                    >
                                      👁️ Ver Detalhes
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Página {ticketView === 'tenant' ? page : landingPage} de {ticketView === 'tenant' ? totalPages : landingTotalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (ticketView === 'tenant') {
                    setPage(Math.max(1, page - 1))
                  } else {
                    setLandingPage(Math.max(1, landingPage - 1))
                  }
                }}
                disabled={ticketView === 'tenant' ? page === 1 : landingPage === 1}
                className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
              >
                ← Anterior
              </button>
              <button
                onClick={() => {
                  if (ticketView === 'tenant') {
                    setPage(Math.min(totalPages, page + 1))
                  } else {
                    setLandingPage(Math.min(landingTotalPages, landingPage + 1))
                  }
                }}
                disabled={ticketView === 'tenant' ? page === totalPages : landingPage === landingTotalPages}
                className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
              >
                Próxima →
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Drawer Lateral Slide-Over: Ticket de Ministério (Suporte 2.0) */}
      {ticketView === 'tenant' && selectedTicket && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop semitransparente com transição */}
          <div
            onClick={() => {
              setSelectedTicket(null)
              setMessages([])
              setReplyText('')
              setError('')
            }}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col">
              {/* Cabeçalho Fixo do Drawer */}
              <div className="p-6 bg-gray-950 border-b border-gray-800 flex items-start justify-between gap-4 sticky top-0 z-10">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/60 font-semibold">
                      #{selectedTicket.ticket_number}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(selectedTicket.status)}`}>
                      {getStatusLabel(selectedTicket.status)}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getPriorityColor(selectedTicket.priority)}`}>
                      {getPriorityLabel(selectedTicket.priority)}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white truncate">{selectedTicket.subject}</h3>
                  <p className="text-xs text-gray-400">
                    Solicitante: <span className="text-gray-200 font-semibold">{selectedTicket.ministry_name || selectedTicket.ministry_id}</span>
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSelectedTicket(null)
                    setMessages([])
                    setReplyText('')
                    setError('')
                  }}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Corpo do Drawer com Histórico em Formato Chat */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-900/50">
                {/* Descrição Inicial do Ticket */}
                <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 shadow-xs">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Descrição Inicial</h4>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                    {selectedTicket.description}
                  </p>
                  <span className="text-[10px] text-gray-500 mt-3 block">
                    Criado em: {new Date(selectedTicket.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>

                {/* Divisor do Histórico */}
                <div className="relative flex items-center justify-center my-4">
                  <div className="border-t border-gray-800 w-full" />
                  <span className="bg-gray-900 px-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider absolute">
                    Histórico de Atendimento
                  </span>
                </div>

                {/* Histórico em Formato Chat */}
                {messages.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-xs font-medium">
                    Nenhuma mensagem registrada. Envie uma resposta abaixo para iniciar o atendimento.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg, index) => {
                      const isLatestMessage = index === 0
                      const forceSupportOnRespondedTicket =
                        isLatestMessage && (selectedTicket.status === 'waiting_customer' || Boolean(selectedTicket.response_at))
                      const isSupportMessage = msg.sender_role
                        ? msg.sender_role === 'support'
                        : msg.user_id !== selectedTicket.user_id || forceSupportOnRespondedTicket
                      const isInternalNote = msg.is_internal

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${
                            isInternalNote
                              ? 'items-center'
                              : isSupportMessage
                              ? 'items-end'
                              : 'items-start'
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl p-4 shadow-xs text-xs ${
                              isInternalNote
                                ? 'bg-amber-950/40 border border-amber-800/50 text-amber-200 rounded-xl w-full'
                                : isSupportMessage
                                ? 'bg-blue-950/70 border border-blue-800/60 text-gray-100 rounded-tr-xs'
                                : 'bg-gray-800/80 border border-gray-700 text-gray-100 rounded-tl-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4 mb-1.5 pb-1 border-b border-white/10">
                              <span className="font-bold flex items-center gap-1.5">
                                {isInternalNote ? (
                                  '📌 Nota Interna da Equipe'
                                ) : isSupportMessage ? (
                                  '💬 Suporte Técnico'
                                ) : (
                                  '👤 Cliente / Ministério'
                                )}
                              </span>
                              <span className="text-[10px] opacity-70">
                                {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed text-xs">{msg.message}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Rodapé Fixo de Resposta */}
              {selectedTicket.status === 'closed' ? (
                <div className="p-4 bg-gray-950 border-t border-gray-800 text-center text-xs text-gray-400 font-medium">
                  🔒 Ticket Encerrado. O atendimento foi finalizado.
                </div>
              ) : (
                <form onSubmit={handleReply} className="p-4 bg-gray-950 border-t border-gray-800 space-y-3 sticky bottom-0 z-10">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-xs text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none transition"
                    placeholder="Digite a resposta para o cliente..."
                    required
                  />

                  <div className="flex items-center justify-between gap-3">
                    <select
                      value={replyStatus}
                      onChange={(e) => setReplyStatus(e.target.value as SupportTicket['status'])}
                      className="bg-gray-900 border border-gray-800 text-gray-300 rounded-lg px-3 py-1.5 text-xs font-medium focus:border-blue-500 focus:outline-none"
                    >
                      <option value="waiting_customer">Status: Aguardando Cliente</option>
                      <option value="in_progress">Status: Em Atendimento</option>
                      <option value="closed">Status: Fechado</option>
                    </select>

                    <button
                      type="submit"
                      disabled={replying || !replyText.trim()}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {replying ? 'Enviando...' : 'Enviar Resposta'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {closingTicket && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-800">
              <h3 className="text-lg font-semibold text-white">Fechar ticket</h3>
              <p className="text-sm text-gray-400 mt-1">
                Confirma o fechamento do ticket <span className="text-gray-200 font-semibold">{closingTicket.ticket_number}</span>?
              </p>
            </div>
            <div className="px-6 py-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setClosingTicket(null)}
                disabled={closingTicketId === closingTicket.id}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-800 text-gray-200 hover:bg-gray-700 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => closeTicket(closingTicket)}
                disabled={closingTicketId === closingTicket.id}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                {closingTicketId === closingTicket.id ? 'Fechando...' : 'Fechar ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Lateral Slide-Over: Ticket do Site / Landing (Suporte 2.0) */}
      {ticketView === 'landing' && selectedLandingTicket && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            onClick={() => setSelectedLandingTicket(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col">
              {/* Cabeçalho Fixo do Drawer */}
              <div className="p-6 bg-gray-950 border-b border-gray-800 flex items-start justify-between gap-4 sticky top-0 z-10">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/60 font-semibold">
                      #{selectedLandingTicket.ticket_number}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(selectedLandingTicket.status)}`}>
                      {getStatusLabel(selectedLandingTicket.status)}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getPriorityColor(selectedLandingTicket.priority)}`}>
                      {getPriorityLabel(selectedLandingTicket.priority)}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white truncate">{selectedLandingTicket.institution_name}</h3>
                  <p className="text-xs text-gray-400">
                    Lead: <span className="text-gray-200 font-semibold">{selectedLandingTicket.contact_name}</span> ({selectedLandingTicket.email})
                  </p>
                </div>

                <button
                  onClick={() => setSelectedLandingTicket(null)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Corpo do Drawer com Informações e Notas */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-900/50">
                {/* Dados de Contato do Lead */}
                <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 shadow-xs space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Dados de Contato</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500 block">Contato:</span>
                      <span className="font-semibold text-gray-200">{selectedLandingTicket.contact_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">WhatsApp:</span>
                      <span className="font-semibold text-gray-200">{selectedLandingTicket.whatsapp || 'Não informado'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500 block">E-mail:</span>
                      <span className="font-semibold text-gray-200">{selectedLandingTicket.email}</span>
                    </div>
                  </div>
                </div>

                {/* Descrição do Interesse */}
                <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 shadow-xs">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mensagem do Site</h4>
                  <p className="text-xs text-gray-200 whitespace-pre-wrap leading-relaxed">
                    {selectedLandingTicket.description}
                  </p>
                </div>

                {/* Alteração Rápida de Status */}
                <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 shadow-xs space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Alterar Status do Lead</h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateLandingStatus(selectedLandingTicket.id, 'em_atendimento')}
                      disabled={landingUpdating}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition"
                    >
                      Em Atendimento
                    </button>
                    <button
                      type="button"
                      onClick={() => updateLandingStatus(selectedLandingTicket.id, 'aguardando_contrato')}
                      disabled={landingUpdating}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 transition"
                    >
                      Aguardando Contrato
                    </button>
                    <button
                      type="button"
                      onClick={() => updateLandingStatus(selectedLandingTicket.id, 'contrato_finalizado')}
                      disabled={landingUpdating}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition"
                    >
                      Contrato Finalizado
                    </button>
                  </div>
                </div>

                {/* Bloco de Notas Internas */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Notas Internas do Atendimento</h4>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={landingNoteText}
                      onChange={(e) => setLandingNoteText(e.target.value)}
                      placeholder="Adicionar nota sobre esta negociação..."
                      className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={addLandingNote}
                      disabled={landingAddingNote || !landingNoteText.trim()}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50"
                    >
                      Adicionar
                    </button>
                  </div>

                  {selectedLandingTicket.notes && selectedLandingTicket.notes.length > 0 && (
                    <div className="space-y-2">
                      {selectedLandingTicket.notes.map((note, idx) => (
                        <div key={idx} className="bg-gray-950 border border-gray-800 p-3 rounded-lg text-xs text-gray-300">
                          <p>{note.text}</p>
                          <span className="text-[10px] text-gray-500 mt-1 block">
                            {new Date(note.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
