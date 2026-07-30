import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { createServerClient } from '@/lib/supabase-server';
import { TechnicalAccessService } from '@/lib/security/TechnicalAccessService';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (!authResult.ok) {
      return authResult.response;
    }

    const { ctx } = authResult;
    const body = await request.json().catch(() => ({}));
    const { tenantId, adminPassword, reason } = body || {};

    if (!tenantId || typeof tenantId !== 'string') {
      return NextResponse.json({ error: 'tenantId é obrigatório.' }, { status: 400 });
    }

    if (!adminPassword || typeof adminPassword !== 'string') {
      return NextResponse.json({ error: 'Reautenticação obrigatória: Informe a sua senha de Super Admin.' }, { status: 401 });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return NextResponse.json({ error: 'Motivo do acesso é obrigatório (mínimo de 5 caracteres).' }, { status: 400 });
    }

    // 1. Reautenticar a senha do próprio Super Admin
    const authValidationClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error: signInErr } = await authValidationClient.auth.signInWithPassword({
      email: ctx.user.email || '',
      password: adminPassword,
    });

    if (signInErr) {
      return NextResponse.json({ error: 'Senha de Administrador incorreta. Acesso negado.' }, { status: 401 });
    }

    const adminClient = createServerClient();

    // 2. Descriptografar a senha técnica AES-256-GCM
    const { email, plainTextPassword } = await TechnicalAccessService.revealPassword(adminClient, tenantId);

    // 3. Registrar auditoria obrigatória com IP e User-Agent
    try {
      await adminClient.from('audit_logs').insert({
        user_id: ctx.user.id,
        action: 'VIEW_TECHNICAL_PASSWORD',
        module: 'admin',
        details: `Senha da conta técnica (${email}) visualizada pelo Super Admin. Motivo: ${reason.trim()}`,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1',
        user_agent: request.headers.get('user-agent') || 'desconhecido',
        created_at: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('[API technical-access/reveal] Erro ao gravar log de auditoria:', auditErr);
    }

    return NextResponse.json({
      success: true,
      email,
      plainTextPassword,
    });
  } catch (err: any) {
    console.error('[API technical-access/reveal] Exceção:', err);
    return NextResponse.json({ error: err?.message || 'Erro ao revelar senha técnica.' }, { status: 500 });
  }
}
