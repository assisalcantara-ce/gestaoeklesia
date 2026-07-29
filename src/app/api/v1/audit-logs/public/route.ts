import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { enviarNotificacaoSegurancaSenha } from '@/lib/email-service';

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

    let notificationSent = false;
    let notificationError: string | null = null;
    let notificationSentAt: string | null = null;

    // Se a ação for de redefinição concluída ('editar'), disparar e-mail de notificação de segurança
    if (body.acao === 'editar' && body.usuario_email) {
      try {
        const notifResult = await enviarNotificacaoSegurancaSenha({
          email: body.usuario_email,
          ip,
          userAgent,
        });

        notificationSent = notifResult.enviado;
        if (notifResult.enviado) {
          notificationSentAt = new Date().toISOString();
        } else {
          notificationError = notifResult.erro || 'Falha no envio';
        }
      } catch (err: any) {
        console.error('❌ Erro resiliente ao enviar notificação de segurança:', err);
        notificationSent = false;
        notificationError = err?.message || 'Exceção no envio';
      }
    }

    // Insere evento auditado PASSWORD_RESET_COMPLETED com campos enriquecidos de notificação
    await admin.from('audit_logs').insert({
      action: body.acao === 'editar' ? 'UPDATE' : 'READ',
      resource_type: 'autenticacao',
      ip_address: ip,
      user_agent: userAgent,
      status_code: 200,
      error_message: null,
      new_data: {
        event_type: body.acao === 'editar' ? 'PASSWORD_RESET_COMPLETED' : 'PASSWORD_RESET_REQUESTED',
        descricao: body.descricao,
        usuario_email: body.usuario_email,
        data_hora: new Date().toISOString(),
        notification_sent: notificationSent,
        notification_error: notificationError,
        notification_sent_at: notificationSentAt,
      },
    });

    return NextResponse.json({
      success: true,
      notification_sent: notificationSent,
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

