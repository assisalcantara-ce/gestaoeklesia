'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { BRAND } from '@/config/brand'
import { createClient } from '@/lib/supabase-client'
import NotificationModal from '@/components/NotificationModal'
import PremiumCard from '@/components/ui/PremiumCard'
import PremiumButton from '@/components/ui/PremiumButton'
import PremiumInput from '@/components/ui/PremiumInput'
import { GRADIENTS } from '@/config/tokens'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'

import Link from 'next/link';

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
        if (nextParam) {
          router.push(nextParam)
        } else {
          router.push('/dashboard')
        }
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
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950"
      style={{ background: GRADIENTS.LOGIN_BACKGROUND }}
    >
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

      {/* Container Central */}
      <div className="w-full max-w-md relative z-10 mx-auto transition-all duration-300">
        <PremiumCard variant="glass" hoverable={false} className="p-8 shadow-2xl border border-white/20">
          {/* Logo e cabeçalho */}
          <div className="flex flex-col items-center mb-6">
            <Image
              src={BRAND.logoHorizontal}
              alt="Gestão Eklésia"
              width={220}
              height={64}
              priority
              sizes="220px"
              className="h-[64px] w-auto object-contain select-none mb-1"
            />
            <p className="text-xs text-slate-500 font-bold tracking-wider uppercase mt-1 text-center">
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
            <PremiumInput
              id="email"
              type="email"
              label="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemplo@igreja.com"
              icon={<Mail className="w-4 h-4" />}
              required
            />

            {/* Campo de senha */}
            <PremiumInput
              id="password"
              type={showPassword ? 'text' : 'password'}
              label="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              icon={<Lock className="w-4 h-4" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 transition flex items-center justify-center"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              required
            />

            {/* Checkbox lembrar e link de recuperação */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-[#0B3B82] focus:ring-[#0B3B82] cursor-pointer"
                />
                <span>Lembrar acesso</span>
              </label>
              <a
                href={`${siteUrl}/login#recuperar`}
                className="font-semibold text-[#0B3B82] hover:underline transition"
              >
                Esqueci minha senha
              </a>
            </div>

            {/* Botão de envio */}
            <PremiumButton
              type="submit"
              loading={loading}
              className="w-full mt-2"
            >
              Entrar no sistema
            </PremiumButton>
          </form>

          {/* Links adicionais */}
          <div className="mt-6 pt-5 border-t border-slate-200/60 flex items-center justify-between text-xs">
            <a
              href={siteUrl}
              className="font-semibold text-slate-600 hover:text-[#0B3B82] transition flex items-center gap-1"
            >
              <span>←</span> Voltar ao site
            </a>
            <a
              href={`${siteUrl}/pre-cadastro?plan=starter&trial=true`}
              className="font-bold text-[#0B3B82] hover:underline transition"
            >
              Criar Teste Grátis
            </a>
          </div>
        </PremiumCard>

        {/* Rodapé institucional */}
        <div className="mt-8 text-center text-[10px] text-white/60 tracking-wider space-y-1 select-none">
          <p>© Gestão Eklésia. Todos os direitos reservados.</p>
          <p>
            Tecnologia Alcântara Sistemas
            <Link
              href="/admin/login"
              className="ml-1 text-white/10 hover:text-white/40 transition select-none text-[8px] cursor-default"
            >
              •
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
