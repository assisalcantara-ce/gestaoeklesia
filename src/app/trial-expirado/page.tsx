'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { formatarPreco } from '@/config/plans'
import PremiumCard from '@/components/ui/PremiumCard'
import PremiumButton from '@/components/ui/PremiumButton'

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
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [planos, setPlanos] = useState<PlanoDB[]>([])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/')
    } catch {
      window.location.href = '/'
    }
  }
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

  // Estados do Modal de Proposta
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalPlan, setModalPlan] = useState<PlanoDB | null>(null)
  const [observacao, setObservacao] = useState('')
  const [solicitando, setSolicitando] = useState(false)
  const [solicitacaoSucesso, setSolicitacaoSucesso] = useState(false)
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)
  const [profileData, setProfileData] = useState<{
    ministry_id: string
    ministry_name: string
    responsavel: string
    email: string
    telefone: string
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

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const user = sessionData?.session?.user
        if (!user) return

        setSessionUserId(user.id)

        // Busca o ministry_id do usuário em ministry_users ou ministries
        let mId = ''
        const { data: ministryUser } = await supabase
          .from('ministry_users')
          .select('ministry_id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (ministryUser?.ministry_id) {
          mId = ministryUser.ministry_id
        } else {
          const { data: ownedM } = await supabase
            .from('ministries')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle()
          if (ownedM?.id) mId = ownedM.id
        }

        if (!mId) return

        // Busca informações do ministério
        const { data: mData } = await supabase
          .from('ministries')
          .select('name, email_admin, phone')
          .eq('id', mId)
          .maybeSingle()

        // Busca informações de configurações adicionais (como responsável)
        const { data: configData } = await supabase
          .from('configurations')
          .select('church_profile')
          .eq('ministry_id', mId)
          .maybeSingle()

        const churchProfile = (configData as any)?.church_profile || {}

        setProfileData({
          ministry_id: mId,
          ministry_name: mData?.name || 'Seu Ministério',
          responsavel: churchProfile.responsavel || user.user_metadata?.full_name || 'Líder Responsável',
          email: mData?.email_admin || user.email || '',
          telefone: mData?.phone || churchProfile.telefone || '',
        })
      } catch (err) {
        console.error('Erro ao carregar perfil de trial expirado:', err)
      }
    }
    loadProfile()
  }, [supabase])

  const handleSendSolicitacao = async () => {
    if (!modalPlan || !profileData || solicitando) return
    setSolicitando(true)
    try {
      // 1. Tenta inserir na tabela de oportunidades comerciais
      const { error: optError } = await supabase
        .from('oportunidades_comerciais')
        .insert([{
          ministry_id: profileData.ministry_id,
          plano_solicitado: modalPlan.name,
          observacao: observacao,
          created_at: new Date().toISOString(),
          status: 'novo'
        }])

      if (optError) {
        console.warn('oportunidades_comerciais falhou/não existe. Usando fallback de suporte:', optError.message)
        
        // 2. Fallback para support_tickets (solicitações administrativas)
        const { error: ticketError } = await supabase
          .from('support_tickets')
          .insert([{
            ministry_id: profileData.ministry_id,
            user_id: sessionUserId,
            subject: `Solicitação de Proposta: Plano ${modalPlan.name}`,
            description: `Solicitação de proposta personalizada enviada pelo trial expirado.\n\nPlano solicitado: ${modalPlan.name}\nResponsável: ${profileData.responsavel}\nE-mail: ${profileData.email}\nTelefone: ${profileData.telefone}\n\nObservações:\n${observacao || 'Nenhuma'}`,
            category: 'billing',
            priority: 'high',
            status: 'open'
          }])
          
        if (ticketError) {
          throw new Error(ticketError.message)
        }
      }

      setSolicitacaoSucesso(true)
      setTimeout(() => {
        setIsModalOpen(false)
        setSolicitacaoSucesso(false)
        setObservacao('')
      }, 3000)
    } catch (err: any) {
      alert('Erro ao enviar solicitação: ' + (err?.message || 'Tente novamente.'))
    } finally {
      setSolicitando(false)
    }
  }


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

      <div className="absolute top-6 right-6 z-10">
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-lg border border-[#e7e0d6] bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sair
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16 relative">
        <div className="max-w-3xl">
          <span className="inline-flex items-center px-4 py-1 rounded-full bg-amber-50 text-xs uppercase tracking-[0.4em] text-amber-700 border border-amber-100">
            Avaliação encerrada
          </span>
          <h1 className="landing-title text-4xl md:text-5xl font-bold leading-tight mt-4">
            Seu período de avaliação terminou
          </h1>
          <p className="text-lg text-slate-600 mt-4">
            Seu ministério continua salvo e todos os dados cadastrados permanecem preservados.
          </p>
          <p className="text-base text-slate-500 mt-2">
            Escolha abaixo como deseja continuar utilizando o Gestão Eklésia.
          </p>

          {/* Card informativo — dados preservados */}
          <div className="mt-6 rounded-2xl bg-emerald-50 border border-emerald-100 px-6 py-5 flex flex-wrap gap-x-8 gap-y-2">
            {[
              'Nenhum membro será perdido',
              'Financeiro preservado',
              'Eventos preservados',
              'Configurações preservadas',
            ].map((item) => (
              <span key={item} className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </span>
            ))}
          </div>
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

          {!loading && !error && (() => {
            const planosExibidos = planos.filter((p) => !p.slug?.toLowerCase().includes('basic'))
            const planoStarter = planosExibidos.find((p) => p.slug?.toLowerCase().includes('starter') || p.price_monthly === 59.90 || p.price_monthly > 0)
            const planosSecundarios = planosExibidos.filter((p) => p.id !== planoStarter?.id)

            return (
              <div className="space-y-10">
                {/* Seção Protagonista: Plano Starter */}
                {planoStarter && (() => {
                  const plan = planoStarter
                  const isSelected = selectedPlanId === plan.id
                  const btnLabel = isSelected ? '✓ Selecionado' : 'Selecionar Plano'

                  return (

                    <div className="space-y-5">
                      <div className="space-y-1 text-center md:text-left">
                        <h3 className="text-xl font-bold text-[#062E6F]">Continue utilizando o Gestão Eklésia</h3>
                        <p className="text-sm text-slate-500 font-medium">Este é o plano recomendado para continuar utilizando todos os recursos do seu ministério.</p>
                      </div>

                      <div className="max-w-lg md:max-w-xl mx-auto md:mx-0 w-full">
                        <PremiumCard
                          key={plan.id}
                          hoverable
                          onClick={() => {
                            setSelectedPlanId(plan.id)
                            setCheckoutInfo(null)
                            setCheckoutError('')
                          }}
                          className={`relative pt-10 pb-8 px-8 transition-all duration-300 transform hover:scale-[1.02] flex flex-col justify-between h-full overflow-visible ${
                            isSelected ? 'border-2 border-emerald-600 bg-white shadow-2xl' : 'border-2 border-emerald-500 bg-white shadow-xl'
                          } cursor-pointer`}
                        >
                          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center px-4 py-1 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest shadow z-10 whitespace-nowrap">
                            Mais escolhido
                          </span>

                          <div className="flex-1 flex flex-col">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Plano Principal</p>
                                <h2 className="text-2xl font-black text-slate-800 mt-2">{plan.name}</h2>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-bold text-slate-400">Mensal</p>
                                <p className="text-2xl font-black text-[#062E6F]">{formatarPreco(plan.price_monthly)}/mês</p>
                              </div>
                            </div>

                            {/* Bloco de benefícios adicionados */}
                            <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 mt-4 space-y-2.5 text-xs text-emerald-950">
                              <div className="flex items-start gap-2.5 font-semibold">
                                <span className="text-emerald-600 font-black text-sm leading-none">✓</span>
                                <span className="leading-tight">Ativação imediata após a confirmação do pagamento</span>
                              </div>
                              <div className="flex items-start gap-2.5 font-semibold">
                                <span className="text-emerald-600 font-black text-sm leading-none">✓</span>
                                <span className="leading-tight">Continue utilizando todos os módulos já cadastrados</span>
                              </div>
                              <div className="flex items-start gap-2.5 font-semibold">
                                <span className="text-emerald-600 font-black text-sm leading-none">✓</span>
                                <span className="leading-tight">Seus dados permanecem preservados</span>
                              </div>
                            </div>

                            <p className="text-xs text-slate-500 mt-4 font-medium">{plan.description || ''}</p>

                            <ul className="space-y-2 text-xs text-slate-600 mt-4 flex-1">
                              {buildHighlights(plan).map((item) => (
                                <li key={item} className="flex items-center gap-2 font-medium">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="mt-6 pt-4 border-t border-slate-50">
                            <PremiumButton
                              variant="success"
                              className="w-full text-xs py-3"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedPlanId(plan.id)
                                setCheckoutInfo(null)
                                setCheckoutError('')
                              }}
                            >
                              {btnLabel}
                            </PremiumButton>
                            
                            {/* Observação discreta de rodapé */}
                            <p className="text-[10px] text-center text-slate-400 mt-3 font-semibold leading-normal">
                              "A cobrança será gerada na próxima etapa e poderá ser paga via PIX, boleto ou cartão."
                            </p>
                          </div>
                        </PremiumCard>
                      </div>

                    </div>
                  )
                })()}

                {/* Seção Secundária: Intermediário & Profissional */}
                {planosSecundarios.length > 0 && (
                  <div className="pt-10 border-t border-slate-100 space-y-6">
                    <div className="space-y-1 text-center md:text-left">
                      <h3 className="text-lg font-bold text-slate-800">Precisa de uma solução personalizada?</h3>
                      <p className="text-sm text-slate-500 font-medium">Para ministérios maiores ou com necessidades específicas, nossa equipe poderá montar uma proposta personalizada.</p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 max-w-3xl">
                      {planosSecundarios.map((plan) => {
                        const isSelected = selectedPlanId === plan.id
                        const isProfissional = plan.slug?.toLowerCase().includes('profis')
                        const btnLabel = isProfissional ? 'Falar com Especialista' : 'Solicitar Proposta'

                        return (
                          <PremiumCard
                            key={plan.id}
                            hoverable
                            onClick={() => {
                              setModalPlan(plan)
                              setIsModalOpen(true)
                              setSolicitacaoSucesso(false)
                              setObservacao('')
                            }}
                            className={`relative pt-8 pb-6 px-6 transition-all flex flex-col justify-between h-full overflow-visible ${
                              isSelected ? 'border border-emerald-400 bg-emerald-50/10' : 'border border-slate-150 bg-white'
                            } cursor-pointer`}
                          >
                            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center px-3 py-1 rounded-full bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider shadow z-10 whitespace-nowrap">
                              Recomendado
                            </span>

                            <div className="flex-1 flex flex-col">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Plano</p>
                                  <h2 className="text-xl font-bold text-slate-800 mt-2">{plan.name}</h2>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-semibold text-slate-500 mt-1 leading-tight">
                                    Preço sob<br />consulta
                                  </p>
                                </div>
                              </div>

                              <p className="text-xs text-slate-500 mt-3 font-medium">{plan.description || ''}</p>

                              <ul className="space-y-2 text-xs text-slate-600 mt-4 flex-1">
                                {buildHighlights(plan).map((item) => (
                                  <li key={item} className="flex items-center gap-2 font-medium">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-50">
                              <PremiumButton
                                variant="secondary"
                                className="w-full text-xs"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setModalPlan(plan)
                                  setIsModalOpen(true)
                                  setSolicitacaoSucesso(false)
                                  setObservacao('')
                                }}
                              >
                                {btnLabel}
                              </PremiumButton>
                            </div>
                          </PremiumCard>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}


          {!loading && !error && selectedPlanId && selectedPlan && selectedPlan.price_monthly > 0 && (
            <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 text-emerald-950 space-y-3">
              <p className="text-sm font-semibold">
                Plano selecionado: <strong>{selectedPlan?.name || 'Plano'}</strong>. Gere o boleto para concluir a assinatura.
              </p>

              <PremiumButton
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="w-full text-xs"
              >
                {checkoutLoading ? 'Gerando boleto...' : 'Gerar boleto e enviar por e-mail'}
              </PremiumButton>
              {checkoutError && (
                <p className="text-xs text-red-600 font-semibold mt-1">{checkoutError}</p>
              )}
              {checkoutInfo && (
                <PremiumCard hoverable={false} className="p-4 bg-white border border-emerald-100">
                  <p className="text-sm font-bold text-emerald-800">Boleto gerado e enviado por e-mail.</p>
                  <p className="text-xs text-slate-500 font-semibold mt-1">
                    Vencimento: {new Date(checkoutInfo.due_date).toLocaleDateString('pt-BR')} · Valor: {formatarPreco(checkoutInfo.amount)}
                  </p>
                  {checkoutInfo.bank_slip_url && (
                    <a
                      href={checkoutInfo.bank_slip_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex mt-3 text-xs font-bold text-emerald-600 hover:text-emerald-700 underline"
                    >
                      Abrir boleto
                    </a>
                  )}
                  {!checkoutInfo.bank_slip_url && checkoutInfo.invoice_url && (
                    <a
                      href={checkoutInfo.invoice_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex mt-3 text-xs font-bold text-emerald-600 hover:text-emerald-700 underline"
                    >
                      Abrir fatura
                    </a>
                  )}
                </PremiumCard>
              )}
            </div>
          )}
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <a
            href="https://wa.me/5591981755021"
            target="_blank"
            rel="noreferrer"
          >
            <PremiumButton variant="secondary" className="text-xs border-none bg-white shadow-md">
              💬 Falar com a equipe comercial
            </PremiumButton>
          </a>
          <PremiumButton
            variant="danger"
            onClick={handleLogout}
            className="text-xs shadow-md"
          >
            Sair da conta e voltar ao início
          </PremiumButton>
        </div>
      </div>

      {/* Modal de Solicitação de Proposta */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 md:p-8 border border-[#e7e0d6] shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-slate-800">Solicitar proposta personalizada</h2>
              <p className="text-xs text-slate-500">
                Nossa equipe comercial entrará em contato para apresentar a melhor solução para seu ministério.
              </p>
            </div>

            {solicitacaoSucesso ? (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-center space-y-2">
                <p className="text-emerald-800 font-bold text-sm">✓ Solicitação enviada com sucesso.</p>
                <p className="text-emerald-600 text-xs">Nossa equipe entrará em contato em breve.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ministério</label>
                    <input
                      type="text"
                      readOnly
                      value={profileData?.ministry_name || ''}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Plano Escolhido</label>
                    <input
                      type="text"
                      readOnly
                      value={modalPlan?.name || ''}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-emerald-800 font-bold text-xs outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Responsável</label>
                    <input
                      type="text"
                      readOnly
                      value={profileData?.responsavel || ''}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Telefone</label>
                    <input
                      type="text"
                      readOnly
                      value={profileData?.telefone || ''}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">E-mail</label>
                  <input
                    type="text"
                    readOnly
                    value={profileData?.email || ''}
                    className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Observações (opcional)</label>
                  <textarea
                    rows={3}
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Escreva alguma observação ou dúvida adicional..."
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-700 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <PremiumButton
                    variant="secondary"
                    className="flex-1 text-xs"
                    onClick={() => setIsModalOpen(false)}
                    disabled={solicitando}
                  >
                    Cancelar
                  </PremiumButton>
                  <PremiumButton
                    variant="success"
                    className="flex-1 text-xs"
                    onClick={handleSendSolicitacao}
                    disabled={solicitando}
                  >
                    {solicitando ? 'Enviando...' : 'Enviar Solicitação'}
                  </PremiumButton>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

