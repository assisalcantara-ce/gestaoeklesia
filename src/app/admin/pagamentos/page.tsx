'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import AdminSidebar from '@/components/AdminSidebar'
import { temAcessoAdmin } from '@/lib/access-control'
import ExecutiveMetricCard from '@/components/dashboard/ExecutiveMetricCard'
import {
  Coins,
  Search,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Plus,
  BarChart3,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Ban,
  Trash2,
  RotateCcw,
  CreditCard,
  Filter,
  Zap,
  Settings,
  MessageCircle,
} from 'lucide-react'

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
  const [openMenuInvoiceId, setOpenMenuInvoiceId] = useState<string | null>(null)

  // Financeiro 2.1: Cancelamento e Exclusão Segura
  const [cancelingInvoice, setCancelingInvoice] = useState<BillingInvoice | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelingLoading, setCancelingLoading] = useState(false)
  const [deletingInvoice, setDeletingInvoice] = useState<BillingInvoice | null>(null)
  const [deletingLoading, setDeletingLoading] = useState(false)

  // Financeiro 2.2: Ações em Lote do Cliente e Wizard de Regeneração
  const [openMenuMinistryId, setOpenMenuMinistryId] = useState<string | null>(null)
  const [batchCancelMinistry, setBatchCancelMinistry] = useState<{ id: string; name: string } | null>(null)
  const [batchCancelReason, setBatchCancelReason] = useState('')
  const [batchCancelLoading, setBatchCancelLoading] = useState(false)

  const [batchDeleteMinistry, setBatchDeleteMinistry] = useState<{ id: string; name: string } | null>(null)
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false)

  // Wizard de Regeneração em 3 Passos
  const [wizardMinistry, setWizardMinistry] = useState<{ id: string; name: string } | null>(null)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1)
  const [wizardDueDay, setWizardDueDay] = useState<number>(10)
  const [wizardPendingAction, setWizardPendingAction] = useState<'cancel' | 'delete'>('cancel')
  const [wizardInstallments, setWizardInstallments] = useState<number>(12)
  const [wizardAmount, setWizardAmount] = useState<string>('')
  const [wizardLoading, setWizardLoading] = useState(false)
  const [waLoadingId, setWaLoadingId] = useState<string | null>(null)
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

  // Financeiro 2.1 — Cancelamento com motivo e registro de auditoria
  const handleCancelInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cancelingInvoice || !cancelReason.trim()) return

    try {
      setCancelingLoading(true)
      setError('')

      const response = await authenticatedFetch('/api/v1/admin/billing-invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: cancelingInvoice.id,
          action: 'cancel',
          cancel_reason: cancelReason,
        }),
      })

      if (!response.ok) {
        const resErr = await response.json()
        throw new Error(resErr.error || 'Erro ao cancelar cobrança')
      }

      setCancelingInvoice(null)
      setCancelReason('')
      await fetchInvoices()
    } catch (err: any) {
      setError(err.message || 'Erro ao cancelar cobrança.')
    } finally {
      setCancelingLoading(false)
    }
  }

  // Financeiro 2.1 — Reabertura de cobrança cancelada
  const handleReopenInvoice = async (invoiceId: string) => {
    try {
      setLoading(true)
      setError('')

      const response = await authenticatedFetch('/api/v1/admin/billing-invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: invoiceId,
          action: 'reopen',
        }),
      })

      if (!response.ok) {
        const resErr = await response.json()
        throw new Error(resErr.error || 'Erro ao reabrir cobrança')
      }

      await fetchInvoices()
    } catch (err: any) {
      setError(err.message || 'Erro ao reabrir cobrança.')
    } finally {
      setLoading(false)
    }
  }

  // Financeiro 2.1 — Exclusão permanente exclusiva para Super Admin
  const handleDeleteInvoiceSubmit = async () => {
    if (!deletingInvoice) return

    try {
      setDeletingLoading(true)
      setError('')

      const response = await authenticatedFetch(`/api/v1/admin/billing-invoices?id=${deletingInvoice.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const resErr = await response.json()
        throw new Error(resErr.error || 'Erro ao excluir cobrança')
      }

      setDeletingInvoice(null)
      await fetchInvoices()
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir cobrança.')
    } finally {
      setDeletingLoading(false)
    }
  }

  // Financeiro 2.2 — Cancelamento em Lote das Cobranças Pendentes de um Cliente
  const handleBatchCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!batchCancelMinistry || !batchCancelReason.trim()) return

    try {
      setBatchCancelLoading(true)
      setError('')

      const response = await authenticatedFetch('/api/v1/admin/billing/batch-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel_all_pending',
          ministry_id: batchCancelMinistry.id,
          cancel_reason: batchCancelReason,
        }),
      })

      if (!response.ok) {
        const resErr = await response.json()
        throw new Error(resErr.error || 'Erro ao cancelar cobranças em lote')
      }

      setBatchCancelMinistry(null)
      setBatchCancelReason('')
      await fetchInvoices()
    } catch (err: any) {
      setError(err.message || 'Erro no cancelamento em lote.')
    } finally {
      setBatchCancelLoading(false)
    }
  }

  // Financeiro 2.2 — Exclusão em Lote das Cobranças Pendentes (Super Admin)
  const handleBatchDeleteSubmit = async () => {
    if (!batchDeleteMinistry) return

    try {
      setBatchDeleteLoading(true)
      setError('')

      const response = await authenticatedFetch('/api/v1/admin/billing/batch-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_all_pending',
          ministry_id: batchDeleteMinistry.id,
        }),
      })

      if (!response.ok) {
        const resErr = await response.json()
        throw new Error(resErr.error || 'Erro ao excluir cobranças em lote')
      }

      setBatchDeleteMinistry(null)
      await fetchInvoices()
    } catch (err: any) {
      setError(err.message || 'Erro na exclusão em lote.')
    } finally {
      setBatchDeleteLoading(false)
    }
  }

  // Financeiro 2.2 — Wizard de Regeneração de Cobranças (Preserva Pagas)
  const handleWizardRegenerateSubmit = async () => {
    if (!wizardMinistry || !wizardAmount || Number(wizardAmount) <= 0) return

    try {
      setWizardLoading(true)
      setError('')

      const response = await authenticatedFetch('/api/v1/admin/billing/batch-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerate',
          ministry_id: wizardMinistry.id,
          new_due_day: wizardDueDay,
          pending_action: wizardPendingAction,
          new_installments_count: wizardInstallments,
          amount_per_installment: Number(wizardAmount),
        }),
      })

      if (!response.ok) {
        const resErr = await response.json()
        throw new Error(resErr.error || 'Erro ao regenerar cobranças')
      }

      setWizardMinistry(null)
      setWizardStep(1)
      await fetchInvoices()
    } catch (err: any) {
      setError(err.message || 'Erro ao regenerar cobranças.')
    } finally {
      setWizardLoading(false)
    }
  }

  // Financeiro 2.3 — Envio de Faturas via WhatsApp
  const handleSendWhatsApp = async (invoice: BillingInvoice) => {
    const statusLower = String(invoice.status || '').toLowerCase()
    if (statusLower === 'paid' || statusLower === 'pago' || statusLower === 'canceled' || statusLower === 'cancelada') {
      setError('Somente cobranças pendentes podem ser enviadas.')
      return
    }

    try {
      setWaLoadingId(invoice.id)
      setError('')

      const response = await authenticatedFetch('/api/v1/admin/billing/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoice.id }),
      })

      const resData = await response.json()
      if (!response.ok) {
        throw new Error(resData.error || 'Erro ao preparar mensagem de WhatsApp.')
      }

      if (resData.whatsapp_url) {
        window.open(resData.whatsapp_url, '_blank')
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar fatura via WhatsApp.')
    } finally {
      setWaLoadingId(null)
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

  // Agrupar faturas por ministério/tenant (Hook resiliente com fallback)
  const groupedInvoices = useMemo(() => {
    const list = invoices || []
    const groups: Record<string, { ministryName: string; invoices: BillingInvoice[] }> = {}
    for (const inv of list) {
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

  // Estatísticas financeiras (Hook resiliente com fallback zerado)
  const financialStats = useMemo(() => {
    const list = invoices || []
    const activeInvoices = list.filter((inv) => inv.status !== 'canceled' && inv.status !== 'cancelada')

    const previstaTotal = activeInvoices.reduce((acc, inv) => acc + (inv.amount || 0), 0)

    const recebidaTotal = activeInvoices
      .filter((inv) => inv.status === 'RECEIVED' || inv.status === 'CONFIRMED' || inv.status === 'paid' || inv.status === 'pago')
      .reduce((acc, inv) => acc + (inv.amount || 0), 0)

    const emAberto = activeInvoices.filter((inv) => inv.status === 'PENDING' || inv.status === 'pending').length
    const vencidas = activeInvoices.filter((inv) => inv.status === 'OVERDUE' || inv.status === 'overdue').length

    return {
      receitaPrevista:
        previstaTotal > 0
          ? `R$ ${((previstaTotal + recebidaTotal) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          : 'R$ 0,00',
      receitaRecebida:
        recebidaTotal > 0 ? `R$ ${(recebidaTotal / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00',
      cobrancasEmAberto: emAberto,
      faturasVencidas: vencidas,
    }
  }, [invoices])

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
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
      case 'canceled':
      case 'cancelada':
      case 'cancelado':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
            Cancelada
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

  // Cláusulas de Retorno Antecipado (apenas APÓS a execução incondicional de TODOS os Hooks)
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

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <AdminSidebar />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur px-8 py-6 sticky top-0 z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Coins className="text-blue-500 h-7 w-7" />
              Gestão Financeira da Plataforma
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Gerencie a receita, faturas e lançamentos financeiros de todos os clientes.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin/pagamentos/relatorios')}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 hover:border-gray-600 px-4 py-2.5 rounded-lg text-sm font-semibold transition"
            >
              <BarChart3 className="h-4 w-4 text-blue-400" />
              📊 Relatórios
            </button>

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

          {/* Painel Executivo Financeiro 2.0 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ExecutiveMetricCard
              title="Receita Prevista"
              value={financialStats.receitaPrevista}
              subtitle="Faturamento projetado"
              icon={TrendingUp}
              color="blue"
            />

            <ExecutiveMetricCard
              title="Receita Recebida"
              value={financialStats.receitaRecebida}
              subtitle="Pagamentos confirmados"
              icon={ShieldCheck}
              color="emerald"
            />

            <ExecutiveMetricCard
              title="Cobranças em Aberto"
              value={financialStats.cobrancasEmAberto}
              subtitle="Aguardando pagamento"
              icon={CreditCard}
              color="amber"
            />

            <ExecutiveMetricCard
              title="Faturas Vencidas"
              value={financialStats.faturasVencidas}
              subtitle="Prazo expirado no Asaas"
              icon={AlertCircle}
              color="rose"
            />
          </div>

          {/* Filtros */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-blue-500" />
              <span className="font-semibold text-sm text-gray-300">Filtrar por Status:</span>
            </div>
            <div className="flex gap-2">
              {['all', 'pending', 'paid', 'overdue', 'canceled'].map((status) => (
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
                  {status === 'canceled' && 'Canceladas'}
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
                    className="border border-gray-800 rounded-xl bg-gray-900/50 backdrop-blur shadow-xl transition-all relative z-10 hover:z-20"
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

                      <div className="flex items-center gap-3">
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

                        {/* Menu de Ações em Lote do Cliente (Financeiro 2.2) */}
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setOpenMenuMinistryId(openMenuMinistryId === group.ministryId ? null : group.ministryId)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                          >
                            <Settings className="h-3.5 w-3.5 text-blue-400" />
                            Ações do Cliente
                            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                          </button>

                          {openMenuMinistryId === group.ministryId && (
                            <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl py-1 z-50 text-left">
                              <button
                                onClick={() => {
                                  setWizardMinistry({ id: group.ministryId, name: group.ministryName })
                                  setWizardStep(1)
                                  const paidCount = group.invoices.filter((i) => i.status === 'paid' || i.status === 'pago').length
                                  const remaining = Math.max(1, 12 - paidCount)
                                  setWizardInstallments(remaining)
                                  setWizardAmount(group.invoices[0] ? String(group.invoices[0].amount) : '15000')
                                  setOpenMenuMinistryId(null)
                                }}
                                className="w-full px-4 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-950/40 flex items-center gap-2 transition"
                              >
                                <Zap className="h-3.5 w-3.5" />
                                ⚡ Regenerar Cobranças
                              </button>

                              <button
                                onClick={() => {
                                  setBatchCancelMinistry({ id: group.ministryId, name: group.ministryName })
                                  setBatchCancelReason('')
                                  setOpenMenuMinistryId(null)
                                }}
                                className="w-full px-4 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-950/40 flex items-center gap-2 transition"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                Cancelar Pendentes
                              </button>

                              {adminUser?.role === 'admin' && (
                                <button
                                  onClick={() => {
                                    setBatchDeleteMinistry({ id: group.ministryId, name: group.ministryName })
                                    setOpenMenuMinistryId(null)
                                  }}
                                  className="w-full px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 transition border-t border-gray-800/80 mt-1"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Excluir Pendentes
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="overflow-hidden rounded-b-xl border-t border-gray-800">
                        {/* Resumo Financeiro Executivo do Cliente */}
                        {(() => {
                          const clienteAberto = group.invoices
                            .filter((i) => i.status === 'PENDING' || i.status === 'pending' || i.status === 'OVERDUE' || i.status === 'overdue')
                            .reduce((sum, i) => sum + (i.amount || 0), 0);

                          const clienteRecebido = group.invoices
                            .filter((i) => i.status === 'RECEIVED' || i.status === 'paid' || i.status === 'CONFIRMED' || i.status === 'pago')
                            .reduce((sum, i) => sum + (i.amount || 0), 0);

                          const pendentesComData = group.invoices
                            .filter((i) => (i.status === 'PENDING' || i.status === 'pending' || i.status === 'OVERDUE' || i.status === 'overdue') && i.due_date)
                            .map((i) => new Date(i.due_date!).getTime());

                          const menorVencimento = pendentesComData.length > 0 ? new Date(Math.min(...pendentesComData)) : null;
                          const proximoVencimentoFormatted = menorVencimento ? menorVencimento.toLocaleDateString('pt-BR') : '—';

                          return (
                            <div className="bg-gray-900/90 border-b border-gray-800/80 px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div className="bg-gray-950/70 p-2.5 rounded-lg border border-gray-800/80">
                                <span className="text-gray-400 font-medium text-[11px] block">Total em Aberto</span>
                                <span className="text-amber-400 font-bold text-sm mt-0.5 block">{formatCurrency(clienteAberto)}</span>
                              </div>

                              <div className="bg-gray-950/70 p-2.5 rounded-lg border border-gray-800/80">
                                <span className="text-gray-400 font-medium text-[11px] block">Valor Recebido</span>
                                <span className="text-emerald-400 font-bold text-sm mt-0.5 block">{formatCurrency(clienteRecebido)}</span>
                              </div>

                              <div className="bg-gray-950/70 p-2.5 rounded-lg border border-gray-800/80">
                                <span className="text-gray-400 font-medium text-[11px] block">Faturas Emitidas</span>
                                <span className="text-white font-bold text-sm mt-0.5 block">{group.invoices.length} fatura{group.invoices.length !== 1 ? 's' : ''}</span>
                              </div>

                              <div className="bg-gray-950/70 p-2.5 rounded-lg border border-gray-800/80">
                                <span className="text-gray-400 font-medium text-[11px] block">Próximo Vencimento</span>
                                <span className="text-blue-400 font-bold text-sm mt-0.5 block">{proximoVencimentoFormatted}</span>
                              </div>
                            </div>
                          )
                        })()}

                        <div className="overflow-x-auto bg-gray-950/30">
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
                            {group.invoices.map((inv) => (
                              <tr
                                key={inv.id}
                                className={
                                  inv.status === 'overdue' || inv.status === 'vencido'
                                    ? "bg-rose-900/10 border-l-2 border-l-rose-500 hover:bg-rose-900/15 transition"
                                    : inv.status === 'pending' || inv.status === 'pendente'
                                    ? "bg-amber-900/5 border-l-2 border-l-amber-500 hover:bg-amber-900/10 transition"
                                    : "hover:bg-gray-800/20 transition"
                                }
                              >
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
                                <td className="px-6 py-3.5 text-right relative">
                                  <div className="flex justify-end items-center gap-1.5">
                                    {/* Botão Enviar WhatsApp na linha (Financeiro 2.3) */}
                                    <button
                                      onClick={() => handleSendWhatsApp(inv)}
                                      disabled={inv.status === 'paid' || inv.status === 'pago' || inv.status === 'canceled' || inv.status === 'cancelada' || waLoadingId === inv.id}
                                      title={
                                        inv.status === 'paid' || inv.status === 'pago' || inv.status === 'canceled' || inv.status === 'cancelada'
                                          ? 'Somente cobranças pendentes podem ser enviadas.'
                                          : 'Enviar cobrança via WhatsApp'
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded text-[11px] font-semibold transition cursor-pointer disabled:cursor-not-allowed border border-emerald-500/30"
                                    >
                                      <MessageCircle className="h-3 w-3" />
                                      📲 Enviar WhatsApp
                                    </button>

                                    {inv.asaas_invoice_url && (
                                      <a
                                        href={inv.asaas_invoice_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium transition cursor-pointer"
                                      >
                                        Abrir
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}

                                    {/* Menu de Ações (⋮) */}
                                    <div className="relative">
                                      <button
                                        onClick={() => setOpenMenuInvoiceId(openMenuInvoiceId === inv.id ? null : inv.id)}
                                        className="p-1.5 text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg transition cursor-pointer"
                                        title="Mais opções"
                                      >
                                        <MoreVertical className="h-3.5 w-3.5" />
                                      </button>

                                      {openMenuInvoiceId === inv.id && (
                                        <div className="absolute right-0 mt-1 w-52 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl py-1 z-30 text-left">
                                          {/* Opção WhatsApp no Menu (Financeiro 2.3) */}
                                          <button
                                            onClick={() => {
                                              handleSendWhatsApp(inv)
                                              setOpenMenuInvoiceId(null)
                                            }}
                                            disabled={inv.status === 'paid' || inv.status === 'pago' || inv.status === 'canceled' || inv.status === 'cancelada'}
                                            title={
                                              inv.status === 'paid' || inv.status === 'pago' || inv.status === 'canceled' || inv.status === 'cancelada'
                                                ? 'Somente cobranças pendentes podem ser enviadas.'
                                                : 'Enviar cobrança via WhatsApp'
                                            }
                                            className="w-full px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-950/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition"
                                          >
                                            <MessageCircle className="h-3.5 w-3.5" />
                                            📲 Enviar via WhatsApp
                                          </button>

                                          {inv.asaas_invoice_url && (
                                            <button
                                              onClick={() => {
                                                handleCopyLink(inv.asaas_invoice_url!, inv.id)
                                                setOpenMenuInvoiceId(null)
                                              }}
                                              className="w-full px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800 flex items-center gap-2 transition"
                                            >
                                              <Copy className="h-3.5 w-3.5 text-blue-400" />
                                              {copiedId === inv.id ? 'Copiado!' : 'Copiar Link'}
                                            </button>
                                          )}

                                          {inv.status !== 'paid' && inv.status !== 'canceled' && (
                                            <button
                                              onClick={() => {
                                                handleMarkAsPaid(inv.id)
                                                setOpenMenuInvoiceId(null)
                                              }}
                                              className="w-full px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-950/40 flex items-center gap-2 transition"
                                            >
                                              <Check className="h-3.5 w-3.5" />
                                              Marcar como Pago
                                            </button>
                                          )}

                                          {inv.status !== 'canceled' ? (
                                            <button
                                              onClick={() => {
                                                setCancelingInvoice(inv)
                                                setCancelReason('')
                                                setOpenMenuInvoiceId(null)
                                              }}
                                              className="w-full px-4 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-950/40 flex items-center gap-2 transition"
                                            >
                                              <Ban className="h-3.5 w-3.5" />
                                              Cancelar Cobrança
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => {
                                                handleReopenInvoice(inv.id)
                                                setOpenMenuInvoiceId(null)
                                              }}
                                              className="w-full px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-950/40 flex items-center gap-2 transition"
                                            >
                                              <RotateCcw className="h-3.5 w-3.5" />
                                              Reabrir Cobrança
                                            </button>
                                          )}

                                          {/* Exclusão Permanente — Apenas Super Admin */}
                                          {adminUser?.role === 'admin' && (
                                            <button
                                              onClick={() => {
                                                setDeletingInvoice(inv)
                                                setOpenMenuInvoiceId(null)
                                              }}
                                              className="w-full px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 transition border-t border-gray-800/80 mt-1"
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                              Excluir Permanentemente
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
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
      {/* Modal: Cancelamento de Cobrança (Financeiro 2.1) */}
      {cancelingInvoice && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 text-gray-100 space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <Ban className="h-6 w-6" />
              <h3 className="text-lg font-bold text-white">Cancelar Cobrança</h3>
            </div>

            <p className="text-xs text-gray-300">
              A cobrança do plano <span className="font-mono text-blue-400">{cancelingInvoice.plano_slug}</span> de valor{' '}
              <span className="font-bold text-white">{formatCurrency(cancelingInvoice.amount)}</span> será removida dos totais em aberto.
            </p>

            <form onSubmit={handleCancelInvoiceSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                  Motivo do Cancelamento *
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Informe o motivo do cancelamento para fins de auditoria..."
                  required
                  rows={3}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCancelingInvoice(null)
                    setCancelReason('')
                  }}
                  disabled={cancelingLoading}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={cancelingLoading || !cancelReason.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {cancelingLoading ? 'Cancelando...' : 'Confirmar Cancelamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Exclusão Permanente de Cobrança - Super Admin (Financeiro 2.1) */}
      {deletingInvoice && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-gray-900 border border-red-800/60 rounded-2xl shadow-2xl max-w-md w-full p-6 text-gray-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <AlertCircle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-white">Exclusão Permanente de Cobrança</h3>
            </div>

            <div className="bg-rose-950/40 border border-rose-800/50 rounded-xl p-3 text-xs text-rose-200 space-y-1">
              <p className="font-bold">⚠️ ATENÇÃO: AÇÃO IRREVERSÍVEL!</p>
              <p>Esta cobrança será removida fisicamente do banco de dados e todos os seus registros associados serão apagados.</p>
            </div>

            <p className="text-xs text-gray-300">
              Fatura do plano <span className="font-mono text-blue-400">{deletingInvoice.plano_slug}</span> de valor{' '}
              <span className="font-bold text-white">{formatCurrency(deletingInvoice.amount)}</span>.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingInvoice(null)}
                disabled={deletingLoading}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteInvoiceSubmit}
                disabled={deletingLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                {deletingLoading ? 'Excluindo...' : 'Excluir Permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cancelar Cobranças Pendentes em Lote (Financeiro 2.2) */}
      {batchCancelMinistry && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 text-gray-100 space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <Ban className="h-6 w-6" />
              <h3 className="text-lg font-bold text-white">Cancelar Pendentes em Lote</h3>
            </div>

            <p className="text-xs text-gray-300">
              Todas as cobranças <span className="font-semibold text-amber-400">pendentes e vencidas</span> de{' '}
              <span className="font-bold text-white">{batchCancelMinistry.name}</span> serão canceladas e removidas dos totais em aberto.
            </p>

            <form onSubmit={handleBatchCancelSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                  Motivo do Cancelamento em Lote *
                </label>
                <textarea
                  value={batchCancelReason}
                  onChange={(e) => setBatchCancelReason(e.target.value)}
                  placeholder="Informe a razão do cancelamento das cobranças pendentes..."
                  required
                  rows={3}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setBatchCancelMinistry(null)
                    setBatchCancelReason('')
                  }}
                  disabled={batchCancelLoading}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={batchCancelLoading || !batchCancelReason.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {batchCancelLoading ? 'Cancelando...' : 'Confirmar Cancelamento em Lote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Excluir Cobranças Pendentes em Lote - Super Admin (Financeiro 2.2) */}
      {batchDeleteMinistry && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-gray-900 border border-red-800/60 rounded-2xl shadow-2xl max-w-md w-full p-6 text-gray-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <AlertCircle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-white">Excluir Pendentes em Lote</h3>
            </div>

            <div className="bg-rose-950/40 border border-rose-800/50 rounded-xl p-3 text-xs text-rose-200 space-y-1">
              <p className="font-bold">⚠️ ATENÇÃO: EXCLUSÃO PERMANENTE</p>
              <p>Todas as cobranças pendentes de <span className="font-bold">{batchDeleteMinistry.name}</span> serão excluídas fisicamente.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBatchDeleteMinistry(null)}
                disabled={batchDeleteLoading}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBatchDeleteSubmit}
                disabled={batchDeleteLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                {batchDeleteLoading ? 'Excluindo...' : 'Excluir Pendentes em Lote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wizard de Regeneração de Cobranças em 3 Passos (Financeiro 2.2) */}
      {wizardMinistry && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-gray-100 space-y-6">
            {/* Header do Wizard */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center gap-3 text-blue-400">
                <Zap className="h-6 w-6" />
                <div>
                  <h3 className="text-lg font-bold text-white">Regenerar Cobranças</h3>
                  <p className="text-xs text-gray-400">{wizardMinistry.name}</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-blue-950 border border-blue-800 text-blue-300 rounded-full text-xs font-bold font-mono">
                Passo {wizardStep} de 3
              </span>
            </div>

            {/* Passo 1: Selecionar Novo Dia de Vencimento */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white">Passo 1: Novo Dia de Vencimento</h4>
                <p className="text-xs text-gray-300">
                  Informe em qual dia do mês as parcelas futuras deverão vencer.
                </p>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                    Dia do Vencimento (1 a 31)
                  </label>
                  <select
                    value={wizardDueDay}
                    onChange={(e) => setWizardDueDay(Number(e.target.value))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        Dia {day} de cada mês
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-between pt-4 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setWizardMinistry(null)}
                    className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold"
                  >
                    Próximo: Tratamento das Pendentes →
                  </button>
                </div>
              </div>
            )}

            {/* Passo 2: Escolher Tratamento das Pendentes Existentes */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white">Passo 2: O que fazer com as cobranças pendentes atuais?</h4>
                <p className="text-xs text-gray-300">
                  Escolha como deseja tratar as cobranças em aberto atuais antes de gerar as novas parcelas.
                </p>

                <div className="space-y-3">
                  <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${
                    wizardPendingAction === 'cancel'
                      ? 'bg-blue-950/40 border-blue-500/60 text-white'
                      : 'bg-gray-950 border-gray-800 text-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="wizardPendingAction"
                      checked={wizardPendingAction === 'cancel'}
                      onChange={() => setWizardPendingAction('cancel')}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="font-bold text-xs block text-white">Cancelar pendentes (Recomendado)</span>
                      <span className="text-[11px] text-gray-400 block mt-0.5">
                        Altera o status das cobranças em aberto para "Canceladas", mantendo-as visíveis no histórico para auditoria.
                      </span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${
                    wizardPendingAction === 'delete'
                      ? 'bg-rose-950/40 border-rose-500/60 text-white'
                      : 'bg-gray-950 border-gray-800 text-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="wizardPendingAction"
                      checked={wizardPendingAction === 'delete'}
                      onChange={() => setWizardPendingAction('delete')}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="font-bold text-xs block text-white">Excluir pendentes</span>
                      <span className="text-[11px] text-gray-400 block mt-0.5">
                        Remove fisicamente do banco de dados as cobranças não pagas atuais.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="flex justify-between pt-4 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs font-semibold"
                  >
                    ← Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold"
                  >
                    Próximo: Resumo das Parcelas →
                  </button>
                </div>
              </div>
            )}

            {/* Passo 3: Resumo e Confirmação das Novas Parcelas */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white">Passo 3: Resumo e Confirmação</h4>

                <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3 text-xs text-emerald-300 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 shrink-0" />
                  <span>Cobranças já <strong>pagas</strong> serão preservadas 100% intactas sem qualquer alteração.</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-gray-400 block mb-1">Novas Parcelas</label>
                    <select
                      value={wizardInstallments}
                      onChange={(e) => setWizardInstallments(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                        <option key={n} value={n}>{n} parcelas</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-gray-400 block mb-1">Valor por Parcela (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={wizardAmount}
                      onChange={(e) => setWizardAmount(e.target.value)}
                      placeholder="150.00"
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>

                <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs space-y-1 text-gray-300">
                  <div className="flex justify-between">
                    <span>Novo Dia do Vencimento:</span>
                    <span className="font-bold text-white">Dia {wizardDueDay} de cada mês</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ação nas Pendentes Atuais:</span>
                    <span className="font-bold text-amber-400">{wizardPendingAction === 'cancel' ? 'Cancelar' : 'Excluir'}</span>
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    disabled={wizardLoading}
                    className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    ← Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleWizardRegenerateSubmit}
                    disabled={wizardLoading || !wizardAmount || Number(wizardAmount) <= 0}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-600/25 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {wizardLoading ? 'Regenerando...' : '⚡ Confirmar e Regenerar Cobranças'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
