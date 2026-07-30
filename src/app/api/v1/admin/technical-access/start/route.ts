import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { createServerClient } from '@/lib/supabase-server';
import { TechnicalAccessService } from '@/lib/security/TechnicalAccessService';
import { getAppBaseUrl } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Validar autenticação do Super Admin
    const authResult = await requireAdmin(request);
    if (!authResult.ok) {
      return authResult.response;
    }

    const { ctx } = authResult;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 });
    }

    const { tenantId, reason, ticketReference, durationHours } = body || {};

    if (!tenantId || typeof tenantId !== 'string') {
      return NextResponse.json({ error: 'tenantId é obrigatório.' }, { status: 400 });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return NextResponse.json({ error: 'Motivo do atendimento é obrigatório (mínimo 5 caracteres).' }, { status: 400 });
    }

    const adminClient = createServerClient();
    
    // Resolvendo a URL base publica oficial da aplicacao sem usar request.nextUrl.origin
    const baseUrl = getAppBaseUrl(request);
    const expectedRedirectTo = `${baseUrl}/auth/technical-callback`;

    // Debug logs para auditoria de conexao e geracao de link
    console.log('[TECHNICAL_ACCESS_START] baseUrl resolvida:', baseUrl);
    console.log('[TECHNICAL_ACCESS_START] redirectTo final:', expectedRedirectTo);

    // 2. Iniciar sessão técnica e gerar Magic Link nativo do Supabase Auth
    const sessionResult = await TechnicalAccessService.startTechnicalSession(adminClient, {
      tenantId,
      adminId: ctx.user.id,
      reason: reason.trim(),
      ticketReference: typeof ticketReference === 'string' ? ticketReference.trim() : undefined,
      durationHours: typeof durationHours === 'number' && durationHours > 0 ? durationHours : 2,
      baseUrl,
    });

    console.log('[TECHNICAL_ACCESS_START] action_link retornado pelo Supabase:', sessionResult.actionLink);

    // 3. Registrar auditoria do acesso técnico
    try {
      await adminClient.from('audit_logs').insert({
        user_id: ctx.user.id,
        action: 'START_TECHNICAL_ACCESS',
        module: 'admin',
        details: `Acesso Técnico concedido para o tenant ${tenantId}. Motivo: ${reason}`,
        ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[API technical-access/start] Erro ao gravar log de auditoria:', err);
    }

    return NextResponse.json({
      success: true,
      redirectUrl: sessionResult.actionLink,
      grantId: sessionResult.grantId,
    });
  } catch (err: any) {
    console.error('[API technical-access/start] Exceção:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno ao iniciar acesso técnico.' }, { status: 500 });
  }
}
