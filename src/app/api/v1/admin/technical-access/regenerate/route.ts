import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { createServerClient } from '@/lib/supabase-server';
import { TechnicalAccessService } from '@/lib/security/TechnicalAccessService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (!authResult.ok) {
      return authResult.response;
    }

    const { ctx } = authResult;
    const body = await request.json().catch(() => ({}));
    const { tenantId, reason } = body || {};

    if (!tenantId || typeof tenantId !== 'string') {
      return NextResponse.json({ error: 'tenantId é obrigatório.' }, { status: 400 });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return NextResponse.json({ error: 'Motivo da regeneração é obrigatório (mínimo de 5 caracteres).' }, { status: 400 });
    }

    const adminClient = createServerClient();

    // 1. Regenerar a senha no Auth e no Banco Criptografado
    const { email, newPassword } = await TechnicalAccessService.regeneratePassword(
      adminClient,
      tenantId,
      ctx.user.id
    );

    // 2. Registrar log de auditoria do evento de regeneração
    try {
      await adminClient.from('audit_logs').insert({
        user_id: ctx.user.id,
        action: 'REGENERATE_TECHNICAL_PASSWORD',
        module: 'admin',
        details: `Senha da conta técnica (${email}) foi regenerada pelo Super Admin. Motivo: ${reason.trim()}`,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1',
        user_agent: request.headers.get('user-agent') || 'desconhecido',
        created_at: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('[API technical-access/regenerate] Erro ao gravar audit log:', auditErr);
    }

    return NextResponse.json({
      success: true,
      email,
      newPassword,
    });
  } catch (err: any) {
    console.error('[API technical-access/regenerate] Exceção:', err);
    return NextResponse.json({ error: err?.message || 'Erro ao regenerar senha técnica.' }, { status: 500 });
  }
}
