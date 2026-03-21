'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Suspense } from 'react'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

function EmailConfirmationContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  const success = searchParams.get('success') === 'true'
  const error = searchParams.get('error')
  const email = searchParams.get('email')

  useEffect(() => {
    if (success && email) {
      setStatus('success')
      setMessage(`✅ Parabéns! Seu email ${email} foi confirmado com sucesso!`)
      
      // Redirecionar para login após 3 segundos
      const timer = setTimeout(() => {
        router.push('/login')
      }, 3000)
      return () => clearTimeout(timer)
    } else if (error) {
      setStatus('error')
      const errorMessages: Record<string, string> = {
        'email_not_confirmed': 'Email ainda não foi confirmado. Tente novamente.',
        'invalid_code': 'O link de confirmação é inválido ou expirou.',
        'user_not_found': 'Usuário não encontrado.',
        'confirmation_failed': 'Erro ao confirmar email. Tente novamente.',
        'missing_code': 'Link de confirmação inválido.',
      }
      setMessage(errorMessages[error] || `Erro: ${error}`)
    } else {
      setStatus('loading')
      setMessage('Processando confirmação de email...')
    }
  }, [success, error, email, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="flex justify-center mb-4">
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Confirmando Email...</h1>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Email Confirmado!</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <p className="text-sm text-gray-500 mb-6">
              Redirecionando para login em alguns segundos...
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition"
            >
              Ir para Login
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-16 h-16 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Erro na Confirmação</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                📧 Não recebeu o email? Verifique sua pasta de spam ou tente se registrar novamente.
              </p>
              <button
                onClick={() => router.push('/')}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition"
              >
                Voltar para Registro
              </button>
              <button
                onClick={() => router.push('/login')}
                className="w-full border border-blue-500 text-blue-500 hover:bg-blue-50 font-bold py-3 rounded-lg transition"
              >
                Ir para Login
              </button>
            </div>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            © 2026 Gestão Eclesial - Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  )
}

export default function EmailConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex justify-center">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
        </div>
      </div>
    }>
      <EmailConfirmationContent />
    </Suspense>
  )
}
