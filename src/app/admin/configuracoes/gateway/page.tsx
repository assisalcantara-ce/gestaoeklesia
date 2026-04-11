'use client'

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, Link2, ShieldCheck } from 'lucide-react'
import AdminSidebar from '@/components/AdminSidebar'
import { createClient } from '@/lib/supabase-client'

interface GatewaySettings {
  provider: 'asaas'
  apiUrl: string
  hasApiKey: boolean
  hasWebhookToken: boolean
  apiKeyMasked: string | null
  webhookTokenMasked: string | null
}

export default function GatewayConfigPage() {
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [settings, setSettings] = useState<GatewaySettings | null>(null)
  const [form, setForm] = useState({
    apiUrl: 'https://api.asaas.com/v3',
    apiKey: '',
    webhookToken: '',
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      setLoading(true)
      setError('')

      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) throw new Error('Não autenticado')

      const response = await fetch('/api/admin/gateway-settings', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!response.ok) throw new Error('Erro ao carregar configurações do gateway')

      const data = (await response.json()) as GatewaySettings
      setSettings(data)
      setForm((prev) => ({ ...prev, apiUrl: data.apiUrl || prev.apiUrl }))
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }

  async function testConnection() {
    try {
      setTesting(true)
      setError('')
      setSuccess('')

      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Não autenticado')

      const response = await fetch('/api/admin/gateway-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          apiUrl: form.apiUrl,
          apiKey: form.apiKey || undefined,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Falha no teste de conexão')
      }

      setSuccess(payload?.message || 'Conexão validada com sucesso.')
      await fetchSettings()
    } catch (err: any) {
      setError(err.message || 'Erro ao testar conexão')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 z-10">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Link2 className="w-6 h-6 text-blue-500" />
            PAINEL ADMINISTRATIVO: Gateway de Pagamentos
          </h2>
          <p className="text-gray-400 text-sm mt-1">Configure e valide a integração do ASAAS</p>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-lg border border-red-700 bg-red-900/30 text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 rounded-lg border border-green-700 bg-green-900/30 text-green-200 flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {loading ? (
            <div className="text-gray-400">Carregando configurações...</div>
          ) : (
            <>
              <section className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">Status Atual</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                    <p className="text-gray-400 text-sm">Provider</p>
                    <p className="text-white font-semibold mt-1 uppercase">{settings?.provider || 'asaas'}</p>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                    <p className="text-gray-400 text-sm">ASAAS_API_KEY</p>
                    <p className={`font-semibold mt-1 ${settings?.hasApiKey ? 'text-green-400' : 'text-red-400'}`}>
                      {settings?.hasApiKey ? `Configurada (${settings.apiKeyMasked})` : 'Não configurada'}
                    </p>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                    <p className="text-gray-400 text-sm">ASAAS_WEBHOOK_TOKEN</p>
                    <p className={`font-semibold mt-1 ${settings?.hasWebhookToken ? 'text-green-400' : 'text-red-400'}`}>
                      {settings?.hasWebhookToken ? `Configurado (${settings.webhookTokenMasked})` : 'Não configurado'}
                    </p>
                  </div>
                </div>
              </section>

              <section className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">Teste de Conexão ASAAS</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">ASAAS_API_URL</label>
                    <input
                      type="text"
                      value={form.apiUrl}
                      onChange={(e) => setForm((p) => ({ ...p, apiUrl: e.target.value }))}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">ASAAS_API_KEY (opcional para teste)</label>
                    <input
                      type="password"
                      value={form.apiKey}
                      onChange={(e) => setForm((p) => ({ ...p, apiKey: e.target.value }))}
                      placeholder="Se vazio, usa variável de ambiente"
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">ASAAS_WEBHOOK_TOKEN</label>
                    <input
                      type="password"
                      value={form.webhookToken}
                      onChange={(e) => setForm((p) => ({ ...p, webhookToken: e.target.value }))}
                      placeholder="Informativo (configuração via .env)"
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100"
                      disabled
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={testConnection}
                    disabled={testing}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold disabled:opacity-50"
                  >
                    {testing ? 'Testando...' : 'Testar Conexão'}
                  </button>

                  <button
                    onClick={fetchSettings}
                    className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium"
                  >
                    Recarregar Status
                  </button>
                </div>
              </section>

              <section className="bg-amber-950/30 border border-amber-700/40 rounded-lg p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-amber-300 mt-0.5" />
                  <div>
                    <h4 className="text-amber-200 font-semibold">Segurança e Persistência</h4>
                    <p className="text-amber-100/90 text-sm mt-1">
                      As credenciais do gateway não são salvas por esta tela. A configuração oficial permanece via
                      variáveis de ambiente: ASAAS_API_URL, ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN.
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
