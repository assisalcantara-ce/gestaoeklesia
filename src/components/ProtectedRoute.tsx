'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { GRADIENTS } from '@/config/tokens'
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
  // Apenas as rotas mobile públicas explícitas estão liberadas do ProtectedRoute global
  '/app/login',
  '/app/vincular',
]

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true
  if (pathname === '/app') return true // Apenas a rota raiz '/app' é pública e redirecionada pelo fluxo mobile
  return PUBLIC_PREFIXES.some(prefix => 
    prefix !== '/' && (pathname === prefix || pathname.startsWith(prefix + '/'))
  )
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isLoading: authLoading } = useAuth()
  const { loading: contextLoading, nivel } = useUserContext()

  const isPublic = isPublicPath(pathname)

  useEffect(() => {
    if (isPublic) return

    // 1. Redirecionamento por falta de autenticação
    if (!authLoading && !user) {
      const isMobile = pathname.startsWith('/app/') || pathname === '/app'
      router.replace(isMobile ? '/app/login' : '/login')
      return
    }

    // 2. Bloqueio específico para /app/presidencia (restrito a presidência ou administrador)
    if (!authLoading && !contextLoading && user && pathname.startsWith('/app/presidencia')) {
      const temNivelPresidencia = nivel === 'presidencia' || nivel === 'administrador'
      if (!temNivelPresidencia) {
        router.replace('/acesso-negado')
      }
    }
  }, [user, authLoading, contextLoading, nivel, isPublic, router, pathname])

  if (isPublic) {
    return <>{children}</>
  }

  // Se a autenticação ou o perfil estiver carregando, renderiza carregamento neutro
  if (authLoading || contextLoading || !user) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center" style={{ background: GRADIENTS.APP_BACKGROUND }}>
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/img/logoh.png"
            alt="Gestão Eklésia"
            width={290}
            height={83}
            priority
            sizes="290px"
            className="h-[83px] w-auto object-contain animate-pulse select-none"
          />
          <div className="w-24 h-1 bg-white/20 rounded-full overflow-hidden relative">
            <div className="w-1/2 h-full bg-[#5A9DDC] rounded-full absolute left-0 top-0 animate-[loading_1s_infinite_ease-in-out]"></div>
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

  // Tratativa final para /app/presidencia se não tiver permissão (evita piscar conteúdo antes do useEffect)
  if (pathname.startsWith('/app/presidencia')) {
    const temNivelPresidencia = nivel === 'presidencia' || nivel === 'administrador'
    if (!temNivelPresidencia) {
      return null
    }
  }

  return <>{children}</>
}
