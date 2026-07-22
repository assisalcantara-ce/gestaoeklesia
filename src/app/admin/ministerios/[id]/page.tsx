'use client'

import { useState, useEffect, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import { temAcessoAdmin } from '@/lib/access-control'
import { authenticatedFetch } from '@/lib/api-client'
import type { SubscriptionPlan } from '@/types/admin'
import type { Ministry as SupabaseMinistry } from '@/types/supabase'
import AdminSidebar from '@/components/AdminSidebar'
import MinisteriosHeader from '@/components/admin/ministerios/MinisteriosHeader'
import BillingModal from '@/components/admin/ministerios/modals/BillingModal'
import ActivationModal from '@/components/admin/ministerios/modals/ActivationModal'
import { useBillingActions } from '@/hooks/admin/ministerios/useBillingActions'
import { friendlyError, getDetailedStatus, formatPhoneDisplay } from '@/lib/admin/ministerios/helpers'

interface CockpitPageProps {
  params: Promise<{ id: string }>
}

export default function CockpitPage({ params }: CockpitPageProps) {
  const { id } = use(params)
  const { isLoading, isAuthenticated, adminUser } = useAdminAuth()
  const [ministerios, setMinisterios] = useState<SupabaseMinistry[]>([])
  const [ministry, setMinistry] = useState<SupabaseMinistry | null>(null)
  const [planos, setPlanos] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState<'resumo' | 'financeiro' | 'usuarios' | 'congregacoes' | 'uso' | 'auditoria'>('resumo')
  const router = useRouter()
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/admin/login')
        return
      }
      if (!temAcessoAdmin(adminUser?.role, 'ministerios')) {
        router.push('/admin/dashboard')
      }
    }
  }, [isLoading, isAuthenticated, adminUser, router])

  useEffect(() => {
    if (isAuthenticated && temAcessoAdmin(adminUser?.role, 'ministerios')) {
      fetchMinistryData()
      fetchPlanos()
    }
  }, [isAuthenticated, adminUser, id])

  const fetchPlanos = async () => {
    try {
      const response = await authenticatedFetch('/api/v1/admin/plans')
      if (!response.ok) {
        throw new Error('Erro ao carregar planos')
      }
      const data = await response.json()
      setPlanos(data.data || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  const fetchMinistryData = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch(`/api/v1/admin/ministries?limit=1000`)
      if (!response.ok) {
        throw new Error('Erro ao buscar dados do ministério')
      }
      const resData = await response.json()
      const list: SupabaseMinistry[] = resData.data || []
      setMinisterios(list)
      const found = list.find((m) => m.id === id)
      if (found) {
        setMinistry(found)
      } else {
        throw new Error('Ministério não encontrado no sistema.')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const showError = (msg: string) => {
    setError(friendlyError(msg))
    setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  // Hook Reutilizado de Ações Financeiras e Ativação
  const {
    billingMinistry,
    setBillingMinistry,
    billingPlan,
    setBillingPlan,
    billingDueDate,
    setBillingDueDate,
    billingInstallments,
    setBillingInstallments,
    billingLoading,
    billingSuccessData,
    setBillingSuccessData,
    activatingMinistry,
    setActivatingMinistry,
    confirmActivation,
    setConfirmActivation,
    activationPlan,
    setActivationPlan,
    activationValidity,
    setActivationValidity,
    customValidity,
    setCustomValidity,
    activationObservation,
    setActivationObservation,
    activationLoading,
    activationMode,
    setActivationMode,
    asaasDueDate,
    setAsaasDueDate,
    asaasSuccessData,
    setAsaasSuccessData,
    handleOpenActivate,
    handleActivateSubmit,
    handleOpenBilling,
    getPlanPrice,
    handleCreateBillingSubmit,
  } = useBillingActions({
    planos,
    setSuccess: (msg) => {
      setSuccess(msg)
      fetchMinistryData() // recarregar dados apos ativacao ou cobranca
    },
    showError,
    fetchMinisterios: fetchMinistryData,
    setMinisterios,
  })

  // Evitar erro TS6133
  void ministerios;

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-900">
        <AdminSidebar />
        <main className="flex-1 p-12 text-center text-gray-400">Carregando Cockpit...</main>
      </div>
    )
  }

  if (!ministry) {
    return (
      <div className="flex h-screen bg-gray-900">
        <AdminSidebar />
        <main className="flex-1 p-12 text-center text-red-400">Ministério não encontrado</main>
      </div>
    )
  }

  const statusDetail = getDetailedStatus(ministry)
  const faturas = (ministry as any).platform_billing_invoices || []

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        <MinisteriosHeader
          titulo={`COCKPIT: ${ministry.name}`}
          descricao="Visualização detalhada e gerenciamento comercial do cliente"
        />

        <div className="p-6 space-y-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {error && (
              <div ref={errorRef} className="bg-red-900 border border-red-700 text-red-200 p-4 rounded flex items-start gap-3">
                <span className="text-xl leading-none mt-0.5">&#9888;</span>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-green-900 border border-green-700 text-green-200 p-4 rounded">
                {success}
              </div>
            )}

            {/* Cabeçalho do Cliente */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                {ministry.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ministry.logo_url} alt={ministry.name} className="w-16 h-16 rounded-lg object-cover border border-gray-600" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-700 border border-gray-600 flex items-center justify-center text-2xl font-bold text-gray-300">
                    {ministry.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="space-y-1">
                  <h1 className="text-2xl font-bold text-white uppercase">{ministry.name}</h1>
                  <div className="flex flex-wrap gap-2 items-center text-sm text-gray-400">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${statusDetail.class}`}>
                      {statusDetail.label}
                    </span>
                    <span>•</span>
                    <span className="uppercase text-xs font-bold text-gray-200">Plano: {ministry.plan || 'Starter'}</span>
                    <span>•</span>
                    <span>Criado em: {new Date(ministry.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </div>

              {/* Ações rápidas */}
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/admin/ministerios/${ministry.id}/editar`}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg text-sm transition"
                >
                  📝 Editar Cadastro
                </Link>
                <button
                  onClick={() => handleOpenActivate(ministry)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-sm transition"
                >
                  ⚡ Ativar / Renovar
                </button>
                <button
                  onClick={() => handleOpenBilling(ministry)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-sm transition"
                >
                  💰 Gerar Cobrança
                </button>
              </div>
            </div>

            {/* Abas de Informação */}
            <div className="border-b border-gray-800">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'resumo', label: '📋 Resumo Cadastral' },
                  { id: 'financeiro', label: '💳 Financeiro Asaas' },
                  { id: 'usuarios', label: '🔑 Acesso e Usuários' },
                  { id: 'congregacoes', label: '⛪ Congregações' },
                  { id: 'uso', label: '📊 Uso e Limites' },
                  { id: 'auditoria', label: '📜 Auditoria' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-2.5 text-sm font-medium transition rounded-t-lg border-b-2 ${
                      activeTab === tab.id
                        ? 'text-blue-400 border-blue-400 bg-gray-800/40'
                        : 'text-gray-400 border-transparent hover:text-gray-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conteúdo das Abas */}
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-6">
              {activeTab === 'resumo' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-200">Informações Básicas</h3>
                    <div className="space-y-2 text-sm">
                      <p><span className="text-gray-400">Nome:</span> {ministry.name}</p>
                      <p><span className="text-gray-400">Responsável:</span> {ministry.responsible_name || '-'}</p>
                      <p><span className="text-gray-400">Documento:</span> {ministry.cnpj_cpf || '-'}</p>
                      <p><span className="text-gray-400">Site/Rede:</span> {ministry.website ? <a href={ministry.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{ministry.website}</a> : '-'}</p>
                      <p><span className="text-gray-400">Descrição:</span> {ministry.description || '-'}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-200">Endereço & Contato</h3>
                    <div className="space-y-2 text-sm">
                      <p><span className="text-gray-400">Email Administrativo:</span> {ministry.email_admin || '-'}</p>
                      <p><span className="text-gray-400">Telefone:</span> {formatPhoneDisplay(ministry.phone)}</p>
                      <p><span className="text-gray-400">WhatsApp:</span> {formatPhoneDisplay(ministry.whatsapp)}</p>
                      <p><span className="text-gray-400">Endereço:</span> {`${ministry.address_street || '-'}, ${ministry.address_number || '-'}`}</p>
                      <p><span className="text-gray-400">Complemento:</span> {ministry.address_complement || '-'}</p>
                      <p><span className="text-gray-400">Cidade/UF:</span> {`${ministry.address_city || '-'} / ${ministry.address_state || '-'}`}</p>
                      <p><span className="text-gray-400">CEP:</span> {ministry.address_zip || '-'}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'financeiro' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-200">Histórico de Faturamento (Asaas)</h3>
                  {faturas.length === 0 ? (
                    <p className="text-sm text-gray-400">Nenhuma fatura registrada no sistema para este ministério.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-700 text-left text-gray-400">
                            <th className="py-2">ID Cobrança</th>
                            <th className="py-2">Vencimento</th>
                            <th className="py-2">Valor</th>
                            <th className="py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {faturas.map((fat: any) => (
                            <tr key={fat.id} className="text-gray-300">
                              <td className="py-2 font-mono text-xs">{fat.id}</td>
                              <td className="py-2">{fat.due_date ? new Date(fat.due_date).toLocaleDateString('pt-BR') : '-'}</td>
                              <td className="py-2">R$ {fat.value}</td>
                              <td className="py-2 uppercase text-xs">{fat.status || 'pendente'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'usuarios' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-200">Configuração de Credenciais</h3>
                  <div className="space-y-2 text-sm text-gray-300">
                    <p><span className="text-gray-400">E-mail de Login do Admin:</span> {ministry.email_admin}</p>
                    <p><span className="text-gray-400">Link da Plataforma:</span> <a href="https://app.gestaoeklesia.com.br" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">app.gestaoeklesia.com.br</a></p>
                    <p className="text-xs text-gray-400 mt-4 bg-gray-800/80 border border-gray-700/50 p-3 rounded">
                      📌 As credenciais do usuário admin deste ministério são definidas no momento de sua criação. A alteração de senha pode ser efetuada diretamente pelo painel do próprio ministério em configurações.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'congregacoes' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-200">Estrutura de Igrejas e Locais</h3>
                  <div className="space-y-2 text-sm text-gray-300">
                    <p><span className="text-gray-400">Quantidade de Templos Cadastrados (limite contratado):</span> {ministry.quantity_temples || 'Ilimitado'}</p>
                    <p><span className="text-gray-400">Quantidade de Membros Máxima:</span> {ministry.quantity_members || 'Ilimitado'}</p>
                  </div>
                </div>
              )}

              {activeTab === 'uso' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-200">Licenciamento e Assinatura</h3>
                  <div className="space-y-2 text-sm text-gray-300">
                    <p><span className="text-gray-400">Plano Comercial Atual:</span> <span className="uppercase font-bold text-gray-200">{ministry.plan || 'Starter'}</span></p>
                    <p><span className="text-gray-400">Situação:</span> {statusDetail.label}</p>
                    <p><span className="text-gray-400">Expiração da Licença:</span> {ministry.subscription_end_date ? new Date(ministry.subscription_end_date).toLocaleDateString('pt-BR') : 'Sem expiração definida'}</p>
                  </div>
                </div>
              )}

              {activeTab === 'auditoria' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-200">Logs e Atividades do Cliente</h3>
                  <p className="text-sm text-gray-400">Nenhum evento registrado de modificações diretas para esta conta.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modais Reutilizados */}
      <ActivationModal
        activatingMinistry={activatingMinistry}
        asaasSuccessData={asaasSuccessData}
        activationMode={activationMode}
        setActivationMode={setActivationMode}
        activationPlan={activationPlan}
        setActivationPlan={setActivationPlan}
        activationValidity={activationValidity}
        setActivationValidity={setActivationValidity}
        customValidity={customValidity}
        setCustomValidity={setCustomValidity}
        asaasDueDate={asaasDueDate}
        setAsaasDueDate={setAsaasDueDate}
        activationObservation={activationObservation}
        setActivationObservation={setActivationObservation}
        confirmActivation={confirmActivation}
        setConfirmActivation={setConfirmActivation}
        activationLoading={activationLoading}
        onClose={() => {
          setActivatingMinistry(null)
          setAsaasSuccessData(null)
        }}
        onSubmit={handleActivateSubmit}
      />

      <BillingModal
        billingMinistry={billingMinistry}
        billingSuccessData={billingSuccessData}
        billingPlan={billingPlan}
        setBillingPlan={setBillingPlan}
        billingDueDate={billingDueDate}
        setBillingDueDate={setBillingDueDate}
        billingInstallments={billingInstallments}
        setBillingInstallments={setBillingInstallments}
        billingLoading={billingLoading}
        onClose={() => {
          setBillingMinistry(null)
          setBillingSuccessData(null)
        }}
        onSubmit={handleCreateBillingSubmit}
        getPlanPrice={getPlanPrice}
      />
    </div>
  )
}
