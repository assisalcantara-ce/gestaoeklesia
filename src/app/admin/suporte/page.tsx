'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import Link from 'next/link'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import type { SupportTicket, SupportTicketMessage } from '@/types/admin'

export default function SuportePage() {
  const { isLoading, isAuthenticated } = useAdminAuth()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [page, setPage] = useState(1)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
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
      fetchTickets()
    }
  }, [page, statusFilter, priorityFilter, isAuthenticated])

  useEffect(() => {
    if (!selectedTicket) return
    setReplyText('')
    setReplyStatus('waiting_customer')
    setSuccess('')
    setError('')
    fetchMessages(selectedTicket.id)
  }, [selectedTicket?.id])

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
      case 'urgent':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'URGENTE'
      case 'high':
        return 'ALTA'
      case 'medium':
        return 'MEDIA'
      case 'low':
        return 'BAIXA'
      default:
        return priority.toUpperCase()
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'waiting_customer':
        return 'bg-purple-100 text-purple-800'
      case 'resolved':
        return 'bg-green-100 text-green-800'
      case 'closed':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return 'ABERTO'
      case 'in_progress':
        return 'EM PROGRESSO'
      case 'waiting_customer':
        return 'AGUARDANDO CLIENTE'
      case 'closed':
        return 'FECHADO'
      default:
        return status
    }
  }

  const getStatusRowBorder = (status: string) => {
    switch (status) {
      case 'open':
        return 'border-red-400'
      case 'in_progress':
        return 'border-blue-400'
      case 'waiting_customer':
        return 'border-purple-400'
      case 'resolved':
        return 'border-green-400'
      case 'closed':
        return 'border-gray-400'
      default:
        return 'border-gray-300'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard" className="text-blue-600 hover:underline">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">Suporte Técnico</h1>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        {/* Mensagens */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            {success}
          </div>
        )}

        {/* Toolbar */}
        <div className="mb-6 flex gap-4 items-center flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="active">Em atendimento</option>
            <option value="open">Abertos (apenas novos)</option>
            <option value="in_progress">Em Progresso</option>
            <option value="waiting_customer">Aguardando Cliente</option>
            <option value="closed">Fechados</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">Todas as Prioridades</option>
            <option value="urgent">Urgente</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>

          <button
            onClick={() => setShowForm(!showForm)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Novo Ticket
          </button>
        </div>

        {/* Formulário */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Novo Ticket de Suporte</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="ID do Ministério"
                value={formData.ministry_id}
                onChange={(e) => setFormData({ ...formData, ministry_id: e.target.value })}
                required
                className="col-span-2 px-4 py-2 border border-gray-300 rounded-lg"
              />

              <input
                type="text"
                placeholder="Assunto"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
                className="col-span-2 px-4 py-2 border border-gray-300 rounded-lg"
              />

              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg"
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
                className="px-4 py-2 border border-gray-300 rounded-lg"
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
                className="col-span-2 px-4 py-2 border border-gray-300 rounded-lg"
                rows={4}
              />

              <button
                type="submit"
                className="col-span-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Criar Ticket
              </button>
            </form>
          </div>
        )}

        {/* Tabela */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-gray-600">Carregando...</div>
          ) : tickets.length === 0 ? (
            <div className="p-6 text-center text-gray-600">Nenhum ticket encontrado</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">#</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Assunto</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Ministério</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Prioridade</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Criado em</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    className={`border-b hover:bg-gray-50 border-l-4 ${getStatusRowBorder(t.status)} ${t.last_message_user_id && t.user_id && t.last_message_user_id === t.user_id ? 'bg-yellow-50' : t.last_message_user_id ? 'bg-green-50' : ''}`}
                  >
                    <td className="px-6 py-4 font-mono text-sm text-gray-600">{t.ticket_number}</td>
                    <td className="px-6 py-4 font-medium">{t.subject}</td>
                    <td className="px-6 py-4 text-sm">
                      {t.ministry_id}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs ${getPriorityColor(t.priority)}`}>
                        {getPriorityLabel(t.priority)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs ${getStatusColor(t.status)}`}>
                          {getStatusLabel(t.status)}
                        </span>
                        {t.response_at && (
                          <span className="text-[11px] text-gray-500">
                            Respondido em {new Date(t.response_at).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(t.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => setSelectedTicket(t)}
                        className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
                      >
                        {t.status === 'closed' ? 'Visualizar' : 'Responder'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selectedTicket && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden">
              <div className="relative bg-gradient-to-r from-[#0f2f4d] via-[#123b63] to-[#1b6aa5] text-white px-8 py-7">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/70">Ticket</p>
                    <h3 className="text-2xl font-bold">{selectedTicket.subject}</h3>
                    <p className="text-sm text-white/80 mt-1">#{selectedTicket.ticket_number}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedTicket(null)
                      setMessages([])
                      setReplyText('')
                      setError('')
                    }}
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

              <div className="px-6 lg:px-8 pb-8">
                <div className="mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-0">
                  <div className="p-6 border-b lg:border-b-0 lg:border-r border-gray-100 space-y-6">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-2">Detalhes</h4>
                      <p className="text-gray-700 bg-gray-50 border border-gray-100 rounded-xl p-4 leading-relaxed">
                        {selectedTicket.description}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Conversas</h4>
                        <span className="text-xs text-gray-400">Atualiza automaticamente</span>
                      </div>
                      {messages.length === 0 ? (
                        <p className="text-gray-500 text-sm">Nenhuma mensagem ainda.</p>
                      ) : (
                        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                          {messages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`rounded-xl p-3 border ${msg.user_id === selectedTicket.user_id ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}
                            >
                              <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                                <span className="inline-flex items-center gap-2 font-semibold">
                                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${msg.user_id === selectedTicket.user_id ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'}`}>
                                    {msg.user_id === selectedTicket.user_id ? 'CL' : 'SP'}
                                  </span>
                                  {msg.user_id === selectedTicket.user_id ? 'Cliente' : 'Suporte'}
                                </span>
                                <span>{new Date(msg.created_at).toLocaleString('pt-BR')}</span>
                              </div>
                              <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{msg.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="rounded-xl border border-gray-100 p-3">
                        <p className="text-xs text-gray-400 uppercase tracking-widest">Criado em</p>
                        <p className="font-semibold text-gray-700 mt-1">
                          {new Date(selectedTicket.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-100 p-3">
                        <p className="text-xs text-gray-400 uppercase tracking-widest">Atualizado</p>
                        <p className="font-semibold text-gray-700 mt-1">
                          {new Date(selectedTicket.updated_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    {selectedTicket.status === 'closed' ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Visualizar</h4>
                          <span className="text-xs text-gray-400">Ticket fechado</span>
                        </div>
                        <p className="text-sm text-gray-500">
                          Este ticket foi fechado pelo suporte. O cliente pode reabrir caso necessite.
                        </p>
                      </div>
                    ) : (
                      <form onSubmit={handleReply} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Responder</h4>
                          <span className="text-xs text-gray-400">Envie a resposta ao cliente</span>
                        </div>
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="w-full px-5 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/20 h-40 resize-none leading-relaxed"
                          placeholder="Escreva a resposta para o cliente"
                        />
                        <div className="flex flex-wrap gap-3 items-center">
                          <select
                            value={replyStatus}
                            onChange={(e) => setReplyStatus(e.target.value as SupportTicket['status'])}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="waiting_customer">Aguardando Cliente</option>
                            <option value="in_progress">Em Progresso</option>
                            <option value="closed">Fechado</option>
                          </select>
                          <button
                            type="submit"
                            disabled={replying}
                            className="ml-auto px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
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
      </div>
    </div>
  )
}
