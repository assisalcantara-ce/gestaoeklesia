import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServerClient as createAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * /app/auth/callback — Callback oficial de autenticação do Portal do Membro
 *
 * Fluxo:
 * 1. Recebe 'code' do Supabase Auth (PKCE)
 * 2. Troca o código por uma sessão Supabase e grava os cookies HTTP seguros via @supabase/ssr
 * 3. Consulta se o usuário autenticado (auth.uid()) já possui vínculo na tabela 'members' (members.auth_user_id)
 * 4. Redirecionamento:
 *    - Usuário autenticado + Membro vinculado     → /app/inicio
 *    - Usuário autenticado + Membro NÃO vinculado → /app/vincular
 *    - Erro na troca de código / código inválido  → /app/login?error=...
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  console.log('[MOBILE_AUTH_CALLBACK] Recebido callback mobile:', {
    hasCode: !!code,
    error,
    errorDescription,
  });

  if (error || !code) {
    const msg = errorDescription || error || 'Link de acesso inválido ou expirado. Por favor, solicite um novo link.';
    return NextResponse.redirect(
      new URL(`/app/login?error=${encodeURIComponent(msg)}`, request.url)
    );
  }

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    // 1. Troca o código PKCE por sessão Supabase (grava cookies)
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError || !data?.user) {
      console.error('[MOBILE_AUTH_CALLBACK] Falha na troca de código por sessão:', exchangeError);
      return NextResponse.redirect(
        new URL(
          `/app/login?error=${encodeURIComponent(exchangeError?.message || 'Não foi possível validar seu acesso. Solicite um novo link.')}`,
          request.url
        )
      );
    }

    console.log('[MOBILE_AUTH_CALLBACK] ✅ Sessão Supabase estabelecida para:', data.user.email);

    // 2. Verifica vínculo com a tabela members usando service_role (autoridade do servidor)
    const admin = createAdminClient();
    const { data: member, error: memberError } = await admin
      .from('members')
      .select('id, status')
      .eq('auth_user_id', data.user.id)
      .maybeSingle();

    if (memberError) {
      console.error('[MOBILE_AUTH_CALLBACK] Erro ao consultar vínculo de membro:', memberError);
    }

    if (member && !memberError) {
      console.log('[MOBILE_AUTH_CALLBACK] Membro vinculado identificado:', member.id, '→ Redirecionando para /app/inicio');
      return NextResponse.redirect(new URL('/app/inicio', request.url));
    } else {
      console.log('[MOBILE_AUTH_CALLBACK] Usuário autenticado sem vínculo → Redirecionando para /app/vincular');
      return NextResponse.redirect(new URL('/app/vincular', request.url));
    }
  } catch (err: any) {
    console.error('[MOBILE_AUTH_CALLBACK] Erro inesperado no callback mobile:', err);
    return NextResponse.redirect(
      new URL('/app/login?error=Ocorreu+um+erro+ao+processar+sua+autenticação.+Tente+novamente.', request.url)
    );
  }
}
