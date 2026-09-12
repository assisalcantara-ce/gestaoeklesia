'use client'

import { useState, useEffect, useCallback } from 'react'
import { authenticatedFetch } from '@/lib/api-client'
import {
  PlatformExpense,
  PlatformFinancialCategory,
} from '@/lib/platform/finance'
import {
  Plus,
  Search,
  RefreshCw,
  Edit2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  DollarSign,
  Tag,
  Calendar,
  User,
  Ban,
  Repeat,
  Paperclip,
} from 'lucide-react'

export default function CorporateExpensesTab({ onDataChanged }: { onDataChanged?: () => void }) {
  const [expenses, setExpenses] = useState<PlatformExpense[]>([])
  const [categories, setCategories] = useState<PlatformFinancialCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Modal de Criação / Edição
  const [modalOpen, setModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<PlatformExpense | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')

  // Estado do formulário
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    reference_date: new Date().toISOString().split('T')[0],
    due_date: new Date().toISOString().split('T')[0],
    category_id: '',
    status: 'pending' as 'pending' | 'paid' | 'canceled',
    paid_at: '',
    payment_method: 'PIX',
    is_recurring: false,
    recipient_name: '',
    receipt_url: '',
    notes: '',
  })

  // Modal de Confirmação de Cancelamento
  const [cancelingItem, setCancelingItem] = useState<PlatformExpense | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const formatCurrency = (val: number | null | undefined) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    const clean = dateStr.split('T')[0]
    const parts = clean.split('-')
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
    return clean
  }

  // Carregar Categorias de Despesa (EXPENSE)
  const fetchCategories = useCallback(async () => {
    try {
      const res = await authenticatedFetch('/api/v1/admin/corporate-finance/categories?type=EXPENSE')
      if (res.ok) {
        const json = await res.json()
        setCategories(json.data || [])
      }
    } catch (err) {
      console.warn('Erro ao carregar categorias de despesa:', err)
    }
  }, [])

  // Carregar Despesas Corporativas
  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const res = await authenticatedFetch(`/api/v1/admin/corporate-finance/expenses?${params.toString()}`)
      if (!res.ok) {
        throw new Error('Falha ao carregar despesas corporativas')
      }
      const json = await res.json()
      setExpenses(json.data || [])
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar despesas')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, startDate, endDate])

  useEffect(() => {
    fetchCategories()
    fetchExpenses()
  }, [fetchCategories, fetchExpenses])

  // Abrir Modal de Nova Despesa
  const handleOpenNew = () => {
    setEditingExpense(null)
    const today = new Date().toISOString().split('T')[0]
    setFormData({
      description: '',
      amount: '',
      reference_date: today,
      due_date: today,
      category_id: categories.length > 0 ? categories[0].id : '',
      status: 'pending',
      paid_at: '',
      payment_method: 'PIX',
      is_recurring: false,
      recipient_name: '',
      receipt_url: '',
      notes: '',
    })
    setFormError('')
    setModalOpen(true)
  }

  // Abrir Modal de Edição
  const handleOpenEdit = (exp: PlatformExpense) => {
    setEditingExpense(exp)
    setFormData({
      description: exp.description,
      amount: String(exp.amount),
      reference_date: exp.reference_date?.split('T')[0] || '',
      due_date: exp.due_date?.split('T')[0] || '',
      category_id: exp.category_id || '',
      status: exp.status,
      paid_at: exp.paid_at ? exp.paid_at.split('T')[0] : '',
      payment_method: exp.payment_method || 'PIX',
      is_recurring: Boolean(exp.is_recurring),
      recipient_name: exp.recipient_name || '',
      receipt_url: exp.receipt_url || '',
      notes: exp.notes || '',
    })
    setFormError('')
    setModalOpen(true)
  }

  // Submeter Formulário
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setFormLoading(true)
      setFormError('')

      if (!formData.description.trim()) throw new Error('A descrição é obrigatória')
      const numAmt = Number(formData.amount)
      if (!Number.isFinite(numAmt) || numAmt <= 0) throw new Error('O valor deve ser maior que zero')
      if (!formData.reference_date) throw new Error('A data de competência é obrigatória')
      if (!formData.due_date) throw new Error('A data de vencimento é obrigatória')

      const payload = {
        description: formData.description.trim(),
        amount: numAmt,
        reference_date: formData.reference_date,
        due_date: formData.due_date,
        category_id: formData.category_id || null,
        status: formData.status,
        paid_at: formData.status === 'paid' ? (formData.paid_at || new Date().toISOString()) : null,
        payment_method: formData.payment_method,
        is_recurring: formData.is_recurring,
        recipient_name: formData.recipient_name.trim() || null,
        receipt_url: formData.receipt_url.trim() || null,
        notes: formData.notes.trim() || null,
      }

      let res
      if (editingExpense) {
        res = await authenticatedFetch(`/api/v1/admin/corporate-finance/expenses/${editingExpense.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await authenticatedFetch('/api/v1/admin/corporate-finance/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Erro ao salvar despesa')
      }

      setModalOpen(false)
      setSuccessMsg(editingExpense ? 'Despesa atualizada com sucesso!' : 'Despesa lançada com sucesso!')
      setTimeout(() => setSuccessMsg(''), 4000)
      await fetchExpenses()
      if (onDataChanged) onDataChanged()
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar despesa corporativa')
    } finally {
      setFormLoading(false)
    }
  }

  // Marcar como Paga
  const handleMarkAsPaid = async (exp: PlatformExpense) => {
    try {
      setActionLoading(true)
      const res = await authenticatedFetch(`/api/v1/admin/corporate-finance/expenses/${exp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'paid',
          paid_at: new Date().toISOString(),
        }),
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Erro ao marcar despesa como paga')
      }

      setSuccessMsg(`Despesa "${exp.description}" liquidada com sucesso!`)
      setTimeout(() => setSuccessMsg(''), 4000)
      await fetchExpenses()
      if (onDataChanged) onDataChanged()
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar status')
    } finally {
      setActionLoading(false)
    }
  }

  // Cancelar Despesa
  const handleCancelExpense = async () => {
    if (!cancelingItem) return
    try {
      setActionLoading(true)
      const res = await authenticatedFetch(`/api/v1/admin/corporate-finance/expenses/${cancelingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'canceled' }),
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Erro ao cancelar despesa')
      }

      setSuccessMsg(`Despesa "${cancelingItem.description}" cancelada com sucesso.`)
      setTimeout(() => setSuccessMsg(''), 4000)
      setCancelingItem(null)
      await fetchExpenses()
      if (onDataChanged) onDataChanged()
    } catch (err: any) {
      setError(err.message || 'Erro ao cancelar')
    } finally {
      setActionLoading(false)
    }
  }

  // Filtragem local
  const filteredExpenses = expenses.filter((exp) => {
    if (categoryFilter !== 'all' && exp.category_id !== categoryFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchDesc = exp.description?.toLowerCase().includes(q)
      const matchRecip = exp.recipient_name?.toLowerCase().includes(q)
      const matchNotes = exp.notes?.toLowerCase().includes(q)
      if (!matchDesc && !matchRecip && !matchNotes) return false
    }
    return true
  })

  // Estatísticas Rápidas
  const totalPagas = filteredExpenses
    .filter((e) => e.status === 'paid')
    .reduce((acc, e) => acc + Number(e.amount || 0), 0)
  const totalPendentes = filteredExpenses
    .filter((e) => e.status === 'pending')
    .reduce((acc, e) => acc + Number(e.amount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Alerta Informativo */}
      <div className="bg-rose-950/30 border border-rose-900/60 rounded-xl p-4 flex items-start gap-3 text-xs text-rose-300">
        <DollarSign className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-rose-200">
            Módulo de Despesas Corporativas e Custos da Empresa
          </p>
          <p className="text-gray-400">
            Lance todos os custos operacionais (infraestrutura em nuvem, ferramentas, APIs, impostos, fornecedores e pró-labore). Uma despesa só deduz do <strong className="text-rose-300">Saldo Financeiro</strong> e compõe as <strong className="text-rose-300">Despesas Pagas</strong> quando estiver com status <span className="font-mono text-emerald-400">paid</span> e data de liquidação preenchida.
          </p>
        </div>
      </div>

      {/* Feedback de Sucesso */}
      {successMsg && (
        <div className="bg-emerald-950/70 border border-emerald-800 text-emerald-300 p-4 rounded-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="bg-red-950/70 border border-red-800 text-red-300 p-4 rounded-xl flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            {error}
          </div>
          <button onClick={fetchExpenses} className="underline hover:text-white font-bold cursor-pointer">
            Recarregar
          </button>
        </div>
      )}

      {/* Barra de Filtros e Ações */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Busca */}
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por descrição, fornecedor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-gray-950 border border-gray-800 rounded-lg text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todos os Status</option>
              <option value="paid">Pagas</option>
              <option value="pending">Pendentes</option>
              <option value="canceled">Canceladas</option>
            </select>

            {/* Categoria */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todas as Categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Datas */}
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
              placeholder="Data inicial"
            />
            <span className="text-gray-500 text-xs">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
              placeholder="Data final"
            />

            {(startDate || endDate || searchQuery || statusFilter !== 'all' || categoryFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                  setCategoryFilter('all')
                  setStartDate('')
                  setEndDate('')
                }}
                className="text-xs text-gray-400 hover:text-gray-200 underline cursor-pointer"
              >
                Limpar filtros
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchExpenses}
              disabled={loading}
              className="p-2 bg-gray-950 border border-gray-800 hover:border-gray-700 rounded-lg text-gray-400 hover:text-white transition cursor-pointer"
              title="Recarregar"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleOpenNew}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm shadow-rose-500/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Nova Despesa Corporativa
            </button>
          </div>
        </div>

        {/* Mini Cards de Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-800/80">
          <div className="bg-gray-950/60 p-3 rounded-lg border border-gray-800/60">
            <span className="text-[11px] text-gray-400 uppercase font-semibold">Despesas Pagas (Filtro)</span>
            <p className="text-base font-bold text-rose-400 mt-0.5">{formatCurrency(totalPagas)}</p>
          </div>
          <div className="bg-gray-950/60 p-3 rounded-lg border border-gray-800/60">
            <span className="text-[11px] text-gray-400 uppercase font-semibold">Despesas Pendentes (Filtro)</span>
            <p className="text-base font-bold text-amber-400 mt-0.5">{formatCurrency(totalPendentes)}</p>
          </div>
          <div className="bg-gray-950/60 p-3 rounded-lg border border-gray-800/60">
            <span className="text-[11px] text-gray-400 uppercase font-semibold">Lançamentos Encontrados</span>
            <p className="text-base font-bold text-white mt-0.5">{filteredExpenses.length} registro(s)</p>
          </div>
        </div>
      </div>

      {/* Tabela de Despesas */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-gray-950/80 text-gray-400 uppercase font-semibold text-[10px] tracking-wider border-b border-gray-800">
              <tr>
                <th className="px-4 py-3">Vencimento / Comp</th>
                <th className="px-4 py-3">Descrição / Fornecedor</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Recorrência</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-500 mb-2" />
                    Carregando despesas corporativas...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    Nenhuma despesa corporativa encontrada com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const isPaid = exp.status === 'paid'
                  const isPending = exp.status === 'pending'
                  const isCanceled = exp.status === 'canceled'

                  return (
                    <tr key={exp.id} className="hover:bg-gray-800/40 transition">
                      {/* Vencimento / Competência */}
                      <td className="px-4 py-3 font-medium text-gray-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-gray-500" />
                          <span className="text-white font-semibold">Venc: {formatDate(exp.due_date)}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Comp: {formatDate(exp.reference_date)}
                        </div>
                        {exp.paid_at && (
                          <span className="text-[10px] text-emerald-400 block mt-0.5">
                            Pago em: {formatDate(exp.paid_at)}
                          </span>
                        )}
                      </td>

                      {/* Descrição / Fornecedor */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          {exp.description}
                          {exp.receipt_url && (
                            <a
                              href={exp.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                              title="Ver Comprovante"
                            >
                              <Paperclip className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        {exp.recipient_name && (
                          <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <User className="h-3 w-3 text-gray-500" />
                            {exp.recipient_name}
                          </div>
                        )}
                        {exp.notes && (
                          <div className="text-[10px] text-gray-500 italic mt-0.5 line-clamp-1">
                            {exp.notes}
                          </div>
                        )}
                      </td>

                      {/* Categoria */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-800 text-gray-300 text-[11px] border border-gray-700/60">
                          <Tag className="h-3 w-3 text-rose-400" />
                          {(exp as any)?.platform_financial_categories?.name || 'Sem Categoria'}
                        </span>
                      </td>

                      {/* Recorrência */}
                      <td className="px-4 py-3 whitespace-nowrap text-[11px]">
                        {exp.is_recurring ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">
                            <Repeat className="h-3 w-3" />
                            Recorrente
                          </span>
                        ) : (
                          <span className="text-gray-500">Eventual</span>
                        )}
                      </td>

                      {/* Valor */}
                      <td className="px-4 py-3 text-right font-bold text-sm whitespace-nowrap text-rose-400">
                        {formatCurrency(exp.amount)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {isPaid && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            Pago
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="h-3 w-3" />
                            A Pagar
                          </span>
                        )}
                        {isCanceled && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                            <Ban className="h-3 w-3" />
                            Cancelado
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <button
                              onClick={() => handleMarkAsPaid(exp)}
                              disabled={actionLoading}
                              className="p-1.5 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/80 text-emerald-300 rounded-lg transition cursor-pointer"
                              title="Marcar como Pago"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEdit(exp)}
                            className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition cursor-pointer"
                            title="Editar Despesa"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          {!isCanceled && (
                            <button
                              onClick={() => setCancelingItem(exp)}
                              className="p-1.5 bg-gray-800 hover:bg-red-950/80 hover:text-red-400 text-gray-400 rounded-lg transition cursor-pointer"
                              title="Cancelar Despesa"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Criação / Edição */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-rose-500" />
                {editingExpense ? 'Editar Despesa Corporativa' : 'Nova Despesa Corporativa'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-950/70 border border-red-800 text-red-300 p-3 rounded-lg text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-3.5 text-xs">
              {/* Descrição */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Descrição da Despesa *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Assinatura Servidores Supabase Pro"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Valor e Categoria */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Valor (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-rose-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Categoria Corporativa
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 focus:outline-none focus:border-rose-500"
                  >
                    <option value="">Sem categoria específica</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Competência e Vencimento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Data de Competência / Mês *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.reference_date}
                    onChange={(e) => setFormData({ ...formData, reference_date: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Data de Vencimento *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Status e Data de Pagamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Status da Despesa
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 focus:outline-none focus:border-rose-500"
                  >
                    <option value="pending">Pendente (A Pagar)</option>
                    <option value="paid">Paga (Liquidada)</option>
                    <option value="canceled">Cancelada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 focus:outline-none focus:border-rose-500"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Boleto">Boleto Bancário</option>
                    <option value="Cartão Corporativo">Cartão Corporativo</option>
                    <option value="Transferência Bancária">Transferência / TED</option>
                    <option value="Débito Automático">Débito Automático</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              {/* Se pago: data de pagamento */}
              {formData.status === 'paid' && (
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Data do Pagamento Efetivo
                  </label>
                  <input
                    type="date"
                    value={formData.paid_at}
                    onChange={(e) => setFormData({ ...formData, paid_at: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 focus:outline-none focus:border-rose-500"
                  />
                </div>
              )}

              {/* Beneficiário e Comprovante */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Beneficiário / Fornecedor
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Supabase Inc, Google, Contador"
                    value={formData.recipient_name}
                    onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Link do Comprovante / Fatura
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formData.receipt_url}
                    onChange={(e) => setFormData({ ...formData, receipt_url: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Recorrência */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_recurring"
                  checked={formData.is_recurring}
                  onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                  className="rounded border-gray-800 bg-gray-950 text-rose-600 focus:ring-rose-500 h-4 w-4"
                />
                <label htmlFor="is_recurring" className="text-gray-300 font-medium cursor-pointer">
                  Despesa Recorrente (custo mensal habitual)
                </label>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Observações
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalhes adicionais, centro de custo ou número do documento..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={formLoading}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold transition shadow-sm shadow-rose-500/20 cursor-pointer"
                >
                  {formLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {editingExpense ? 'Salvar Alterações' : 'Lançar Despesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Cancelamento */}
      {cancelingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <Ban className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Cancelar Despesa</h3>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Deseja realmente cancelar a despesa <strong>&quot;{cancelingItem.description}&quot;</strong> no valor de <strong>{formatCurrency(cancelingItem.amount)}</strong>?
            </p>
            <p className="text-[11px] text-gray-400">
              Despesas canceladas não compõem as despesas pagas nem reduzem o saldo financeiro da plataforma.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-800 text-xs">
              <button
                onClick={() => setCancelingItem(null)}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-semibold transition cursor-pointer"
              >
                Voltar
              </button>
              <button
                onClick={handleCancelExpense}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold transition shadow-sm shadow-rose-500/20 cursor-pointer"
              >
                {actionLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
