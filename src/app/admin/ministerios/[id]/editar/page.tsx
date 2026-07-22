'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import { temAcessoAdmin } from '@/lib/access-control'
import { authenticatedFetch } from '@/lib/api-client'
import type { SubscriptionPlan } from '@/types/admin'
import type { Ministry as SupabaseMinistry } from '@/types/supabase'
import AdminSidebar from '@/components/AdminSidebar'
import MinisteriosHeader from '@/components/admin/ministerios/MinisteriosHeader'
import MinistryForm from '@/components/admin/ministerios/forms/MinistryForm'
import { useMinistryForm } from '@/hooks/admin/ministerios/useMinistryForm'
import { friendlyError } from '@/lib/admin/ministerios/helpers'

interface EditarMinisterioPageProps {
  params: Promise<{ id: string }>
}

export default function EditarMinisterioPage({ params }: EditarMinisterioPageProps) {
  const { id } = use(params)
  const { isLoading, isAuthenticated, adminUser } = useAdminAuth()
  const [planos, setPlanos] = useState<SubscriptionPlan[]>([])
  const [planosLoading, setPlanosLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({})
  const errorRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

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
      fetchMinistryData()
    }
  }, [isAuthenticated, adminUser, id])

  const fetchPlanos = async () => {
    try {
      setPlanosLoading(true)
      const response = await authenticatedFetch('/api/v1/admin/plans')
      if (!response.ok) {
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

  const fetchMinistryData = async () => {
    try {
      // Buscar lista de ministerios e encontrar o que corresponde ao ID
      const response = await authenticatedFetch(`/api/v1/admin/ministries?limit=1000`)
      if (!response.ok) {
        throw new Error('Erro ao buscar dados do ministério')
      }
      const resData = await response.json()
      const list: SupabaseMinistry[] = resData.data || []
      const found = list.find((m) => m.id === id)
      if (found) {
        handleEdit(found)
      } else {
        throw new Error('Ministério não encontrado no sistema.')
      }
    } catch (err: any) {
      showError(err.message)
    }
  }

  const showError = (msg: string) => {
    setError(friendlyError(msg))
    setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  const {
    formData,
    setFormData,
    isTrial,
    setIsTrial,
    trialDays,
    setTrialDays,
    logoFile,
    setLogoFile,
    logoPreviewSrc,
    setLogoPreviewSrc,
    logoPreviewObjectUrl,
    setLogoPreviewObjectUrl,
    cepLookupLoading,
    cepLookupError,
    cepResolved,
    handleSubmit,
    handleEdit,
  } = useMinistryForm({
    showError,
    setSuccess: (msg) => {
      setSuccess(msg)
      setTimeout(() => {
        router.push('/admin/ministerios')
      }, 1500)
    },
    setError,
    fetchMinisterios: () => {}, // Nao precisa recarregar lista local aqui
    setTempPasswords,
  })

  // Evitar erro TS6133
  void tempPasswords;

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        <MinisteriosHeader
          titulo="EDITAR MINISTÉRIO"
          descricao="Atualizar dados de um ministério existente"
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

            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
              <MinistryForm
                formData={formData}
                editingId={id}
                onSubmit={handleSubmit}
                planos={planos}
                planosLoading={planosLoading}
                isTrial={isTrial}
                setIsTrial={setIsTrial}
                trialDays={trialDays}
                setTrialDays={setTrialDays}
                logoPreviewSrc={logoPreviewSrc}
                logoFile={logoFile}
                onFileChange={(file, objectUrl) => {
                  setLogoFile(file)
                  setLogoPreviewObjectUrl(objectUrl)
                  setLogoPreviewSrc(objectUrl)
                }}
                logoPreviewObjectUrl={logoPreviewObjectUrl}
                cepLookupLoading={cepLookupLoading}
                cepLookupError={cepLookupError}
                cepResolved={cepResolved}
                onChangeFormData={(data) => setFormData({ ...formData, ...data })}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
