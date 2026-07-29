import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

function requestMeta(request: NextRequest) {
  return {
    ip:
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'desconhecido',
    userAgent: request.headers.get('user-agent') || 'desconhecido',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ip, userAgent } = requestMeta(request);

    const admin = createServerClient();

    // Insere evento auditado de solicitações/redefinições de autenticação sem expor credenciais
    await admin.from('audit_logs').insert({
      action: body.acao === 'editar' ? 'UPDATE' : 'READ',
      resource_type: 'autenticacao',
      ip_address: ip,
      user_agent: userAgent,
      status_code: 200,
      error_message: null,
      new_data: {
        descricao: body.descricao,
        usuario_email: body.usuario_email,
        data_hora: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
