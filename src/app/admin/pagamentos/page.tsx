'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import AdminSidebar from '@/components/AdminSidebar'
import { temAcessoAdmin } from '@/lib/access-control'
import { ExternalLink, Copy, Check, Filter, RefreshCw, AlertCircle, Coins, Plus, Search, ChevronDown, ChevronRight } from 'lucide-react'

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
  const { isLoading, isAuthenticated, isAdmin, adminUser } = useAdminAuth()
  const [invoices, setInvoices] = useState<BillingInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  
  // === Faturas Avulsas ===
  const [ministries, setMinistries] = useState<any[]>([])
  const [loadingMinistries, setLoadingMinistries] = useState(false)
  const [showAvulsaModal, setShowAvulsaModal] = useState(false)
  const [avulsaSearch, setAvulsaSearch] = useState('')
  const [selectedMinistryId, setSelectedMinistryId] = useState('')
  const [avulsaAmount, setAvulsaAmount] = useState('')
  const [avulsaDescription, setAvulsaDescription] = useState('')
  const [avulsaDueDate, setAvulsaDueDate] = useState('')
  const [avulsaInstallments, setAvulsaInstallments] = useState('1')
  const [avulsaLoading, setAvulsaLoading] = useState(false)
  const [avulsaSuccessData, setAvulsaSuccessData] = useState<any>(null)
  const [hasMinistriesAccess, setHasMinistriesAccess] = useState(true)

  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !isAdmin) {
        router.push('/admin/login')
        return
      }
      if (!temAcessoAdmin(adminUser?.role, 'pagamentos')) {
        router.push('/admin/dashboard')
      }
    }
  }, [isLoading, isAuthenticated, isAdmin, adminUser, router])

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
        if (response.status === 401) {
          router.push('/admin/login')
          return
        }
        if (response.status === 403) {
          setError('Acesso negado para este recurso.')
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
    if (isAuthenticated && isAdmin && temAcessoAdmin(adminUser?.role, 'pagamentos')) {
      fetchInvoices()
    }
  }, [statusFilter, isAuthenticated, isAdmin, adminUser])

  useEffect(() => {
    if (isAuthenticated && isAdmin && temAcessoAdmin(adminUser?.role, 'pagamentos')) {
      fetchMinistries()
    }
  }, [isAuthenticated, isAdmin, adminUser])

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

  // === Faturas Avulsas ===
  const fetchMinistries = async () => {
    try {
      setLoadingMinistries(true)
      const response = await authenticatedFetch('/api/v1/admin/ministries?limit=200')
      if (response.status === 403) {
        setHasMinistriesAccess(false)
        setMinistries([])
        return
      }
      if (!response.ok) {
        throw new Error('Erro ao carregar ministérios')
      }
      const data = await response.json()
      setMinistries(data.data || [])
      setHasMinistriesAccess(true)
    } catch (err: any) {
      console.warn('Erro ao carregar ministérios auxiliares:', err)
    } finally {
      setLoadingMinistries(false)
    }
  }

  const handleOpenAvulsaModal = () => {
    setShowAvulsaModal(true)
    setAvulsaSearch('')
    setSelectedMinistryId('')
    setAvulsaAmount('')
    setAvulsaDescription('')
    setAvulsaDueDate('')
    setAvulsaInstallments('1')
    setAvulsaSuccessData(null)
    fetchMinistries()
  }

  const handleCreateAvulsaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMinistryId) return

    try {
      setAvulsaLoading(true)
      setError('')

      if (!avulsaDueDate) {
        throw new Error('A data de vencimento é obrigatória')
      }
      if (!avulsaAmount || Number(avulsaAmount) <= 0) {
        throw new Error('O valor da fatura deve ser maior que zero')
      }
      if (!avulsaDescription.trim()) {
        throw new Error('A descrição é obrigatória')
      }

      const response = await authenticatedFetch('/api/v1/admin/billing/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ministry_id: selectedMinistryId,
          due_date: avulsaDueDate,
          installments: Number(avulsaInstallments),
          amount: Number(avulsaAmount),
          description: avulsaDescription,
        }),
      })

      const resData = await response.json()
      if (!response.ok) {
        throw new Error(resData.error || 'Erro ao gerar fatura avulsa')
      }

      setAvulsaSuccessData({
        id: resData.data.id,
        invoiceUrl: resData.data.asaas_invoice_url,
      })
      fetchInvoices()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAvulsaLoading(false)
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

  // Agrupar faturas por ministério/tenant
  const groupedInvoices = useMemo(() => {
    const groups: Record<string, { ministryName: string; invoices: BillingInvoice[] }> = {}
    for (const inv of invoices) {
      const mId = inv.ministry_id
      const mName = inv.ministries?.name || 'Ministério Removido'
      if (!groups[mId]) {
        groups[mId] = {
          ministryName: mName,
          invoices: [],
        }
      }
      groups[mId].invoices.push(inv)
    }
    
    return Object.entries(groups).map(([ministryId, data]) => {
      // Ordena as faturas: abertas (pending/overdue) primeiro, ordenadas por vencimento (mais próximo/antigo primeiro)
      const sortedInvoices = [...data.invoices].sort((a, b) => {
        const isAOpen = a.status === 'pending' || a.status === 'pendente' || a.status === 'overdue' || a.status === 'vencido'
        const isBOpen = b.status === 'pending' || b.status === 'pendente' || b.status === 'overdue' || b.status === 'vencido'

        if (isAOpen && !isBOpen) return -1
        if (!isAOpen && isBOpen) return 1

        const dateA = a.due_date ? new Date(a.due_date).getTime() : Infinity
        const dateB = b.due_date ? new Date(b.due_date).getTime() : Infinity
        return dateA - dateB
      })

      return {
        ministryId,
        ministryName: data.ministryName,
        invoices: sortedInvoices,
      }
    })
  }, [invoices])

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [id]: !prev[id],
    }))
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
          <div className="flex items-center gap-3">
            {hasMinistriesAccess && (
              <button
                onClick={handleOpenAvulsaModal}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition"
              >
                <Plus className="h-4 w-4" />
                Lançar Fatura Avulsa
              </button>
            )}
            <button
              onClick={fetchInvoices}
              disabled={loading}
              className="p-2.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition disabled:opacity-50"
              title="Atualizar lista"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
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

          {/* Tabela/Lista de Faturas */}
          {loading ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl flex flex-col items-center justify-center py-20 gap-3 shadow-2xl">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-gray-400">Carregando faturas...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl text-center py-20 text-gray-500 space-y-2 shadow-2xl">
              <p className="text-lg font-medium">Nenhuma fatura encontrada</p>
              <p className="text-sm">Não há registros correspondentes aos critérios de filtro aplicados.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedInvoices.map((group) => {
                const isExpanded = !!expandedGroups[group.ministryId];
                const pendingCount = group.invoices.filter((i) => i.status === 'pending' || i.status === 'pendente').length;
                const overdueCount = group.invoices.filter((i) => i.status === 'overdue' || i.status === 'vencido').length;
                const totalValue = group.invoices.reduce((sum, i) => sum + i.amount, 0);

                return (
                  <div
                    key={group.ministryId}
                    className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/50 backdrop-blur shadow-xl transition-all"
                  >
                    <div
                      onClick={() => toggleGroup(group.ministryId)}
                      className="flex items-center justify-between p-5 hover:bg-gray-800/40 cursor-pointer transition select-none"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-gray-400 shrink-0" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />
                        )}
                        <div>
                          <h3 className="font-semibold text-base text-white">{group.ministryName}</h3>
                          <span className="text-xs text-gray-400 font-mono block mt-0.5">
                            {group.invoices.length} fatura{group.invoices.length !== 1 ? 's' : ''} • Total:{' '}
                            {formatCurrency(totalValue)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {pendingCount > 0 && (
                          <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {pendingCount} Pendente{pendingCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {overdueCount > 0 && (
                          <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">
                            {overdueCount} Vencida{overdueCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {pendingCount === 0 && overdueCount === 0 && (
                          <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Em dia
                          </span>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="overflow-x-auto bg-gray-950/30 border-t border-gray-800/40">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-gray-800 bg-gray-950/40 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                              <th className="px-6 py-3">Plano / Serviço</th>
                              <th className="px-6 py-3">Valor</th>
                              <th className="px-6 py-3">Status</th>
                              <th className="px-6 py-3">Vencimento</th>
                              <th className="px-6 py-3">Criado em</th>
                              <th className="px-6 py-3 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800/30 text-xs">
                            {group.invoices.map((inv) => {
                              const isOverdue = inv.status === 'overdue' || inv.status === 'vencido'
                              const isPending = inv.status === 'pending' || inv.status === 'pendente'
                              let rowClass = "hover:bg-gray-800/20 transition"
                              
                              if (isOverdue) {
                                rowClass = "bg-rose-900/10 border-l-2 border-l-rose-500 hover:bg-rose-900/15 transition"
                              } else if (isPending) {
                                rowClass = "bg-amber-900/5 border-l-2 border-l-amber-500 hover:bg-amber-900/10 transition"
                              }

                              return (
                                <tr key={inv.id} className={rowClass}>
                                <td className="px-6 py-3.5">
                                  <span className="px-2 py-0.5 text-[11px] font-mono rounded bg-gray-800 text-gray-300 border border-gray-700 uppercase">
                                    {inv.plano_slug}
                                  </span>
                                </td>
                                <td className="px-6 py-3.5 font-semibold text-white">
                                  {formatCurrency(inv.amount)}
                                </td>
                                <td className="px-6 py-3.5">{getStatusBadge(inv.status)}</td>
                                <td className="px-6 py-3.5 text-gray-300">{formatDate(inv.due_date)}</td>
                                <td className="px-6 py-3.5 text-gray-400">{formatDateTime(inv.created_at)}</td>
                                <td className="px-6 py-3.5 text-right">
                                  <div className="flex justify-end items-center gap-1.5">
                                    {inv.status !== 'paid' && (
                                      <button
                                        onClick={() => handleMarkAsPaid(inv.id)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold transition cursor-pointer whitespace-nowrap"
                                      >
                                        <Check className="h-3 w-3" />
                                        Marcar pago
                                      </button>
                                    )}
                                    {inv.asaas_invoice_url ? (
                                      <>
                                        <a
                                          href={inv.asaas_invoice_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium transition cursor-pointer"
                                        >
                                          Abrir
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                        <button
                                          onClick={() => handleCopyLink(inv.asaas_invoice_url!, inv.id)}
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-755 text-gray-300 hover:text-white rounded text-[11px] font-medium border border-gray-700 hover:border-gray-650 transition cursor-pointer"
                                        >
                                          {copiedId === inv.id ? (
                                            <>
                                              Copiado
                                              <Check className="h-3 w-3 text-emerald-400" />
                                            </>
                                          ) : (
                                            <>
                                              Copiar
                                              <Copy className="h-3 w-3" />
                                            </>
                                          )}
                                        </button>
                                      </>
                                    ) : (
                                      <span className="text-[11px] text-gray-500 italic pr-2">Sem link</span>
                                    )}
                                  </div>
                                </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal: Lançar Fatura Avulsa */}
      {showAvulsaModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-gray-100 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white">Lançar Fatura Avulsa</h2>
              <button
                type="button"
                onClick={() => setShowAvulsaModal(false)}
                className="text-gray-400 hover:text-white transition text-lg"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {avulsaSuccessData ? (
                <div className="space-y-6 py-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-start gap-3">
                    <Check className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">Fatura(s) Avulsa(s) Gerada(s) com Sucesso!</p>
                      <p className="text-xs text-gray-400 mt-1">
                        A(s) cobrança(s) já constará(ão) na lista de faturamento do ministério.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {avulsaSuccessData.invoiceUrl && (
                      <>
                        <a
                          href={avulsaSuccessData.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-center font-semibold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                          Abrir 1ª fatura
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(avulsaSuccessData.invoiceUrl)
                            alert('Link copiado!')
                          }}
                          className="w-full py-3 bg-gray-800 hover:bg-gray-750 text-gray-100 rounded-lg text-center font-semibold text-sm transition border border-gray-700 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          Copiar link da 1ª fatura
                          <Copy className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAvulsaModal(false)
                      setAvulsaSuccessData(null)
                    }}
                    className="w-full py-2.5 bg-gray-800 hover:bg-gray-750 text-gray-300 rounded-lg text-center font-medium text-sm transition"
                  >
                    Fechar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreateAvulsaSubmit} className="space-y-4">
                  {/* Busca do Ministério */}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                      Ministério Destinatário (Tenant) *
                    </label>

                    {selectedMinistryId ? (
                      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-white block text-sm">
                            {ministries.find((m) => m.id === selectedMinistryId)?.name}
                          </span>
                          <span className="text-xs text-gray-400 block">
                            {ministries.find((m) => m.id === selectedMinistryId)?.email_admin}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedMinistryId('')}
                          className="text-xs text-rose-400 hover:text-rose-300 font-semibold transition"
                        >
                          Alterar
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                          <input
                            type="text"
                            placeholder="Buscar por nome ou e-mail..."
                            value={avulsaSearch}
                            onChange={(e) => setAvulsaSearch(e.target.value)}
                            className="w-full bg-gray-850 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="bg-gray-850 border border-gray-700 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-800">
                          {loadingMinistries ? (
                            <div className="p-3 text-center text-xs text-gray-500">Carregando ministérios...</div>
                          ) : ministries.length === 0 ? (
                            <div className="p-3 text-center text-xs text-gray-500">Nenhum ministério encontrado.</div>
                          ) : (
                            ministries
                              .filter(
                                (m) =>
                                  m.name.toLowerCase().includes(avulsaSearch.toLowerCase()) ||
                                  m.email_admin?.toLowerCase().includes(avulsaSearch.toLowerCase())
                              )
                              .slice(0, 15)
                              .map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => setSelectedMinistryId(m.id)}
                                  className="w-full p-3 text-left hover:bg-gray-800 transition flex flex-col cursor-pointer"
                                >
                                  <span className="font-medium text-gray-200 text-sm">{m.name}</span>
                                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                                    {m.email_admin}
                                  </span>
                                </button>
                              ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedMinistryId && (
                    <>
                      {/* Descrição */}
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                          Descrição da Cobrança *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Consultoria de Configurações, Migração Manual..."
                          value={avulsaDescription}
                          onChange={(e) => setAvulsaDescription(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      {/* Valor Total */}
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                          Valor Total da Cobrança (R$) *
                        </label>
                        <input
                          type="number"
                          required
                          step="0.01"
                          min="1"
                          placeholder="0,00"
                          value={avulsaAmount}
                          onChange={(e) => setAvulsaAmount(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      {/* Data de Vencimento */}
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                          Data de Vencimento da 1ª Parcela *
                        </label>
                        <input
                          type="date"
                          required
                          value={avulsaDueDate}
                          onChange={(e) => setAvulsaDueDate(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      {/* Parcelas */}
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                          Quantidade de Parcelas
                        </label>
                        <select
                          value={avulsaInstallments}
                          onChange={(e) => setAvulsaInstallments(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                            <option key={n} value={String(n)}>
                              {n === 1 ? '1x (À vista)' : `${n}x`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Resumo Financeiro */}
                      {avulsaAmount && Number(avulsaAmount) > 0 && (
                        <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 text-xs space-y-1">
                          <span className="font-semibold text-white block mb-1 text-[10px] uppercase tracking-wider">
                            Resumo das Parcelas
                          </span>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Total da Cobrança:</span>
                            <span className="text-gray-200 font-medium">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                Number(avulsaAmount)
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700/50 pt-2 text-sm">
                            <span className="text-gray-300 font-medium">
                              Valor por Parcela ({avulsaInstallments}x):
                            </span>
                            <span className="text-emerald-400 font-bold">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                Number(avulsaAmount) / Math.max(1, Number(avulsaInstallments))
                              )}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAvulsaModal(false)}
                          disabled={avulsaLoading}
                          className="flex-1 px-4 py-2.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-755 transition text-sm font-medium disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={avulsaLoading}
                          className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {avulsaLoading ? 'Processando...' : 'Lançar Cobrança'}
                        </button>
                      </div>
                    </>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
