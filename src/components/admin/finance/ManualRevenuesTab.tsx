'use client'

import { useState, useEffect, useCallback } from 'react'
import { authenticatedFetch } from '@/lib/api-client'
import {
  PlatformManualRevenue,
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
} from 'lucide-react'

export default function ManualRevenuesTab({ onDataChanged }: { onDataChanged?: () => void }) {
  const [revenues, setRevenues] = useState<PlatformManualRevenue[]>([])
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
  const [editingRevenue, setEditingRevenue] = useState<PlatformManualRevenue | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')

  // Estado do formulário
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    reference_date: new Date().toISOString().split('T')[0],
    category_id: '',
    status: 'pending' as 'pending' | 'received' | 'canceled',
    received_at: '',
    payment_method: 'PIX',
    payer_name: '',
    notes: '',
  })

  // Modal de Confirmação de Cancelamento
  const [cancelingItem, setCancelingItem] = useState<PlatformManualRevenue | null>(null)
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

  // Carregar Categorias de Receita (INCOME)
  const fetchCategories = useCallback(async () => {
    try {
      const res = await authenticatedFetch('/api/v1/admin/corporate-finance/categories?type=INCOME')
      if (res.ok) {
        const json = await res.json()
        setCategories(json.data || [])
      }
    } catch (err) {
      console.warn('Erro ao carregar categorias de receita:', err)
    }
  }, [])

  // Carregar Receitas Manuais
  const fetchRevenues = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const res = await authenticatedFetch(`/api/v1/admin/corporate-finance/manual-revenues?${params.toString()}`)
      if (!res.ok) {
        throw new Error('Falha ao carregar receitas manuais')
      }
      const json = await res.json()
      setRevenues(json.data || [])
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar receitas')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, startDate, endDate])

  useEffect(() => {
    fetchCategories()
    fetchRevenues()
  }, [fetchCategories, fetchRevenues])

  // Abrir Modal de Nova Receita
  const handleOpenNew = () => {
    setEditingRevenue(null)
    setFormData({
      description: '',
      amount: '',
      reference_date: new Date().toISOString().split('T')[0],
      category_id: categories.length > 0 ? categories[0].id : '',
      status: 'pending',
      received_at: '',
      payment_method: 'PIX',
      payer_name: '',
      notes: '',
    })
    setFormError('')
    setModalOpen(true)
  }

  // Abrir Modal de Edição
  const handleOpenEdit = (rev: PlatformManualRevenue) => {
    setEditingRevenue(rev)
    setFormData({
      description: rev.description,
      amount: String(rev.amount),
      reference_date: rev.reference_date?.split('T')[0] || '',
      category_id: rev.category_id || '',
      status: rev.status,
      received_at: rev.received_at ? rev.received_at.split('T')[0] : '',
      payment_method: rev.payment_method || 'PIX',
      payer_name: rev.payer_name || '',
      notes: rev.notes || '',
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
      if (!formData.reference_date) throw new Error('A data de referência é obrigatória')

      const payload = {
        description: formData.description.trim(),
        amount: numAmt,
        reference_date: formData.reference_date,
        category_id: formData.category_id || null,
        status: formData.status,
        received_at: formData.status === 'received' ? (formData.received_at || new Date().toISOString()) : null,
        payment_method: formData.payment_method,
        payer_name: formData.payer_name.trim() || null,
        notes: formData.notes.trim() || null,
      }

      let res
      if (editingRevenue) {
        res = await authenticatedFetch(`/api/v1/admin/corporate-finance/manual-revenues/${editingRevenue.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await authenticatedFetch('/api/v1/admin/corporate-finance/manual-revenues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Erro ao salvar receita manual')
      }

      setModalOpen(false)
      setSuccessMsg(editingRevenue ? 'Receita atualizada com sucesso!' : 'Receita cadastrada com sucesso!')
      setTimeout(() => setSuccessMsg(''), 4000)
      await fetchRevenues()
      if (onDataChanged) onDataChanged()
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar receita manual')
    } finally {
      setFormLoading(false)
    }
  }

  // Marcar como Recebida
  const handleMarkAsReceived = async (rev: PlatformManualRevenue) => {
    try {
      setActionLoading(true)
      const res = await authenticatedFetch(`/api/v1/admin/corporate-finance/manual-revenues/${rev.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'received',
          received_at: new Date().toISOString(),
        }),
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Erro ao marcar receita como recebida')
      }

      setSuccessMsg(`Receita "${rev.description}" marcada como recebida!`)
      setTimeout(() => setSuccessMsg(''), 4000)
      await fetchRevenues()
      if (onDataChanged) onDataChanged()
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar status')
    } finally {
      setActionLoading(false)
    }
  }

  // Cancelar Receita
  const handleCancelRevenue = async () => {
    if (!cancelingItem) return
    try {
      setActionLoading(true)
      const res = await authenticatedFetch(`/api/v1/admin/corporate-finance/manual-revenues/${cancelingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'canceled' }),
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Erro ao cancelar receita')
      }

      setSuccessMsg(`Receita "${cancelingItem.description}" cancelada com sucesso.`)
      setTimeout(() => setSuccessMsg(''), 4000)
      setCancelingItem(null)
      await fetchRevenues()
      if (onDataChanged) onDataChanged()
    } catch (err: any) {
      setError(err.message || 'Erro ao cancelar')
    } finally {
      setActionLoading(false)
    }
  }

  // Filtragem local
  const filteredRevenues = revenues.filter((rev) => {
    if (categoryFilter !== 'all' && rev.category_id !== categoryFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchDesc = rev.description?.toLowerCase().includes(q)
      const matchPayer = rev.payer_name?.toLowerCase().includes(q)
      const matchNotes = rev.notes?.toLowerCase().includes(q)
      if (!matchDesc && !matchPayer && !matchNotes) return false
    }
    return true
  })

  // Estatísticas Rápidas da Aba
  const totalRecebidas = filteredRevenues
    .filter((r) => r.status === 'received')
    .reduce((acc, r) => acc + Number(r.amount || 0), 0)
  const totalPendentes = filteredRevenues
    .filter((r) => r.status === 'pending')
    .reduce((acc, r) => acc + Number(r.amount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Alerta Informativo de Isolamento */}
      <div className="bg-blue-950/40 border border-blue-800/60 rounded-xl p-4 flex items-start gap-3 text-xs text-blue-300">
        <DollarSign className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-blue-200">
            Módulo Exclusivo para Receitas Corporativas Avulsas
          </p>
          <p className="text-gray-400">
            As assinaturas recorrentes do SaaS são geradas e sincronizadas automaticamente via <span className="text-blue-300 font-mono">platform_billing_invoices</span>. Utilize este espaço exclusivamente para lançar receitas pontuais como consultorias, serviços de implantação, treinamentos, aportes ou outras entradas corporativas.
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
          <button onClick={fetchRevenues} className="underline hover:text-white font-bold cursor-pointer">
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
                placeholder="Buscar por descrição, pagador..."
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
              <option value="received">Recebidas</option>
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
              onClick={fetchRevenues}
              disabled={loading}
              className="p-2 bg-gray-950 border border-gray-800 hover:border-gray-700 rounded-lg text-gray-400 hover:text-white transition cursor-pointer"
              title="Recarregar"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleOpenNew}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Nova Receita Manual
            </button>
          </div>
        </div>

        {/* Mini Cards de Resumo dos Lançamentos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-800/80">
          <div className="bg-gray-950/60 p-3 rounded-lg border border-gray-800/60">
            <span className="text-[11px] text-gray-400 uppercase font-semibold">Total Recebido (Filtro)</span>
            <p className="text-base font-bold text-emerald-400 mt-0.5">{formatCurrency(totalRecebidas)}</p>
          </div>
          <div className="bg-gray-950/60 p-3 rounded-lg border border-gray-800/60">
            <span className="text-[11px] text-gray-400 uppercase font-semibold">Total Pendente (Filtro)</span>
            <p className="text-base font-bold text-amber-400 mt-0.5">{formatCurrency(totalPendentes)}</p>
          </div>
          <div className="bg-gray-950/60 p-3 rounded-lg border border-gray-800/60">
            <span className="text-[11px] text-gray-400 uppercase font-semibold">Lançamentos Encontrados</span>
            <p className="text-base font-bold text-white mt-0.5">{filteredRevenues.length} registro(s)</p>
          </div>
        </div>
      </div>

      {/* Tabela de Receitas */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-gray-950/80 text-gray-400 uppercase font-semibold text-[10px] tracking-wider border-b border-gray-800">
              <tr>
                <th className="px-4 py-3">Referência</th>
                <th className="px-4 py-3">Descrição / Pagador</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Forma Pagto</th>
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
                    Carregando receitas manuais...
                  </td>
                </tr>
              ) : filteredRevenues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    Nenhuma receita manual encontrada com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredRevenues.map((rev) => {
                  const isReceived = rev.status === 'received'
                  const isPending = rev.status === 'pending'
                  const isCanceled = rev.status === 'canceled'

                  return (
                    <tr key={rev.id} className="hover:bg-gray-800/40 transition">
                      {/* Data Referência */}
                      <td className="px-4 py-3 font-medium text-gray-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-gray-500" />
                          {formatDate(rev.reference_date)}
                        </div>
                        {rev.received_at && (
                          <span className="text-[10px] text-emerald-400 block mt-0.5">
                            Rec: {formatDate(rev.received_at)}
                          </span>
                        )}
                      </td>

                      {/* Descrição / Pagador */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{rev.description}</div>
                        {rev.payer_name && (
                          <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <User className="h-3 w-3 text-gray-500" />
                            {rev.payer_name}
                          </div>
                        )}
                        {rev.notes && (
                          <div className="text-[10px] text-gray-500 italic mt-0.5 line-clamp-1">
                            {rev.notes}
                          </div>
                        )}
                      </td>

                      {/* Categoria */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-800 text-gray-300 text-[11px] border border-gray-700/60">
                          <Tag className="h-3 w-3 text-blue-400" />
                          {(rev as any)?.platform_financial_categories?.name || 'Sem Categoria'}
                        </span>
                      </td>

                      {/* Forma Pagamento */}
                      <td className="px-4 py-3 whitespace-nowrap text-gray-400 text-[11px]">
                        {rev.payment_method || 'PIX'}
                      </td>

                      {/* Valor */}
                      <td className="px-4 py-3 text-right font-bold text-sm whitespace-nowrap text-emerald-400">
                        {formatCurrency(rev.amount)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {isReceived && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            Recebido
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="h-3 w-3" />
                            Pendente
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
                              onClick={() => handleMarkAsReceived(rev)}
                              disabled={actionLoading}
                              className="p-1.5 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/80 text-emerald-300 rounded-lg transition cursor-pointer"
                              title="Marcar como Recebido"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEdit(rev)}
                            className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition cursor-pointer"
                            title="Editar Receita"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          {!isCanceled && (
                            <button
                              onClick={() => setCancelingItem(rev)}
                              className="p-1.5 bg-gray-800 hover:bg-red-950/80 hover:text-red-400 text-gray-400 rounded-lg transition cursor-pointer"
                              title="Cancelar Receita"
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
                <DollarSign className="h-5 w-5 text-blue-500" />
                {editingRevenue ? 'Editar Receita Manual' : 'Nova Receita Corporativa Manual'}
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
                  Descrição da Receita *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Consultoria de Implantação Customizada"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
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
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Categoria Corporativa
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 focus:outline-none focus:border-blue-500"
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

              {/* Data de Referência e Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Data de Referência / Competência *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.reference_date}
                    onChange={(e) => setFormData({ ...formData, reference_date: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Status do Lançamento
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="pending">Pendente (A Receber)</option>
                    <option value="received">Recebido (Pago)</option>
                    <option value="canceled">Cancelado</option>
                  </select>
                </div>
              </div>

              {/* Se recebido: data de recebimento */}
              {formData.status === 'received' && (
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Data do Recebimento Efetivo
                  </label>
                  <input
                    type="date"
                    value={formData.received_at}
                    onChange={(e) => setFormData({ ...formData, received_at: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* Forma de Pagamento e Nome do Pagador */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Transferência Bancária">Transferência Bancária</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Nome do Pagador / Contratante
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Empresa Parceira / Cliente"
                    value={formData.payer_name}
                    onChange={(e) => setFormData({ ...formData, payer_name: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Observações Internas
                </label>
                <textarea
                  rows={2}
                  placeholder="Informações adicionais, número de nota ou protocolo..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
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
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition shadow-sm shadow-blue-500/20 cursor-pointer"
                >
                  {formLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {editingRevenue ? 'Salvar Alterações' : 'Cadastrar Receita'}
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
              <h3 className="text-base font-bold text-white">Cancelar Receita Manual</h3>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Deseja realmente cancelar a receita manual <strong>&quot;{cancelingItem.description}&quot;</strong> no valor de <strong>{formatCurrency(cancelingItem.amount)}</strong>?
            </p>
            <p className="text-[11px] text-gray-400">
              Lançamentos cancelados não impactam o saldo realizado nem as previsões de caixa.
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
                onClick={handleCancelRevenue}
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