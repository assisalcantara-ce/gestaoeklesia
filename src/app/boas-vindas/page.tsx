'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import {
  Settings,
  LayoutDashboard,
  Building2,
  Users,
  UserPlus,
  Compass,
  CalendarDays,
  Sparkles,
} from 'lucide-react'

interface UserProfile {
  name: string
  ministry_name?: string
  role?: string
}

export default function BoasVindasPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.replace('/login')
          return
        }

        // Buscar dados do perfil/usuário logado
        const { data: userData } = await supabase
          .from('users')
          .select('name, role')
          .eq('auth_user_id', session.user.id)
          .maybeSingle()

        // Buscar dados do ministério/tenant
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('name')
          .single()

        setProfile({
          name: userData?.name || session.user.email?.split('@')[0] || 'Líder',
          ministry_name: tenantData?.name || 'Seu Ministério',
          role: userData?.role,
        })
      } catch (err) {
        console.error('Erro ao buscar dados do usuário:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
  }, [supabase, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f2ea] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-emerald-700 animate-spin" />
          <p className="text-sm font-medium text-slate-600">Carregando ambiente...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f2ea] text-[#1f1b16] py-16 px-6 relative overflow-hidden">
      {/* Orbs de fundo estéticos */}
      <div className="absolute w-[420px] h-[420px] rounded-full bg-[#ccebe3] filter blur-[80px] opacity-40 top-[-120px] left-[-140px] pointer-events-none" />
      <div className="absolute w-[520px] h-[520px] rounded-full bg-[#f3d8bf] filter blur-[80px] opacity-40 bottom-[-220px] right-[-160px] pointer-events-none" />

      <div className="max-w-3xl mx-auto bg-white/95 backdrop-blur rounded-3xl p-8 md:p-12 shadow-2xl border border-[#e7e0d6] relative z-10 space-y-8">
        
        {/* Cabeçalho */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-700 animate-bounce">
            <Sparkles className="h-8 w-8" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            🎉 Tudo pronto, {profile?.name}!
          </h1>
          <p className="text-lg text-slate-600 max-w-xl mx-auto">
            O ambiente do <strong>{profile?.ministry_name}</strong> foi criado com sucesso no Gestão Eklésia.
          </p>
          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-100">
            ⏳ Você tem 7 dias grátis de acesso ilimitado
          </span>
        </div>

        {/* Roadmap Inicial */}
        <div className="space-y-4 border-t border-slate-100 pt-6">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Compass className="h-5 w-5 text-emerald-700" />
            Checklist de implantação da sua igreja:
          </h2>
          <p className="text-sm text-slate-500">
            Siga os passos iniciais para deixar a gestão da sua igreja 100% configurada:
          </p>

          <div className="grid gap-3 mt-4">
            {[
              {
                title: 'Completar dados do ministério',
                desc: 'Adicione logotipo, CNPJ, dados de contato e endereço oficial da sede.',
                icon: Building2,
              },
              {
                title: 'Cadastrar primeira congregação',
                desc: 'Organize suas filiais, pontos de pregação ou templos adicionais.',
                icon: Settings,
              },
              {
                title: 'Convidar usuários e liderança',
                desc: 'Dê acesso para secretários, tesoureiros e pastores auxiliares.',
                icon: Users,
              },
              {
                title: 'Cadastrar primeiro membro',
                desc: 'Registre seu primeiro membro oficial para ver o histórico e ficha cadastral.',
                icon: UserPlus,
              },
              {
                title: 'Registrar primeiro culto',
                desc: 'Lance o primeiro culto com relatórios, visitantes e controle de presença.',
                icon: CalendarDays,
              },
            ].map((step, idx) => (
              <div key={idx} className="flex items-start gap-4 p-4 rounded-2xl bg-[#fcfbfa] border border-[#e7e0d6]/60 hover:border-emerald-200 transition-all duration-200">
                <div className="p-2 bg-slate-100 rounded-xl text-slate-600 shrink-0">
                  <step.icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900">{idx + 1}. {step.title}</p>
                  <p className="text-xs text-slate-500">{step.desc}</p>
                </div>
                <div className="ml-auto text-xs font-semibold text-slate-400">Recomendado</div>
              </div>
            ))}
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-100">
          <button
            onClick={() => router.push('/configuracoes/perfil-ministerio')}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-6 py-4 text-sm font-bold text-white hover:bg-emerald-800 shadow-lg shadow-emerald-700/10 hover:shadow-emerald-700/20 transition duration-200"
          >
            <Settings className="h-4 w-4" />
            Completar configuração
          </button>
          
          <button
            onClick={() => router.push('/dashboard')}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-bold text-white hover:bg-slate-800 hover:shadow-lg transition duration-200"
          >
            <LayoutDashboard className="h-4 w-4" />
            Ir para o Dashboard
          </button>
        </div>

      </div>
    </div>
  )
}
