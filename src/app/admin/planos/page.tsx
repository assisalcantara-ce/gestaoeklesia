'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import type { SubscriptionPlan } from '@/types/admin'
import { useAppDialog } from '@/providers/AppDialogProvider'
import AdminSidebar from '@/components/AdminSidebar'

export default function PlanosPage() {
  const { isLoading, isAuthenticated } = useAdminAuth()
  const dialog = useAppDialog()
  const formRef = useRef<HTMLDivElement>(null)
  const [planos, setPlanos] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [expandedModulos, setExpandedModulos] = useState<Record<string, boolean>>({})
  const router = useRouter()

  const slugify = (value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    price_monthly: '',
    price_annually: '',
    max_users: '',
    max_members: '',
    members_unlimited: false,
    max_ministerios: '',
    additional_church_monthly_fee: '50',
    additional_admin_users_per_church: '2',
    setup_fee: '',
    has_api_access: false,
    has_advanced_reports: false,
    has_priority_support: false,
    has_modulo_financeiro: false,
    has_modulo_eventos: false,
    has_modulo_reunioes: false,
    has_custom_domain: false,
    has_white_label: false,
    has_automation: false,
    modulos: '' as string, // um módulo por linha
  })

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      fetchPlanos()
    }
  }, [isAuthenticated])

  const fetchPlanos = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch('/api/v1/admin/plans')
      if (!response.ok) {
        throw new Error('Erro ao carregar planos')
      }

      const data = await response.json()
      setPlanos(data.data || [])
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
      const url = selectedPlan
        ? `/api/v1/admin/plans/${selectedPlan.id}`
        : '/api/v1/admin/plans'
      
      const method = selectedPlan ? 'PATCH' : 'POST'

      const slugValue = formData.slug?.trim() || slugify(formData.name)

      const response = await authenticatedFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          slug: slugValue,
          price_monthly: parseFloat(formData.price_monthly),
          price_annually: parseFloat(formData.price_annually || '0'),
          max_users: parseInt(formData.max_users),
          max_members: formData.members_unlimited ? 0 : parseInt(formData.max_members || '0'),
          max_ministerios: parseInt(formData.max_ministerios),
          additional_church_monthly_fee: parseFloat(formData.additional_church_monthly_fee || '0'),
          additional_admin_users_per_church: parseInt(formData.additional_admin_users_per_church || '0'),
          setup_fee: parseFloat(formData.setup_fee || '0'),
          modulos: formData.modulos
            .split('\n')
            .map((m) => m.trim())
            .filter(Boolean),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao salvar plano')
      }

      setSuccess(selectedPlan ? 'Plano atualizado!' : 'Plano criado!')
      resetForm()
      fetchPlanos()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      price_monthly: '',
      price_annually: '',
      max_users: '',
      max_members: '',
      members_unlimited: false,
      max_ministerios: '',
      additional_church_monthly_fee: '50',
      additional_admin_users_per_church: '2',
      setup_fee: '',
      has_api_access: false,
      has_advanced_reports: false,
      has_priority_support: false,
      has_modulo_financeiro: false,
      has_modulo_eventos: false,
      has_modulo_reunioes: false,
      has_custom_domain: false,
      has_white_label: false,
      has_automation: false,
      modulos: '',
    })
    setSelectedPlan(null)
    setShowForm(false)
  }

  const handleEdit = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan)
    setFormData({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      price_monthly: plan.price_monthly.toString(),
      price_annually: (plan.price_annually || 0).toString(),
      max_users: plan.max_users.toString(),
      max_members: plan.max_members > 0 ? plan.max_members.toString() : '',
      members_unlimited: plan.max_members <= 0,
      max_ministerios: String((plan as any).max_ministerios ?? ''),
      additional_church_monthly_fee: String((plan as any).additional_church_monthly_fee ?? 50),
      additional_admin_users_per_church: String((plan as any).additional_admin_users_per_church ?? 2),
      setup_fee: plan.setup_fee ? plan.setup_fee.toString() : '',
      has_api_access: plan.has_api_access,
      has_advanced_reports: plan.has_advanced_reports,
      has_priority_support: plan.has_priority_support,
      has_modulo_financeiro: (plan as any).has_modulo_financeiro || false,
      has_modulo_eventos: (plan as any).has_modulo_eventos || false,
      has_modulo_reunioes: (plan as any).has_modulo_reunioes || false,
      has_custom_domain: (plan as any).has_custom_domain || false,
      has_white_label: (plan as any).has_white_label || false,
      has_automation: (plan as any).has_automation || false,
      modulos: Array.isArray((plan as any).modulos) ? (plan as any).modulos.join('\n') : '',
    })
    setShowForm(true)
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  const visiblePlanos = planos.filter((plan) => showInactive || plan.is_active)
  const orderedPlanos = [...visiblePlanos].sort((a, b) => a.price_monthly - b.price_monthly)

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 z-10">
          <h2 className="text-2xl font-bold text-white">PAINEL ADMINISTRATIVO: PLANOS</h2>
          <p className="text-gray-400 text-sm mt-1">Gestão de planos e limites</p>
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

            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    resetForm()
                    setShowForm(!showForm)
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {showForm ? 'Cancelar' : '+ Novo Plano'}
                </button>

                <button
                  onClick={() => setShowInactive((prev) => !prev)}
                  className="px-4 py-2 bg-gray-700 text-gray-100 rounded-lg hover:bg-gray-600 text-sm"
                >
                  {showInactive ? 'Ocultar Inativos' : 'Mostrar Inativos'}
                </button>
              </div>
            </div>

            {showForm && (
              <div ref={formRef} className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6 mb-6 text-gray-100">
                <h2 className="text-xl font-bold mb-4">
                  {selectedPlan ? 'Editar Plano' : 'Novo Plano'}
                </h2>
                <form
                  onSubmit={handleSubmit}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4 [&_input]:bg-gray-900 [&_input]:border-gray-700 [&_input]:text-gray-100 [&_input]:placeholder:text-gray-500 [&_textarea]:bg-gray-900 [&_textarea]:border-gray-700 [&_textarea]:text-gray-100 [&_textarea]:placeholder:text-gray-500"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Nome do Plano</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Usuários Administrativos</label>
                    <input
                      type="number"
                      value={formData.max_users}
                      onChange={(e) => setFormData({ ...formData, max_users: e.target.value })}
                      required
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Máximo de Membros</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.max_members}
                      onChange={(e) => setFormData({ ...formData, max_members: e.target.value })}
                      disabled={formData.members_unlimited}
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                    <label className="mt-2 flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={formData.members_unlimited}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            members_unlimited: e.target.checked,
                            max_members: e.target.checked ? '' : formData.max_members,
                          })
                        }
                        className="w-4 h-4 rounded"
                      />
                      Membros ilimitados
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Igrejas Inclusas</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.max_ministerios}
                      onChange={(e) => setFormData({ ...formData, max_ministerios: e.target.value })}
                      required
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Taxa por Igreja Adicional (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.additional_church_monthly_fee}
                      onChange={(e) => setFormData({ ...formData, additional_church_monthly_fee: e.target.value })}
                      required
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Admins por Igreja Adicional</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.additional_admin_users_per_church}
                      onChange={(e) => setFormData({ ...formData, additional_admin_users_per_church: e.target.value })}
                      required
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Descrição</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Preço Mensal (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price_monthly}
                      onChange={(e) => setFormData({ ...formData, price_monthly: e.target.value })}
                      required
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Preço Anual (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price_annually}
                      onChange={(e) => setFormData({ ...formData, price_annually: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Preço de Implantação (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.setup_fee}
                      onChange={(e) => setFormData({ ...formData, setup_fee: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>


                  <h3 className="md:col-span-3 font-semibold text-lg mt-4">Recursos</h3>

                  <label className="col-span-1 flex items-center text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={formData.has_api_access}
                      onChange={(e) => setFormData({ ...formData, has_api_access: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="ml-2">Acesso à API</span>
                  </label>



                  <label className="col-span-1 flex items-center text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={formData.has_advanced_reports}
                      onChange={(e) => setFormData({ ...formData, has_advanced_reports: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="ml-2">Relatórios Avançados</span>
                  </label>

                  <label className="col-span-1 flex items-center text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={formData.has_priority_support}
                      onChange={(e) => setFormData({ ...formData, has_priority_support: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="ml-2">Suporte Prioritário</span>
                  </label>

                  <h3 className="md:col-span-3 font-semibold text-lg mt-4">Módulos Extras</h3>

                  <label className="col-span-1 flex items-center text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={formData.has_modulo_financeiro}
                      onChange={(e) => setFormData({ ...formData, has_modulo_financeiro: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="ml-2">Financeiro</span>
                  </label>

                  <label className="col-span-1 flex items-center text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={formData.has_modulo_eventos}
                      onChange={(e) => setFormData({ ...formData, has_modulo_eventos: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="ml-2">Eventos</span>
                  </label>

                  <label className="col-span-1 flex items-center text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={formData.has_modulo_reunioes}
                      onChange={(e) => setFormData({ ...formData, has_modulo_reunioes: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="ml-2">Reuniões</span>
                  </label>

                  <label className="col-span-1 flex items-center text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={formData.has_custom_domain}
                      onChange={(e) => setFormData({ ...formData, has_custom_domain: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="ml-2">Domínio Próprio</span>
                  </label>

                  <label className="col-span-1 flex items-center text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={formData.has_white_label}
                      onChange={(e) => setFormData({ ...formData, has_white_label: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="ml-2">White Label</span>
                  </label>

                  <label className="col-span-1 flex items-center text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={formData.has_automation}
                      onChange={(e) => setFormData({ ...formData, has_automation: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="ml-2">Automação</span>
                  </label>

                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Módulos inclusos <span className="text-gray-500 font-normal">(um por linha)</span>
                    </label>
                    <textarea
                      value={formData.modulos}
                      onChange={(e) => setFormData({ ...formData, modulos: e.target.value })}
                      rows={6}
                      placeholder={'Secretaria Geral\nTesouraria\nMissões\nChat Interno'}
                      className="w-full px-4 py-2 border rounded-lg font-mono text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    className="md:col-span-3 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    {selectedPlan ? 'Atualizar Plano' : 'Criar Plano'}
                  </button>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {loading ? (
                <div className="col-span-4 text-center text-gray-400">Carregando...</div>
              ) : orderedPlanos.length === 0 ? (
                <div className="col-span-4 text-center text-gray-400">Nenhum plano encontrado</div>
              ) : (
                orderedPlanos.map((plan) => (
                  <div
                    key={plan.id}
                    className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden hover:border-gray-700 transition"
                  >
                    <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-6">
                      <h3 className="text-2xl font-bold">{plan.name}</h3>
                      <p className="text-blue-100 mt-2">{plan.description || 'Sem descrição cadastrada.'}</p>
                      {!plan.is_active && (
                        <span className="inline-block mt-3 px-2 py-1 text-xs rounded bg-gray-900/40 border border-white/30">
                          Inativo
                        </span>
                      )}
                    </div>

                    <div className="p-6 border-b border-gray-800">
                      <div className="text-3xl font-bold text-white">
                        R$ {plan.price_monthly.toFixed(2)}
                        <span className="text-base text-gray-300">/mês</span>
                      </div>
                      {(plan.price_annually ?? 0) > 0 && (
                        <p className="text-sm text-gray-300 mt-2">
                          R$ {plan.price_annually!.toFixed(2)}/ano
                        </p>
                      )}
                    </div>

                    <div className="p-6 border-b border-gray-800">
                      <ul className="space-y-3 text-gray-200">
                        <li className="flex items-center text-sm">
                          <span className="font-semibold text-gray-100 mr-2">👥</span>
                          {plan.max_members > 0 ? `Até ${plan.max_members} Membros` : 'Membros ilimitados'}
                        </li>
                        <li className="flex items-center text-sm">
                          <span className="font-semibold text-gray-100 mr-2">🏛️</span>
                          Até {(plan as any).max_ministerios || 0} Igrejas Inclusas
                        </li>
                        <li className="flex items-center text-sm">
                          <span className="font-semibold text-gray-100 mr-2">👥</span>
                          Até {plan.max_users} Usuários Administrativos
                        </li>
                        <li className="flex items-center text-sm">
                          <span className="font-semibold text-gray-100 mr-2">➕</span>
                          R$ {Number((plan as any).additional_church_monthly_fee || 0).toFixed(2)} por igreja adicional/mês
                        </li>
                        <li className="flex items-center text-sm">
                          <span className="font-semibold text-gray-100 mr-2">👤</span>
                          +{(plan as any).additional_admin_users_per_church || 0} admins por igreja adicional
                        </li>
                      </ul>
                    </div>

                    {Array.isArray((plan as any).modulos) && (plan as any).modulos.length > 0 && (
                      <div className="border-b border-gray-800">
                        <button
                          onClick={() => setExpandedModulos(prev => ({ ...prev, [plan.id]: !prev[plan.id] }))}
                          className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-gray-800/50 transition"
                        >
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Módulos inclusos ({(plan as any).modulos.length})
                          </span>
                          <span className="text-gray-500 text-xs transition-transform duration-200" style={{ display: 'inline-block', transform: expandedModulos[plan.id] ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                        </button>
                        {expandedModulos[plan.id] && (
                          <ul className="px-6 pb-4 space-y-1">
                            {(plan as any).modulos.map((m: string) => (
                              <li key={m} className="flex items-center gap-2 text-sm text-gray-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                                {m}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    <div className="p-6 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(plan);
                        }}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        Editar
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await dialog.confirm({
                            title: 'Confirmar',
                            type: 'warning',
                            message: `Desativar plano "${plan.name}"?`,
                            confirmText: 'OK',
                            cancelText: 'Cancelar',
                          })

                          if (ok) {
                            try {
                              setError('')
                              setSuccess('')
                              const response = await authenticatedFetch(`/api/v1/admin/plans/${plan.id}`, {
                                method: 'DELETE',
                              })

                              if (!response.ok) {
                                const payload = await response.json().catch(() => ({}))
                                throw new Error(payload?.error || 'Erro ao desativar plano')
                              }

                              setSuccess(`Plano "${plan.name}" desativado.`)
                              fetchPlanos()
                            } catch (err: any) {
                              setError(err.message || 'Erro ao desativar plano')
                            }
                          }
                        }}
                        disabled={!plan.is_active}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {plan.is_active ? 'Desativar' : 'Inativo'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
