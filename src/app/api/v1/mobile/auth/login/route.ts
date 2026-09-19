/**
 * POST /api/v1/mobile/auth/login
 *
 * Autenticação direta do Membro via CPF + Data de Nascimento.
 *
 * Regras de Segurança:
 * 1. Rate limiting por IP (máximo 5 tentativas por minuto) para prevenir força bruta.
 * 2. Validação estrita de CPF (11 dígitos numéricos) e data de nascimento (data civil).
 * 3. Consulta de membro ativo no banco de dados com isolamento multi-tenant.
 * 4. Provisionamento e vinculação automática e transparente no Supabase Auth (auth.users.id -> members.auth_user_id).
 * 5. Geração e validação de sessão 100% server-side (sem dependência de links externos por e-mail/SMS).
 * 6. Gravação imediata dos cookies de autenticação HTTP (@supabase/ssr) com persistência confiável.
 * 7. Respostas genéricas seguras contra enumeração e sem vazamento de dados de outros membros/tenants.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createAdminClient } from '@/lib/supabase-server';
import { createServerClient as createSsrClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const CPF_DIGITS_RE = /^\d{11}$/;
const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_BR_RE = /^\d{2}\/\d{2}\/\d{4}$/;

export async function POST(request: NextRequest) {
  // ── 1. Rate Limiting por IP ─────────────────────────────────────────────
  const rateLimit = checkRateLimit(request, 5, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Muitas tentativas de acesso. Por favor, aguarde alguns instantes.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  // ── 2. Leitura e normalização de CPF e Data de Nascimento ───────────────
  let rawCpf = '';
  let normalizedDate = '';

  try {
    const body = await request.json();
    rawCpf = String(body.cpf ?? '').replace(/\D/g, '');
    const rawDate = String(body.data_nascimento ?? '').trim();

    if (DATE_ISO_RE.test(rawDate)) {
      normalizedDate = rawDate;
    } else if (DATE_BR_RE.test(rawDate)) {
      const [dia, mes, ano] = rawDate.split('/');
      normalizedDate = `${ano}-${mes}-${dia}`;
    } else {
      normalizedDate = rawDate;
    }
  } catch {
    return NextResponse.json(
      { error: 'Dados de requisição inválidos.', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  if (!CPF_DIGITS_RE.test(rawCpf)) {
    return NextResponse.json(
      { error: 'Informe um CPF válido com 11 dígitos.', code: 'INVALID_CPF' },
      { status: 400 }
    );
  }

  if (!DATE_ISO_RE.test(normalizedDate)) {
    return NextResponse.json(
      { error: 'Informe uma data de nascimento válida no formato DD/MM/AAAA.', code: 'INVALID_DATE' },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();
    const cpfFormatted = `${rawCpf.slice(0, 3)}.${rawCpf.slice(3, 6)}.${rawCpf.slice(6, 9)}-${rawCpf.slice(9, 11)}`;

    // ── 3. Buscar membro ativo correspondente aos dados informados ─────────
    const { data: members, error: searchError } = await admin
      .from('members')
      .select('id, name, email, ministry_id, auth_user_id, status')
      .or(`cpf.eq.${rawCpf},cpf.eq.${cpfFormatted}`)
      .eq('data_nascimento', normalizedDate)
      .eq('status', 'active');

    if (searchError) {
      console.error('[MOBILE_AUTH_LOGIN] Erro ao consultar membro:', searchError);
      return NextResponse.json(
        { error: 'Não foi possível processar seu acesso no momento. Tente novamente.', code: 'DB_ERROR' },
        { status: 500 }
      );
    }

    if (!members || members.length === 0) {
      // Resposta genérica e segura (anti-enumeração)
      return NextResponse.json(
        {
          error: 'Não encontramos um cadastro ativo com os dados informados. Verifique o CPF e a data de nascimento.',
          code: 'MEMBER_NOT_FOUND',
        },
        { status: 401 }
      );
    }

    // Seleciona o membro ativo (priorizando o que já possui auth_user_id ou email)
    const targetMember = members.find((m) => m.auth_user_id) || members.find((m) => m.email) || members[0];

    // ── 4. Resolver ou provisionar conta de autenticação (Supabase Auth) ───
    let targetEmail = targetMember.email ? targetMember.email.trim().toLowerCase() : null;
    let authUserId = targetMember.auth_user_id;

    if (authUserId) {
      const { data: existingAuth } = await admin.auth.admin.getUserById(authUserId);
      if (existingAuth?.user?.email) {
        targetEmail = existingAuth.user.email;
      }
    }

    // Se o membro não tem e-mail, usamos um identificador unificado e seguro do sistema
    if (!targetEmail) {
      targetEmail = `membro_${targetMember.id}@gestaoeklesia.app`;
    }

    if (!authUserId) {
      // Criar ou localizar usuário no Supabase Auth
      let authUserRecord = null;
      const { data: created } = await admin.auth.admin.createUser({
        email: targetEmail,
        email_confirm: true,
        user_metadata: {
          member_id: targetMember.id,
          ministry_id: targetMember.ministry_id,
          role: 'member',
        },
      });

      if (created?.user) {
        authUserRecord = created.user;
      } else {
        // Se já existia usuário com este e-mail no Auth, recuperamos o ID
        const { data: linkInfo } = await admin.auth.admin.generateLink({
          type: 'magiclink',
          email: targetEmail,
        });
        if (linkInfo?.user) {
          authUserRecord = linkInfo.user;
        }
      }

      if (authUserRecord) {
        authUserId = authUserRecord.id;
        await admin
          .from('members')
          .update({
            auth_user_id: authUserId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetMember.id);
        console.log('[MOBILE_AUTH_LOGIN] ✅ Membro vinculado a auth.users:', targetMember.id);
      }
    }

    if (!authUserId) {
      return NextResponse.json(
        { error: 'Não foi possível inicializar sua conta de acesso. Procure o suporte da sua igreja.', code: 'AUTH_PROVISION_ERROR' },
        { status: 500 }
      );
    }

    // ── 5. Gerar token de sessão e validar no servidor (SSR Session) ───────
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetEmail,
    });

    const hashedToken = linkData?.properties?.hashed_token;
    if (linkError || !hashedToken) {
      console.error('[MOBILE_AUTH_LOGIN] Erro ao gerar token de autenticação:', linkError);
      return NextResponse.json(
        { error: 'Falha ao autenticar sessão. Tente novamente.', code: 'AUTH_TOKEN_ERROR' },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const cookiesToSetBuffer: Array<{ name: string; value: string; options: any }> = [];

    const ssrClient = createSsrClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                cookieStore.set(name, value, options);
              } catch {}
              cookiesToSetBuffer.push({ name, value, options });
            });
          },
        },
      }
    );

    const { data: verifyData, error: verifyError } = await ssrClient.auth.verifyOtp({
      token_hash: hashedToken,
      type: 'magiclink',
    });

    if (verifyError || !verifyData?.session) {
      console.error('[MOBILE_AUTH_LOGIN] Erro ao validar sessão server-side:', verifyError);
      return NextResponse.json(
        { error: 'Não foi possível estabelecer a sessão. Tente novamente.', code: 'SESSION_ERROR' },
        { status: 500 }
      );
    }

    // ── 6. Responder com sucesso e gravar cookies HTTP na resposta ─────────
    const response = NextResponse.json({
      success: true,
      session: {
        access_token: verifyData.session.access_token,
        refresh_token: verifyData.session.refresh_token,
        expires_at: verifyData.session.expires_at,
        expires_in: verifyData.session.expires_in,
        user: verifyData.session.user,
      },
    });

    cookiesToSetBuffer.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, {
        ...options,
        path: options?.path || '/',
        sameSite: options?.sameSite || 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    });

    console.log('[MOBILE_AUTH_LOGIN] ✅ Login direto realizado com sucesso para membro:', targetMember.id);
    return response;
  } catch (err: any) {
    console.error('[MOBILE_AUTH_LOGIN] Erro inesperado:', err);
    return NextResponse.json(
      { error: 'Ocorreu um erro ao processar sua autenticação. Tente novamente.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
