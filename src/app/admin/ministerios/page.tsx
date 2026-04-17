'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import TrialSignupsWidget from '@/components/TrialSignupsWidget'
import AdminSidebar from '@/components/AdminSidebar'
import type { Ministry as SupabaseMinistry } from '@/types/supabase'
import type { SubscriptionPlan } from '@/types/admin'
import { onlyDigits, formatCnpj, formatPhone, validarCnpj } from '@/lib/mascaras'

export default function MinisteriosPage() {
  const { isLoading, isAuthenticated } = useAdminAuth()
  const [ministerios, setMinisterios] = useState<SupabaseMinistry[]>([])
  const [planos, setPlanos] = useState<SubscriptionPlan[]>([])
  const [planosLoading, setPlanosLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
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
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      fetchMinisterios()
      fetchPlanos()
    }
  }, [isAuthenticated])

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

  const formatCep = (value: string) => {
    const digits = onlyDigits(value).slice(0, 8)
    if (digits.length <= 5) return digits
    return `${digits.slice(0, 5)}-${digits.slice(5)}`
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

  const handleUseLogoUrl = () => {
    const url = formData.logo_url?.trim()
    if (!url) return

    if (logoPreviewObjectUrl) URL.revokeObjectURL(logoPreviewObjectUrl)
    setLogoPreviewObjectUrl('')
    setLogoFile(null)
    setLogoPreviewSrc(url)
  }

  const fetchMinisterios = async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    try {
      setLoading(true)
      const response = await authenticatedFetch('/api/v1/admin/ministries', {
        signal: controller.signal,
      })
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push('/admin/login')
          return
        }
        throw new Error('Erro ao carregar ministérios')
      }

      const data = await response.json()
      setMinisterios(data.data)
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

    // Validar CNPJ se preenchido
    const cnpjDigits = onlyDigits(formData.cnpj)
    if (cnpjDigits && !validarCnpj(cnpjDigits)) {
      showError('CNPJ inválido. Verifique os dígitos e tente novamente.')
      return
    }

    try {
      const uploadedLogoUrl = await uploadLogoIfNeeded()

      let payloadToSend: any = {
        ...formData,
        // Garantir que o backend recebe apenas dígitos
        cnpj: onlyDigits(formData.cnpj),
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
    setFormData({
      name: ministerio.name || '',
      cnpj: ministerio.cnpj_cpf || '',
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

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 z-10">
          <h2 className="text-2xl font-bold text-white">PAINEL ADMINISTRATIVO: MINISTÉRIOS</h2>
          <p className="text-gray-400 text-sm mt-1">Gerencie todos os ministérios/clientes</p>
        </div>

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
            {/* Botões de ação */}
              <div className="mb-6 flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => {
                    if (showForm) {
                      setShowForm(false)
                      setEditingId(null)
                      resetForm()
                    } else {
                      setShowForm(true)
                    }
                  }}
                  className={`px-6 py-2 text-white rounded transition ${
                    showForm
                      ? editingId
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {showForm ? (editingId ? 'Cancelar edição' : 'Cancelar') : '+ Novo Ministério'}
                </button>
                <button
                  onClick={() => { setShowImport(true); setImportResult(null); setImportRows([]); setImportHeaders([]); setImportFile(null); setImportMinistryId('') }}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition text-sm font-medium"
                >
                  📥 Importar CSV
                </button>
              </div>

            {/* Formulário */}
              {showForm && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6 mb-8 text-gray-100">
                  <h3 className="text-xl font-bold mb-4">
                    {editingId ? 'Editar Ministério' : 'Novo Ministério'}
                  </h3>
                <form
                  onSubmit={handleSubmit}
                  className="space-y-6 text-gray-100 [&_h3]:text-white [&_h4]:text-gray-200 [&_label]:text-gray-300 [&_input]:bg-gray-900 [&_input]:border-gray-700 [&_input]:text-gray-100 [&_input]:placeholder:text-gray-500 [&_select]:bg-gray-900 [&_select]:border-gray-700 [&_select]:text-gray-100 [&_textarea]:bg-gray-900 [&_textarea]:border-gray-700 [&_textarea]:text-gray-100 [&_textarea]:placeholder:text-gray-500"
                >
                  {/* Seção 1: Informações Básicas */}
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">Informações Básicas</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Ministério *</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">CNPJ</label>
                        <input
                          type="text"
                          value={formatCnpj(formData.cnpj)}
                          onChange={(e) => {
                            const digits = onlyDigits(e.target.value).slice(0, 14)
                            setFormData({ ...formData, cnpj: digits })
                          }}
                          className={`w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500 ${
                            formData.cnpj.length === 14 && !validarCnpj(formData.cnpj)
                              ? 'border-red-500 bg-red-50'
                              : formData.cnpj.length === 14
                              ? 'border-green-500'
                              : 'border-gray-300'
                          }`}
                          maxLength={18}
                        />
                        {formData.cnpj.length === 14 && !validarCnpj(formData.cnpj) && (
                          <p className="mt-1 text-xs text-red-600">CNPJ inválido — verifique os dígitos verificadores</p>
                        )}
                        {formData.cnpj.length === 14 && validarCnpj(formData.cnpj) && (
                          <p className="mt-1 text-xs text-green-600">CNPJ válido ✓</p>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>

                            <div className="flex items-center gap-3">
                              <input
                                id="ministry-logo-file"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null

                                  if (logoPreviewObjectUrl) URL.revokeObjectURL(logoPreviewObjectUrl)

                                  if (!file) {
                                    setLogoFile(null)
                                    setLogoPreviewObjectUrl('')
                                    setLogoPreviewSrc('')
                                    return
                                  }

                                  const objectUrl = URL.createObjectURL(file)
                                  setLogoFile(file)
                                  setLogoPreviewObjectUrl(objectUrl)
                                  setLogoPreviewSrc(objectUrl)
                                }}
                                className="hidden"
                              />
                              <label
                                htmlFor="ministry-logo-file"
                                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded cursor-pointer hover:bg-blue-700"
                              >
                                Adicionar foto
                              </label>
                              <span className="text-sm text-gray-600">
                                {logoFile ? logoFile.name : 'Nenhum arquivo selecionado'}
                              </span>
                            </div>

                            <p className="text-sm text-gray-600 mt-2">
                              Envie uma foto do seu dispositivo. Se preferir, cole uma URL pública abaixo.
                            </p>

                            <div className="mt-3 flex items-center gap-2">
                              <input
                                type="url"
                                value={formData.logo_url}
                                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                              />
                              <button
                                type="button"
                                onClick={handleUseLogoUrl}
                                className="px-4 py-2 border border-gray-300 rounded"
                              >
                                Usar URL
                              </button>
                            </div>

                            <p className="text-xs text-gray-500 mt-2">A imagem é otimizada automaticamente.</p>
                          </div>

                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">Pré-visualização</p>
                            <div className="border border-gray-200 rounded bg-gray-50 h-44 flex items-center justify-center overflow-hidden">
                              {logoPreviewSrc ? (
                                <img src={logoPreviewSrc} alt="Pré-visualização da logo" className="w-full h-full object-contain" />
                              ) : (
                                <span className="text-sm text-gray-500">Sem foto</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              Se enviar arquivo, vamos reduzir para 512×512 e comprimir (JPG).
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seção 2: Contatos */}
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">Dados de Contato</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email de Contato *</label>
                    <input
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Telefone</label>
                    <input
                      type="tel"
                      value={formatPhone(formData.contact_phone)}
                      onChange={(e) => {
                        const digits = onlyDigits(e.target.value).slice(0, 11)
                        setFormData({ ...formData, contact_phone: digits })
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">WhatsApp</label>
                    <input
                      type="tel"
                      value={formatPhone(formData.whatsapp)}
                      onChange={(e) => {
                        const digits = onlyDigits(e.target.value).slice(0, 11)
                        setFormData({ ...formData, whatsapp: digits })
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                    <input
                      type="text"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 3: Responsável */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">Responsável</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Responsável</label>
                    <input
                      type="text"
                      value={formData.responsible_name}
                      onChange={(e) => setFormData({ ...formData, responsible_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 3.1: Credenciais de Acesso */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">
                  {editingId ? 'Alterar Credenciais de Acesso' : 'Credenciais de Acesso'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {editingId ? 'Novo Email de Acesso' : 'Email de Acesso'}
                      {!editingId && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <input
                      type="email"
                      value={formData.access_email}
                      onChange={(e) => setFormData({ ...formData, access_email: e.target.value })}
                      placeholder="admin@ministerio.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {editingId ? 'Nova Senha de Acesso' : 'Senha de Acesso'}
                      {!editingId && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <input
                      type="password"
                      value={formData.access_password}
                      onChange={(e) => setFormData({ ...formData, access_password: e.target.value })}
                      placeholder={editingId ? 'Deixe em branco para manter' : 'Mínimo 8 caracteres'}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {editingId
                    ? 'Se preencher, o email/senha de acesso do tenant será atualizado.'
                    : 'Email e senha que o administrador do ministério usará para acessar o sistema.'}
                </p>
              </div>

              {/* Seção 4: Endereço */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">Endereço</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CEP</label>
                    <input
                      type="text"
                      value={formatCep(formData.address_zip)}
                      onChange={(e) => {
                        const formatted = formatCep(e.target.value)
                        const digits = onlyDigits(formatted)
                        setFormData({ ...formData, address_zip: formatted })
                        setCepLookupError('')
                        if (digits.length < 8) setCepResolved('')
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                      maxLength={9}
                    />
                    {cepLookupLoading && (
                      <p className="mt-1 text-xs text-blue-600">Buscando endereço pelo CEP...</p>
                    )}
                    {!cepLookupLoading && cepLookupError && (
                      <p className="mt-1 text-xs text-red-600">{cepLookupError}</p>
                    )}
                    {!cepLookupLoading && !cepLookupError && cepResolved === onlyDigits(formData.address_zip || '') && (
                      <p className="mt-1 text-xs text-green-600">CEP localizado e endereço preenchido automaticamente.</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rua</label>
                    <input
                      type="text"
                      value={formData.address_street}
                      onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Número</label>
                    <input
                      type="text"
                      value={formData.address_number}
                      onChange={(e) => setFormData({ ...formData, address_number: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Complemento</label>
                    <input
                      type="text"
                      value={formData.address_complement}
                      onChange={(e) => setFormData({ ...formData, address_complement: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
                    <input
                      type="text"
                      value={formData.address_city}
                      onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Estado (UF)</label>
                    <select
                      value={formData.address_state}
                      onChange={(e) => setFormData({ ...formData, address_state: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Selecione...</option>
                      <option value="AC">AC</option>
                      <option value="AL">AL</option>
                      <option value="AP">AP</option>
                      <option value="AM">AM</option>
                      <option value="BA">BA</option>
                      <option value="CE">CE</option>
                      <option value="DF">DF</option>
                      <option value="ES">ES</option>
                      <option value="GO">GO</option>
                      <option value="MA">MA</option>
                      <option value="MT">MT</option>
                      <option value="MS">MS</option>
                      <option value="MG">MG</option>
                      <option value="PA">PA</option>
                      <option value="PB">PB</option>
                      <option value="PR">PR</option>
                      <option value="PE">PE</option>
                      <option value="PI">PI</option>
                      <option value="RJ">RJ</option>
                      <option value="RN">RN</option>
                      <option value="RS">RS</option>
                      <option value="RO">RO</option>
                      <option value="RR">RR</option>
                      <option value="SC">SC</option>
                      <option value="SP">SP</option>
                      <option value="SE">SE</option>
                      <option value="TO">TO</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Seção 5: Descrição e Plano */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">Informações Adicionais</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Plano de Inscrição</label>
                    <select
                      value={formData.subscription_plan_id}
                      onChange={(e) => setFormData({ ...formData, subscription_plan_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Selecione um plano...</option>
                      {planosLoading && (
                        <option value="" disabled>Carregando planos...</option>
                      )}
                      {!planosLoading && planos.map((plano) => (
                        <option key={plano.id} value={plano.id}>
                          {plano.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={formData.is_active ? 'ativo' : 'inativo'}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'ativo' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    >
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </div>
                  {/* Trial */}
                  {!editingId && (
                    <div className="md:col-span-2">
                      <div className="flex items-center gap-3 p-4 rounded-lg border-2 transition"
                        style={{ borderColor: isTrial ? '#2563eb' : '#e5e7eb', background: isTrial ? '#eff6ff' : '#f9fafb' }}
                      >
                        <input
                          type="checkbox"
                          id="chk-trial"
                          checked={isTrial}
                          onChange={e => setIsTrial(e.target.checked)}
                          className="w-5 h-5 accent-blue-600 cursor-pointer"
                        />
                        <label htmlFor="chk-trial" className="font-semibold text-gray-800 cursor-pointer select-none">
                          Período Trial
                        </label>
                        <span className="text-xs text-gray-500">— o ministério iniciará em modo trial e será desativado após o prazo</span>
                      </div>
                      {isTrial && (
                        <div className="mt-3 flex items-center gap-3">
                          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Duração do trial:</label>
                          <input
                            type="number"
                            min={1}
                            max={90}
                            value={trialDays}
                            onChange={e => setTrialDays(Math.max(1, Math.min(90, Number(e.target.value))))}
                            className="w-24 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-sm"
                          />
                          <span className="text-sm text-gray-600">dias</span>
                          <span className="text-xs text-blue-600 ml-1">
                            (expira em {new Date(Date.now() + trialDays * 86400000).toLocaleDateString('pt-BR')})
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="mt-6 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
              >
                {editingId ? 'Atualizar Ministério' : 'Criar Ministério'}
              </button>
            </form>
          </div>
        )}

        {/* Lista de ministérios */}
            {loading ? (
              <div className="text-center text-gray-400 py-12">Carregando...</div>
            ) : ministerios.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                Nenhum ministério cadastrado
              </div>
            ) : (
              <div className="bg-gray-800 border border-gray-700 rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Nome</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Email</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Telefone</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {ministerios.map((ministerio) => (
                      <tr key={ministerio.id} className="hover:bg-gray-700/40">
                        <td className="px-6 py-4 text-sm text-gray-100">{ministerio.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-300">{ministerio.email_admin}</td>
                        <td className="px-6 py-4 text-sm text-gray-300">{formatPhoneDisplay(ministerio.phone)}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-3 py-1 rounded text-xs font-semibold ${
                            ministerio.is_active
                              ? 'bg-green-900 text-green-200'
                              : 'bg-gray-700 text-gray-300'
                          }`}>
                            {ministerio.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => handleEdit(ministerio)}
                            className="text-blue-400 hover:text-blue-300 mr-2"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(ministerio)}
                            className="text-red-400 hover:text-red-300"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
              </>
            )}

        {/* TAB: Pré-Cadastros */}
            {activeTab === 'precadastros' && (
              <TrialSignupsWidget />
            )}
          </div>
        </div>
      </main>

      {/* Modal: Importar CSV de membros */}
      {showImport && (
        <div className="fixed inset-0 bg-black/75 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl my-8 text-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">📥 Importar Membros via CSV</h2>
              <button
                onClick={() => { setShowImport(false); setImportResult(null); setImportRows([]); setImportHeaders([]); setImportFile(null) }}
                className="text-gray-400 hover:text-white transition text-xl leading-none"
              >✕</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Passo 1: Baixar modelo */}
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <p className="text-sm font-semibold text-gray-200 mb-1">Passo 1 — Baixe o modelo CSV</p>
                <p className="text-xs text-gray-400 mb-3">O modelo contém todas as colunas suportadas com um exemplo de linha. Use ponto-e-vírgula como separador no Excel se necessário.</p>
                <button
                  onClick={downloadTemplate}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition font-medium"
                >
                  📄 Baixar modelo CSV
                </button>
              </div>

              {/* Passo 2: Selecionar ministério */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Passo 2 — Selecione o ministério destino <span className="text-red-400">*</span>
                </label>
                <select
                  value={importMinistryId}
                  onChange={(e) => setImportMinistryId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">— Selecione o ministério —</option>
                  {ministerios.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Passo 3: Selecionar arquivo */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Passo 3 — Selecione o arquivo CSV <span className="text-red-400">*</span>
                </label>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f) }}
                  className="block w-full text-sm text-gray-300 file:mr-3 file:px-4 file:py-2 file:rounded file:bg-gray-700 file:text-gray-100 file:border-0 hover:file:bg-gray-600 cursor-pointer"
                />
                {importFile && (
                  <p className="mt-1 text-xs text-gray-400">{importFile.name} — {importRows.length} linha{importRows.length !== 1 ? 's' : ''} encontrada{importRows.length !== 1 ? 's' : ''}</p>
                )}
              </div>

              {/* Preview */}
              {importRows.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pré-visualização (primeiras 5 linhas)</p>
                  <div className="overflow-x-auto rounded border border-gray-700">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-800">
                        <tr>
                          <th className="px-2 py-1 text-gray-400 font-medium text-left">#</th>
                          {importHeaders.slice(0, 8).map(h => (
                            <th key={h} className="px-2 py-1 text-gray-300 font-medium text-left whitespace-nowrap">{h}</th>
                          ))}
                          {importHeaders.length > 8 && <th className="px-2 py-1 text-gray-500">+{importHeaders.length - 8} cols</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700/50">
                        {importRows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-800/40">
                            <td className="px-2 py-1 text-gray-500">{idx + 2}</td>
                            {importHeaders.slice(0, 8).map(h => (
                              <td key={h} className="px-2 py-1 text-gray-300 max-w-[120px] truncate" title={row[h]}>{row[h] || <span className="text-gray-600">—</span>}</td>
                            ))}
                            {importHeaders.length > 8 && <td />}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Resultado */}
              {importResult && (
                <div className={`rounded-xl p-4 border ${importResult.inserted > 0 ? 'bg-green-950/40 border-green-800' : 'bg-red-950/40 border-red-800'}`}>
                  {importResult.inserted > 0 && (
                    <p className="text-green-300 font-semibold text-sm mb-1">
                      ✅ {importResult.inserted} membro{importResult.inserted !== 1 ? 's' : ''} importado{importResult.inserted !== 1 ? 's' : ''} com sucesso em <strong>{importResult.ministry_name}</strong>!
                    </p>
                  )}
                  {importResult.skipped > 0 && (
                    <p className="text-yellow-400 text-xs">⚠️ {importResult.skipped} linha{importResult.skipped !== 1 ? 's' : ''} ignorada{importResult.skipped !== 1 ? 's' : ''} (sem nome)</p>
                  )}
                  {importResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-red-400 text-xs font-semibold mb-1">Erros ({importResult.errors.length}):</p>
                      <ul className="space-y-1 max-h-40 overflow-y-auto">
                        {importResult.errors.map((e, i) => (
                          <li key={i} className="text-xs text-red-300">Linha {e.row} {e.name ? `"${e.name}"` : ''}: {e.reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Botão importar */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={doImport}
                  disabled={!importFile || !importMinistryId || importLoading || importRows.length === 0}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {importLoading ? 'Importando...' : `📥 Importar ${importRows.length > 0 ? importRows.length + ' membro' + (importRows.length !== 1 ? 's' : '') : 'membros'}`}
                </button>
                <button
                  onClick={() => { setShowImport(false); setImportResult(null); setImportRows([]); setImportHeaders([]); setImportFile(null) }}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition text-sm"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar remoção de ministério */}
      {confirmDeleteMinisterio && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-red-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-900/60 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white">Remover ministério?</h2>
            </div>
            <p className="text-sm text-gray-300 mb-1">
              Você está prestes a remover permanentemente:
            </p>
            <div className="bg-gray-800 rounded-lg px-4 py-3 mb-4">
              <p className="font-semibold text-white text-sm">{confirmDeleteMinisterio.name}</p>
              {confirmDeleteMinisterio.email_admin && (
                <p className="text-xs text-gray-400">{confirmDeleteMinisterio.email_admin}</p>
              )}
            </div>
            <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-3 mb-5">
              <p className="text-xs text-red-400 font-medium">⚠️ Esta ação é irreversível. Todos os dados do ministério serão excluídos.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteMinisterio(null)}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-100 rounded-lg hover:bg-gray-600 transition text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={doDelete}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold disabled:opacity-50"
              >
                {deleteLoading ? 'Removendo...' : 'Sim, remover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
