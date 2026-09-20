'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { BRAND } from '@/config/brand'
import { createClient } from '@/lib/supabase-client'
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Users,
  Wallet,
  Calendar,
  BarChart3,
  Church,
  ShieldCheck,
  AlertCircle,
  X,
  CheckCircle2,
  Loader2,
} from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextParam = searchParams.get('next') || searchParams.get('redirectTo') || ''
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  // Modal Esqueci minha senha
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotError, setForgotError] = useState('')

  const getSupabase = () => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient()
    }
    return supabaseRef.current
  }

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
      const t = setTimeout(() => setError(''), 5000)
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
        setError('Preencha todos os campos.')
        setLoading(false)
        return
      }

      const supabase = getSupabase()

      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (!err && data?.user) {
        // Salva ou remove o e-mail no localStorage
        if (rememberMe) {
          localStorage.setItem('ge_remembered_email', email.trim())
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
            console.error('Erro ao verificar status de trial:', e)
          }
        }

        if (nextParam) {
          router.push(nextParam)
        } else {
          router.push('/dashboard')
        }
        return
      }

      setError('E-mail ou senha inválidos. Verifique os dados inseridos e tente novamente.')
      setLoading(false)
    } catch {
      setError('Erro ao fazer login. Tente novamente.')
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true)
      setError('')
      const supabase = getSupabase()
      const redirectTo = `${window.location.origin}/dashboard`

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      })

      if (oauthError) {
        setError('Não foi possível iniciar o login com o Google. Tente novamente.')
        setGoogleLoading(false)
      }
    } catch {
      setError('Erro ao conectar com o Google.')
      setGoogleLoading(false)
    }
  }

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (forgotLoading) return

    const emailTrimmed = forgotEmail.trim()
    if (!emailTrimmed) {
      setForgotError('Por favor, informe o e-mail cadastrado.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailTrimmed)) {
      setForgotError('Informe um e-mail válido.')
      return
    }

    setForgotLoading(true)
    setForgotError('')

    try {
      const supabase = getSupabase()
      const redirectTo = `${window.location.origin}/redefinir-senha`

      await supabase.auth.resetPasswordForEmail(emailTrimmed, {
        redirectTo,
      })

      try {
        await fetch('/api/v1/audit-logs/public', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acao: 'outro',
            modulo: 'autenticacao',
            descricao: 'Solicitação de redefinição de senha',
            usuario_email: emailTrimmed,
            status: 'sucesso',
          }),
        })
      } catch {
        // Ignora falha de log na solicitação
      }

      setForgotSent(true)
    } catch {
      setForgotSent(true)
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#031536] text-white relative overflow-x-hidden selection:bg-blue-600 selection:text-white">
      {/* Imagem de Fundo Oficial do App (bg_app.png) */}
      <div 
        className="pointer-events-none absolute inset-0 bg-cover bg-center z-0"
        style={{
          backgroundImage: `url('/img/bg_app.png')`,
        }}
      />

      {/* Camada sutil para realçar contraste dos textos e cards */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-blue-950/40 via-transparent to-blue-950/20 z-0" />

      {/* Cabeçalho com Logo */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 pt-7 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white/95 px-3 py-1.5 rounded-xl shadow-md flex items-center justify-center backdrop-blur-md">
            <Image
              src={BRAND.logoHorizontal}
              alt={BRAND.name}
              width={140}
              height={40}
              className="h-8 w-auto object-contain"
              priority
            />
          </div>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs sm:text-sm font-medium text-blue-50 border border-white/15 backdrop-blur-md transition duration-200 hover:border-blue-300/40 cursor-pointer shadow-sm"
        >
          <span>← Voltar ao site</span>
        </Link>
      </header>

      {/* Conteúdo Principal Split-Screen */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 py-8 lg:py-10 flex-1 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Coluna Esquerda: Apresentação & Cartões de Recursos */}
          <div className="lg:col-span-7 flex flex-col justify-center max-w-xl">
            {/* Traço azul vibrante */}
            <div className="w-12 h-1 bg-blue-400 rounded-full mb-6 shadow-[0_0_14px_rgba(96,165,250,0.8)]" />

            {/* Título Principal */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.18]">
              Bem-vindo ao <br />
              Gestão <span className="text-sky-400">Eklésia</span>
            </h1>

            {/* Subtítulo */}
            <p className="mt-4 text-base sm:text-lg text-blue-100/75 font-normal leading-relaxed">
              A plataforma completa para a gestão da sua igreja, ministério ou campo, com simplicidade, segurança e foco na missão.
            </p>

            {/* Grid de Recursos / Destaques */}
            <div className="mt-8 space-y-3 sm:space-y-3.5">
              {/* Item 1: Gestão de membros */}
              <div className="flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-white/[0.04] border border-blue-400/20 backdrop-blur-md transition duration-200 hover:border-sky-400/40 hover:bg-white/[0.07]">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center shrink-0 text-sky-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-semibold text-white">
                    Gestão de membros
                  </h4>
                  <p className="text-xs text-blue-200/70">
                    Cadastro completo e histórico ministerial
                  </p>
                </div>
              </div>

              {/* Item 2: Controle financeiro */}
              <div className="flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-white/[0.04] border border-blue-400/20 backdrop-blur-md transition duration-200 hover:border-sky-400/40 hover:bg-white/[0.07]">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center shrink-0 text-sky-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-semibold text-white">
                    Controle financeiro
                  </h4>
                  <p className="text-xs text-blue-200/70">
                    Dízimos, ofertas e prestações de contas
                  </p>
                </div>
              </div>

              {/* Item 3: Agenda e eventos */}
              <div className="flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-white/[0.04] border border-blue-400/20 backdrop-blur-md transition duration-200 hover:border-sky-400/40 hover:bg-white/[0.07]">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center shrink-0 text-sky-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-semibold text-white">
                    Agenda e eventos
                  </h4>
                  <p className="text-xs text-blue-200/70">
                    Cultos, reuniões e atividades
                  </p>
                </div>
              </div>

              {/* Item 4: Relatórios em tempo real */}
              <div className="flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-white/[0.04] border border-blue-400/20 backdrop-blur-md transition duration-200 hover:border-sky-400/40 hover:bg-white/[0.07]">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center shrink-0 text-sky-400">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-semibold text-white">
                    Relatórios em tempo real
                  </h4>
                  <p className="text-xs text-blue-200/70">
                    Informações para melhores decisões
                  </p>
                </div>
              </div>
            </div>

            {/* Versículo bíblico no rodapé da coluna */}
            <div className="mt-8 flex items-start gap-3 text-xs text-blue-200/65 italic">
              <div className="w-6 h-[2px] bg-blue-400/70 mt-2 shrink-0" />
              <div>
                <p>&ldquo;Tudo coopera para o bem daqueles que amam a Deus.&rdquo;</p>
                <p className="not-italic text-blue-300/80 font-medium mt-0.5">Romanos 8:28</p>
              </div>
            </div>
          </div>

          {/* Coluna Direita: Card de Acesso da Instituição (Branco) */}
          <div className="lg:col-span-5 w-full flex justify-center lg:justify-end">
            <div className="w-full max-w-[430px] bg-white rounded-3xl p-7 sm:p-9 shadow-2xl shadow-blue-950/70 border border-slate-100 text-slate-900 transition duration-300">
              
              {/* Ícone Superior Central da Igreja */}
              <div className="flex justify-center mb-5">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                  <Church className="w-6 h-6" />
                </div>
              </div>

              {/* Título & Subtítulo */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Acesso da sua Instituição
                </h2>
                <p className="mt-1.5 text-xs text-slate-500 leading-normal max-w-xs mx-auto">
                  Entre com suas credenciais para acessar o Gestão Eklésia.
                </p>
              </div>

              {/* Formulário de Login */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Alerta de Erro */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* E-mail Institucional */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    E-mail institucional
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="seu@email.com.br"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-slate-900 text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                    />
                  </div>
                </div>

                {/* Senha */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Senha
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Sua senha"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-slate-900 text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Links Lembrar & Esqueceu Senha */}
                  <div className="flex items-center justify-between mt-2.5 text-xs">
                    <label className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span>Lembrar</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setForgotSent(false)
                        setForgotError('')
                        setForgotEmail(email)
                        setShowForgotModal(true)
                      }}
                      className="font-medium text-blue-600 hover:text-blue-700 hover:underline transition cursor-pointer"
                    >
                      Esqueceu sua senha?
                    </button>
                  </div>
                </div>

                {/* Botão Principal Entrar no Sistema */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 shadow-md shadow-blue-600/30 hover:shadow-lg hover:shadow-blue-600/40 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Entrando...</span>
                    </>
                  ) : (
                    <>
                      <span>Entrar no Sistema</span>
                      <span className="text-base leading-none">→</span>
                    </>
                  )}
                </button>

                {/* Divisor "Ou continue com" */}
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-200" />
                  <span className="shrink-0 mx-3 text-[11px] text-slate-400 font-medium">
                    Ou continue com
                  </span>
                  <div className="flex-grow border-t border-slate-200" />
                </div>

                {/* Botão Entrar com Google */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition duration-200 shadow-sm hover:border-slate-300 disabled:opacity-60 cursor-pointer"
                >
                  {googleLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                      />
                    </svg>
                  )}
                  <span>Entrar com Google</span>
                </button>
              </form>

              {/* Mensagem de Segurança no rodapé do Card */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-normal">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Ambiente seguro e com criptografia SSL.</span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Rodapé Inferior */}
      <footer className="relative z-10 w-full bg-[#020d24] border-t border-blue-950 py-4 px-6 sm:px-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-blue-200/60">
          {/* Logo compacta / Icone à esquerda */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-600/30 flex items-center justify-center text-sky-400 border border-blue-500/20">
              <Church className="w-3.5 h-3.5" />
            </div>
            <span className="font-medium text-white/90">{BRAND.name}</span>
          </div>

          {/* Links Centrais */}
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-blue-300 transition">
              Início
            </Link>
            <Link href="/suporte" className="hover:text-blue-300 transition">
              Suporte
            </Link>
            <Link href="/termos" className="hover:text-blue-300 transition">
              Termos de Uso
            </Link>
            <Link href="/privacidade" className="hover:text-blue-300 transition">
              Política de Privacidade
            </Link>
          </div>

          {/* Copyright à direita */}
          <div>
            © {new Date().getFullYear()} {BRAND.name}. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {/* Modal Esqueci minha senha */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 text-slate-900 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" /> Recuperar Senha
              </h3>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-slate-600 transition text-sm font-bold p-1 cursor-pointer"
                disabled={forgotLoading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {forgotSent ? (
              <div className="space-y-4 text-center py-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-xl">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                  Se existir uma conta vinculada a este e-mail, enviaremos as instruções para redefinição da senha.
                </p>
                <p className="text-xs text-slate-500">
                  Por favor, verifique também a sua caixa de spam ou lixo eletrônico.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium text-xs transition cursor-pointer"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Informe o seu e-mail cadastrado. Enviaremos um link seguro para você redefinir sua senha.
                </p>

                {forgotError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                    {forgotError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    E-mail cadastrado
                  </label>
                  <input
                    type="email"
                    placeholder="seu.email@igreja.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    disabled={forgotLoading}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer"
                    disabled={forgotLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2 disabled:opacity-60 cursor-pointer shadow-sm"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <span>Enviar instruções</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

