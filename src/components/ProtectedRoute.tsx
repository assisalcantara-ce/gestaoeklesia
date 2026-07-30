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
  '/formularios',
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
    console.log('[PROTECTED_ROUTE] authLoading:', authLoading, 'user.id:', user?.id || null);

    if (isPublic) return

    // 1. Redirecionamento por falta de autenticação
    if (!authLoading && !user) {
      const isMobile = pathname.startsWith('/app/') || pathname === '/app'
      const redirectTarget = isMobile ? '/app/login' : '/login'
      console.log('[PROTECTED_ROUTE] motivo do redirect: Usuário não autenticado após término do carregamento de auth. Destino:', redirectTarget);
      router.replace(redirectTarget)
      return
    }

    // 2. Bloqueio específico para /app/presidencia (restrito a presidência ou administrador)
    if (!authLoading && !contextLoading && user && pathname.startsWith('/app/presidencia')) {
      const temNivelPresidencia = nivel === 'presidencia' || nivel === 'administrador'
      if (!temNivelPresidencia) {
        console.log('[PROTECTED_ROUTE] motivo do redirect: Nível de permissão insuficiente para /app/presidencia');
        router.replace('/acesso-negado')
      }
    }
  }, [user, authLoading, contextLoading, nivel, isPublic, router, pathname])

  if (isPublic) {
    return <>{children}</>
  }

  // Se a autenticação ou o perfil estiver carregando, renderiza carregamento neutro sem redirecionar
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
            className="w-[220px] sm:w-[290px] h-auto"
          />
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
            <span className="text-white/80 text-sm font-medium">Carregando permissões...</span>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
