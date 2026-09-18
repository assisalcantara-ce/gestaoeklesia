import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServerClient as createAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * /app/auth/callback — Callback oficial de autenticação do Portal do Membro
 *
 * Suporta:
 * 1. `token_hash` + `type`: Magic Link gerado server-side via Supabase Admin (imune a erros de PKCE)
 * 2. `code`: Fluxo tradicional de troca PKCE via exchangeCodeForSession
 *
 * Após estabelecer a sessão em cookies HTTP seguros (@supabase/ssr):
 * - Se o usuário já tiver vínculo oficial em `members.auth_user_id` → redireciona para `/app/inicio`
 * - Se não tiver vínculo → redireciona para `/app/vincular`
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  console.log('[MOBILE_AUTH_CALLBACK] Recebido callback mobile:', {
    hasTokenHash: !!tokenHash,
    hasCode: !!code,
    type,
    error,
    errorDescription,
  });

  if (error || (!tokenHash && !code)) {
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

    let authUser = null;

    // 1. Se recebemos token_hash (Magic Link gerado server-side)
    if (tokenHash) {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: (type as any) || 'magiclink',
      });

      if (verifyError || !data?.user) {
        console.error('[MOBILE_AUTH_CALLBACK] Falha na verificação de OTP/Magic Link:', verifyError);
        return NextResponse.redirect(
          new URL(
            `/app/login?error=${encodeURIComponent(verifyError?.message || 'Link de acesso expirado ou inválido. Solicite um novo link.')}`,
            request.url
          )
        );
      }
      authUser = data.user;
    } else if (code) {
      // 2. Se recebemos code (PKCE do Supabase Auth)
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
      authUser = data.user;
    }

    if (!authUser) {
      return NextResponse.redirect(
        new URL('/app/login?error=Não+foi+possível+identificar+o+usuário+autenticado.', request.url)
      );
    }

    console.log('[MOBILE_AUTH_CALLBACK] ✅ Sessão Supabase estabelecida para:', authUser.email);

    // 3. Verifica vínculo com a tabela members usando service_role (autoridade do servidor)
    const admin = createAdminClient();
    const { data: member, error: memberError } = await admin
      .from('members')
      .select('id, status, ministry_id')
      .eq('auth_user_id', authUser.id)
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
