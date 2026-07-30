import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Callback de autenticação e confirmação de sessão (PKCE / SSR)
 * Recebe o código do Supabase via /auth/callback?code=XXXXX&next=/dashboard ou signup
 * Persiste a sessão em cookies HTTP nativos via @supabase/ssr
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const next = searchParams.get('next')

  console.log('[AUTH_CALLBACK] Recebido callback:', { code: code?.substring(0, 10) + '...', type, next })

  if (!code) {
    return NextResponse.redirect(
      new URL('/email-confirmation?error=missing_code', request.url)
    )
  }

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
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )

    // Trocar o código por uma sessão (grava cookies HTTP via @supabase/ssr)
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    console.log('[AUTH_CALLBACK] Resultado da troca de código:', { 
      user: data?.user?.email, 
      error: error?.message 
    })

    if (error) {
      console.error('[AUTH_CALLBACK] Erro ao trocar código por sessão:', error)
      return NextResponse.redirect(
        new URL(`/email-confirmation?error=${encodeURIComponent(error.message)}`, request.url)
      )
    }

    if (!data?.user) {
      console.error('[AUTH_CALLBACK] Usuário não encontrado após troca de código')
      return NextResponse.redirect(
        new URL('/email-confirmation?error=user_not_found', request.url)
      )
    }

    console.log('[AUTH_CALLBACK] ✅ Sessão iniciada com sucesso via @supabase/ssr:', data.user?.email)

    // Se houver parâmetro next (ex: /dashboard do Acesso Técnico), redirecionar diretamente
    if (next) {
      const redirectTarget = next.startsWith('/') ? next : `/${next}`
      return NextResponse.redirect(new URL(redirectTarget, request.url))
    }

    // Fallback padrão para confirmação de email de signup
    return NextResponse.redirect(
      new URL(`/email-confirmation?success=true&email=${encodeURIComponent(data.user?.email || 'desconhecido')}`, request.url)
    )

  } catch (error) {
    console.error('[AUTH_CALLBACK] Erro geral no callback:', error)
    return NextResponse.redirect(
      new URL('/email-confirmation?error=confirmation_failed', request.url)
    )
  }
}
