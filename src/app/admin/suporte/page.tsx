'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import AdminSidebar from '@/components/AdminSidebar'
import type { SupportTicket, SupportTicketMessage, SupportTicketLanding, LandingTicketNote } from '@/types/admin'

export default function SuportePage() {
  const { isLoading, isAuthenticated } = useAdminAuth()
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
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [selectedLandingTicket, setSelectedLandingTicket] = useState<SupportTicketLanding | null>(null)
  const [messages, setMessages] = useState<SupportTicketMessage[]>([])
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  const [replyStatus, setReplyStatus] = useState<SupportTicket['status']>('waiting_customer')
  const router = useRouter()

  const [formData, setFormData] = useState({
    ministry_id: '',
    subject: '',
    description: '',
    category: 'technical',
    priority: 'medium',
  })

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      if (ticketView === 'tenant') {
        fetchTickets()
      } else {
        fetchLandingTickets()
      }
    }
  }, [page, statusFilter, priorityFilter, landingPage, landingStatusFilter, ticketView, isAuthenticated])

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
        if (response.status === 401 || response.status === 403) {
          router.push('/admin/login')
          return
        }
        throw new Error('Erro ao carregar tickets')
      }

      const data = await response.json()
      setTickets(data.data)
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
        if (response.status === 401 || response.status === 403) {
          router.push('/admin/login')
          return
        }
        throw new Error('Erro ao carregar tickets da landing')
      }

      const data = await response.json()
      setLandingTickets(data.data || [])
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
      case 'medium': return 'MEDIA'
      case 'low': return 'BAIXA'
      default: return priority.toUpperCase()
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-500/20 text-red-400 border border-red-500/30'
      case 'in_progress': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
      case 'waiting_customer': return 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
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
      case 'waiting_customer': return 'AGUARDANDO CLIENTE'
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
      case 'waiting_customer': return 'border-l-purple-500'
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

          {/* Toolbar */}
          <div className="flex gap-3 items-center flex-wrap">
            {/* Tabs */}
            <div className="inline-flex rounded-lg border border-gray-700 bg-gray-800 p-1">
              <button
                type="button"
                onClick={() => setTicketView('tenant')}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                  ticketView === 'tenant' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Tickets de Instituições
              </button>
              <button
                type="button"
                onClick={() => setTicketView('landing')}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                  ticketView === 'landing' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Tickets da Landing
              </button>
            </div>

            {ticketView === 'tenant' && (
              <>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg text-sm"
                >
                  <option value="active">Em atendimento</option>
                  <option value="open">Abertos (apenas novos)</option>
                  <option value="in_progress">Em Progresso</option>
                  <option value="waiting_customer">Aguardando Cliente</option>
                  <option value="closed">Fechados</option>
                </select>
                <select
                  value={priorityFilter}
                  onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg text-sm"
                >
                  <option value="all">Todas as Prioridades</option>
                  <option value="urgent">Urgente</option>
                  <option value="high">Alta</option>
                  <option value="medium">Média</option>
                  <option value="low">Baixa</option>
                </select>
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold transition"
                >
                  + Novo Ticket
                </button>
              </>
            )}

            {ticketView === 'landing' && (
              <select
                value={landingStatusFilter}
                onChange={(e) => { setLandingStatusFilter(e.target.value); setLandingPage(1) }}
                className="px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg text-sm"
              >
                <option value="active">Em atendimento</option>
                <option value="open">Abertos (apenas novos)</option>
                <option value="em_atendimento">Em Atendimento</option>
                <option value="aguardando_contrato">Aguardando Contrato</option>
                <option value="contrato_finalizado">Contrato Finalizado</option>
                <option value="cancelado">Cancelado</option>
                <option value="closed">Fechados</option>
              </select>
            )}
          </div>

          {/* Formulário novo ticket */}
          {ticketView === 'tenant' && showForm && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h2 className="text-lg font-bold text-white mb-4">Novo Ticket de Suporte</h2>
              <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="ID da Instituição"
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
                <button
                  type="submit"
                  className="col-span-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                >
                  Criar Ticket
                </button>
              </form>
            </div>
          )}

          {/* Tabela */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            {ticketView === 'tenant' && (
              loading ? (
                <div className="p-6 text-center text-gray-400">Carregando...</div>
              ) : tickets.length === 0 ? (
                <div className="p-6 text-center text-gray-400">Nenhum ticket encontrado</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-900 border-b border-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">#</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Assunto</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Ministério</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Prioridade</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Criado em</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {tickets.map((t) => (
                      <tr
                        key={t.id}
                        className={`border-l-4 ${getStatusRowBorder(t.status)} hover:bg-gray-750 transition ${
                          t.last_message_user_id && t.user_id && t.last_message_user_id === t.user_id
                            ? 'bg-yellow-900/10'
                            : t.last_message_user_id
                            ? 'bg-green-900/10'
                            : ''
                        }`}
                      >
                        <td className="px-6 py-4 font-mono text-xs text-gray-400">{t.ticket_number}</td>
                        <td className="px-6 py-4 font-medium text-gray-200">{t.subject}</td>
                        <td className="px-6 py-4 text-sm text-gray-400">{t.ministry_id}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(t.priority)}`}>
                            {getPriorityLabel(t.priority)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold w-fit ${getStatusColor(t.status)}`}>
                              {getStatusLabel(t.status)}
                            </span>
                            {t.response_at && (
                              <span className="text-[10px] text-gray-500">
                                Resp. {new Date(t.response_at).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400">
                          {new Date(t.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setSelectedTicket(t)}
                            className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
                          >
                            {t.status === 'closed' ? 'Visualizar' : 'Responder'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {ticketView === 'landing' && (
              landingLoading ? (
                <div className="p-6 text-center text-gray-400">Carregando...</div>
              ) : landingTickets.length === 0 ? (
                <div className="p-6 text-center text-gray-400">Nenhum ticket de landing encontrado</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-900 border-b border-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">#</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Instituição</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Contato</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Criado em</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {landingTickets.map((t) => (
                      <tr key={t.id} className={`border-l-4 ${getStatusRowBorder(t.status)} hover:bg-gray-750 transition`}>
                        <td className="px-6 py-4 font-mono text-xs text-gray-400">{t.ticket_number}</td>
                        <td className="px-6 py-4 font-medium text-gray-200">{t.institution_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-400">{t.contact_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-400">{t.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(t.status)}`}>
                            {getStatusLabel(t.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400">
                          {new Date(t.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setSelectedLandingTicket(t)}
                            className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
                          >
                            Visualizar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>
      </main>

      {/* Modal: Ticket de Instituição */}
      {ticketView === 'tenant' && selectedTicket && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-gray-700">
            {/* Header */}
            <div className="relative bg-gradient-to-r from-[#0f2f4d] via-[#123b63] to-[#1b6aa5] text-white px-8 py-7">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/70">Ticket</p>
                  <h3 className="text-2xl font-bold">{selectedTicket.subject}</h3>
                  <p className="text-sm text-white/80 mt-1">#{selectedTicket.ticket_number}</p>
                </div>
                <button
                  onClick={() => { setSelectedTicket(null); setMessages([]); setReplyText(''); setError('') }}
                  className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-2 transition"
                >
                  ✕
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedTicket.status)}`}>
                  {getStatusLabel(selectedTicket.status)}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(selectedTicket.priority)}`}>
                  PRIORIDADE {getPriorityLabel(selectedTicket.priority)}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white">
                  MINISTERIO {selectedTicket.ministry_id}
                </span>
              </div>
            </div>

            <div className="px-6 lg:px-8 pb-8 max-h-[70vh] overflow-y-auto">
              <div className="mx-auto grid grid-cols-1 lg:grid-cols-2 gap-0">
                {/* Esquerda: detalhe + conversa */}
                <div className="p-6 border-b lg:border-b-0 lg:border-r border-gray-700 space-y-6">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Detalhes</h4>
                    <p className="text-gray-300 bg-gray-800 border border-gray-700 rounded-xl p-4 leading-relaxed text-sm">
                      {selectedTicket.description}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Conversas</h4>
                    </div>
                    {messages.length === 0 ? (
                      <p className="text-gray-500 text-sm">Nenhuma mensagem ainda.</p>
                    ) : (
                      <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`rounded-xl p-3 border ${
                              msg.user_id === selectedTicket.user_id
                                ? 'bg-yellow-900/20 border-yellow-700/40'
                                : 'bg-green-900/20 border-green-700/40'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                              <span className="inline-flex items-center gap-2 font-semibold">
                                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                                  msg.user_id === selectedTicket.user_id
                                    ? 'bg-yellow-700/50 text-yellow-300'
                                    : 'bg-green-700/50 text-green-300'
                                }`}>
                                  {msg.user_id === selectedTicket.user_id ? 'CL' : 'SP'}
                                </span>
                                {msg.user_id === selectedTicket.user_id ? 'Cliente' : 'Suporte'}
                              </span>
                              <span>{new Date(msg.created_at).toLocaleString('pt-BR')}</span>
                            </div>
                            <p className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">{msg.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Direita: datas + resposta */}
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-3">
                      <p className="text-xs text-gray-500 uppercase tracking-widest">Criado em</p>
                      <p className="font-semibold text-gray-200 mt-1">
                        {new Date(selectedTicket.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-3">
                      <p className="text-xs text-gray-500 uppercase tracking-widest">Atualizado</p>
                      <p className="font-semibold text-gray-200 mt-1">
                        {new Date(selectedTicket.updated_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  {selectedTicket.status === 'closed' ? (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Ticket fechado</h4>
                      <p className="text-sm text-gray-500">
                        Este ticket foi fechado. O cliente pode reabrir caso necessite.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleReply} className="space-y-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Responder</h4>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={6}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-gray-200 rounded-xl focus:outline-none focus:border-blue-500 resize-none placeholder-gray-600 text-sm"
                        placeholder="Escreva a resposta para o cliente"
                      />
                      <div className="flex flex-wrap gap-3 items-center">
                        <select
                          value={replyStatus}
                          onChange={(e) => setReplyStatus(e.target.value as SupportTicket['status'])}
                          className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="waiting_customer">Aguardando Cliente</option>
                          <option value="in_progress">Em Progresso</option>
                          <option value="closed">Fechado</option>
                        </select>
                        <button
                          type="submit"
                          disabled={replying}
                          className="ml-auto px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                        >
                          {replying ? 'Enviando...' : 'Enviar resposta'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ticket da Landing */}
      {ticketView === 'landing' && selectedLandingTicket && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-gray-700">
            {/* Header */}
            <div className="relative bg-gradient-to-r from-[#123b63] via-[#1b6aa5] to-[#2b7cbf] text-white px-8 py-7">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/70">Ticket Landing</p>
                  <h3 className="text-2xl font-bold">{selectedLandingTicket.institution_name}</h3>
                  <p className="text-sm text-white/80 mt-1">#{selectedLandingTicket.ticket_number}</p>
                </div>
                <button
                  onClick={() => setSelectedLandingTicket(null)}
                  className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-2 transition"
                >
                  ✕
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedLandingTicket.status)}`}>
                  {getStatusLabel(selectedLandingTicket.status)}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(selectedLandingTicket.priority)}`}>
                  PRIORIDADE {getPriorityLabel(selectedLandingTicket.priority)}
                </span>
              </div>
            </div>

            <div className="px-6 lg:px-8 pb-8 pt-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Info contato */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-widest">Contato</p>
                  <p className="font-semibold text-gray-200 mt-2">{selectedLandingTicket.contact_name}</p>
                  <p className="text-gray-400 mt-1">{selectedLandingTicket.email}</p>
                  <p className="text-gray-400 mt-1">{selectedLandingTicket.whatsapp}</p>
                </div>
                <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-widest">Criado em</p>
                  <p className="font-semibold text-gray-200 mt-2">
                    {new Date(selectedLandingTicket.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              {/* Botões de status */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Mudar Status</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateLandingStatus(selectedLandingTicket.id, 'em_atendimento')}
                    disabled={landingUpdating}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition"
                  >
                    Em Atendimento
                  </button>
                  <button
                    type="button"
                    onClick={() => updateLandingStatus(selectedLandingTicket.id, 'aguardando_contrato')}
                    disabled={landingUpdating}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-50 transition"
                  >
                    Aguardando Contrato
                  </button>
                  <button
                    type="button"
                    onClick={() => updateLandingStatus(selectedLandingTicket.id, 'contrato_finalizado')}
                    disabled={landingUpdating}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 disabled:opacity-50 transition"
                  >
                    Contrato Finalizado
                  </button>
                  <button
                    type="button"
                    onClick={() => updateLandingStatus(selectedLandingTicket.id, 'cancelado')}
                    disabled={landingUpdating}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-gray-500/10 border border-gray-500/30 text-gray-400 hover:bg-gray-500/20 disabled:opacity-50 transition"
                  >
                    Cancelado
                  </button>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Descrição</p>
                <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 text-sm text-gray-300 whitespace-pre-wrap">
                  {selectedLandingTicket.description}
                </div>
              </div>

              {/* Histórico de comentários */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Histórico de Comentários</p>
                {(!selectedLandingTicket.notes || selectedLandingTicket.notes.length === 0) ? (
                  <p className="text-xs text-gray-600 italic mb-3">Nenhum comentário ainda.</p>
                ) : (
                  <div className="space-y-3 mb-4 max-h-56 overflow-y-auto pr-1">
                    {[...selectedLandingTicket.notes].reverse().map((note: LandingTicketNote, idx: number) => (
                      <div key={idx} className="rounded-xl border border-blue-800/40 bg-blue-900/20 p-4">
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">{note.text}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(note.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <textarea
                    rows={3}
                    placeholder="Escreva um comentário interno..."
                    value={landingNoteText}
                    onChange={(e) => setLandingNoteText(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-gray-200 rounded-xl text-sm resize-none placeholder-gray-600 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={addLandingNote}
                    disabled={landingAddingNote || !landingNoteText.trim()}
                    className="self-end px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {landingAddingNote ? 'Salvando...' : 'Salvar Comentário'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
