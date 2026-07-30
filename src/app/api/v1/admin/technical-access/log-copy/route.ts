import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (!authResult.ok) {
      return authResult.response;
    }

    const { ctx } = authResult;
    const body = await request.json().catch(() => ({}));
    const { tenantId, actionType, reason } = body || {};

    if (!tenantId || typeof tenantId !== 'string') {
      return NextResponse.json({ error: 'tenantId é obrigatório.' }, { status: 400 });
    }

    const validActions = ['COPY_TECHNICAL_EMAIL', 'COPY_TECHNICAL_PASSWORD'];
    if (!actionType || !validActions.includes(actionType)) {
      return NextResponse.json({ error: 'actionType é inválido.' }, { status: 400 });
    }

    const adminClient = createServerClient();

    try {
      await adminClient.from('audit_logs').insert({
        user_id: ctx.user.id,
        action: actionType,
        module: 'admin',
        details: `${actionType === 'COPY_TECHNICAL_EMAIL' ? 'E-mail' : 'Senha'} da conta técnica copiado(a) para o tenant ${tenantId}. Motivo: ${reason || 'Não informado'}`,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1',
        user_agent: request.headers.get('user-agent') || 'desconhecido',
        created_at: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('[API technical-access/log-copy] Erro ao gravar log de auditoria:', auditErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API technical-access/log-copy] Exceção:', err);
    return NextResponse.json({ error: err?.message || 'Erro ao registrar auditoria de cópia.' }, { status: 500 });
  }
}
