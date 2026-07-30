import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { createServerClient } from '@/lib/supabase-server';
import { TechnicalAccessService } from '@/lib/security/TechnicalAccessService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (!authResult.ok) {
      return authResult.response;
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId é obrigatório.' }, { status: 400 });
    }

    const adminClient = createServerClient();
    const account = await TechnicalAccessService.getOrCreateTechnicalAccount(adminClient, tenantId);

    // Registra log de auditoria da consulta de credencial se for o primeiro acesso
    try {
      await adminClient.from('audit_logs').insert({
        user_id: authResult.ctx.user.id,
        action: 'FETCH_TECHNICAL_CREDENTIALS',
        module: 'admin',
        details: `Credencial técnica consultada para o tenant ${tenantId}`,
        ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
        created_at: new Date().toISOString(),
      });
    } catch {}

    return NextResponse.json({
      success: true,
      email: account.email,
      lastSignInAt: account.lastSignInAt,
      lastSignInIp: account.lastSignInIp || null,
      lastSignInUserAgent: account.lastSignInUserAgent || null,
    });
  } catch (err: any) {
    console.error('[API technical-access/credentials] Exceção:', err);
    return NextResponse.json({ error: err?.message || 'Erro ao obter credenciais técnicas.' }, { status: 500 });
  }
}
