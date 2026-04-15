'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { formatarPreco } from '@/config/plans'

type PlanoDB = {
  id: string
  name: string
  slug: string
  description: string | null
  price_monthly: number
  price_annually: number | null
  max_users: number
  max_members: number
  max_ministerios: number
  additional_church_monthly_fee: number
  additional_admin_users_per_church: number
  has_advanced_reports: boolean
  has_api_access: boolean
  has_priority_support: boolean
  has_custom_domain: boolean
  has_white_label: boolean
  has_automation: boolean
  has_modulo_financeiro: boolean
  has_modulo_eventos: boolean
  has_modulo_reunioes: boolean
}

function buildHighlights(plan: PlanoDB): string[] {
  const h: string[] = []
  if (plan.max_users > 0) h.push(`Ate ${plan.max_users} Usuarios Administrativos`)
  if (plan.max_members > 0) h.push(`Ate ${plan.max_members.toLocaleString('pt-BR')} Membros`)
  else h.push('Membros ilimitados')
  if (plan.max_ministerios > 0) h.push(`Ate ${plan.max_ministerios} Igrejas inclusas`)
  if (plan.additional_church_monthly_fee > 0) {
    h.push(`R$ ${plan.additional_church_monthly_fee.toFixed(2)}/mes por igreja adicional`)
  }
  if (plan.additional_admin_users_per_church > 0) {
    h.push(`+${plan.additional_admin_users_per_church} admins por igreja adicional`)
  }
  if (plan.has_modulo_financeiro) h.push('Modulo Financeiro')
  if (plan.has_modulo_eventos) h.push('Modulo Eventos')
  if (plan.has_modulo_reunioes) h.push('Modulo Reunioes')
  if (plan.has_advanced_reports) h.push('Relatorios Avancados')
  if (plan.has_priority_support) h.push('Suporte Prioritario')
  return h
}

export default function TrialExpiradoPage() {
  const supabase = useMemo(() => createClient(), [])
  const [planos, setPlanos] = useState<PlanoDB[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutInfo, setCheckoutInfo] = useState<{
    amount: number
    due_date: string
    invoice_url?: string | null
    bank_slip_url?: string | null
    status?: string | null
  } | null>(null)

  useEffect(() => {
    const loadPlans = async () => {
      try {
        setLoading(true)
        const { data, error: plansError } = await supabase
          .from('subscription_plans')
          .select('id,name,slug,description,price_monthly,price_annually,max_users,max_members,max_ministerios,additional_church_monthly_fee,additional_admin_users_per_church,has_api_access,has_advanced_reports,has_priority_support,has_custom_domain,has_white_label,has_automation,has_modulo_financeiro,has_modulo_eventos,has_modulo_reunioes')
          .eq('is_active', true)
          .order('display_order', { ascending: true })
          .order('price_monthly', { ascending: true })

        if (plansError) {
          setError('Nao foi possivel carregar os planos. Tente novamente.')
          return
        }

        setPlanos((data || []) as PlanoDB[])
      } catch {
        setError('Nao foi possivel carregar os planos. Tente novamente.')
      } finally {
        setLoading(false)
      }
    }

    loadPlans()
  }, [supabase])

  const selectedPlan = planos.find((plan) => plan.id === selectedPlanId) || null

  const handleCheckout = async () => {
    if (!selectedPlanId) return
    setCheckoutLoading(true)
    setCheckoutError('')
    setCheckoutInfo(null)

    try {
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token
      if (!token) {
        setCheckoutError('Sessao expirada. Faca login novamente.')
        setCheckoutLoading(false)
        return
      }

      const response = await fetch('/api/v1/trial/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan_id: selectedPlanId }),
      })

      const payload = await response.json()
      if (!response.ok) {
        setCheckoutError(payload?.error || 'Erro ao gerar boleto')
        setCheckoutLoading(false)
        return
      }

      setCheckoutInfo(payload.payment || null)
    } catch {
      setCheckoutError('Erro ao gerar boleto. Tente novamente.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f2ea] text-[#1f1b16] relative overflow-hidden">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&display=swap');
        body {
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
          background: radial-gradient(circle at top, #f8f5ef 0%, #eef5f2 55%, #f6f2ea 100%);
        }
        .landing-title {
          font-family: 'Cormorant Garamond', 'Georgia', serif;
          letter-spacing: -0.02em;
        }
        .landing-orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(80px);
          opacity: 0.55;
          pointer-events: none;
        }
        .landing-orb.orb-a {
          width: 420px;
          height: 420px;
          background: #ccebe3;
          top: -120px;
          left: -140px;
        }
        .landing-orb.orb-b {
          width: 520px;
          height: 520px;
          background: #f3d8bf;
          bottom: -220px;
          right: -160px;
        }
      `}</style>

      <div className="landing-orb orb-a" />
      <div className="landing-orb orb-b" />

      <div className="max-w-6xl mx-auto px-6 py-16 relative">
        <div className="max-w-3xl">
          <span className="inline-flex items-center px-4 py-1 rounded-full bg-amber-50 text-xs uppercase tracking-[0.4em] text-amber-700 border border-amber-100">
            Teste encerrado
          </span>
          <h1 className="landing-title text-4xl md:text-5xl font-bold leading-tight mt-4">
            Seu periodo de teste terminou.
          </h1>
          <p className="text-lg text-slate-600 mt-4">
            Para continuar usando o Gestao Eklesia, escolha um plano abaixo. O boleto sera enviado por email na proxima etapa.
          </p>
        </div>

        <div className="mt-10">
          {loading && (
            <div className="rounded-2xl bg-white/90 border border-[#e7e0d6] p-6 shadow-lg text-slate-600">
              Carregando planos...
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="grid gap-6 md:grid-cols-2">
              {planos.map((plan) => {
                const isSelected = selectedPlanId === plan.id
                return (
                  <div
                    key={plan.id}
                    className={`rounded-2xl border p-6 shadow-lg transition ${isSelected ? 'border-emerald-500 bg-emerald-50/70' : 'border-[#e7e0d6] bg-white/90'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm uppercase tracking-[0.3em] text-emerald-700">Plano</p>
                        <h2 className="text-2xl font-bold text-slate-900 mt-2">{plan.name}</h2>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-500">Mensal</p>
                        <p className="text-xl font-bold text-slate-900">{formatarPreco(plan.price_monthly)}/mes</p>
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 mt-3">{plan.description || ''}</p>

                    <ul className="space-y-2 text-xs text-slate-600 mt-4">
                      {buildHighlights(plan).map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                          {item}
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlanId(plan.id)
                        setCheckoutInfo(null)
                        setCheckoutError('')
                      }}
                      className="mt-6 w-full rounded-xl bg-emerald-700 px-4 py-3 text-white font-semibold hover:bg-emerald-800 transition"
                    >
                      Selecionar plano
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && !error && selectedPlanId && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800 space-y-3">
              <p className="text-sm">
                Plano selecionado: <strong>{selectedPlan?.name || 'Plano'}</strong>. Gere o boleto para concluir a assinatura.
              </p>
              <button
                type="button"
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-white font-semibold hover:bg-emerald-800 transition disabled:opacity-60"
              >
                {checkoutLoading ? 'Gerando boleto...' : 'Gerar boleto e enviar por email'}
              </button>
              {checkoutError && (
                <p className="text-sm text-red-700">{checkoutError}</p>
              )}
              {checkoutInfo && (
                <div className="rounded-xl border border-emerald-200 bg-white/80 p-4 text-emerald-900">
                  <p className="text-sm font-semibold">Boleto gerado e enviado por email.</p>
                  <p className="text-xs text-emerald-800 mt-1">
                    Vencimento: {new Date(checkoutInfo.due_date).toLocaleDateString('pt-BR')} · Valor: {formatarPreco(checkoutInfo.amount)}
                  </p>
                  {checkoutInfo.bank_slip_url && (
                    <a
                      href={checkoutInfo.bank_slip_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex mt-3 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                    >
                      Abrir boleto
                    </a>
                  )}
                  {!checkoutInfo.bank_slip_url && checkoutInfo.invoice_url && (
                    <a
                      href={checkoutInfo.invoice_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex mt-3 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                    >
                      Abrir fatura
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-10">
          <a
            href="https://wa.me/5591981755021"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-[#e7e0d6] bg-white/80 px-4 py-3 text-sm text-slate-700 hover:bg-emerald-50/60 transition"
          >
            Falar com a equipe comercial
          </a>
        </div>
      </div>
    </div>
  )
}
