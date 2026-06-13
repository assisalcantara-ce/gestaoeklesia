import { createClient as createServiceRoleClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const hostname = request.headers.get('host') || ''

  // 1. Redirecionamento de domínio institucional (Landing) para a aplicação (App)
  const redirectPaths = [
    '/login',
    '/auth/callback',
    '/reset-password',
    '/recuperar-senha',
  ]

  const isInstitutionalDomain = hostname.includes('www.gestaoeklesia.com.br') || hostname === 'gestaoeklesia.com.br'
  const isTargetRedirectPath = redirectPaths.some(
    path => pathname === path || pathname.startsWith(path + '/')
  )

  if (isInstitutionalDomain && isTargetRedirectPath) {
    const destinationUrl = `https://app.gestaoeklesia.com.br${pathname}${search}`
    // Usando redirect temporário 307 durante fase de validação (será alterado para 301 futuramente)
    return NextResponse.redirect(destinationUrl, 307)
  }

  // 2. Proteção de rotas /admin via proxy herdado
  if (pathname.startsWith('/admin')) {
    // Rotas públicas de admin que NÃO requerem autenticação
    const adminPublicRoutes = ['/admin/login']

    // Se é rota pública de admin (login), deixar passar
    if (!adminPublicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
      try {
        const cookieStore = await cookies()
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          {
            cookies: {
              getAll() {
                return cookieStore.getAll()
              },
              setAll(cookiesToSet) {
                try {
                  cookiesToSet.forEach(({ name, value, options }) => {
                    cookieStore.set(name, value, options as CookieOptions)
                  })
                } catch {
                  // Silenciar erros de cookies
                }
              },
            },
          }
        )

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          const loginUrl = new URL('/admin/login', request.url)
          return NextResponse.redirect(loginUrl)
        }

        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
          const loginUrl = new URL('/admin/login', request.url)
          return NextResponse.redirect(loginUrl)
        }

        const adminDb = createServiceRoleClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          }
        )

        const { data: adminUser, error: adminError } = await adminDb
          .from('admin_users')
          .select('*')
          .eq('email', user.email)
          .single()

        const isActive =
          (typeof adminUser?.is_active === 'boolean'
            ? adminUser.is_active === true
            : typeof adminUser?.status === 'string'
              ? adminUser.status === 'ATIVO'
              : typeof adminUser?.ativo === 'boolean'
                ? adminUser.ativo === true
                : false)

        if (adminError || !adminUser || !isActive) {
          const loginUrl = new URL('/admin/login', request.url)
          return NextResponse.redirect(loginUrl)
        }
      } catch (error) {
        console.error('[PROXY] Erro ao validar autenticação admin:', error)
        const loginUrl = new URL('/admin/login', request.url)
        return NextResponse.redirect(loginUrl)
      }
    }
  }

  // 3. SEO: Adicionar cabeçalho X-Robots-Tag: noindex, nofollow no domínio da aplicação
  const response = NextResponse.next()
  if (hostname.includes('app.gestaoeklesia.com.br')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Intercepta todas as rotas de páginas exceto arquivos estáticos e de otimização
     */
    '/((?!api|_next/static|_next/image|favicon.ico|img|.*\\.png|.*\\.jpg|.*\\.jpeg).*)',
  ],
}