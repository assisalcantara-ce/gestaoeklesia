/**
 * POST /api/v1/mobile/auth/request-access
 *
 * Solicita acesso ao Portal do Membro via CPF + Data de Nascimento.
 *
 * Regras de Segurança:
 * 1. Rate limiting por IP (máximo 5 requisições por minuto) para prevenir enumeração/brute force.
 * 2. Valida e normaliza CPF (11 dígitos) e data de nascimento (ISO YYYY-MM-DD ou BR DD/MM/YYYY).
 * 3. Busca membro ativo no banco usando cliente admin (service_role).
 * 4. Resposta genérica segura para proteger contra enumeração:
 *    - Se não encontrar: retorna mensagem genérica segura.
 *    - Se encontrar mas não tiver e-mail: retorna código NO_EMAIL orientando procurar a secretaria.
 *    - Se encontrar com e-mail: gera Magic Link no servidor via Supabase Admin (generateLink)
 *      e envia e-mail estilizado via Resend (com fallback para link Supabase).
 * 5. NUNCA retorna dados pessoais do membro ou e-mail completo no payload de resposta.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rate-limit';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

const CPF_DIGITS_RE = /^\d{11}$/;
const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_BR_RE = /^\d{2}\/\d{2}\/\d{4}$/;

export async function POST(request: NextRequest) {
  // ── 1. Rate Limiting por IP (máximo 5 tentativas por minuto) ────────────
  const rateLimit = checkRateLimit(request, 5, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Muitas tentativas de acesso. Aguarde alguns instantes e tente novamente.',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  // ── 2. Leitura e normalização do body ────────────────────────────────────
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
      { error: 'Formato de requisição inválido.' },
      { status: 400 }
    );
  }

  if (!CPF_DIGITS_RE.test(rawCpf)) {
    return NextResponse.json(
      { error: 'Informe um CPF válido com 11 dígitos.' },
      { status: 400 }
    );
  }

  if (!DATE_ISO_RE.test(normalizedDate)) {
    return NextResponse.json(
      { error: 'Informe uma data de nascimento válida (DD/MM/AAAA).' },
      { status: 400 }
    );
  }

  try {
    const admin = createServerClient();
    const cpfFormatted = `${rawCpf.slice(0, 3)}.${rawCpf.slice(3, 6)}.${rawCpf.slice(6, 9)}-${rawCpf.slice(9, 11)}`;

    // ── 3. Buscar membros ativos que correspondam aos dados ────────────────
    const { data: members, error: searchError } = await admin
      .from('members')
      .select('id, name, email, ministry_id, auth_user_id, status')
      .or(`cpf.eq.${rawCpf},cpf.eq.${cpfFormatted}`)
      .eq('data_nascimento', normalizedDate)
      .eq('status', 'active');

    if (searchError) {
      console.error('[MOBILE_REQUEST_ACCESS] Erro ao buscar membros:', searchError);
      return NextResponse.json(
        { error: 'Não foi possível processar sua solicitação no momento. Tente novamente.' },
        { status: 500 }
      );
    }

    // Se nenhum membro for encontrado com os dados informados:
    if (!members || members.length === 0) {
      // Mensagem genérica segura para proteger contra enumeração
      return NextResponse.json({
        success: true,
        message: 'Se os dados estiverem corretos e houver um e-mail cadastrado, enviaremos um link de acesso.',
      });
    }

    // Selecionar o membro (priorizando o que possui e-mail cadastrado)
    const targetMember = members.find((m) => m.email && m.email.trim()) || members[0];
    const memberEmail = targetMember.email ? targetMember.email.trim().toLowerCase() : null;

    // Se o membro existe mas NÃO possui e-mail cadastrado:
    if (!memberEmail) {
      return NextResponse.json({
        success: false,
        code: 'NO_EMAIL',
        message: 'Seu cadastro foi localizado, porém não possui e-mail registrado. Por favor, procure a Secretaria da sua igreja para atualizar seu e-mail.',
      });
    }

    // ── 4. Obter dados da instituição / ministério ─────────────────────────
    let ministryName = 'Gestão Eklésia';
    if (targetMember.ministry_id) {
      const { data: minData } = await admin
        .from('ministries')
        .select('name')
        .eq('id', targetMember.ministry_id)
        .maybeSingle();
      if (minData?.name) {
        ministryName = minData.name;
      }
    }

    // ── 5. Gerar Magic Link no Supabase Auth (Server-side) ────────────────
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.gestaoeklesia.com.br';
    const redirectTo = `${appUrl}/app/auth/callback`;

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: memberEmail,
      options: {
        redirectTo,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[MOBILE_REQUEST_ACCESS] Erro ao gerar link de acesso:', linkError);
      return NextResponse.json(
        { error: 'Não foi possível gerar o link de acesso. Tente novamente em instantes.' },
        { status: 500 }
      );
    }

    // O link direto gerado pelo Supabase
    let loginUrl = linkData.properties.action_link;

    // Se tivermos o hashed_token retornado, podemos direcionar diretamente para o nosso /app/auth/callback
    // garantindo validação direta via verifyOtp no callback sem depender do PKCE do browser
    if (linkData.properties.hashed_token) {
      loginUrl = `${appUrl}/app/auth/callback?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=magiclink`;
    }

    // ── 6. Enviar e-mail via Resend ────────────────────────────────────────
    const resendKey = process.env.RESEND_API_KEY;
    const resendFrom = process.env.RESEND_FROM || 'noreply@gestaoeklesia.com.br';

    if (resendKey) {
      try {
        const resend = new Resend(resendKey);
        const firstName = targetMember.name ? targetMember.name.split(' ')[0] : 'Membro';

        await resend.emails.send({
          from: resendFrom,
          to: memberEmail,
          subject: `Seu link de acesso ao Portal do Membro - ${ministryName}`,
          html: `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Acesso ao Aplicativo do Membro</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; color: #f8fafc; }
                .card { max-width: 480px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 32px 24px; text-align: center; }
                .title { font-size: 20px; font-weight: bold; color: #ffffff; margin-bottom: 8px; }
                .subtitle { font-size: 14px; color: #94a3b8; margin-bottom: 24px; }
                .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: bold; font-size: 15px; padding: 14px 28px; border-radius: 12px; text-decoration: none; margin-top: 12px; margin-bottom: 24px; }
                .footer { font-size: 12px; color: #64748b; line-height: 1.5; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="title">Olá, ${firstName}!</div>
                <div class="subtitle">Você solicitou acesso ao Portal do Membro da <strong>${ministryName}</strong>.</div>
                <p style="font-size: 14px; color: #cbd5e1; margin-bottom: 20px;">
                  Toque no botão abaixo para entrar automaticamente no seu aplicativo com segurança:
                </p>
                <a href="${loginUrl}" class="btn">Entrar no Aplicativo</a>
                <div class="footer">
                  Se você não solicitou este link, por favor ignore esta mensagem.<br>
                  Este link é de uso único e expira em breve.
                </div>
              </div>
            </body>
            </html>
          `,
        });
        console.log('[MOBILE_REQUEST_ACCESS] E-mail de acesso enviado com sucesso via Resend para:', memberEmail.substring(0, 3) + '***');
      } catch (emailErr) {
        console.error('[MOBILE_REQUEST_ACCESS] Erro ao enviar e-mail via Resend:', emailErr);
      }
    } else {
      console.warn('[MOBILE_REQUEST_ACCESS] RESEND_API_KEY não configurada. Link gerado:', loginUrl);
    }

    // ── 7. Resposta segura ao cliente ───────────────────────────────────────
    return NextResponse.json({
      success: true,
      message: 'Se os dados estiverem corretos e houver um e-mail cadastrado, enviaremos um link de acesso.',
    });
  } catch (err: any) {
    console.error('[MOBILE_REQUEST_ACCESS] Erro não tratado:', err);
    return NextResponse.json(
      { error: 'Ocorreu um erro ao processar sua solicitação. Tente novamente.' },
      { status: 500 }
    );
  }
}
