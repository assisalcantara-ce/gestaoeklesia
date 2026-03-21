'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import Link from 'next/link'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import TrialSignupsWidget from '@/components/TrialSignupsWidget'
import type { Ministry as SupabaseMinistry } from '@/types/supabase'
import { onlyDigits, formatCnpj, formatPhone } from '@/lib/mascaras'

export default function MinisteriosPage() {
  const { isLoading, isAuthenticated, logout } = useAdminAuth()
  const [ministerios, setMinisterios] = useState<SupabaseMinistry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewSrc, setLogoPreviewSrc] = useState<string>('')
  const [logoPreviewObjectUrl, setLogoPreviewObjectUrl] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'ativos' | 'precadastros'>('ativos')
  const router = useRouter()

  useEffect(() => {
    return () => {
      if (logoPreviewObjectUrl) URL.revokeObjectURL(logoPreviewObjectUrl)
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
    address_street: '',
    address_number: '',
    address_complement: '',
    address_city: '',
    address_state: '',
    address_zip: '',
    subscription_plan_id: '',
    is_active: true,
    quantity_temples: 1,
    quantity_members: 0,
  })

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      fetchMinisterios()
    }
  }, [isAuthenticated])

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
      const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`)
      if (!response.ok) return

      const data = await response.json()
      if (data?.erro) return

      setFormData((prev) => ({
        ...prev,
        address_street: data.logradouro || prev.address_street,
        address_city: data.localidade || prev.address_city,
        address_state: data.uf || prev.address_state,
      }))
    } catch {
      // Silenciar erros de autocomplete
    }
  }

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

    try {
      const uploadedLogoUrl = await uploadLogoIfNeeded()

      const payloadToSend = {
        ...formData,
        // Garantir que o backend recebe apenas dígitos
        cnpj: onlyDigits(formData.cnpj),
        contact_phone: onlyDigits(formData.contact_phone),
        whatsapp: onlyDigits(formData.whatsapp),
        logo_url: uploadedLogoUrl || formData.logo_url,
      }

      const response = await authenticatedFetch('/api/v1/admin/ministries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadToSend),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar ministério')
      }

      const payload = await response.json()
      const creds = payload?.credentials
      setSuccess(
        creds?.email && creds?.password
          ? `Ministério criado com sucesso! Credenciais geradas: ${creds.email} / ${creds.password}`
          : 'Ministério criado com sucesso!'
      )
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
        address_street: '',
        address_number: '',
        address_complement: '',
        address_city: '',
        address_state: '',
        address_zip: '',
        subscription_plan_id: '',
        is_active: true,
        quantity_temples: 1,
        quantity_members: 0,
      })
      if (logoPreviewObjectUrl) URL.revokeObjectURL(logoPreviewObjectUrl)
      setLogoPreviewObjectUrl('')
      setLogoPreviewSrc('')
      setLogoFile(null)
      setShowForm(false)
      fetchMinisterios()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/admin/dashboard" className="text-2xl font-bold text-gray-800 hover:text-gray-600">
            ← Voltar ao Dashboard
          </Link>
          <button
            onClick={async () => {
              await logout()
              router.push('/admin/login')
            }}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Sair
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Gerenciar Ministérios</h2>
          <p className="text-gray-600">Gerencie todos os ministérios/clientes do sistema</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 p-4 rounded mb-6">
            {success}
          </div>
        )}

        {/* Abas */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('ativos')}
              className={`px-4 py-3 font-medium text-sm transition ${
                activeTab === 'ativos'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📋 Ministérios Ativos
            </button>
            <button
              onClick={() => setActiveTab('precadastros')}
              className={`px-4 py-3 font-medium text-sm transition ${
                activeTab === 'precadastros'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              ⏳ Pré-Cadastros (Trial)
            </button>
          </div>
        </div>

        {/* TAB: Ministérios Ativos */}
        {activeTab === 'ativos' && (
          <>
            {/* Botão para novo ministério */}
            <div className="mb-6">
              <button
                onClick={() => setShowForm(!showForm)}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {showForm ? 'Cancelar' : '+ Novo Ministério'}
              </button>
            </div>

            {/* Formulário */}
            {showForm && (
              <div className="bg-white rounded-lg shadow p-6 mb-8">
                <h3 className="text-xl font-bold mb-4">Novo Ministério</h3>
                <form onSubmit={handleSubmit}>
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
                          placeholder="Ex: Igreja Assembleia de Deus"
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
                          className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                          placeholder="00.000.000/0000-00"
                          maxLength={18}
                        />
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
                                placeholder="(opcional) URL da foto"
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
                      placeholder="contato@ministerio.com"
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
                      placeholder="(11) 3000-0000"
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
                      placeholder="(11) 99000-0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                      placeholder="https://www.ministerio.com"
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
                      placeholder="Ex: Pastor João Silva"
                    />
                  </div>
                </div>
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
                        if (digits.length === 8) {
                          fetchCep(digits)
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                      placeholder="00000-000"
                      maxLength={9}
                    />
                  </div>
                </div>

                {/* Informações de Estrutura */}
                <div className="mt-6 pt-6 border-t border-gray-300">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">📊 Informações de Estrutura</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Quantidade de Igrejas/Templos</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.quantity_temples}
                        onChange={(e) => setFormData({ ...formData, quantity_temples: parseInt(e.target.value) || 1 })}
                        className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Quantidade de Membros</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.quantity_members}
                        onChange={(e) => setFormData({ ...formData, quantity_members: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                        placeholder="0"
                      />
                    </div>
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
                      placeholder="Rua das Flores"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Número</label>
                    <input
                      type="text"
                      value={formData.address_number}
                      onChange={(e) => setFormData({ ...formData, address_number: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                      placeholder="123"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Complemento</label>
                    <input
                      type="text"
                      value={formData.address_complement}
                      onChange={(e) => setFormData({ ...formData, address_complement: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                      placeholder="Apto 42, Bloco A"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
                    <input
                      type="text"
                      value={formData.address_city}
                      onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                      placeholder="São Paulo"
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
                      placeholder="Descreva brevemente o ministério..."
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
                      <option value="plan-basic">Plano Básico</option>
                      <option value="plan-standard">Plano Padrão</option>
                      <option value="plan-premium">Plano Premium</option>
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
                </div>
              </div>

              <button
                type="submit"
                className="mt-6 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
              >
                Criar Ministério
              </button>
            </form>
          </div>
        )}

        {/* Lista de ministérios */}
        {loading ? (
          <div className="text-center text-gray-600 py-12">Carregando...</div>
        ) : ministerios.length === 0 ? (
          <div className="text-center text-gray-600 py-12">
            Nenhum ministério cadastrado
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nome</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Telefone</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ministerios.map((ministerio) => (
                  <tr key={ministerio.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-800">{ministerio.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{ministerio.email_admin}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatPhoneDisplay(ministerio.phone)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded text-sm font-medium ${
                        ministerio.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {ministerio.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button className="text-blue-600 hover:text-blue-800 mr-2">Editar</button>
                      <button className="text-red-600 hover:text-red-800">Remover</button>
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
  )
}
