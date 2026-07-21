'use client'

import { useState, useEffect, useRef } from 'react'
import { authenticatedFetch } from '@/lib/api-client'
import { onlyDigits, validarCnpj, validarCpf } from '@/lib/mascaras'
import type { Ministry as SupabaseMinistry } from '@/types/supabase'

interface UseMinistryFormOptions {
  showError: (msg: string) => void
  setSuccess: (msg: string) => void
  setError: (msg: string) => void
  fetchMinisterios: () => void
  setTempPasswords: React.Dispatch<React.SetStateAction<Record<string, string>>>
}

export function useMinistryForm({
  showError,
  setSuccess,
  setError,
  fetchMinisterios,
  setTempPasswords,
}: UseMinistryFormOptions) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

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
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewSrc, setLogoPreviewSrc] = useState<string>('')
  const [logoPreviewObjectUrl, setLogoPreviewObjectUrl] = useState<string>('')

  const [cepLookupLoading, setCepLookupLoading] = useState(false)
  const [cepLookupError, setCepLookupError] = useState('')
  const [cepResolved, setCepResolved] = useState('')
  const cepLookupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCepRequestedRef = useRef('')

  const resetForm = () => {
    setFormData({
      name: '',
      cnpj: '',
      documento_tipo: 'cnpj',
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

  // Monitorar ZIP
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

    const fetchCep = async (digits: string) => {
      try {
        setCepLookupLoading(true)
        setCepLookupError('')

        const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
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

        setCepResolved(digits)
      } catch {
        setCepLookupError('Erro ao buscar CEP. Verifique sua conexão e tente novamente.')
        setCepResolved('')
      } finally {
        setCepLookupLoading(false)
      }
    }

    cepLookupTimeoutRef.current = setTimeout(() => {
      lastCepRequestedRef.current = cepDigits
      fetchCep(cepDigits)
    }, 450)

    return () => {
      if (cepLookupTimeoutRef.current) {
        clearTimeout(cepLookupTimeoutRef.current)
      }
    }
  }, [formData.address_zip, cepResolved])

  const compressLogo = async (file: File) => {
    const maxSize = 512
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = maxSize
    canvas.height = maxSize
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas não suportado')

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

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

      const payloadToSend: any = {
        ...formData,
        cnpj: docDigits,
        contact_phone: onlyDigits(formData.contact_phone),
        whatsapp: onlyDigits(formData.whatsapp),
        logo_url: uploadedLogoUrl || formData.logo_url,
        trial_mode: !editingId && isTrial,
        trial_days: !editingId && isTrial ? trialDays : undefined,
      }

      if (!editingId) {
        if (!formData.access_email?.trim()) {
          showError('Email de acesso é obrigatório para criar um ministério.')
          return
        }
        if (!formData.access_password?.trim() || formData.access_password.trim().length < 8) {
          showError('Senha de acesso é obrigatória e deve ter no mínimo 8 caracteres.')
          return
        }
      } else {
        if (!payloadToSend.access_email?.trim()) delete payloadToSend.access_email
        if (!payloadToSend.access_password?.trim()) delete payloadToSend.access_password
      }

      const response = await authenticatedFetch('/api/v1/admin/ministries', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { ...payloadToSend, id: editingId } : payloadToSend),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao salvar ministério')
      }

      const payload = await response.json()
      const creds = payload?.credentials
      if (payload?.data?.id && creds?.password) {
        setTempPasswords((prev) => ({ ...prev, [payload.data.id]: creds.password }))
      } else if (payload?.data?.id && formData.access_password?.trim()) {
        setTempPasswords((prev) => ({ ...prev, [payload.data.id]: formData.access_password.trim() }))
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

  return {
    showForm,
    setShowForm,
    editingId,
    setEditingId,
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
    resetForm,
    handleSubmit,
    handleEdit,
  }
}
