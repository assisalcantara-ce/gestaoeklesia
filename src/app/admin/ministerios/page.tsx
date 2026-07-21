'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import TrialSignupsWidget from '@/components/TrialSignupsWidget'
import AdminSidebar from '@/components/AdminSidebar'
import { temAcessoAdmin } from '@/lib/access-control'
import type { Ministry as SupabaseMinistry } from '@/types/supabase'
import type { SubscriptionPlan } from '@/types/admin'
import { onlyDigits, formatPhone, validarCnpj, validarCpf } from '@/lib/mascaras'

import MinisteriosHeader from '@/components/admin/ministerios/MinisteriosHeader'
import MinisteriosToolbar from '@/components/admin/ministerios/MinisteriosToolbar'
import MinisteriosTable from '@/components/admin/ministerios/MinisteriosTable'
import MinistryForm from '@/components/admin/ministerios/forms/MinistryForm'
import BillingModal from '@/components/admin/ministerios/modals/BillingModal'
import ActivationModal from '@/components/admin/ministerios/modals/ActivationModal'
import CsvImportModal from '@/components/admin/ministerios/modals/CsvImportModal'
import DeleteConfirmationDialog from '@/components/admin/ministerios/modals/DeleteConfirmationDialog'

export default function MinisteriosPage() {
  const { isLoading, isAuthenticated, adminUser } = useAdminAuth()
  const [ministerios, setMinisterios] = useState<SupabaseMinistry[]>([])
  const [planos, setPlanos] = useState<SubscriptionPlan[]>([])
  const [planosLoading, setPlanosLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(15)
  const [totalItems, setTotalItems] = useState(0)
  
  // === Gerar Faturas ASAAS ===
  const [billingMinistry, setBillingMinistry] = useState<SupabaseMinistry | null>(null)
  const [billingPlan, setBillingPlan] = useState('starter')
  const [billingDueDate, setBillingDueDate] = useState('')
  const [billingInstallments, setBillingInstallments] = useState('1')
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingSuccessData, setBillingSuccessData] = useState<{ id: string; invoiceUrl: string } | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  const friendlyError = (msg: string): string => {
    if (!msg) return msg
    if (msg.includes('ministries_email_admin_key') || (msg.includes('duplicate key') && msg.includes('email')))
      return 'Este e-mail j\u00e1 est\u00e1 cadastrado em outro minist\u00e9rio. Utilize um e-mail diferente.'
    if (msg.includes('duplicate key') || msg.includes('unique constraint'))
      return 'J\u00e1 existe um registro com esses dados. Verifique os campos e tente novamente.'
    if (msg.includes('auth/email-already-in-use') || msg.includes('User already registered'))
      return 'Este e-mail j\u00e1 possui uma conta no sistema. Utilize outro e-mail de acesso.'
    return msg
  }

  const showError = (msg: string) => {
    setError(friendlyError(msg))
    setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewSrc, setLogoPreviewSrc] = useState<string>('')
  const [logoPreviewObjectUrl, setLogoPreviewObjectUrl] = useState<string>('')
  const [cepLookupLoading, setCepLookupLoading] = useState(false)
  const [cepLookupError, setCepLookupError] = useState('')
  const [cepResolved, setCepResolved] = useState('')
  const cepLookupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCepRequestedRef = useRef('')
  const [activeTab, setActiveTab] = useState<'ativos' | 'precadastros'>('ativos')
  const [confirmDeleteMinisterio, setConfirmDeleteMinisterio] = useState<SupabaseMinistry | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const router = useRouter()

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

  const getDetailedStatus = (m: any) => {
    if (!m.is_active || m.subscription_status === 'suspended') {
      return {
        label: 'Suspenso',
        class: 'bg-red-900/60 text-red-200 border border-red-700/50',
        type: 'SUSPENSO'
      }
    }
    if (m.subscription_status === 'cancelled') {
      return {
        label: 'Cancelado',
        class: 'bg-gray-700 text-gray-300 border border-gray-600',
        type: 'CANCELADO'
      }
    }
    if (m.subscription_status === 'trial') {
      const expiresAt = m.subscription_end_date ? new Date(m.subscription_end_date) : null
      const now = new Date()
      if (expiresAt && expiresAt.getTime() <= now.getTime()) {
        return {
          label: 'Teste Expirado',
          class: 'bg-red-950 text-red-400 border border-red-800',
          type: 'TRIAL_EXPIRADO',
          expiresAt
        }
      } else {
        const diffTime = expiresAt ? expiresAt.getTime() - now.getTime() : 0
        const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
        return {
          label: `Teste — restam ${diffDays} dias`,
          class: 'bg-blue-900/80 text-blue-200 border border-blue-700',
          type: 'TRIAL_ATIVO',
          expiresAt
        }
      }
    }
    if (m.subscription_status === 'active') {
      return {
        label: 'Ativo',
        class: 'bg-green-900/80 text-green-200 border border-green-700',
        type: 'ATIVO'
      }
    }
    return {
      label: m.is_active ? 'Ativo' : 'Inativo',
      class: m.is_active ? 'bg-green-900 text-green-200' : 'bg-gray-700 text-gray-300',
      type: m.is_active ? 'ATIVO' : 'SUSPENSO'
    }
  }

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
      setError('')
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

  // === Gerar Faturas ASAAS ===
  const handleOpenBilling = (m: SupabaseMinistry) => {
    setBillingMinistry(m)
    setBillingPlan(m.plan || 'starter')
    setBillingDueDate('')
    setBillingInstallments('1')
    setBillingSuccessData(null)
    setError('')
    setSuccess('')
  }

  const getPlanPrice = (slug: string) => {
    const p = planos.find(x => x.slug === slug)
    return p ? Number(p.price_monthly) : 99
  }

  const handleCreateBillingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!billingMinistry) return

    try {
      setBillingLoading(true)
      setError('')
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


  // === Importação CSV ===
  const [showImport, setShowImport] = useState(false)
  const [importMinistryId, setImportMinistryId] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importRows, setImportRows] = useState<Record<string, string>[]>([])
  const [importHeaders, setImportHeaders] = useState<string[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{
    inserted: number
    skipped: number
    total_rows: number
    ministry_name: string
    errors: { row: number; name: string; reason: string }[]
  } | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (logoPreviewObjectUrl) URL.revokeObjectURL(logoPreviewObjectUrl)
      if (cepLookupTimeoutRef.current) clearTimeout(cepLookupTimeoutRef.current)
    }
  }, [logoPreviewObjectUrl])

  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    documento_tipo: 'cnpj' as 'cnpj' | 'cpf',
    contact_email: '',
    contact_phone: '',
    whatsapp: '',
    responsible_name: '',
    website: '',
    logo_url: '',
    description: '',
    access_email: '',
    access_password: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    address_city: '',
    address_state: '',
    address_zip: '',
    subscription_plan_id: '',
    is_active: true,
  })

  const [isTrial, setIsTrial] = useState(false)
  const [trialDays, setTrialDays] = useState(7)

  const resetForm = () => {
    setFormData({
      name: '',
      cnpj: '',
      documento_tipo: 'cnpj' as 'cnpj' | 'cpf',
      contact_email: '',
      contact_phone: '',
      whatsapp: '',
      responsible_name: '',
      website: '',
      logo_url: '',
      description: '',
      access_email: '',
      access_password: '',
      address_street: '',
      address_number: '',
      address_complement: '',
      address_city: '',
      address_state: '',
      address_zip: '',
      subscription_plan_id: '',
      is_active: true,
    })
    setIsTrial(false)
    setTrialDays(7)
    if (logoPreviewObjectUrl) URL.revokeObjectURL(logoPreviewObjectUrl)
    setLogoPreviewObjectUrl('')
    setLogoPreviewSrc('')
    setLogoFile(null)
    setCepLookupLoading(false)
    setCepLookupError('')
    setCepResolved('')
    lastCepRequestedRef.current = ''
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
      fetchMinisterios()
      fetchPlanos()
    }
  }, [isAuthenticated, adminUser, currentPage])

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

  const formatPhoneDisplay = (value: string | null | undefined) => {
    const digits = onlyDigits(value || '')
    if (!digits) return '-'
    return formatPhone(digits)
  }

  const fetchCep = async (cepDigits: string) => {
    try {
      setCepLookupLoading(true)
      setCepLookupError('')

      const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`)
      if (!response.ok) {
        setCepLookupError('Não foi possível consultar o CEP agora. Tente novamente.')
        setCepResolved('')
        return
      }

      const data = await response.json()
      if (data?.erro) {
        setCepLookupError('CEP não encontrado.')
        setCepResolved('')
        return
      }

      setFormData((prev) => ({
        ...prev,
        address_street: data.logradouro || prev.address_street,
        address_city: data.localidade || prev.address_city,
        address_state: data.uf || prev.address_state,
      }))

      setCepResolved(cepDigits)
    } catch {
      setCepLookupError('Erro ao buscar CEP. Verifique sua conexão e tente novamente.')
      setCepResolved('')
    } finally {
      setCepLookupLoading(false)
    }
  }

  useEffect(() => {
    const cepDigits = onlyDigits(formData.address_zip || '')

    if (cepLookupTimeoutRef.current) {
      clearTimeout(cepLookupTimeoutRef.current)
      cepLookupTimeoutRef.current = null
    }

    if (cepDigits.length < 8) {
      setCepLookupLoading(false)
      setCepLookupError('')
      if (cepResolved && cepResolved !== cepDigits) setCepResolved('')
      return
    }

    if (cepDigits === lastCepRequestedRef.current) {
      return
    }

    cepLookupTimeoutRef.current = setTimeout(() => {
      lastCepRequestedRef.current = cepDigits
      fetchCep(cepDigits)
    }, 450)

    return () => {
      if (cepLookupTimeoutRef.current) {
        clearTimeout(cepLookupTimeoutRef.current)
        cepLookupTimeoutRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.address_zip])

  const compressLogo = async (file: File) => {
    const maxSize = 512

    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = maxSize
    canvas.height = maxSize
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas não suportado')

    // fundo branco para JPG
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, maxSize, maxSize)

    const scale = Math.min(maxSize / bitmap.width, maxSize / bitmap.height)
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const x = Math.round((maxSize - w) / 2)
    const y = Math.round((maxSize - h) / 2)
    ctx.drawImage(bitmap, x, y, w, h)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Falha ao gerar imagem'))),
        'image/jpeg',
        0.78
      )
    })

    return blob
  }

  const uploadLogoIfNeeded = async () => {
    if (!logoFile) return null
    const compressed = await compressLogo(logoFile)

    if (compressed.size > 600 * 1024) {
      throw new Error('Logo ainda ficou grande demais após compressão (máx 600KB).')
    }

    const form = new FormData()
    form.append('file', new File([compressed], 'logo.jpg', { type: 'image/jpeg' }))

    const response = await authenticatedFetch('/api/v1/admin/uploads/logo', {
      method: 'POST',
      body: form,
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload?.error || 'Erro ao fazer upload da logo')
    }

    const payload = await response.json()
    return payload?.url || null
  }

  const fetchMinisterios = async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    try {
      setLoading(true)
      const response = await authenticatedFetch(`/api/v1/admin/ministries?page=${currentPage}&limit=${itemsPerPage}`, {
        signal: controller.signal,
      })
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login')
          return
        }
        if (response.status === 403) {
          setError('Acesso negado para este recurso.')
          return
        }
        throw new Error('Erro ao carregar ministérios')
      }

      const data = await response.json()
      setMinisterios(data.data || [])
      setTotalItems(data.count || 0)
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError('Tempo limite ao carregar ministérios. Tente novamente.')
      } else {
        setError(err.message)
      }
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validar CNPJ ou CPF se preenchido
    const docDigits = onlyDigits(formData.cnpj)
    if (docDigits) {
      if (formData.documento_tipo === 'cnpj') {
        if (!validarCnpj(docDigits)) {
          showError('CNPJ inválido. Verifique os dígitos e tente novamente.')
          return
        }
      } else {
        if (!validarCpf(docDigits)) {
          showError('CPF inválido. Verifique os dígitos e tente novamente.')
          return
        }
      }
    }

    try {
      const uploadedLogoUrl = await uploadLogoIfNeeded()

      let payloadToSend: any = {
        ...formData,
        // Garantir que o backend recebe apenas dígitos
        cnpj: docDigits,
        contact_phone: onlyDigits(formData.contact_phone),
        whatsapp: onlyDigits(formData.whatsapp),
        logo_url: uploadedLogoUrl || formData.logo_url,
        // Trial
        trial_mode: !editingId && isTrial,
        trial_days: !editingId && isTrial ? trialDays : undefined,
      }

      if (!editingId) {
        // Validar credenciais obrigatórias na criação
        if (!formData.access_email?.trim()) {
          showError('Email de acesso é obrigatório para criar um ministério.')
          return
        }
        if (!formData.access_password?.trim() || formData.access_password.trim().length < 8) {
          showError('Senha de acesso é obrigatória e deve ter no mínimo 8 caracteres.')
          return
        }
      } else {
        // Remove empty credential fields when editing
        if (!payloadToSend.access_email?.trim()) delete payloadToSend.access_email
        if (!payloadToSend.access_password?.trim()) delete payloadToSend.access_password
      }

      const response = await authenticatedFetch('/api/v1/admin/ministries', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { ...payloadToSend, id: editingId } : payloadToSend),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar ministério')
      }

      const payload = await response.json()
      const creds = payload?.credentials
      if (payload?.data?.id && creds?.password) {
        setTempPasswords(prev => ({ ...prev, [payload.data.id]: creds.password }))
      } else if (payload?.data?.id && formData.access_password?.trim()) {
        setTempPasswords(prev => ({ ...prev, [payload.data.id]: formData.access_password.trim() }))
      }
      setSuccess(
        editingId
          ? 'Ministério atualizado com sucesso!'
          : creds?.email && creds?.password
            ? `Ministério criado com sucesso! Credenciais geradas: ${creds.email} / ${creds.password}`
            : 'Ministério criado com sucesso!'
      )
      resetForm()
      setEditingId(null)
      setShowForm(false)
      fetchMinisterios()
    } catch (err: any) {
      showError(err.message)
    }
  }

  const handleEdit = (ministerio: SupabaseMinistry) => {
    setEditingId(ministerio.id)
    setShowForm(true)
    const docDigits = onlyDigits(ministerio.cnpj_cpf || '')
    setFormData({
      name: ministerio.name || '',
      cnpj: ministerio.cnpj_cpf || '',
      documento_tipo: (docDigits.length <= 11 && docDigits.length > 0) ? 'cpf' : 'cnpj',
      contact_email: ministerio.email_admin || '',
      contact_phone: ministerio.phone || '',
      whatsapp: ministerio.whatsapp || '',
      responsible_name: ministerio.responsible_name || '',
      website: ministerio.website || '',
      logo_url: ministerio.logo_url || '',
      description: ministerio.description || '',
      access_email: '',
      access_password: '',
      address_street: ministerio.address_street || '',
      address_number: ministerio.address_number || '',
      address_complement: ministerio.address_complement || '',
      address_city: ministerio.address_city || '',
      address_state: ministerio.address_state || '',
      address_zip: ministerio.address_zip || '',
      subscription_plan_id: ministerio.subscription_plan_id || '',
      is_active: ministerio.is_active !== false,
    })
    if (logoPreviewObjectUrl) URL.revokeObjectURL(logoPreviewObjectUrl)
    setLogoPreviewObjectUrl('')
    setLogoFile(null)
    setLogoPreviewSrc(ministerio.logo_url || '')
  }

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

  // === Funções CSV ===
  const downloadTemplate = async () => {
    const response = await authenticatedFetch('/api/v1/admin/import-members')
    if (!response.ok) return
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo_importacao_membros.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = (file: File) => {
    setImportFile(file)
    setImportResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) return
      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
      if (lines.length < 2) { setImportRows([]); setImportHeaders([]); return }
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
      setImportHeaders(headers)
      const rows: Record<string, string>[] = []
      for (let i = 1; i < lines.length && i <= 200; i++) {
        const line = lines[i].trim()
        if (!line) continue
        // Parse simples respeitando aspas
        const cols: string[] = []
        let current = ''
        let inQ = false
        for (const ch of line) {
          if (ch === '"') { inQ = !inQ }
          else if (ch === ',' && !inQ) { cols.push(current.trim()); current = '' }
          else current += ch
        }
        cols.push(current.trim())
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => { row[h] = (cols[idx] ?? '').replace(/^"|"$/g, '') })
        rows.push(row)
      }
      setImportRows(rows)
    }
    reader.readAsText(file, 'utf-8')
  }

  const doImport = async () => {
    if (!importFile || !importMinistryId) return
    setImportLoading(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      fd.append('ministry_id', importMinistryId)
      const response = await authenticatedFetch('/api/v1/admin/import-members', {
        method: 'POST',
        body: fd,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao importar')
      setImportResult(data)
      fetchMinisterios()
    } catch (err: any) {
      setImportResult({ inserted: 0, skipped: 0, total_rows: 0, ministry_name: '', errors: [{ row: 0, name: '', reason: err.message }] })
    } finally {
      setImportLoading(false)
    }
  }
  const handlePrintLabel = async (m: SupabaseMinistry) => {
    let password = tempPasswords[m.id] || '';

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
            <MinisteriosToolbar
              showForm={showForm}
              editingId={editingId}
              onToggleForm={() => {
                if (showForm) {
                  setShowForm(false)
                  setEditingId(null)
                  resetForm()
                } else {
                  setShowForm(true)
                }
              }}
              onOpenImport={() => {
                setShowImport(true)
                setImportResult(null)
                setImportRows([])
                setImportHeaders([])
                setImportFile(null)
                setImportMinistryId('')
              }}
            />

            {/* Formulário */}
            {showForm && (
              <MinistryForm
                formData={formData}
                editingId={editingId}
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
            )}

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
              onEdit={handleEdit}
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
