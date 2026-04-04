'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import AdminSidebar from '@/components/AdminSidebar'
import type { Payment, SubscriptionPlan } from '@/types/admin'
import type { Ministry } from '@/types/supabase'
import { CheckCircle2, FileText, Info, Trash2 } from 'lucide-react'

export default function PagamentosPage() {
  const { isLoading, isAuthenticated } = useAdminAuth()
  const [pagamentos, setPagamentos] = useState<Payment[]>([])
  const [ministerios, setMinisterios] = useState<Ministry[]>([])
  const [ministeriosLoading, setMinisteriosLoading] = useState(false)
  const [planos, setPlanos] = useState<SubscriptionPlan[]>([])
  const [planosLoading, setPlanosLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formTab, setFormTab] = useState<'lote' | 'avulso'>('lote')
  const [submittingAvulso, setSubmittingAvulso] = useState(false)
  const [manualModal, setManualModal] = useState({
    isOpen: false,
    paymentId: '',
    note: 'Recebido em mãos',
    isAsaas: true,
  })
  const [detailsModal, setDetailsModal] = useState<{ isOpen: boolean; payment: Payment | null }>(
    { isOpen: false, payment: null }
  )
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; payment: Payment | null; deleting: boolean }>(
    { isOpen: false, payment: null, deleting: false }
  )
  const [filter, setFilter] = useState<string>('all')
  const [filters, setFilters] = useState({
    ministry_id: '',
    due_from: '',
    due_to: '',
    origin: 'all',
    status: 'all',
  })
  const [ministrySearch, setMinistrySearch] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const router = useRouter()

  const [formData, setFormData] = useState({
    ministry_id: '',
    subscription_plan_id: '',
    amount: '',
    due_date: '',
    description: '',
    payment_method: 'pix',
    installments: '1',
    create_asaas: true,
  })
  const [avulsoForm, setAvulsoForm] = useState({
    ministry_id: '',
    subscription_plan_id: '',
    amount: '',
    due_date: '',
    description: '',
    payment_method: 'pix',
    create_asaas: true,
  })

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      fetchPagamentos()
      fetchMinisterios()
      fetchPlanos()
    }
  }, [page, filter, filters, isAuthenticated])

  const fetchMinisterios = async () => {
    try {
      setMinisteriosLoading(true)
      const response = await authenticatedFetch('/api/v1/admin/ministries')
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push('/admin/login')
          return
        }
        throw new Error('Erro ao carregar instituições')
      }

      const data = await response.json()
      setMinisterios(data.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setMinisteriosLoading(false)
    }
  }

  const fetchPlanos = async () => {
    try {
      setPlanosLoading(true)
      const response = await authenticatedFetch('/api/v1/admin/plans')
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push('/admin/login')
          return
        }
        throw new Error('Erro ao carregar planos')
      }

      const data = await response.json()
      setPlanos(data.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setPlanosLoading(false)
    }
  }

  const fetchPagamentos = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      })
      if (filters.ministry_id) params.append('ministry_id', filters.ministry_id)
      if (filters.due_from) params.append('due_from', filters.due_from)
      if (filters.due_to) params.append('due_to', filters.due_to)
      if (filters.origin !== 'all') params.append('origin', filters.origin)
      if (filters.status !== 'all') params.append('status_in', filters.status)

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
      setTotalPages(data.total_pages || 1)
      setTotalCount(data.count || 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setFilters({
      ministry_id: '',
      due_from: '',
      due_to: '',
      origin: 'all',
      status: 'all',
    })
    setMinistrySearch('')
    setPage(1)
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
          subscription_plan_id: formData.subscription_plan_id || null,
          amount: parseFloat(formData.amount),
          installments: parseInt(formData.installments || '1'),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar pagamento')
      }

      setSuccess('Pagamento criado com sucesso!')
      setFormData({
        ministry_id: '',
        subscription_plan_id: '',
        amount: '',
        due_date: '',
        description: '',
        payment_method: 'pix',
        installments: '1',
        create_asaas: true,
      })
      setShowForm(false)
      fetchPagamentos()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleSubmitAvulso = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingAvulso) return
    setError('')
    setSuccess('')
    setSubmittingAvulso(true)

    try {
      const response = await authenticatedFetch('/api/v1/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...avulsoForm,
          subscription_plan_id: avulsoForm.subscription_plan_id || null,
          amount: parseFloat(avulsoForm.amount),
          installments: 1,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar pagamento avulso')
      }

      setSuccess('Pagamento avulso criado com sucesso!')
      setAvulsoForm({
        ministry_id: '',
        subscription_plan_id: '',
        amount: '',
        due_date: '',
        description: '',
        payment_method: 'pix',
        create_asaas: true,
      })
      setShowForm(false)
      fetchPagamentos()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmittingAvulso(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-900 text-green-200 border border-green-700'
      case 'pending':
        return 'bg-yellow-900 text-yellow-200 border border-yellow-700'
      case 'overdue':
        return 'bg-red-900 text-red-200 border border-red-700'
      case 'cancelled':
        return 'bg-gray-800 text-gray-300 border border-gray-700'
      default:
        return 'bg-blue-900 text-blue-200 border border-blue-700'
    }
  }

  const handleManualSettlement = async () => {
    try {
      const response = await authenticatedFetch('/api/v1/admin/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: manualModal.paymentId,
          manual_note: manualModal.note,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao dar baixa manual')
      }

      setSuccess('Baixa manual registrada com sucesso!')
      setManualModal({ isOpen: false, paymentId: '', note: 'Recebido em mãos', isAsaas: true })
      fetchPagamentos()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDeletePayment = async () => {
    if (!deleteModal.payment) return
    setDeleteModal(prev => ({ ...prev, deleting: true }))
    try {
      const response = await authenticatedFetch('/api/v1/admin/payments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: deleteModal.payment.id }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Erro ao excluir cobrança')
      }

      setSuccess('Cobrança excluída com sucesso!')
      setDeleteModal({ isOpen: false, payment: null, deleting: false })
      fetchPagamentos()
    } catch (err: any) {
      setError(err.message)
      setDeleteModal(prev => ({ ...prev, deleting: false }))
    }
  }

  const handlePrintReceipt = (payment: Payment) => {
    const ministry = (payment as any).ministries || {}
    const ministryName = ministry.name || payment.ministry_id
    const planName = (payment as any).subscription_plans?.name || '-'
    const dueDate = new Date(payment.due_date).toLocaleDateString('pt-BR')
    const paidDate = payment.payment_date
      ? new Date(payment.payment_date).toLocaleDateString('pt-BR')
      : '-'

    const addressParts = [
      ministry.address_street,
      ministry.address_number,
      ministry.address_city,
      ministry.address_state,
      ministry.address_zip,
    ].filter(Boolean)
    const address = addressParts.join(', ')

    const logoHtml = ministry.logo_url
      ? `<img src="${ministry.logo_url}" alt="Logo" style="width:80px;height:80px;object-fit:contain;" />`
      : ''

    const html = `
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Recibo de Pagamento</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            .header { display: flex; align-items: flex-start; gap: 18px; border-bottom: 2px solid #003d7a; padding-bottom: 14px; margin-bottom: 20px; }
            .header-logo { flex-shrink: 0; }
            .header-info { flex: 1; }
            .header-info .nome { font-size: 14px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
            .header-info .detalhe { font-size: 11px; color: #444; line-height: 1.6; }
            h1 { font-size: 16px; margin-bottom: 12px; font-weight: bold; }
            .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
            .row { display: flex; justify-content: space-between; margin: 6px 0; }
            .label { color: #64748b; }
            .value { font-weight: 600; }
            .footer { margin-top: 24px; font-size: 10px; color: #999; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-logo">${logoHtml}</div>
            <div class="header-info">
              <div class="nome">${ministryName}</div>
              ${address ? `<div class="detalhe">${address}</div>` : ''}
              ${ministry.email_admin ? `<div class="detalhe">Email: ${ministry.email_admin}</div>` : ''}
              ${ministry.cnpj_cpf ? `<div class="detalhe">CNPJ: ${ministry.cnpj_cpf}</div>` : ''}
              ${ministry.phone ? `<div class="detalhe">Tel: ${ministry.phone}</div>` : ''}
            </div>
          </div>
          <h1>Recibo de Pagamento</h1>
          <div class="box">
            <div class="row"><span class="label">Instituição</span><span class="value">${ministryName}</span></div>
            <div class="row"><span class="label">Plano</span><span class="value">${planName}</span></div>
            <div class="row"><span class="label">Valor</span><span class="value">R$ ${payment.amount.toFixed(2)}</span></div>
            <div class="row"><span class="label">Vencimento</span><span class="value">${dueDate}</span></div>
            <div class="row"><span class="label">Pagamento</span><span class="value">${paidDate}</span></div>
            <div class="row"><span class="label">Status</span><span class="value">${payment.status}</span></div>
            <div class="row"><span class="label">Método</span><span class="value">${payment.payment_method || '-'}</span></div>
          </div>
          <div class="footer">Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</div>
        </body>
      </html>
    `

    const win = window.open('', '_blank', 'width=720,height=720')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 z-10">
          <h2 className="text-2xl font-bold text-white">PAINEL ADMINISTRATIVO: PAGAMENTOS</h2>
          <p className="text-gray-400 text-sm mt-1">Controle de cobranças e recebimentos</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="max-w-7xl mx-auto">
            {error && (
              <div className="bg-red-900 border border-red-700 text-red-200 p-4 rounded mb-6">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-900 border border-green-700 text-green-200 p-4 rounded mb-6">
                {success}
              </div>
            )}

            <div className="mb-6 flex flex-wrap gap-4 items-center">
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value)
                  setPage(1)
                }}
                className="px-4 py-2 border border-gray-700 rounded-lg bg-gray-900 text-gray-100"
              >
                <option value="all">Todos os Status</option>
                <option value="pending">Pendentes</option>
                <option value="paid">Pagos</option>
                <option value="overdue">Vencidos</option>
                <option value="cancelled">Cancelados</option>
              </select>

              <button
                onClick={() => setShowForm(!showForm)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {showForm ? 'Fechar formulário' : '+ Novo Pagamento'}
              </button>

              <button
                type="button"
                onClick={() => fetchPagamentos()}
                className="ml-auto px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-400"
              >
                Atualizar
              </button>
            </div>

            {!showForm && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6 mb-6 text-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Busca / Filtro</h3>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-3 py-1 rounded-lg border border-gray-600 text-gray-200 hover:text-white hover:border-gray-400"
                >
                  Limpar
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Instituição</label>
                  <input
                    type="text"
                    value={ministrySearch}
                    onChange={(e) => {
                      setMinistrySearch(e.target.value)
                      if (e.target.value.length < 3) {
                        setFilters({ ...filters, ministry_id: '' })
                      }
                    }}
                    placeholder="Digite ao menos 3 letras"
                    className="w-full px-4 py-2 border rounded-lg bg-gray-900 border-gray-700"
                  />
                  {ministrySearch.length >= 3 && (
                    <div className="absolute z-20 mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 shadow-lg max-h-56 overflow-auto">
                      {ministeriosLoading && (
                        <div className="px-4 py-2 text-sm text-gray-400">Carregando instituições...</div>
                      )}
                      {!ministeriosLoading && ministerios
                        .filter((m) => m.name.toLowerCase().includes(ministrySearch.toLowerCase()))
                        .slice(0, 10)
                        .map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setFilters({ ...filters, ministry_id: m.id })
                              setMinistrySearch(m.name)
                              setPage(1)
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-800"
                          >
                            {m.name}
                          </button>
                        ))}
                      {!ministeriosLoading && ministerios
                        .filter((m) => m.name.toLowerCase().includes(ministrySearch.toLowerCase())).length === 0 && (
                          <div className="px-4 py-2 text-sm text-gray-400">Nenhum resultado</div>
                        )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Vencimento (início)</label>
                  <input
                    type="date"
                    value={filters.due_from}
                    onChange={(e) => {
                      setFilters({ ...filters, due_from: e.target.value })
                      setPage(1)
                    }}
                    className="w-full px-4 py-2 border rounded-lg bg-gray-900 border-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Vencimento (fim)</label>
                  <input
                    type="date"
                    value={filters.due_to}
                    onChange={(e) => {
                      setFilters({ ...filters, due_to: e.target.value })
                      setPage(1)
                    }}
                    className="w-full px-4 py-2 border rounded-lg bg-gray-900 border-gray-700"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Origem</label>
                  <select
                    value={filters.origin}
                    onChange={(e) => {
                      setFilters({ ...filters, origin: e.target.value })
                      setPage(1)
                    }}
                    className="w-full px-4 py-2 border rounded-lg bg-gray-900 border-gray-700"
                  >
                    <option value="all">Todas</option>
                    <option value="manual">Avulso</option>
                    <option value="asaas">Asaas</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => {
                      setFilters({ ...filters, status: e.target.value })
                      setPage(1)
                    }}
                    className="w-full px-4 py-2 border rounded-lg bg-gray-900 border-gray-700"
                  >
                    <option value="all">Todos</option>
                    <option value="paid">Pago</option>
                    <option value="pending">Pendente</option>
                  </select>
                </div>
              </div>
            </div>
            )}

            {showForm && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6 mb-6 text-gray-100">
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <h2 className="text-xl font-bold mr-2">Novo Pagamento</h2>
                  <button
                    type="button"
                    onClick={() => setFormTab('lote')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                      formTab === 'lote'
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-transparent border-gray-600 text-gray-300'
                    }`}
                  >
                    Lote
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTab('avulso')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                      formTab === 'avulso'
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-transparent border-gray-600 text-gray-300'
                    }`}
                  >
                    Avulso
                  </button>
                </div>
                {formTab === 'lote' && (
                <form
                  onSubmit={handleSubmit}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 [&_input]:bg-gray-900 [&_input]:border-gray-700 [&_input]:text-gray-100 [&_input]:placeholder:text-gray-500 [&_select]:bg-gray-900 [&_select]:border-gray-700 [&_select]:text-gray-100"
                >
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Instituição</label>
                    <select
                      value={formData.ministry_id}
                      onChange={(e) => setFormData({ ...formData, ministry_id: e.target.value })}
                      required
                      className="w-full px-4 py-2 border rounded-lg"
                    >
                      <option value="">Selecione a instituição...</option>
                      {ministeriosLoading && (
                        <option value="" disabled>Carregando instituições...</option>
                      )}
                      {!ministeriosLoading && ministerios.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Plano</label>
                    <select
                      value={formData.subscription_plan_id}
                      onChange={(e) => {
                        const nextPlanId = e.target.value
                        const selectedPlan = planos.find((plano) => plano.id === nextPlanId)
                        setFormData({
                          ...formData,
                          subscription_plan_id: nextPlanId,
                          amount: selectedPlan ? String(selectedPlan.price_monthly) : formData.amount,
                        })
                      }}
                      required={formData.create_asaas}
                      className="w-full px-4 py-2 border rounded-lg"
                    >
                      <option value="">Selecione o plano...</option>
                      {planosLoading && (
                        <option value="" disabled>Carregando planos...</option>
                      )}
                      {!planosLoading && planos.map((plano) => (
                        <option key={plano.id} value={plano.id}>
                          {plano.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Vencimento</label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      required
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Parcelas</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="1"
                      value={formData.installments}
                      onChange={(e) => setFormData({ ...formData, installments: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Método</label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                    >
                      <option value="pix">PIX</option>
                      <option value="boleto">Boleto</option>
                      <option value="credit_card">Cartão de Crédito</option>
                      <option value="bank_transfer">Transferência Bancária</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Descrição (opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: Ordem de serviço anual"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>

                  <label className="md:col-span-2 flex items-center gap-3 text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={!formData.create_asaas}
                      onChange={(e) => setFormData({ ...formData, create_asaas: !e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    Pagamento em mãos (não enviar para o ASAAS)
                  </label>

                  <button
                    type="submit"
                    className="md:col-span-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Criar Pagamento
                  </button>
                </form>
                )}
              </div>
            )}

            {showForm && formTab === 'avulso' && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6 mb-6 text-gray-100">
                <h2 className="text-xl font-bold mb-4">Pagamento Avulso</h2>
                <form
                  onSubmit={handleSubmitAvulso}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 [&_input]:bg-gray-900 [&_input]:border-gray-700 [&_input]:text-gray-100 [&_input]:placeholder:text-gray-500 [&_select]:bg-gray-900 [&_select]:border-gray-700 [&_select]:text-gray-100"
                >
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Instituição</label>
                    <select
                      value={avulsoForm.ministry_id}
                      onChange={(e) => setAvulsoForm({ ...avulsoForm, ministry_id: e.target.value })}
                      required
                      className="w-full px-4 py-2 border rounded-lg"
                    >
                      <option value="">Selecione a instituição...</option>
                      {ministeriosLoading && (
                        <option value="" disabled>Carregando instituições...</option>
                      )}
                      {!ministeriosLoading && ministerios.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Plano (opcional)</label>
                    <select
                      value={avulsoForm.subscription_plan_id}
                      onChange={(e) => setAvulsoForm({ ...avulsoForm, subscription_plan_id: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                    >
                      <option value="">Selecione o plano...</option>
                      {planosLoading && (
                        <option value="" disabled>Carregando planos...</option>
                      )}
                      {!planosLoading && planos.map((plano) => (
                        <option key={plano.id} value={plano.id}>
                          {plano.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={avulsoForm.amount}
                      onChange={(e) => setAvulsoForm({ ...avulsoForm, amount: e.target.value })}
                      required
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Vencimento</label>
                    <input
                      type="date"
                      value={avulsoForm.due_date}
                      onChange={(e) => setAvulsoForm({ ...avulsoForm, due_date: e.target.value })}
                      required
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Método</label>
                    <select
                      value={avulsoForm.payment_method}
                      onChange={(e) => setAvulsoForm({ ...avulsoForm, payment_method: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                    >
                      <option value="pix">PIX</option>
                      <option value="boleto">Boleto</option>
                      <option value="credit_card">Cartão de Crédito</option>
                      <option value="bank_transfer">Transferência Bancária</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Descrição (opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: Implantação" 
                      value={avulsoForm.description}
                      onChange={(e) => setAvulsoForm({ ...avulsoForm, description: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>

                  <label className="md:col-span-2 flex items-center gap-3 text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={!avulsoForm.create_asaas}
                      onChange={(e) => setAvulsoForm({ ...avulsoForm, create_asaas: !e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    Pagamento em mãos (não enviar para o ASAAS)
                  </label>

                  <button
                    type="submit"
                    disabled={submittingAvulso}
                    className="md:col-span-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    {submittingAvulso ? 'Enviando...' : 'Criar Pagamento Avulso'}
                  </button>
                </form>
              </div>
            )}

            <div className="bg-gray-900 border border-gray-800 rounded-lg shadow overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                <h2 className="text-base font-semibold text-white">Cobranças</h2>
                {!loading && <span className="text-xs text-gray-400">{totalCount} registro{totalCount !== 1 ? 's' : ''}</span>}
              </div>
              {loading ? (
                <div className="p-6 text-center text-gray-400">Carregando...</div>
              ) : pagamentos.length === 0 ? (
                <div className="p-6 text-center text-gray-400">Nenhum pagamento encontrado</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-800 border-b border-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300">Instituição</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300">Valor</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300">Vencimento</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300">Método</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagamentos.map((p) => (
                      <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/60">
                        <td className="px-6 py-4 font-medium text-gray-100">
                          {(p as any).ministries?.name || p.ministry_id}
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-100">R$ {p.amount.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm text-gray-300">
                          {new Date(p.due_date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs ${getStatusColor(p.status)}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-300">{p.payment_method}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setDetailsModal({ isOpen: true, payment: p })}
                              title="Detalhes"
                              className="p-3 rounded-lg border border-blue-500 text-blue-300 hover:text-white hover:bg-blue-600"
                            >
                              <Info size={18} />
                            </button>
                            {p.status === 'paid' && (
                              <button
                                onClick={() => handlePrintReceipt(p)}
                                title="Imprimir recibo"
                                className="p-3 rounded-lg border border-gray-600 text-gray-200 hover:text-white hover:border-gray-400 hover:bg-gray-700"
                              >
                                <FileText size={18} />
                              </button>
                            )}
                            {(p.status === 'pending' || p.status === 'overdue') && (
                              <button
                                onClick={() => {
                                  const isAsaas = Boolean(p.asaas_payment_id)
                                  setManualModal({
                                    isOpen: true,
                                    paymentId: p.id,
                                    note: isAsaas ? 'Recebido em mãos' : '',
                                    isAsaas,
                                  })
                                }}
                                title="Baixa manual"
                                className="p-3 rounded-lg border border-green-600 text-green-300 hover:text-white hover:bg-green-600"
                              >
                                <CheckCircle2 size={18} />
                              </button>
                            )}
                            <button
                              onClick={() => setDeleteModal({ isOpen: true, payment: p, deleting: false })}
                              title="Excluir cobrança"
                              className="p-3 rounded-lg border border-red-600 text-red-400 hover:text-white hover:bg-red-600"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700">
                  <p className="text-sm text-gray-400">
                    {totalCount} registro{totalCount !== 1 ? 's' : ''} &bull; Página {page} de {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      «
                    </button>
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <span className="px-3 py-1.5 text-xs rounded-lg bg-gray-700 text-white font-medium">
                      {page}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Próxima
                    </button>
                    <button
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      »
                    </button>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </main>

      {manualModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Baixa manual</h3>
            <p className="text-sm text-gray-400 mt-1">
              {manualModal.isAsaas
                ? 'Informe o motivo da baixa manual.'
                : 'Adicione observações para este pagamento.'}
            </p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {manualModal.isAsaas ? 'Motivo' : 'Observações'}
              </label>
              <input
                type="text"
                value={manualModal.note}
                onChange={(e) => setManualModal({
                  ...manualModal,
                  note: e.target.value,
                })}
                className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100"
                placeholder={manualModal.isAsaas ? 'Ex: Recebido em mãos' : 'Ex: Recebido via transferência'}
              />
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setManualModal({ isOpen: false, paymentId: '', note: 'Recebido em mãos', isAsaas: true })}
                className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500"
              >
                Cancelar
              </button>
              <button
                onClick={handleManualSettlement}
                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
              >
                Confirmar baixa
              </button>
            </div>
          </div>
        </div>
      )}

      {detailsModal.isOpen && detailsModal.payment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Detalhes do Pagamento</h3>
              <button
                onClick={() => setDetailsModal({ isOpen: false, payment: null })}
                className="text-gray-400 hover:text-white"
              >
                Fechar
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400">Instituição</p>
                <p className="text-gray-100 font-semibold">
                  {(detailsModal.payment as any).ministries?.name || detailsModal.payment.ministry_id}
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400">Plano</p>
                <p className="text-gray-100 font-semibold">
                  {(detailsModal.payment as any).subscription_plans?.name || '-'}
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400">Valor</p>
                <p className="text-gray-100 font-semibold">R$ {detailsModal.payment.amount.toFixed(2)}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400">Vencimento</p>
                <p className="text-gray-100 font-semibold">
                  {new Date(detailsModal.payment.due_date).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400">Status</p>
                <p className="text-gray-100 font-semibold">{detailsModal.payment.status}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400">Método</p>
                <p className="text-gray-100 font-semibold">{detailsModal.payment.payment_method || '-'}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 md:col-span-2">
                <p className="text-gray-400">Descrição</p>
                <p className="text-gray-100 font-semibold">{detailsModal.payment.description || '-'}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 md:col-span-2">
                <p className="text-gray-400">ASAAS ID</p>
                <p className="text-gray-100 font-semibold">{detailsModal.payment.asaas_payment_id || '-'}</p>
              </div>
              {!(detailsModal.payment as any).asaas_payment_id && (detailsModal.payment as any).asaas_response?.error && (
                <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 md:col-span-2">
                  <p className="text-red-400 text-xs font-semibold mb-1">Erro ASAAS</p>
                  <p className="text-red-200 text-xs break-all">{(detailsModal.payment as any).asaas_response.error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteModal.isOpen && deleteModal.payment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Excluir Cobrança</h3>
            <p className="text-sm text-gray-400 mt-2">
              {deleteModal.payment.asaas_payment_id
                ? 'Esta cobrança será removida do sistema e também cancelada no ASAAS.'
                : 'Esta cobrança será removida do sistema.'}
            </p>
            <div className="mt-3 bg-gray-800 rounded-lg p-3 text-sm">
              <p className="text-gray-400">Descrição: <span className="text-gray-100">{deleteModal.payment.description || '-'}</span></p>
              <p className="text-gray-400 mt-1">Valor: <span className="text-gray-100">R$ {deleteModal.payment.amount?.toFixed(2)}</span></p>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteModal({ isOpen: false, payment: null, deleting: false })}
                disabled={deleteModal.deleting}
                className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeletePayment}
                disabled={deleteModal.deleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteModal.deleting ? 'Excluindo...' : 'Confirmar exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
