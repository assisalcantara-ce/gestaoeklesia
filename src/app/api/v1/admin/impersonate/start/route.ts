import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { ImpersonationService } from '@/lib/security/ImpersonationService';

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const { adminUser, user } = adminCheck.ctx;
    const body = await request.json().catch(() => ({}));
    const { tenantId, reason, readOnly } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'O parâmetro tenantId (ID do ministério/tenant) é obrigatório.' },
        { status: 400 }
      );
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    const result = await ImpersonationService.startImpersonation({
      originalAdminId: adminUser.id || user.id,
      originalAdminEmail: adminUser.email || user.email || '',
      originalAdminRole: adminUser.role,
      targetTenantId: tenantId,
      reason: reason || '',
      readOnly: !!readOnly,
      ip,
      userAgent,
      durationMinutes: 30,
    });

    return NextResponse.json({
      token: result.token,
      expiresAt: result.expiresAt,
      sessionId: result.sessionId,
      session: result.sessionRecord,
    });
  } catch (error: any) {
    const status = error.message?.includes('Acesso negado')
      ? 403
      : error.message?.includes('obrigatória') || error.message?.includes('não encontrado')
      ? 400
      : 500;
    return NextResponse.json({ error: error.message || 'Erro interno no servidor.' }, { status });
  }
}
