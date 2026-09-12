'use client'

import { useState, useEffect, useCallback } from 'react'
import { authenticatedFetch } from '@/lib/api-client'
import {
  PlatformFinancialCategory,
  PlatformFinancialCategoryType,
} from '@/lib/platform/finance'
import {
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Tag,
  Tags,
  DollarSign,
  Power,
} from 'lucide-react'

export default function FinancialCategoriesTab({ onDataChanged }: { onDataChanged?: () => void }) {
  const [categories, setCategories] = useState<PlatformFinancialCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<PlatformFinancialCategory | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    type: 'EXPENSE' as PlatformFinancialCategoryType,
    description: '',
    is_active: true,
  })

  // Modal Exclusão
  const [deletingCategory, setDeletingCategory] = useState<PlatformFinancialCategory | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await authenticatedFetch('/api/v1/admin/corporate-finance/categories')
      if (!res.ok) throw new Error('Falha ao carregar categorias financeiras')
      const json = await res.json()
      setCategories(json.data || [])
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar categorias')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const handleOpenNew = (defaultType: PlatformFinancialCategoryType = 'EXPENSE') => {
    setEditingCategory(null)
    setFormData({
      name: '',
      type: defaultType,
      description: '',
      is_active: true,
    })
    setFormError('')
    setModalOpen(true)
  }

  const handleOpenEdit = (cat: PlatformFinancialCategory) => {
    setEditingCategory(cat)
    setFormData({
      name: cat.name,
      type: cat.type,
      description: cat.description || '',
      is_active: cat.is_active,
    })
    setFormError('')
    setModalOpen(true)
  }

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setFormLoading(true)
      setFormError('')

      if (!formData.name.trim()) throw new Error('O nome da categoria é obrigatório')

      let res
      if (editingCategory) {
        res = await authenticatedFetch(`/api/v1/admin/corporate-finance/categories/${editingCategory.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            is_active: formData.is_active,
          }),
        })
      } else {
        res = await authenticatedFetch('/api/v1/admin/corporate-finance/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name.trim(),
            type: formData.type,
            description: formData.description.trim() || null,
          }),
        })
      }

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Erro ao salvar categoria')
      }

      setModalOpen(false)
      setSuccessMsg(editingCategory ? 'Categoria atualizada com sucesso!' : 'Categoria criada com sucesso!')
      setTimeout(() => setSuccessMsg(''), 4000)
      await fetchCategories()
      if (onDataChanged) onDataChanged()
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar categoria')
    } finally {
      setFormLoading(false)
    }
  }

  const handleToggleActive = async (cat: PlatformFinancialCategory) => {
    try {
      const res = await authenticatedFetch(`/api/v1/admin/corporate-finance/categories/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !cat.is_active }),
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Erro ao alterar status da categoria')
      }

      setSuccessMsg(`Categoria "${cat.name}" ${cat.is_active ? 'desativada' : 'ativada'} com sucesso!`)
      setTimeout(() => setSuccessMsg(''), 4000)
      await fetchCategories()
      if (onDataChanged) onDataChanged()
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar status')
    }
  }

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return
    try {
      setDeleteLoading(true)
      const res = await authenticatedFetch(`/api/v1/admin/corporate-finance/categories/${deletingCategory.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Erro ao excluir categoria')
      }

      setSuccessMsg(`Categoria "${deletingCategory.name}" excluída com sucesso!`)
      setTimeout(() => setSuccessMsg(''), 4000)
      setDeletingCategory(null)
      await fetchCategories()
      if (onDataChanged) onDataChanged()
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir')
      setDeletingCategory(null)
    } finally {
      setDeleteLoading(false)
    }
  }

  const incomeCategories = categories.filter((c) => c.type === 'INCOME')
  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE')

  return (
    <div className="space-y-6">
      {/* Alerta */}
      <div className="bg-purple-950/30 border border-purple-900/60 rounded-xl p-4 flex items-start gap-3 text-xs text-purple-300">
        <Tags className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-purple-200">
            Plano de Contas e Categorias Corporativas
          </p>
          <p className="text-gray-400">
            Organize os centros de receita e custo da plataforma. Categorias que já possuem receitas ou despesas vinculadas não podem ser excluídas fisicamente para proteger a rastreabilidade histórica dos demonstrativos, devendo ser apenas inativadas.
          </p>
        </div>
      </div>

      {/* Sucesso */}
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
          <button onClick={fetchCategories} className="underline hover:text-white font-bold cursor-pointer">
            Recarregar
          </button>
        </div>
      )}

      {/* Ações Topo */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 p-1 rounded-xl">
          <button
            onClick={() => setTypeFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              typeFilter === 'ALL' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Todas ({categories.length})
          </button>
          <button
            onClick={() => setTypeFilter('INCOME')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              typeFilter === 'INCOME' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Receitas ({incomeCategories.length})
          </button>
          <button
            onClick={() => setTypeFilter('EXPENSE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              typeFilter === 'EXPENSE' ? 'bg-rose-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Despesas ({expenseCategories.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCategories}
            disabled={loading}
            className="p-2 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-lg text-gray-400 hover:text-white transition cursor-pointer"
            title="Recarregar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => handleOpenNew(typeFilter === 'INCOME' ? 'INCOME' : 'EXPENSE')}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Nova Categoria
          </button>
        </div>
      </div>

      {/* Grid de Listagem das Categorias */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bloco Receitas (INCOME) */}
        {(typeFilter === 'ALL' || typeFilter === 'INCOME') && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
            <div className="bg-emerald-950/40 border-b border-emerald-900/60 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                <DollarSign className="h-4 w-4" />
                Categorias de Receitas (INCOME)
              </div>
              <button
                onClick={() => handleOpenNew('INCOME')}
                className="text-xs bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 px-2.5 py-1 rounded-md font-semibold transition cursor-pointer"
              >
                + Adicionar
              </button>
            </div>

            <div className="p-4 divide-y divide-gray-800/60 flex-1">
              {loading ? (
                <div className="py-8 text-center text-gray-400 text-xs">Carregando categorias...</div>
              ) : incomeCategories.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-xs">Nenhuma categoria de receita cadastrada.</div>
              ) : (
                incomeCategories.map((cat) => (
                  <div key={cat.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-xs ${cat.is_active ? 'text-white' : 'text-gray-500 line-through'}`}>
                          {cat.name}
                        </span>
                        {!cat.is_active && (
                          <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                            Inativa
                          </span>
                        )}
                      </div>
                      {cat.description && (
                        <p className="text-[11px] text-gray-400">{cat.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleActive(cat)}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                          cat.is_active
                            ? 'bg-gray-800 hover:bg-amber-950 text-gray-400 hover:text-amber-300'
                            : 'bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900'
                        }`}
                        title={cat.is_active ? 'Desativar Categoria' : 'Ativar Categoria'}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(cat)}
                        className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition cursor-pointer"
                        title="Editar"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingCategory(cat)}
                        className="p-1.5 bg-gray-800 hover:bg-red-950/80 hover:text-red-400 text-gray-400 rounded-lg transition cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Bloco Despesas (EXPENSE) */}
        {(typeFilter === 'ALL' || typeFilter === 'EXPENSE') && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
            <div className="bg-rose-950/40 border-b border-rose-900/60 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
                <Tag className="h-4 w-4" />
                Categorias de Despesas (EXPENSE)
              </div>
              <button
                onClick={() => handleOpenNew('EXPENSE')}
                className="text-xs bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 px-2.5 py-1 rounded-md font-semibold transition cursor-pointer"
              >
                + Adicionar
              </button>
            </div>

            <div className="p-4 divide-y divide-gray-800/60 flex-1">
              {loading ? (
                <div className="py-8 text-center text-gray-400 text-xs">Carregando categorias...</div>
              ) : expenseCategories.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-xs">Nenhuma categoria de despesa cadastrada.</div>
              ) : (
                expenseCategories.map((cat) => (
                  <div key={cat.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-xs ${cat.is_active ? 'text-white' : 'text-gray-500 line-through'}`}>
                          {cat.name}
                        </span>
                        {!cat.is_active && (
                          <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                            Inativa
                          </span>
                        )}
                      </div>
                      {cat.description && (
                        <p className="text-[11px] text-gray-400">{cat.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleActive(cat)}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                          cat.is_active
                            ? 'bg-gray-800 hover:bg-amber-950 text-gray-400 hover:text-amber-300'
                            : 'bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900'
                        }`}
                        title={cat.is_active ? 'Desativar Categoria' : 'Ativar Categoria'}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(cat)}
                        className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition cursor-pointer"
                        title="Editar"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingCategory(cat)}
                        className="p-1.5 bg-gray-800 hover:bg-red-950/80 hover:text-red-400 text-gray-400 rounded-lg transition cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Nova / Editar Categoria */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Tags className="h-5 w-5 text-blue-500" />
                {editingCategory ? 'Editar Categoria Financeira' : 'Nova Categoria Financeira'}
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
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Infraestrutura em Nuvem, Consultoria"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {!editingCategory && (
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Tipo de Categoria *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 focus:outline-none focus:border-blue-500 font-semibold"
                  >
                    <option value="EXPENSE">Despesa Corporativa (EXPENSE)</option>
                    <option value="INCOME">Receita Manual (INCOME)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Descrição / Finalidade
                </label>
                <textarea
                  rows={2}
                  placeholder="Finalidade desta conta ou categoria..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {editingCategory && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="cat_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-gray-800 bg-gray-950 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <label htmlFor="cat_active" className="text-gray-300 font-medium cursor-pointer">
                    Categoria Ativa
                  </label>
                </div>
              )}

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
                  {editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmação de Exclusão */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <Trash2 className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Excluir Categoria</h3>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Deseja excluir permanentemente a categoria <strong>&quot;{deletingCategory.name}&quot;</strong>?
            </p>
            <p className="text-[11px] text-gray-400">
              Se esta categoria já tiver despesas ou receitas vinculadas, o sistema impedirá a exclusão física e sugerirá a inativação para proteger os dados fiscais.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-800 text-xs">
              <button
                onClick={() => setDeletingCategory(null)}
                disabled={deleteLoading}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-semibold transition cursor-pointer"
              >
                Voltar
              </button>
              <button
                onClick={handleDeleteCategory}
                disabled={deleteLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold transition shadow-sm shadow-rose-500/20 cursor-pointer"
              >
                {deleteLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

