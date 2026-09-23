'use client'

export const dynamic = 'force-dynamic';

import { useState, FormEvent, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { BRAND } from '@/config/brand'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  Lock,
  Compass,
  Building2,
  CreditCard,
  BarChart3,
  ShieldCheck,
  ShieldAlert,
  X,
  CheckCircle2,
  Loader2,
} from 'lucide-react'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Modal de Recuperação de Senha
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotError, setForgotError] = useState('')

  const router = useRouter()
  const { isAuthenticated, isLoading } = useAdminAuth()
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  const getSupabase = () => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient()
    }
    return supabaseRef.current
  }

  // Se já está autenticado, redireciona para dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/admin/dashboard')
    }
  }, [isLoading, isAuthenticated, router])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = getSupabase()

      // Fazer login
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        setError('E-mail ou senha incorretos.')
        return
      }

      if (!data.user) {
        setError('Erro ao autenticar operador.')
        return
      }

      // Verificar se é admin - enviar token no header
      const response = await fetch('/api/v1/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.session?.access_token || ''}`,
        },
        body: JSON.stringify({ email: data.user.email }),
      })

      if (!response.ok) {
        setError('Acesso negado. Esta conta não possui privilégios de operador do Backoffice.')
        await supabase.auth.signOut()
        return
      }

      // Sucesso - redirecionar para dashboard
      router.push('/admin/dashboard')
    } catch (err: any) {
      setError(err?.message || 'Falha de comunicação com os serviços de autenticação.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (forgotLoading) return

    const trimmed = forgotEmail.trim()
    if (!trimmed) {
      setForgotError('Por favor, informe seu e-mail institucional.')
      return
    }

    setForgotLoading(true)
    setForgotError('')

    try {
      const supabase = getSupabase()
      const redirectTo = `${window.location.origin}/redefinir-senha`

      await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      })

      setForgotSent(true)
    } catch {
      // Segurança: exibe sucesso neutro
      setForgotSent(true)
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col justify-between bg-[#041d1a] text-white relative overflow-x-hidden selection:bg-emerald-500 selection:text-white">
      {/* Imagem de Fundo Oficial do Admin (br_admin.png) */}
      <div 
        className="pointer-events-none absolute inset-0 bg-cover bg-center z-0"
        style={{
          backgroundImage: `url('/img/br_admin.png')`,
        }}
      />

      {/* Camada sutil para realçar contraste dos textos e cards */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-950/40 via-transparent to-emerald-950/20 z-0" />

      {/* Barra de Navegação Superior */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-10 pt-4 sm:pt-6 pb-2 sm:pb-3 flex items-center justify-between shrink-0">
        {/* Logo Container */}
        <div className="flex items-center">
          <Image
            src="/icons/logob.png"
            alt={BRAND.name}
            width={170}
            height={52}
            className="h-7 sm:h-8 w-auto object-contain"
            priority
          />
        </div>

        {/* Botão Voltar para o site */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs sm:text-sm font-medium text-emerald-100/90 border border-white/10 backdrop-blur-md transition duration-200 hover:border-emerald-500/30 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
          <span>Voltar para o site</span>
        </Link>
      </header>

      {/* Conteúdo Central em 2 Colunas */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-10 py-3 sm:py-6 lg:py-8 flex-1 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 xl:gap-12 items-center">
          
          {/* Coluna Esquerda: Apresentação & Benefícios */}
          <div className="lg:col-span-7 flex flex-col justify-center max-w-xl">
            {/* Traço verde esmeralda */}
            <div className="w-12 h-1 bg-emerald-400 rounded-full mb-3 sm:mb-5 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />

            {/* Título Principal */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
              Bem-vindo ao <br />
              Backoffice <span className="text-emerald-400">{BRAND.name}</span>
            </h1>

            {/* Subtítulo */}
            <p className="mt-2.5 sm:mt-3.5 text-xs sm:text-sm lg:text-base text-emerald-100/70 font-normal leading-relaxed">
              Gestão central da plataforma, acompanhamento de instituições, planos e resultados em um só lugar.
            </p>

            {/* Grid / Lista de Recursos */}
            <div className="mt-5 sm:mt-6 space-y-2 sm:space-y-2.5 xl:space-y-3">
              {/* Item 1 */}
              <div className="flex items-center gap-3 sm:gap-4 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-white/[0.04] border border-emerald-500/20 backdrop-blur-sm transition duration-200 hover:border-emerald-400/40 hover:bg-white/[0.06]">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center shrink-0 text-emerald-400">
                  <Compass className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-emerald-50/90">
                  Visão estratégica
                </span>
              </div>

              {/* Item 2 */}
              <div className="flex items-center gap-3 sm:gap-4 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-white/[0.04] border border-emerald-500/20 backdrop-blur-sm transition duration-200 hover:border-emerald-400/40 hover:bg-white/[0.06]">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center shrink-0 text-emerald-400">
                  <Building2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-emerald-50/90">
                  Gestão de instituições
                </span>
              </div>

              {/* Item 3 */}
              <div className="flex items-center gap-3 sm:gap-4 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-white/[0.04] border border-emerald-500/20 backdrop-blur-sm transition duration-200 hover:border-emerald-400/40 hover:bg-white/[0.06]">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center shrink-0 text-emerald-400">
                  <CreditCard className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-emerald-50/90">
                  Controle de assinaturas
                </span>
              </div>

              {/* Item 4 */}
              <div className="flex items-center gap-3 sm:gap-4 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-white/[0.04] border border-emerald-500/20 backdrop-blur-sm transition duration-200 hover:border-emerald-400/40 hover:bg-white/[0.06]">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center shrink-0 text-emerald-400">
                  <BarChart3 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-emerald-50/90">
                  Relatórios em tempo real
                </span>
              </div>
            </div>

            {/* Frase inferior de efeito */}
            <div className="mt-5 sm:mt-6 flex items-center gap-3 text-[11px] sm:text-xs text-emerald-200/60 italic">
              <div className="w-6 h-[2px] bg-emerald-400/70" />
              <span>Tecnologia a serviço de uma gestão de excelência.</span>
            </div>
          </div>

          {/* Coluna Direita: Card de Login Branco */}
          <div className="lg:col-span-5 w-full flex justify-center lg:justify-end">
            <div className="w-full max-w-[420px] bg-white rounded-3xl p-5 sm:p-7 xl:p-8 shadow-2xl shadow-emerald-950/60 border border-slate-100 text-slate-900 transition duration-300">
              
              {/* Ícone Superior Central */}
              <div className="flex justify-center mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-sm">
                  {/* Duplo display / ícone de acesso de operador */}
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 stroke-current"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="8" x="3" y="3" rx="2" />
                    <rect width="18" height="8" x="3" y="13" rx="2" />
                  </svg>
                </div>
              </div>

              {/* Título & Descrição do Card */}
              <div className="text-center mb-4 sm:mb-5">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Acesso Administrativo
                </h2>
                <p className="mt-1 text-[11px] sm:text-xs text-slate-500 leading-normal max-w-xs mx-auto">
                  Entre com seu e-mail de operador para acessar o Backoffice.
                </p>
              </div>

              {/* Formulário de Login */}
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
                {/* Alerta de Erro */}
                {error && (
                  <div className="p-2.5 sm:p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Campo E-mail */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail de Operador da Plataforma
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
                      placeholder="admin@gestaoeklesia.com.br"
                      className="w-full pl-10 pr-3.5 py-2 sm:py-2.5 bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl text-slate-900 text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition"
                    />
                  </div>
                </div>

                {/* Campo Senha */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Senha de Acesso
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
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2 sm:py-2.5 bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl text-slate-900 text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition tracking-wider"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Link Esqueceu Senha */}
                  <div className="flex justify-end mt-1.5 sm:mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotSent(false)
                        setForgotError('')
                        setForgotEmail(email)
                        setShowForgotModal(true)
                      }}
                      className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline transition cursor-pointer"
                    >
                      Esqueceu sua senha?
                    </button>
                  </div>
                </div>

                {/* Botão Entrar */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-1.5 sm:mt-2 flex items-center justify-center gap-2 bg-[#00875a] hover:bg-[#00734c] text-white py-2.5 sm:py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 shadow-md shadow-emerald-700/25 hover:shadow-lg hover:shadow-emerald-700/35 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Autenticando...</span>
                    </>
                  ) : (
                    <>
                      <span>Entrar no Backoffice</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Mensagem de Segurança no rodapé do Card */}
              <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[10px] sm:text-[11px] text-emerald-700 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Área estritamente restrita à equipe proprietária.</span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Barra de Rodapé */}
      <footer className="relative z-10 w-full bg-[#021311] border-t border-emerald-950 py-3 sm:py-4 px-5 sm:px-10 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5 sm:gap-4 text-[11px] sm:text-xs text-emerald-100/60">
          {/* Logo compacta / Icone à esquerda */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/10 flex items-center justify-center font-bold text-white text-xs border border-white/10">
              E
            </div>
            <span className="font-medium text-white/80">{BRAND.name}</span>
          </div>

          {/* Links Centrais */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <Link href="/" className="hover:text-emerald-300 transition">
              Início
            </Link>
            <Link href="/suporte" className="hover:text-emerald-300 transition">
              Suporte
            </Link>
            <Link href="/termos" className="hover:text-emerald-300 transition">
              Termos de Uso
            </Link>
            <Link href="/privacidade" className="hover:text-emerald-300 transition">
              Política de Privacidade
            </Link>
          </div>

          {/* Copyright à direita */}
          <div>
            © {new Date().getFullYear()} {BRAND.name}. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {/* Modal de Esqueci Minha Senha */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 sm:p-7 shadow-2xl border border-slate-200 text-slate-900 relative">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mx-auto mb-3 border border-emerald-100">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Recuperação de Senha
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Insira o seu e-mail administrativo para receber as instruções.
              </p>
            </div>

            {forgotSent ? (
              <div className="text-center space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs leading-relaxed flex items-start gap-3 text-left">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Instruções enviadas!</strong>
                    Se houver uma conta de operador associada ao e-mail informado, você receberá um link seguro para redefinição.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full bg-[#00875a] hover:bg-[#00734c] text-white py-2.5 rounded-xl font-medium text-xs transition cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                {forgotError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
                    {forgotError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    E-mail Institucional
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    placeholder="admin@gestaoeklesia.com.br"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-5 py-2 bg-[#00875a] hover:bg-[#00734c] text-white text-xs font-medium rounded-xl transition flex items-center gap-2 disabled:opacity-60 cursor-pointer"
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

