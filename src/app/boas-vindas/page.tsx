'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { ProductExperienceService } from '@/lib/services/product-experience'
import {
  Settings,
  LayoutDashboard,
  Building2,
  Users,
  UserPlus,
  CalendarDays,
  Sparkles,
  Compass,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  X,
  Play
} from 'lucide-react'

interface Step {
  id: string
  label: string
  completed: boolean
  path: string
}

interface OnboardingData {
  steps: Step[]
  progressPercent: number
  trialDaysRemaining: number
  trialStatus: string
  isCompleted: boolean
}

// Passos do Tour Guiado
const TOUR_STEPS = [
  {
    title: 'Painel Principal (Dashboard)',
    desc: 'Aqui você tem uma visão geral instantânea da saúde de sua igreja. Monitore o total de membros ativos, indicadores de batismo, finanças mensais e receba avisos importantes da presidência.',
  },
  {
    title: 'Secretaria Ministerial',
    desc: 'Cadastre e gerencie toda a ficha de membros, controle transferências de cartas e acompanhe dados da Escola Bíblica Dominical (EBD) de forma centralizada e ágil.',
  },
  {
    title: 'Acolhimento e Integração',
    desc: 'Gerencie e dê as boas-vindas a novos visitantes. Acompanhe o fluxo de integração e garanta que ninguém seja esquecido nos primeiros passos na igreja.',
  },
  {
    title: 'Agenda Integrada',
    desc: 'Planeje o calendário ministerial da sede e congregações. Agende cultos, reuniões e eventos oficiais, evitando conflitos de datas.',
  },
  {
    title: 'Financeiro e Tesouraria',
    desc: 'Lance entradas, dízimos, ofertas e despesas. Faça a conciliação bancária, controle contas a pagar e gere relatórios fiscais transparentes para a liderança.',
  },
  {
    title: 'Configurações de Segurança',
    desc: 'Ajuste dados do seu ministério, crie novas congregações locais, defina permissões de acessos e configure os níveis de usuários da sua liderança.',
  }
]

const supabase = createClient()

export default function BoasVindasPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<{ name: string; ministry_name: string } | null>(null)
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null)

  // Estados do Tour Guiado
  const [tourActive, setTourActive] = useState(false)
  const [currentTourStep, setCurrentTourStep] = useState(0)

  const fetchOnboarding = async (uid: string, token: string) => {
    const isCompleted = ProductExperienceService.isTourCompleted(uid)
    const res = await fetch(`/api/v1/onboarding/status?tourCompleted=${isCompleted}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      setOnboarding(data)
      return data
    }
    return null
  }

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.replace('/login')
          return
        }

        const uid = session.user.id
        setUserId(uid)

        const { data: userData } = await supabase
          .from('users')
          .select('name, role')
          .eq('auth_user_id', uid)
          .maybeSingle()

        // Busca o ministry_id do usuário para filtrar o tenant correto
        const { data: ministryUser } = await supabase
          .from('ministry_users')
          .select('ministry_id')
          .eq('user_id', uid)
          .maybeSingle()

        let ministryName = 'Seu Ministério'
        if (ministryUser?.ministry_id) {
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', ministryUser.ministry_id)
            .maybeSingle()
          if (tenantData?.name) {
            ministryName = tenantData.name
          }
        }

        setProfile({
          name: userData?.name || session.user.email?.split('@')[0] || 'Líder',
          ministry_name: ministryName
        })

        const data = await fetchOnboarding(uid, session.access_token)
        
        // Verifica se o assistente foi ocultado
        const forceShow = new URLSearchParams(window.location.search).get('show') === 'true'
        const hasOcultado = !ProductExperienceService.shouldShowAssistant(uid)

        if (data && data.isCompleted && !forceShow) {
          router.replace('/dashboard')
          return
        }

        if (hasOcultado && !forceShow) {
          router.replace('/dashboard')
          return
        }
      } catch (err) {
        console.error('Erro ao obter dados do assistente:', err)
      } finally {
        setLoading(false)
      }
    }

    checkOnboarding()
  }, [])

  const startTour = () => {
    setCurrentTourStep(0)
    setTourActive(true)
  }

  const handleNextTourStep = async () => {
    if (currentTourStep < TOUR_STEPS.length - 1) {
      setCurrentTourStep(prev => prev + 1)
    } else {
      await finishTour()
    }
  }

  const handlePrevTourStep = () => {
    if (currentTourStep > 0) {
      setCurrentTourStep(prev => prev - 1)
    }
  }

  const finishTour = async () => {
    setTourActive(false)
    if (userId) {
      ProductExperienceService.completeTour(userId)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await fetchOnboarding(userId, session.access_token)
      }
    }
  }

  const handleFinishOnboarding = () => {
    if (userId) {
      ProductExperienceService.hideAssistant(userId)
    }
    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f2ea] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-emerald-700 animate-spin" />
          <p className="text-sm font-medium text-slate-600">Carregando assistente...</p>
        </div>
      </div>
    )
  }

  const getStepIcon = (id: string) => {
    switch (id) {
      case 'tour': return Play
      case 'ministry': return Building2
      case 'congregacao': return Settings
      case 'usuarios': return Users
      case 'membro': return UserPlus
      case 'culto': return CalendarDays
      default: return Compass
    }
  }

  const isFullyCompleted = onboarding?.isCompleted || false

  return (
    <div className="min-h-screen bg-[#f6f2ea] text-[#1f1b16] py-16 px-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute w-[420px] h-[420px] rounded-full bg-[#ccebe3] filter blur-[80px] opacity-40 top-[-120px] left-[-140px] pointer-events-none" />
      <div className="absolute w-[520px] h-[520px] rounded-full bg-[#f3d8bf] filter blur-[80px] opacity-40 bottom-[-220px] right-[-160px] pointer-events-none" />

      <div className="max-w-3xl mx-auto bg-white/95 backdrop-blur rounded-3xl p-8 md:p-12 shadow-2xl border border-[#e7e0d6] relative z-10 space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-700">
            <Sparkles className="h-8 w-8 animate-pulse" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            🎉 Bem-vindo ao Gestão Eklésia!
          </h1>
          <p className="text-lg text-slate-600 max-w-xl mx-auto">
            Seu ambiente foi criado com sucesso. Agora vamos configurar seu ministério: <strong>{profile?.ministry_name}</strong>.
          </p>
          {onboarding && onboarding.trialDaysRemaining > 0 && (
            <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-100">
              ⏳ Período de Teste: Você tem {onboarding.trialDaysRemaining} dias grátis restantes
            </span>
          )}
        </div>

        {/* Progresso Geral */}
        {onboarding && (
          <div className="space-y-2 bg-[#fcfbfa] p-6 rounded-2xl border border-[#e7e0d6]/60">
            <div className="flex justify-between items-center text-sm font-bold text-slate-700">
              <span>Implantação do Ministério</span>
              <span>{onboarding.progressPercent}% concluída</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-emerald-600 h-3 rounded-full transition-all duration-500" 
                style={{ width: `${onboarding.progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Checklist */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Compass className="h-5 w-5 text-emerald-700" />
            Checklist de implantação da sua igreja:
          </h2>

          <div className="grid gap-3">
            {onboarding?.steps.map((step) => {
              const Icon = getStepIcon(step.id)
              return (
                <div 
                  key={step.id} 
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 ${
                    step.completed 
                      ? 'bg-emerald-50/40 border-emerald-200' 
                      : 'bg-[#fcfbfa] border-[#e7e0d6]/60 hover:border-slate-300'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${step.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  
                  <div className="space-y-1">
                    <p className={`text-sm font-bold ${step.completed ? 'text-slate-700 line-through' : 'text-slate-900'}`}>
                      {step.label}
                    </p>
                  </div>

                  <div className="ml-auto flex items-center gap-3">
                    {step.completed ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Concluído
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          if (step.id === 'tour') {
                            startTour()
                          } else {
                            router.push(step.path)
                          }
                        }}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
                      >
                        {step.id === 'tour' ? 'Iniciar Tour' : 'Configurar'} <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Finalização comemorativa */}
        {isFullyCompleted ? (
          <div className="bg-emerald-50 border border-emerald-200 p-8 rounded-3xl text-center space-y-4 shadow-sm animate-fade-in">
            <div className="inline-flex p-3 bg-emerald-100 rounded-full text-emerald-800">
              <Sparkles className="h-10 w-10 animate-bounce" />
            </div>
            <h3 className="text-2xl font-extrabold text-emerald-950">🎉 Parabéns!</h3>
            <p className="text-sm text-emerald-900 max-w-md mx-auto leading-relaxed">
              Seu ministério está totalmente implantado. Agradecemos por confiar no Gestão Eklésia para organizar o seu ministério.
            </p>
            <button
              onClick={handleFinishOnboarding}
              className="px-8 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-sm font-bold transition shadow-lg shadow-emerald-700/20"
            >
              Ir para o Dashboard
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-[#e7e0d6]/60">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-[#e7e0d6] px-6 py-4 text-sm font-bold text-slate-700 hover:bg-slate-50 transition duration-200"
            >
              <LayoutDashboard className="h-4 w-4" />
              Ir para o Dashboard
            </button>
          </div>
        )}

      </div>

      {/* Modal do Tour Guiado */}
      {tourActive && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-gray-150 relative space-y-6">
            <button 
              onClick={finishTour} 
              className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:bg-gray-100 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-2">
              <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                Passo {currentTourStep + 1} de {TOUR_STEPS.length}
              </span>
              <h3 className="text-xl font-extrabold text-slate-900">
                {TOUR_STEPS[currentTourStep].title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {TOUR_STEPS[currentTourStep].desc}
              </p>
            </div>

            {/* Dots */}
            <div className="flex gap-1.5 justify-center">
              {TOUR_STEPS.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1.5 rounded-full transition-all duration-350 ${i === currentTourStep ? 'w-6 bg-emerald-600' : 'w-1.5 bg-slate-200'}`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-100">
              <button
                onClick={finishTour}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 transition"
              >
                Pular Tour
              </button>

              <div className="flex gap-2">
                {currentTourStep > 0 && (
                  <button
                    onClick={handlePrevTourStep}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={handleNextTourStep}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
                >
                  {currentTourStep === TOUR_STEPS.length - 1 ? 'Finalizar' : 'Próximo'}
                  <ChevronRight className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
