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
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Gestão Eclesial</h1>
          <p className="text-gray-600 mt-2">Painel Administrativo</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="seu@email.com"
            />
          </div>

          {/* Senha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {/* Botão Login */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            {loading ? 'Autenticando...' : 'Entrar'}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>Apenas administradores têm acesso.</p>
          <p className="mt-2">
            <Link href="/" className="text-blue-600 hover:underline">
              Voltar para página inicial
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
