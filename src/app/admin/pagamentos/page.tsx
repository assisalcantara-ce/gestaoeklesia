'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import AdminSidebar from '@/components/AdminSidebar'
import { ExternalLink, Copy, Check, Filter, RefreshCw, AlertCircle, Coins } from 'lucide-react'

interface BillingInvoice {
  id: string
  ministry_id: string
  subscription_plan_id: string | null
  plano_slug: string
  status: string
  amount: number
  due_date: string | null
  period_start: string | null
  period_end: string | null
  asaas_customer_id: string | null
  asaas_payment_id: string | null
  asaas_invoice_url: string | null
  created_at: string
  updated_at: string
  ministries: {
    name: string
  } | null
}

export default function PagamentosPage() {
  const { isLoading, isAuthenticated, isAdmin } = useAdminAuth()
  const [invoices, setInvoices] = useState<BillingInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin)) {
      router.push('/admin/login')
    }
  }, [isLoading, isAuthenticated, isAdmin, router])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      setError('')
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const response = await authenticatedFetch(`/api/v1/admin/billing-invoices?${params}`)
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push('/admin/login')
          return
        }
        throw new Error('Erro ao carregar faturas de cobrança')
      }

      const data = await response.json()
      setInvoices(data.data || [])
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchInvoices()
    }
  }, [statusFilter, isAuthenticated, isAdmin])

  const handleCopyLink = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      // Falha silenciosa ou aviso amigável
    }
  }

  const handleMarkAsPaid = async (invoiceId: string) => {
    if (!window.confirm('Tem certeza que deseja marcar esta fatura como paga manualmente? Esta ação irá ativar o ministério correspondente.')) {
      return
    }
    try {
      setLoading(true)
      setError('')
      const response = await authenticatedFetch('/api/v1/admin/billing-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoice_id: invoiceId }),
      })
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Erro ao marcar fatura como paga')
      }
      await fetchInvoices()
    } catch (err: any) {
      setError(err.message || 'Erro ao processar pagamento.')
    } finally {
      setLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-900">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white text-lg flex items-center gap-2">
            <RefreshCw className="animate-spin text-blue-500" />
            Verificando autenticação...
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !isAdmin) {
    return null
  }

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase()
    switch (s) {
      case 'paid':
      case 'paga':
      case 'pago':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Pago
          </span>
        )
      case 'pending':
      case 'pendente':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            Pendente
          </span>
        )
      case 'overdue':
      case 'vencida':
      case 'vencido':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Vencido
          </span>
        )
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
            {status}
          </span>
        )
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    // Evitar problemas de timezone em datas sem hora (due_date)
    if (dateStr.length <= 10) {
      const parts = dateStr.split('-')
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`
      }
    }
    return date.toLocaleDateString('pt-BR')
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <AdminSidebar />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur px-8 py-6 sticky top-0 z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Coins className="text-blue-500 h-7 w-7" />
              Faturamento da Plataforma
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Gerencie e visualize as faturas de cobranças geradas para os ministérios.
            </p>
          </div>
          <button
            onClick={fetchInvoices}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition disabled:opacity-50"
            title="Atualizar lista"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </header>

        <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Filtros */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-blue-500" />
              <span className="font-semibold text-sm text-gray-300">Filtrar por Status:</span>
            </div>
            <div className="flex gap-2">
              {['all', 'pending', 'paid', 'overdue'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                    statusFilter === status
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {status === 'all' && 'Todos'}
                  {status === 'pending' && 'Pendente'}
                  {status === 'paid' && 'Pago'}
                  {status === 'overdue' && 'Vencido'}
                </button>
              ))}
            </div>
          </div>

          {/* Tabela de Faturas */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-sm text-gray-400">Carregando faturas...</p>
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-20 text-gray-500 space-y-2">
                <p className="text-lg font-medium">Nenhuma fatura encontrada</p>
                <p className="text-sm">Não há registros correspondentes aos critérios de filtro aplicados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-950/40 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <th className="px-6 py-4">Ministério</th>
                      <th className="px-6 py-4">Plano</th>
                      <th className="px-6 py-4">Valor</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Vencimento</th>
                      <th className="px-6 py-4">Criado em</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 text-sm">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-gray-800/30 transition">
                        <td className="px-6 py-4 font-medium text-white">
                          {inv.ministries?.name || 'Ministério Removido'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 text-xs font-mono rounded bg-gray-800 text-gray-300 border border-gray-700">
                            {inv.plano_slug}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-white">
                          {formatCurrency(inv.amount)}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(inv.status)}
                        </td>
                        <td className="px-6 py-4 text-gray-300">
                          {formatDate(inv.due_date)}
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-xs">
                          {formatDateTime(inv.created_at)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                            {inv.status !== 'paid' && (
                              <button
                                onClick={() => handleMarkAsPaid(inv.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Marcar como pago
                              </button>
                            )}
                            {inv.asaas_invoice_url ? (
                              <>
                                <a
                                  href={inv.asaas_invoice_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition cursor-pointer"
                                >
                                  Abrir fatura
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                                <button
                                  onClick={() => handleCopyLink(inv.asaas_invoice_url!, inv.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-white rounded-lg text-xs font-medium border border-gray-700 hover:border-gray-650 transition cursor-pointer"
                                >
                                  {copiedId === inv.id ? (
                                    <>
                                      Copiado!
                                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                                    </>
                                  ) : (
                                    <>
                                      Copiar link
                                      <Copy className="h-3.5 w-3.5" />
                                    </>
                                  )}
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-gray-500 italic">Sem link disponível</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
