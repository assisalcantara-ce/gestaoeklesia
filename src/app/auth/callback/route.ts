import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Callback para confirmação de email
 * Supabase redireciona automaticamente para:
 * /auth/callback?code=XXXXX&type=signup ou email_change
 * 
 * Persiste a sessão em cookies via @supabase/ssr
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  console.log('[EMAIL_CALLBACK] Recebido callback:', { code: code?.substring(0, 10) + '...', type })

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

    // Trocar o código por uma sessão (confirma o email)
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    console.log('[EMAIL_CALLBACK] Resultado da troca de código:', { 
      user: data?.user?.email, 
      error: error?.message 
    })

    if (error) {
      console.error('[EMAIL_CALLBACK] Erro ao confirmar email:', error)
      return NextResponse.redirect(
        new URL(`/email-confirmation?error=${encodeURIComponent(error.message)}`, request.url)
      )
    }

    if (!data?.user) {
      console.error('[EMAIL_CALLBACK] Usuário não encontrado após confirmação')
      return NextResponse.redirect(
        new URL('/email-confirmation?error=user_not_found', request.url)
      )
    }

    console.log('[EMAIL_CALLBACK] ✅ Email confirmado com sucesso:', data.user?.email)

    // Redirecionar para página de sucesso ou dashboard
    return NextResponse.redirect(
      new URL(`/email-confirmation?success=true&email=${encodeURIComponent(data.user?.email || 'desconhecido')}`, request.url)
    )

  } catch (error) {
    console.error('[EMAIL_CALLBACK] Erro geral:', error)
    return NextResponse.redirect(
      new URL('/email-confirmation?error=confirmation_failed', request.url)
    )
  }
}
