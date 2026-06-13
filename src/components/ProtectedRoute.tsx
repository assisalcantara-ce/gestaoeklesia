'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { useUserContext } from '@/hooks/useUserContext'

const PUBLIC_PREFIXES = [
  '/',
  '/trial-expirado',
  '/login',
  '/pre-cadastro',
  '/email-confirmation',
  '/validar-senha',
  '/acesso-negado',
  '/auth',
  '/admin',
  '/app',
]

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true
  return PUBLIC_PREFIXES.some(prefix => 
    prefix !== '/' && (pathname === prefix || pathname.startsWith(prefix + '/'))
  )
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isLoading: authLoading } = useAuth()
  const { loading: contextLoading } = useUserContext()

  const isPublic = isPublicPath(pathname)

  useEffect(() => {
    if (isPublic) return

    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [user, authLoading, isPublic, router])

  if (isPublic) {
    return <>{children}</>
  }

  // Se a autenticação ou o contexto do usuário (perfil/nível) ainda estiver carregando,
  // ou se não houver usuário autenticado, renderiza uma tela neutra de carregamento
  if (authLoading || contextLoading || !user) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-[#f4f6f9]">
        <div className="flex flex-col items-center gap-3">
          <img src="/img/logo_modal.png" alt="Gestão Eklésia" className="h-12 animate-pulse select-none animate-duration-1000" />
          <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden relative">
            <div className="w-1/2 h-full bg-[#03346E] rounded-full absolute left-0 top-0 animate-[loading_1s_infinite_ease-in-out]"></div>
          </div>
          <style jsx>{`
            @keyframes loading {
              0% { left: -50%; }
              100% { left: 100%; }
            }
          `}</style>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
