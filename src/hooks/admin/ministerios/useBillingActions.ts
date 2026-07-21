'use client'

import { useState } from 'react'
import { authenticatedFetch } from '@/lib/api-client'
import type { Ministry as SupabaseMinistry } from '@/types/supabase'
import type { SubscriptionPlan } from '@/types/admin'

interface UseBillingActionsOptions {
  planos: SubscriptionPlan[]
  setSuccess: (msg: string) => void
  showError: (msg: string) => void
  fetchMinisterios: () => void
  setMinisterios: React.Dispatch<React.SetStateAction<SupabaseMinistry[]>>
}

export function useBillingActions({
  planos,
  setSuccess,
  showError,
  fetchMinisterios,
  setMinisterios,
}: UseBillingActionsOptions) {
  // === Gerar Faturas ASAAS ===
  const [billingMinistry, setBillingMinistry] = useState<SupabaseMinistry | null>(null)
  const [billingPlan, setBillingPlan] = useState('starter')
  const [billingDueDate, setBillingDueDate] = useState('')
  const [billingInstallments, setBillingInstallments] = useState('1')
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingSuccessData, setBillingSuccessData] = useState<{ id: string; invoiceUrl: string } | null>(null)

  // === Ativação de Ministério ===
  const [activatingMinistry, setActivatingMinistry] = useState<SupabaseMinistry | null>(null)
  const [confirmActivation, setConfirmActivation] = useState(false)
  const [activationPlan, setActivationPlan] = useState('starter')
  const [activationValidity, setActivationValidity] = useState('12')
  const [customValidity, setCustomValidity] = useState('12')
  const [activationObservation, setActivationObservation] = useState('')
  const [activationLoading, setActivationLoading] = useState(false)
  const [activationMode, setActivationMode] = useState<'direto' | 'asaas'>('direto')
  const [asaasDueDate, setAsaasDueDate] = useState('')
  const [asaasSuccessData, setAsaasSuccessData] = useState<{ id: string; invoiceUrl: string } | null>(null)

  const handleOpenActivate = (m: SupabaseMinistry) => {
    setActivatingMinistry(m)
    setConfirmActivation(false)
    setActivationPlan(m.plan || 'starter')
    setActivationValidity('12')
    setCustomValidity('12')
    setActivationObservation('')
    setActivationMode('direto')
    setAsaasDueDate('')
    setAsaasSuccessData(null)
  }

  const handleActivateSubmit = async () => {
    if (!activatingMinistry || !confirmActivation) return

    try {
      setActivationLoading(true)
      showError('')
      setSuccess('')

      if (activationMode === 'asaas') {
        if (!asaasDueDate) {
          throw new Error('A data de vencimento da fatura é obrigatória')
        }

        const response = await authenticatedFetch('/api/v1/admin/billing/create-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ministry_id: activatingMinistry.id,
            plano_slug: activationPlan,
            due_date: asaasDueDate,
          }),
        })

        const resData = await response.json()
        if (!response.ok) {
          throw new Error(resData.error || 'Erro ao gerar fatura ASAAS')
        }

        setAsaasSuccessData({
          id: resData.data.id,
          invoiceUrl: resData.data.asaas_invoice_url,
        })
        setSuccess('Fatura ASAAS gerada com sucesso!')
      } else {
        const months = activationValidity === 'custom' ? Number(customValidity) : Number(activationValidity)
        const response = await authenticatedFetch(`/api/v1/admin/ministerios/${activatingMinistry.id}/ativar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modo: 'direto',
            plano_slug: activationPlan,
            validade_meses: months,
            observacao: activationObservation,
          }),
        })

        const resData = await response.json()
        if (!response.ok) {
          throw new Error(resData.error || 'Erro ao ativar o ministério')
        }

        setMinisterios((prev) =>
          prev.map((m) => (m.id === activatingMinistry.id ? { ...m, ...resData.data } : m))
        )

        setSuccess(`Ministério "${activatingMinistry.name}" ativado com sucesso!`)
        setActivatingMinistry(null)
      }
    } catch (err: any) {
      showError(err.message)
    } finally {
      setActivationLoading(false)
    }
  }

  const handleOpenBilling = (m: SupabaseMinistry) => {
    setBillingMinistry(m)
    setBillingPlan(m.plan || 'starter')
    setBillingDueDate('')
    setBillingInstallments('1')
    setBillingSuccessData(null)
    showError('')
    setSuccess('')
  }

  const getPlanPrice = (slug: string) => {
    const p = planos.find((x) => x.slug === slug)
    return p ? Number(p.price_monthly) : 99
  }

  const handleCreateBillingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!billingMinistry) return

    try {
      setBillingLoading(true)
      showError('')
      setSuccess('')

      if (!billingDueDate) {
        throw new Error('A data de vencimento da fatura é obrigatória')
      }

      const response = await authenticatedFetch('/api/v1/admin/billing/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ministry_id: billingMinistry.id,
          plano_slug: billingPlan,
          due_date: billingDueDate,
          installments: Number(billingInstallments),
        }),
      })

      const resData = await response.json()
      if (!response.ok) {
        throw new Error(resData.error || 'Erro ao gerar fatura ASAAS')
      }

      setBillingSuccessData({
        id: resData.data.id,
        invoiceUrl: resData.data.asaas_invoice_url,
      })
      setSuccess('Fatura(s) ASAAS gerada(s) com sucesso!')
      fetchMinisterios()
    } catch (err: any) {
      showError(err.message)
    } finally {
      setBillingLoading(false)
    }
  }

  return {
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
  }
}
