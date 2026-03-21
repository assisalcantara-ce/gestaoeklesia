'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import Link from 'next/link'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import type { SupportTicket } from '@/types/admin'

export default function SuportePage() {
  const { isLoading, isAuthenticated } = useAdminAuth()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('open')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [page, setPage] = useState(1)
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
            <option value="open">Abertos</option>
            <option value="in_progress">Em Progresso</option>
            <option value="waiting_customer">Aguardando Cliente</option>
            <option value="resolved">Resolvidos</option>
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
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-sm text-gray-600">{t.ticket_number}</td>
                    <td className="px-6 py-4 font-medium">{t.subject}</td>
                    <td className="px-6 py-4 text-sm">
                      {t.ministry_id}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs ${getPriorityColor(t.priority)}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs ${getStatusColor(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(t.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button className="text-blue-600 hover:underline">Responder</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
