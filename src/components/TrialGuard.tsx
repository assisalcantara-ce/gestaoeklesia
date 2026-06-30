'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { createClient } from '@/lib/supabase-client'

/**
 * Rotas acessíveis mesmo com trial expirado ou sem autenticação.
 * /admin usa AdminAuthProvider separado — não está sujeito ao guard.
 */
const BYPASS_PATHS = [
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
]

/** Intervalo de polling para re-verificar o status do trial (5 minutos). */
const POLL_INTERVAL_MS = 5 * 60 * 1_000

function isBypassPath(pathname: string): boolean {
  if (pathname.startsWith('/api/')) return true
  return BYPASS_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

/**
 * TrialGuard — controle automático de expiração do trial.
 *
 * Verifica /api/v1/trial/status:
 * - Na montagem inicial (assim que o AuthProvider resolve a sessão)
 * - A cada navegação de rota (pathname change)
 * - A cada 5 minutos via polling (cobre sessões longas sem logout/login)
 *
 * Nunca bloqueia:
 *   - ministries.subscription_status = 'active'
 *   - pre_registration.status = 'efetivado'
 *   - Usuários sem pre_registration (não-trial)
 *   - Rotas de bypass listadas acima
 *   - Erros de rede (falha silenciosa)
 */
export function TrialGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const supabaseRef = useRef(createClient())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Ref do pathname atual — evita stale closure no setInterval do polling
  const pathnameRef = useRef(pathname)
  useEffect(() => {
    pathnameRef.current = pathname
  })

  const checkTrial = useCallback(async () => {
    // Nunca verifica em rotas de bypass (evita loop e bloqueios indevidos)
    if (isBypassPath(pathnameRef.current)) return

    try {
      const { data: sessionData } = await supabaseRef.current.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) return

      const res = await fetch('/api/v1/trial/status', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })

      if (!res.ok) return

      const json: { expired?: boolean } = await res.json()
      if (json.expired === true) {
        router.replace('/trial-expirado')
      }
    } catch {
      // Falha silenciosa — não bloqueia o acesso em caso de erro de rede
    }
  }, [router])

  useEffect(() => {
    // Aguarda AuthProvider resolver e exige usuário autenticado
    if (isLoading || !isAuthenticated) return
    // Não inicia verificação em rotas de bypass
    if (isBypassPath(pathname)) return

    // Verificação imediata ao mudar de rota ou no primeiro acesso autenticado
    checkTrial()

    // Reinicia o intervalo de polling (garante que sessions longas também sejam verificadas)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(checkTrial, POLL_INTERVAL_MS)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isAuthenticated, isLoading, pathname, checkTrial])

  // Renderização transparente — TrialGuard não adiciona markup
  return <>{children}</>
}
