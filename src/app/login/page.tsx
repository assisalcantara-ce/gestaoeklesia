'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase-client'
import NotificationModal from '@/components/NotificationModal'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loginErrorModal, setLoginErrorModal] = useState({ isOpen: false })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.gestaoeklesia.com.br'

  // Carrega e-mail salvo se "Lembrar acesso" estiver ativo
  useEffect(() => {
    const savedEmail = localStorage.getItem('ge_remembered_email')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [])

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(''), 4000)
      return () => clearTimeout(t)
    }
  }, [error])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')

    try {
      if (!email || !password) {
        setError('Preencha todos os campos')
        setLoading(false)
        return
      }

      if (!supabaseRef.current) {
        supabaseRef.current = createClient()
      }

      const { data, error: err } = await supabaseRef.current.auth.signInWithPassword({
        email,
        password,
      })

      if (!err && data?.user) {
        // Salva ou remove o e-mail no localStorage com base no checkbox
        if (rememberMe) {
          localStorage.setItem('ge_remembered_email', email)
        } else {
          localStorage.removeItem('ge_remembered_email')
        }

        const token = data.session?.access_token
        if (token) {
          try {
            const res = await fetch('/api/v1/trial/status', {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (res.ok) {
              const trial = await res.json()
              if (trial?.expired) {
                router.push('/trial-expirado')
                return
              }
            }
          } catch (e) {
            console.error('Erro ao verificar status do trial:', e)
          }
        }
        router.push('/dashboard')
        return
      }

      setLoginErrorModal({ isOpen: true })
      setLoading(false)
    } catch (e) {
      setError('Erro ao fazer login. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
      {/* Background institucional: gradiente azul moderno com formas abstratas */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#021526] via-[#03346E] to-[#6EACDA] z-0"></div>
      
      {/* Formas abstratas com desfoque suave para estética premium */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#03346E] opacity-40 blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-[#6EACDA] opacity-35 blur-[130px] pointer-events-none z-0"></div>
      <div className="absolute top-[30%] right-[10%] w-[25vw] h-[25vw] rounded-full bg-[#0284c7] opacity-25 blur-[100px] pointer-events-none z-0"></div>

      <NotificationModal
        isOpen={loginErrorModal.isOpen}
        type="error"
        title="Credenciais incorretas"
        message="E-mail ou senha inválidos. Verifique os dados inseridos e tente novamente."
        onClose={() => setLoginErrorModal({ isOpen: false })}
        showButton
        autoClose={4000}
      />

      {/* Card central moderno */}
      <div className="w-full max-w-md relative z-10 mx-auto transition-all duration-300">
        <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-white/20 p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)]">
          
          {/* Logo e cabeçalho */}
          <div className="flex flex-col items-center mb-6">
            <Image
              src="/img/logoh.png"
              alt="Gestão Eklésia"
              width={220}
              height={64}
              priority
              sizes="220px"
              className="h-[64px] w-auto object-contain select-none mb-1"
            />
            <p className="text-sm text-slate-500 font-medium mt-1 text-center">
              Administração Ministerial Inteligente
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold text-center">
                {error}
              </div>
            )}

            {/* Campo de e-mail */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 ml-1">
                E-mail
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@igreja.com"
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl bg-white focus:border-[#03346E] focus:ring-2 focus:ring-blue-100 outline-none transition text-sm text-slate-900 placeholder-slate-400"
                  required
                />
              </div>
            </div>

            {/* Campo de senha */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 ml-1">
                Senha
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl bg-white focus:border-[#03346E] focus:ring-2 focus:ring-blue-100 outline-none transition text-sm text-slate-900 placeholder-slate-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Checkbox lembrar e link de recuperação */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-[#03346E] focus:ring-[#03346E] cursor-pointer"
                />
                <span>Lembrar acesso</span>
              </label>
              <a
                href={`${siteUrl}/login#recuperar`}
                className="font-semibold text-[#03346E] hover:underline transition"
              >
                Esqueci minha senha
              </a>
            </div>

            {/* Botão de envio */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#03346E] text-white rounded-xl font-bold text-sm hover:bg-[#02244f] active:scale-[0.98] transition disabled:opacity-50 disabled:pointer-events-none mt-2 shadow-[0_4px_12px_rgba(3,52,110,0.25)]"
            >
              {loading ? 'Entrando no sistema...' : 'Entrar no sistema'}
            </button>
          </form>

          {/* Links adicionais */}
          <div className="mt-6 pt-5 border-t border-slate-200/60 flex items-center justify-between text-xs">
            <a
              href={siteUrl}
              className="font-semibold text-slate-600 hover:text-[#03346E] transition flex items-center gap-1"
            >
              <span>←</span> Voltar ao site
            </a>
            <a
              href={`${siteUrl}/pre-cadastro?plan=starter&trial=true`}
              className="font-bold text-[#03346E] hover:underline transition"
            >
              Criar Teste Grátis
            </a>
          </div>

        </div>

        {/* Rodapé institucional */}
        <div className="mt-8 text-center text-[10px] text-white/60 tracking-wider space-y-1 select-none pointer-events-none">
          <p>© Gestão Eklésia. Todos os direitos reservados.</p>
          <p>Tecnologia Alcântara Sistemas</p>
        </div>
      </div>
    </div>
  )
}
