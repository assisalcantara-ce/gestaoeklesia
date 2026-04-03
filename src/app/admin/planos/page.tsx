'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import type { SubscriptionPlan } from '@/types/admin'
import { useAppDialog } from '@/providers/AppDialogProvider'
import AdminSidebar from '@/components/AdminSidebar'

export default function PlanosPage() {
  const { isLoading, isAuthenticated } = useAdminAuth()
  const dialog = useAppDialog()
  const [planos, setPlanos] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
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
    max_storage_bytes: '',
    max_members: '',
    max_ministerios: '',
    max_divisao1: '',
    max_divisao2: '',
    max_divisao3: '',
    setup_fee: '',
    has_api_access: false,
    has_custom_domain: false,
    has_advanced_reports: false,
    has_priority_support: false,
    has_white_label: false,
    has_automation: false,
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
          max_storage_bytes: parseInt(formData.max_storage_bytes),
          max_members: parseInt(formData.max_members),
          max_ministerios: parseInt(formData.max_ministerios || '0'),
          max_divisao1: parseInt(formData.max_divisao1 || '5'),
          max_divisao2: parseInt(formData.max_divisao2 || '0'),
          max_divisao3: parseInt(formData.max_divisao3 || '-1'),
          setup_fee: parseFloat(formData.setup_fee || '0'),
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
      max_storage_bytes: '',
      max_members: '',
      max_ministerios: '',
      max_divisao1: '',
      max_divisao2: '',
      max_divisao3: '',
      setup_fee: '',
      has_api_access: false,
      has_custom_domain: false,
      has_advanced_reports: false,
      has_priority_support: false,
      has_white_label: false,
      has_automation: false,
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
      max_storage_bytes: plan.max_storage_bytes.toString(),
      max_members: plan.max_members.toString(),
      max_ministerios: plan.max_ministerios?.toString() || '',
      max_divisao1: plan.max_divisao1?.toString() || '5',
      max_divisao2: plan.max_divisao2?.toString() || '0',
      max_divisao3: plan.max_divisao3?.toString() || '-1',
      setup_fee: plan.setup_fee ? plan.setup_fee.toString() : '',
      has_api_access: plan.has_api_access,
      has_custom_domain: plan.has_custom_domain,
      has_advanced_reports: plan.has_advanced_reports,
      has_priority_support: plan.has_priority_support,
      has_white_label: plan.has_white_label,
      has_automation: plan.has_automation,
    })
    setShowForm(true)
  }

  const orderedPlanos = [...planos].sort((a, b) => {
    const order = ['starter', 'intermediario', 'intermediário', 'profissional', 'expert']
    const aKey = String(a.name || '').toLowerCase()
    const bKey = String(b.name || '').toLowerCase()
    const aIndex = order.findIndex((label) => aKey === label)
    const bIndex = order.findIndex((label) => bKey === label)
    if (aIndex === -1 && bIndex === -1) return aKey.localeCompare(bKey)
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })

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
              <button
                onClick={() => {
                  resetForm()
                  setShowForm(!showForm)
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {showForm ? 'Cancelar' : '+ Novo Plano'}
              </button>
            </div>

            {showForm && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6 mb-6 text-gray-100">
                <h2 className="text-xl font-bold mb-4">
                  {selectedPlan ? 'Editar Plano' : 'Novo Plano'}
                </h2>
                <form
                  onSubmit={handleSubmit}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4 [&_input]:bg-gray-900 [&_input]:border-gray-700 [&_input]:text-gray-100 [&_input]:placeholder:text-gray-500 [&_textarea]:bg-gray-900 [&_textarea]:border-gray-700 [&_textarea]:text-gray-100 [&_textarea]:placeholder:text-gray-500"
                >
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      placeholder="Nome do Plano"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>

                  <input
                    type="number"
                    placeholder="Usuários Administrativos"
                    value={formData.max_users}
                    onChange={(e) => setFormData({ ...formData, max_users: e.target.value })}
                    required
                    className="px-4 py-2 border rounded-lg"
                  />

                  <textarea
                    placeholder="Descrição"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="md:col-span-3 px-4 py-2 border rounded-lg"
                    rows={2}
                  />

                  <input
                    type="number"
                    step="0.01"
                    placeholder="Preço Mensal (R$)"
                    value={formData.price_monthly}
                    onChange={(e) => setFormData({ ...formData, price_monthly: e.target.value })}
                    required
                    className="px-4 py-2 border rounded-lg"
                  />

                  <input
                    type="number"
                    step="0.01"
                    placeholder="Preço Anual (R$)"
                    value={formData.price_annually}
                    onChange={(e) => setFormData({ ...formData, price_annually: e.target.value })}
                    className="px-4 py-2 border rounded-lg"
                  />

                  <input
                    type="number"
                    step="0.01"
                    placeholder="Preço de Implantação (R$)"
                    value={formData.setup_fee}
                    onChange={(e) => setFormData({ ...formData, setup_fee: e.target.value })}
                    className="px-4 py-2 border rounded-lg"
                  />

                  <input
                    type="number"
                    placeholder="Máximo de Campos"
                    value={formData.max_storage_bytes}
                    onChange={(e) => setFormData({ ...formData, max_storage_bytes: e.target.value })}
                    required
                    className="px-4 py-2 border rounded-lg"
                  />

                  <input
                    type="number"
                    placeholder="Máximo de Igrejas"
                    value={formData.max_ministerios}
                    onChange={(e) => setFormData({ ...formData, max_ministerios: e.target.value })}
                    required
                    className="px-4 py-2 border rounded-lg"
                  />

                  <input
                    type="number"
                    placeholder="Limite 1ª Divisão (ex: Supervisão)"
                    value={formData.max_divisao1}
                    onChange={(e) => setFormData({ ...formData, max_divisao1: e.target.value })}
                    title="Máximo de registros da 1ª divisão hierárquica"
                    required
                    className="px-4 py-2 border rounded-lg"
                  />

                  <input
                    type="number"
                    placeholder="Limite 2ª Divisão (0 = nenhuma)"
                    value={formData.max_divisao2}
                    onChange={(e) => setFormData({ ...formData, max_divisao2: e.target.value })}
                    title="Máximo de registros da 2ª divisão. 0 = não permitido"
                    required
                    className="px-4 py-2 border rounded-lg"
                  />

                  <input
                    type="number"
                    placeholder="Limite 3ª Divisão (-1 = ilimitado, 0 = nenhuma)"
                    value={formData.max_divisao3}
                    onChange={(e) => setFormData({ ...formData, max_divisao3: e.target.value })}
                    title="-1 = ilimitado, 0 = não permitido, N = máximo N"
                    required
                    className="px-4 py-2 border rounded-lg"
                  />

                  <input
                    type="number"
                    placeholder="Máximo de Membros"
                    value={formData.max_members}
                    onChange={(e) => setFormData({ ...formData, max_members: e.target.value })}
                    required
                    className="px-4 py-2 border rounded-lg"
                  />


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
                      checked={formData.has_custom_domain}
                      onChange={(e) => setFormData({ ...formData, has_custom_domain: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="ml-2">Domínio Customizado</span>
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

                  <button
                    type="submit"
                    className="md:col-span-3 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    {selectedPlan ? 'Atualizar Plano' : 'Criar Plano'}
                  </button>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {loading ? (
                <div className="md:col-span-3 text-center text-gray-400">Carregando...</div>
              ) : planos.length === 0 ? (
                <div className="md:col-span-3 text-center text-gray-400">Nenhum plano encontrado</div>
              ) : (
                orderedPlanos.map((plan) => (
                  <div
                    key={plan.id}
                    className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden hover:border-gray-700 transition cursor-pointer"
                    onClick={() => handleEdit(plan)}
                  >
                    <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-6">
                      <h3 className="text-2xl font-bold">{plan.name}</h3>
                      <p className="text-blue-100 mt-2">{plan.description}</p>
                    </div>

                    <div className="p-6 border-b border-gray-800">
                      <div className="text-3xl font-bold text-white">
                        R$ {plan.price_monthly.toFixed(2)}
                        <span className="text-base text-gray-300">/mês</span>
                      </div>
                      {plan.price_annually && (
                        <p className="text-sm text-gray-300 mt-2">
                          R$ {plan.price_annually.toFixed(2)}/ano
                        </p>
                      )}
                    </div>

                    <div className="p-6 border-b border-gray-800">
                      <ul className="space-y-3 text-gray-200">
                        <li className="flex items-center text-sm">
                          <span className="font-semibold text-gray-100 mr-2">🗂️</span>
                          Até {plan.max_storage_bytes} Campos
                        </li>
                        <li className="flex items-center text-sm">
                          <span className="font-semibold text-gray-100 mr-2">🏛️</span>
                          Até {plan.max_ministerios} Igrejas
                        </li>
                        <li className="flex items-center text-sm">
                          <span className="font-semibold text-gray-100 mr-2">👤</span>
                          Até {plan.max_members} Membros
                        </li>
                        <li className="flex items-center text-sm">
                          <span className="font-semibold text-gray-100 mr-2">👥</span>
                          Até {plan.max_users} Usuários Administrativos
                        </li>

                        {plan.has_api_access && (
                          <li className="text-green-300 text-sm flex items-center">
                            <span className="mr-2">✓</span> API Access
                          </li>
                        )}
                        {plan.has_custom_domain && (
                          <li className="text-green-300 text-sm flex items-center">
                            <span className="mr-2">✓</span> Domínio Customizado
                          </li>
                        )}
                        {plan.has_advanced_reports && (
                          <li className="text-green-300 text-sm flex items-center">
                            <span className="mr-2">✓</span> Relatórios Avançados
                          </li>
                        )}
                        {plan.has_priority_support && (
                          <li className="text-green-300 text-sm flex items-center">
                            <span className="mr-2">✓</span> Suporte Prioritário
                          </li>
                        )}
                      </ul>
                    </div>

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
                            // TODO: Implementar DELETE
                          }
                        }}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                      >
                        Desativar
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
