'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import TrialSignupsWidget from '@/components/TrialSignupsWidget'
import AdminSidebar from '@/components/AdminSidebar'
import { temAcessoAdmin } from '@/lib/access-control'
import type { Ministry as SupabaseMinistry } from '@/types/supabase'
import type { SubscriptionPlan } from '@/types/admin'


import MinisteriosHeader from '@/components/admin/ministerios/MinisteriosHeader'
import MinisteriosTable from '@/components/admin/ministerios/MinisteriosTable'
import BillingModal from '@/components/admin/ministerios/modals/BillingModal'
import ActivationModal from '@/components/admin/ministerios/modals/ActivationModal'
import CsvImportModal from '@/components/admin/ministerios/modals/CsvImportModal'
import DeleteConfirmationDialog from '@/components/admin/ministerios/modals/DeleteConfirmationDialog'
import { useMinisterios } from '@/hooks/admin/ministerios/useMinisterios'
import { useCsvImport } from '@/hooks/admin/ministerios/useCsvImport'
import { useBillingActions } from '@/hooks/admin/ministerios/useBillingActions'
import { friendlyError, getDetailedStatus, formatPhoneDisplay } from '@/lib/admin/ministerios/helpers'
import ExecutiveMetricCard from '@/components/dashboard/ExecutiveMetricCard'
import { Users, ShieldCheck, Clock, Lock, CreditCard } from 'lucide-react'

export default function MinisteriosPage() {
  const { isLoading, isAuthenticated, adminUser } = useAdminAuth()
  const [planos, setPlanos] = useState<SubscriptionPlan[]>([])

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(15)
  const [activeTab, setActiveTab] = useState<'ativos' | 'precadastros'>('ativos')
  const [confirmDeleteMinisterio, setConfirmDeleteMinisterio] = useState<SupabaseMinistry | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const showError = (msg: string) => {
    setError(friendlyError(msg))
    setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  // Hook 1: Listagem
  const {
    ministerios,
    setMinisterios,
    loading,
    totalItems,
    fetchMinisterios,
  } = useMinisterios({
    currentPage,
    itemsPerPage,
    isAuthenticated,
    adminUser,
    setError,
  })



  // Hook 3: Importação CSV
  const {
    showImport,
    setShowImport,
    importMinistryId,
    setImportMinistryId,
    importFile,
    setImportFile,
    importRows,
    setImportRows,
    importHeaders,
    setImportHeaders,
    importLoading,
    importResult,
    setImportResult,
    importFileRef,
    downloadTemplate,
    handleImportFile,
    doImport,
  } = useCsvImport({
    fetchMinisterios,
  })

  // Hook 4: Faturamento e Ativação
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
    setSuccess,
    showError,
    fetchMinisterios,
    setMinisterios,
  })



  const handleDelete = (ministerio: SupabaseMinistry) => {
    setConfirmDeleteMinisterio(ministerio)
  }

  const doDelete = async () => {
    if (!confirmDeleteMinisterio) return
    setDeleteLoading(true)
    try {
      const response = await authenticatedFetch('/api/v1/admin/ministries', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: confirmDeleteMinisterio.id }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Erro ao remover ministério')
      }

      setConfirmDeleteMinisterio(null)
      fetchMinisterios()
    } catch (err: any) {
      setError(err.message)
      setConfirmDeleteMinisterio(null)
    } finally {
      setDeleteLoading(false)
    }
  }

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
      fetchPlanos()
    }
  }, [isAuthenticated, adminUser])

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



  const handlePrintLabel = async (m: SupabaseMinistry) => {
    let password = '';

    try {
      const response = await authenticatedFetch('/api/v1/admin/ministries/decrypt-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id }),
      })
      if (response.ok) {
        const resData = await response.json()
        if (resData.password) {
          password = resData.password
        }
      }
    } catch (err) {
      console.error('Erro ao buscar senha descriptografada:', err)
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Etiqueta de Acesso - ${m.name}</title>
          <style>
            @page {
              size: 85mm 30mm;
              margin: 0;
            }
            body {
              width: 85mm;
              height: 30mm;
              margin: 0;
              padding: 2mm 3.5mm;
              box-sizing: border-box;
              font-family: Arial, sans-serif;
              font-size: 11px;
              line-height: 1.25;
              color: #000;
              display: flex;
              flex-direction: column;
              justify-content: center;
            }
            .title {
              font-size: 13px;
              font-weight: bold;
              border-bottom: 0.5px solid #000;
              padding-bottom: 1.5px;
              margin-bottom: 3px;
              text-transform: uppercase;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .info {
              margin-bottom: 1px;
            }
            .bold {
              font-weight: bold;
            }
            .footer {
              margin-top: auto;
              font-size: 8px;
              color: #555;
              text-align: right;
            }
          </style>
        </head>
        <body>
          <div class="title">${m.name}</div>
          <div class="info"><span class="bold">Link:</span> app.gestaoeklesia.com.br</div>
          <div class="info"><span class="bold">E-mail:</span> ${m.email_admin || '-'}</div>
          <div class="info"><span class="bold">Senha:</span> ${password || 'Não alterada'}</div>
          <div class="info"><span class="bold">Plano:</span> <span style="text-transform: uppercase;">${m.plan || 'Starter'}</span></div>
          <div class="footer">Gestão Eklésia</div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const stats = useMemo(() => {
    let ativos = 0
    let trials = 0
    let suspensos = 0
    let pendentes = 0

    ministerios.forEach((m) => {
      const statusDetail = getDetailedStatus(m)
      if (statusDetail.type === 'ATIVO') ativos++
      if (statusDetail.type === 'TRIAL_ATIVO') trials++
      if (statusDetail.type === 'SUSPENSO') suspensos++

      const faturas = (m as any).platform_billing_invoices || []
      const temPendencia = faturas.some((f: any) => f.status !== 'RECEIVED' && f.status !== 'CONFIRMED')
      if (temPendencia) pendentes++
    })

    return {
      total: totalItems,
      ativos,
      trials,
      suspensos,
      pendentes,
    }
  }, [ministerios, totalItems])

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        <MinisteriosHeader
          titulo="PAINEL ADMINISTRATIVO: MINISTÉRIOS"
          descricao="Gerencie todos os ministérios/clientes"
        />

        <div className="p-6 space-y-6">
          <div className="max-w-7xl mx-auto">
            {error && (
              <div ref={errorRef} className="bg-red-900 border border-red-700 text-red-200 p-4 rounded mb-6 flex items-start gap-3">
                <span className="text-xl leading-none mt-0.5">&#9888;</span>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-green-900 border border-green-700 text-green-200 p-4 rounded mb-6">
                {success}
              </div>
            )}

            {/* Painel Executivo (Executive Summary) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <ExecutiveMetricCard
                title="Total de Ministérios"
                value={stats.total}
                subtitle="Clientes cadastrados"
                icon={Users}
                color="indigo"
              />

              <ExecutiveMetricCard
                title="Licenças Ativas"
                value={stats.ativos}
                subtitle="Acesso liberado"
                icon={ShieldCheck}
                color="emerald"
              />

              <ExecutiveMetricCard
                title="Trials Ativos"
                value={stats.trials}
                subtitle="Período de avaliação"
                icon={Clock}
                color="blue"
              />

              <ExecutiveMetricCard
                title="Licenças Suspensas"
                value={stats.suspensos}
                subtitle="Inadimplentes/Inativos"
                icon={Lock}
                color="rose"
              />

              <ExecutiveMetricCard
                title="Cobranças Pendentes"
                value={stats.pendentes}
                subtitle="Faturas em aberto"
                icon={CreditCard}
                color="amber"
              />
            </div>

            {/* Abas */}
            <div className="mb-6 border-b border-gray-800">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('ativos')}
                  className={`px-4 py-3 font-medium text-sm transition ${
                    activeTab === 'ativos'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  📋 Ministérios Ativos
                </button>
                <button
                  onClick={() => setActiveTab('precadastros')}
                  className={`px-4 py-3 font-medium text-sm transition ${
                    activeTab === 'precadastros'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  ⏳ Pré-Cadastros (Trial)
                </button>
              </div>
            </div>

        {/* TAB: Ministérios Ativos */}
        {activeTab === 'ativos' && (
          <>
            {/* Nova Toolbar Executiva */}
            <div className="mb-6 bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Lado Esquerdo: Filtros e Pesquisa */}
              <div className="flex flex-wrap items-center gap-3 flex-1 max-w-4xl">
                <div className="relative flex-1 min-w-[240px]">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none">🔍</span>
                  <input
                    type="text"
                    placeholder="Pesquisar ministério..."
                    className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 hover:border-gray-650 focus:border-blue-500 rounded-lg text-sm text-gray-100 placeholder-gray-400 focus:outline-none transition"
                    disabled
                  />
                </div>

                <select className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500 cursor-pointer" disabled>
                  <option value="">Filtro: Todos os Status</option>
                  <option value="ativo">Ativo</option>
                  <option value="suspenso">Suspenso</option>
                </select>

                <select className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500 cursor-pointer" disabled>
                  <option value="">Filtro: Todos os Planos</option>
                  <option value="starter">Starter</option>
                  <option value="expert">Expert</option>
                </select>

                <select className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500 cursor-pointer" disabled>
                  <option value="">Filtro: Todos os Trials</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>

              {/* Lado Direito: Ações */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => {
                    setShowImport(true)
                    setImportResult(null)
                    setImportRows([])
                    setImportHeaders([])
                    setImportFile(null)
                    setImportMinistryId('')
                  }}
                  className="px-4 py-2 bg-gray-750 hover:bg-gray-700 border border-gray-600/55 text-white text-sm font-semibold rounded-lg transition"
                >
                  📥 Importar CSV
                </button>

                <button
                  onClick={() => {
                    router.push('/admin/ministerios/novo')
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition"
                >
                  + Novo Ministério
                </button>
              </div>
            </div>

            {/* Lista de ministérios */}
            <MinisteriosTable
              loading={loading}
              ministerios={ministerios}
              totalItems={totalItems}
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              onPageChange={(page) => setCurrentPage(page)}
              getDetailedStatus={getDetailedStatus}
              formatPhoneDisplay={formatPhoneDisplay}
              onEdit={(m) => router.push(`/admin/ministerios/${m.id}/editar`)}
              onActivate={handleOpenActivate}
              onBilling={handleOpenBilling}
              onPrintLabel={handlePrintLabel}
              onDelete={handleDelete}
            />
          </>
        )}

        {/* TAB: Pré-Cadastros */}
        {activeTab === 'precadastros' && (
          <TrialSignupsWidget />
        )}
      </div>
    </div>
  </main>

  {/* Modais Refatorados */}
  <CsvImportModal
    showImport={showImport}
    importMinistryId={importMinistryId}
    setImportMinistryId={setImportMinistryId}
    importFile={importFile}
    importRows={importRows}
    importHeaders={importHeaders}
    importLoading={importLoading}
    importResult={importResult}
    ministerios={ministerios}
    onClose={() => {
      setShowImport(false)
      setImportResult(null)
      setImportRows([])
      setImportHeaders([])
      setImportFile(null)
    }}
    onDownloadTemplate={downloadTemplate}
    onFileChange={(e) => {
      const f = e.target.files?.[0]
      if (f) handleImportFile(f)
    }}
    onImport={doImport}
    importFileRef={importFileRef}
  />

  <DeleteConfirmationDialog
    confirmDeleteMinisterio={confirmDeleteMinisterio}
    deleteLoading={deleteLoading}
    onCancel={() => setConfirmDeleteMinisterio(null)}
    onDelete={doDelete}
  />

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
