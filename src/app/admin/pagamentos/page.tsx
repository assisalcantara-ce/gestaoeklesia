'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import Link from 'next/link'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import type { Payment } from '@/types/admin'

export default function PagamentosPage() {
  const { isLoading, isAuthenticated } = useAdminAuth()
  const [pagamentos, setPagamentos] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [page, setPage] = useState(1)
  const router = useRouter()

  const [formData, setFormData] = useState({
    ministry_id: '',
    amount: '',
    due_date: '',
    description: '',
    payment_method: 'pix',
  })

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      fetchPagamentos()
    }
  }, [page, filter, isAuthenticated])

  const fetchPagamentos = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })
      if (filter !== 'all') params.append('status', filter)

      const response = await authenticatedFetch(`/api/v1/admin/payments?${params}`)
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push('/admin/login')
          return
        }
        throw new Error('Erro ao carregar pagamentos')
      }

      const data = await response.json()
      setPagamentos(data.data)
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
      const response = await authenticatedFetch('/api/v1/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar pagamento')
      }

      setSuccess('Pagamento criado com sucesso!')
      setFormData({
        ministry_id: '',
        amount: '',
        due_date: '',
        description: '',
        payment_method: 'pix',
      })
      setShowForm(false)
      fetchPagamentos()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-blue-100 text-blue-800'
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
            <h1 className="text-2xl font-bold text-gray-800">Pagamentos</h1>
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
        <div className="mb-6 flex gap-4 items-center">
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">Todos os Status</option>
            <option value="pending">Pendentes</option>
            <option value="paid">Pagos</option>
            <option value="overdue">Vencidos</option>
            <option value="cancelled">Cancelados</option>
          </select>

          <button
            onClick={() => setShowForm(!showForm)}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            + Novo Pagamento
          </button>
        </div>

        {/* Formulário */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Novo Pagamento</h2>
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
                type="number"
                step="0.01"
                placeholder="Valor (R$)"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                className="px-4 py-2 border border-gray-300 rounded-lg"
              />

              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                required
                className="px-4 py-2 border border-gray-300 rounded-lg"
              />

              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="col-span-2 px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="pix">PIX</option>
                <option value="boleto">Boleto</option>
                <option value="credit_card">Cartão de Crédito</option>
                <option value="bank_transfer">Transferência Bancária</option>
              </select>

              <input
                type="text"
                placeholder="Descrição (opcional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="col-span-2 px-4 py-2 border border-gray-300 rounded-lg"
              />

              <button
                type="submit"
                className="col-span-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Criar Pagamento
              </button>
            </form>
          </div>
        )}

        {/* Tabela */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-gray-600">Carregando...</div>
          ) : pagamentos.length === 0 ? (
            <div className="p-6 text-center text-gray-600">Nenhum pagamento encontrado</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Ministério</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Valor</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Vencimento</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Método</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pagamentos.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">
                      {p.ministry_id}
                    </td>
                    <td className="px-6 py-4 font-bold">R$ {p.amount.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm">
                      {new Date(p.due_date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs ${getStatusColor(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{p.payment_method}</td>
                    <td className="px-6 py-4 text-sm">
                      <button className="text-blue-600 hover:underline">Detalhes</button>
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
