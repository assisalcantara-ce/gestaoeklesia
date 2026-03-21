'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import Link from 'next/link'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import type { SubscriptionPlan } from '@/types/admin'
import { useAppDialog } from '@/providers/AppDialogProvider'

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

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    price_monthly: '',
    price_annually: '',
    max_users: '',
    max_storage_bytes: '',
    max_members: '',
    setup_fee: '0',
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

      const response = await authenticatedFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          price_monthly: parseFloat(formData.price_monthly),
          price_annually: parseFloat(formData.price_annually || '0'),
          max_users: parseInt(formData.max_users),
          max_storage_bytes: parseInt(formData.max_storage_bytes),
          max_members: parseInt(formData.max_members),
          setup_fee: parseFloat(formData.setup_fee),
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
      setup_fee: '0',
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
      setup_fee: (plan.setup_fee || 0).toString(),
      has_api_access: plan.has_api_access,
      has_custom_domain: plan.has_custom_domain,
      has_advanced_reports: plan.has_advanced_reports,
      has_priority_support: plan.has_priority_support,
      has_white_label: plan.has_white_label,
      has_automation: plan.has_automation,
    })
    setShowForm(true)
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
            <h1 className="text-2xl font-bold text-gray-800">Planos de Assinatura</h1>
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

        {/* Botão */}
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

        {/* Formulário */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">
              {selectedPlan ? 'Editar Plano' : 'Novo Plano'}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <input
                  type="text"
                  placeholder="Nome do Plano"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <input
                type="text"
                placeholder="Slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                required
                className="px-4 py-2 border border-gray-300 rounded-lg"
              />

              <textarea
                placeholder="Descrição"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="col-span-3 px-4 py-2 border border-gray-300 rounded-lg"
                rows={2}
              />

              <input
                type="number"
                step="0.01"
                placeholder="Preço Mensal (R$)"
                value={formData.price_monthly}
                onChange={(e) => setFormData({ ...formData, price_monthly: e.target.value })}
                required
                className="px-4 py-2 border border-gray-300 rounded-lg"
              />

              <input
                type="number"
                step="0.01"
                placeholder="Preço Anual (R$)"
                value={formData.price_annually}
                onChange={(e) => setFormData({ ...formData, price_annually: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              />

              <input
                type="number"
                step="0.01"
                placeholder="Taxa de Setup (R$)"
                value={formData.setup_fee}
                onChange={(e) => setFormData({ ...formData, setup_fee: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              />

              <input
                type="number"
                placeholder="Máximo de Usuários"
                value={formData.max_users}
                onChange={(e) => setFormData({ ...formData, max_users: e.target.value })}
                required
                className="px-4 py-2 border border-gray-300 rounded-lg"
              />

              <input
                type="number"
                placeholder="Máximo de Membros"
                value={formData.max_members}
                onChange={(e) => setFormData({ ...formData, max_members: e.target.value })}
                required
                className="px-4 py-2 border border-gray-300 rounded-lg"
              />

              <input
                type="number"
                placeholder="Storage (bytes)"
                value={formData.max_storage_bytes}
                onChange={(e) => setFormData({ ...formData, max_storage_bytes: e.target.value })}
                required
                className="px-4 py-2 border border-gray-300 rounded-lg"
              />

              <h3 className="col-span-3 font-semibold text-lg mt-4">Recursos</h3>

              <label className="col-span-1 flex items-center">
                <input
                  type="checkbox"
                  checked={formData.has_api_access}
                  onChange={(e) => setFormData({ ...formData, has_api_access: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="ml-2">Acesso à API</span>
              </label>

              <label className="col-span-1 flex items-center">
                <input
                  type="checkbox"
                  checked={formData.has_custom_domain}
                  onChange={(e) => setFormData({ ...formData, has_custom_domain: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="ml-2">Domínio Customizado</span>
              </label>

              <label className="col-span-1 flex items-center">
                <input
                  type="checkbox"
                  checked={formData.has_advanced_reports}
                  onChange={(e) => setFormData({ ...formData, has_advanced_reports: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="ml-2">Relatórios Avançados</span>
              </label>

              <label className="col-span-1 flex items-center">
                <input
                  type="checkbox"
                  checked={formData.has_priority_support}
                  onChange={(e) => setFormData({ ...formData, has_priority_support: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="ml-2">Suporte Prioritário</span>
              </label>

              <label className="col-span-1 flex items-center">
                <input
                  type="checkbox"
                  checked={formData.has_white_label}
                  onChange={(e) => setFormData({ ...formData, has_white_label: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="ml-2">White Label</span>
              </label>

              <label className="col-span-1 flex items-center">
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
                className="col-span-3 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                {selectedPlan ? 'Atualizar Plano' : 'Criar Plano'}
              </button>
            </form>
          </div>
        )}

        {/* Grid de Planos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-3 text-center text-gray-600">Carregando...</div>
          ) : planos.length === 0 ? (
            <div className="col-span-3 text-center text-gray-600">Nenhum plano encontrado</div>
          ) : (
            planos.map((plan) => (
              <div key={plan.id} className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                  <p className="text-blue-100 mt-2">{plan.description}</p>
                </div>

                {/* Preço */}
                <div className="p-6 border-b">
                  <div className="text-4xl font-bold text-gray-800">
                    R$ {plan.price_monthly.toFixed(2)}
                    <span className="text-lg text-gray-600">/mês</span>
                  </div>
                  {plan.price_annually && (
                    <p className="text-sm text-gray-600 mt-2">
                      R$ {plan.price_annually.toFixed(2)}/ano
                    </p>
                  )}
                </div>

                {/* Features */}
                <div className="p-6 border-b">
                  <ul className="space-y-3">
                    <li className="flex items-center text-sm">
                      <span className="font-semibold text-gray-800 mr-2">👥</span>
                      {plan.max_users} usuários
                    </li>
                    <li className="flex items-center text-sm">
                      <span className="font-semibold text-gray-800 mr-2">👤</span>
                      {plan.max_members} membros
                    </li>
                    <li className="flex items-center text-sm">
                      <span className="font-semibold text-gray-800 mr-2">💾</span>
                      {(plan.max_storage_bytes / (1024 * 1024 * 1024)).toFixed(1)} GB
                    </li>

                    {plan.has_api_access && (
                      <li className="text-green-600 text-sm flex items-center">
                        <span className="mr-2">✓</span> API Access
                      </li>
                    )}
                    {plan.has_custom_domain && (
                      <li className="text-green-600 text-sm flex items-center">
                        <span className="mr-2">✓</span> Domínio Customizado
                      </li>
                    )}
                    {plan.has_advanced_reports && (
                      <li className="text-green-600 text-sm flex items-center">
                        <span className="mr-2">✓</span> Relatórios Avançados
                      </li>
                    )}
                    {plan.has_priority_support && (
                      <li className="text-green-600 text-sm flex items-center">
                        <span className="mr-2">✓</span> Suporte Prioritário
                      </li>
                    )}
                  </ul>
                </div>

                {/* Ações */}
                <div className="p-6 flex gap-2">
                  <button
                    onClick={() => handleEdit(plan)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={async () => {
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
  )
}
