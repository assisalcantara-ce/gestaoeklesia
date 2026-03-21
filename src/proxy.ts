import { createClient as createServiceRoleClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rotas públicas que NÃO requerem autenticação
  const adminPublicRoutes = ['/admin/login']

  // Rotas que não são /admin passam direto
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  // Se é rota pública de admin (login), deixar passar
  if (adminPublicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next()
  }

  try {
    // Obter cookies
    const cookieStore = await cookies()

    // Criar cliente Supabase no servidor
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
              // Silenciar erros de cookies durante proxy
            }
          },
        },
      }
    )

    // Verificar se há usuário autenticado (usando getUser() - seguro)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    // Se não há usuário autenticado, redirecionar para login
    if (userError || !user) {
      const loginUrl = new URL('/admin/login', request.url)
      return NextResponse.redirect(loginUrl)
    }

    // Verificar se é um admin válido consultando o banco de dados.
    // Usa service role para evitar depender de RLS em admin_users (e evitar recursion/policies frágeis).
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

    // Se não encontrou admin ou está inativo, redirecionar para login
    if (adminError || !adminUser || !isActive) {
      const loginUrl = new URL('/admin/login', request.url)
      return NextResponse.redirect(loginUrl)
    }

    // Admin válido - deixar passar
    return NextResponse.next()
  } catch (error) {
    console.error('[PROXY] Erro ao validar autenticação:', error)
    // Em caso de erro, redirecionar para login por segurança
    const loginUrl = new URL('/admin/login', request.url)
    return NextResponse.redirect(loginUrl)
  }
}

export const config = {
  matcher: ['/admin/:path*'],
}