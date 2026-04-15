'use client'

export const dynamic = 'force-dynamic';

import { useState, FormEvent, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminAuth } from '@/providers/AdminAuthProvider'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAdminAuth()
  const supabase = createClient()

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
      // Fazer login
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      if (!data.user) {
        setError('Erro ao fazer login')
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
        setError('Acesso negado. Você não é um administrador.')
        await supabase.auth.signOut()
        return
      }

      // Sucesso - redirecionar para dashboard
      router.push('/admin/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Serif+Display&display=swap');
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-slate-900 to-blue-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Orbes decorativas */}
        <div className="absolute top-10 -left-32 w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-8 right-20 w-96 h-96 bg-amber-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>

        {/* Container principal */}
        <div className="w-full max-w-md relative z-10">
          {/* Card de Login */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
            {/* Logo e Heading */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: 'DM Serif Display' }}>
                GESTÃO
              </h1>
              <p className="text-emerald-300 font-medium" style={{ fontFamily: 'Space Grotesk' }}>
                Painel Administrativo
              </p>
              <div className="h-1 w-12 bg-gradient-to-r from-emerald-400 to-amber-300 mx-auto mt-4 rounded-full"></div>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-500/20 border border-red-400/50 text-red-200 rounded-lg backdrop-blur-sm text-sm">
                  {error}
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-emerald-100 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-emerald-400/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/50 transition backdrop-blur-sm"
                  placeholder="seu@email.com"
                />
              </div>

              {/* Senha */}
              <div>
                <label className="block text-sm font-medium text-emerald-100 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-emerald-400/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/50 transition backdrop-blur-sm"
                  placeholder="••••••••"
                />
              </div>

              {/* Botão Login */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-3 px-4 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 transform hover:scale-105 shadow-lg"
                style={{ fontFamily: 'Space Grotesk' }}
              >
                {loading ? 'Autenticando...' : 'Entrar no Painel'}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-white/10 text-center text-sm text-slate-300">
              <p>Apenas administradores têm acesso.</p>
              <p className="mt-4">
                <Link href="/" className="text-emerald-300 hover:text-emerald-200 font-medium transition">
                  ← Voltar para página inicial
                </Link>
              </p>
            </div>
          </div>

          {/* Linha decorativa inferior */}
          <div className="mt-8 h-1 bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent rounded-full blur"></div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </>
  )
}
