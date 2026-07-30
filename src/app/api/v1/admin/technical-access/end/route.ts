import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServerClientFromRequest } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientFromRequest(request);
    const admin = createServerClient();

    // 1. Obter usuário autenticado nativamente via Supabase Auth
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 401 });
    }

    const isTechnical = user.app_metadata?.is_technical_user === true || user.user_metadata?.is_technical_user === true;

    // Buscar concessão ativa para este usuário técnico na tabela oficial technical_access_grants
    const { data: grant } = await admin
      .from('technical_access_grants')
      .select('id, ministry_id, technical_user_id, admin_id')
      .eq('technical_user_id', user.id)
      .eq('status', 'active')
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (grant) {
      // 2. Finalizar concessão na tabela oficial technical_access_grants
      await admin
        .from('technical_access_grants')
        .update({
          status: 'ended',
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
        })
        .eq('id', grant.id);
    }

    // 3. Desabilitar a conta do usuário técnico no Supabase Auth para bloquear acessos não autorizados
    if (isTechnical) {
      await admin.auth.admin.updateUserById(user.id, {
        ban_duration: '876000h',
      }).catch((err) => console.warn('[API technical-access/end] Aviso ao desabilitar conta técnica:', err));
    }

    // 4. Registrar log de auditoria do encerramento
    try {
      await admin.from('audit_logs').insert({
        user_id: user.id,
        action: 'END_TECHNICAL_ACCESS',
        module: 'admin',
        details: `Atendimento técnico encerrado para a conta ${user.email}`,
        ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[API technical-access/end] Erro ao gravar audit log:', err);
    }

    return NextResponse.json({ success: true, message: 'Atendimento técnico encerrado com sucesso.' });
  } catch (err: any) {
    console.error('[API technical-access/end] Exceção:', err);
    return NextResponse.json({ error: err?.message || 'Erro ao encerrar atendimento técnico.' }, { status: 500 });
  }
}
