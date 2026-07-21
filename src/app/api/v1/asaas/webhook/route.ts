import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServerClient } from '@/lib/supabase-server';
import { SubscriptionService } from '@/lib/platform';

const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;

// --- Helpers de autenticação do webhook (responsabilidade exclusiva do transporte) ---

const resolveToken = (request: NextRequest) => {
  const direct = request.headers.get('asaas-access-token') || request.headers.get('access_token');
  if (direct) return direct;

  const auth = request.headers.get('authorization');
  if (!auth) return null;
  return auth.replace('Bearer ', '');
};

export async function POST(request: NextRequest) {
  try {
    // 1. Validar autenticidade do webhook
    if (!ASAAS_WEBHOOK_TOKEN) {
      console.error('[ASAAS WEBHOOK] ASAAS_WEBHOOK_TOKEN não configurado — request rejeitado');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = resolveToken(request);
    if (!token || token !== ASAAS_WEBHOOK_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Interpretar payload recebido
    const payload = await request.json();
    const eventId = payload?.id ? String(payload.id) : null;
    const event = String(payload?.event || '').toUpperCase();
    const payment = payload?.payment;
    const asaasPaymentId = payment?.id;

    if (!asaasPaymentId) {
      return NextResponse.json({ error: 'Pagamento nao informado' }, { status: 400 });
    }

    const statusMap: Record<string, string> = {
      PAYMENT_CONFIRMED: 'paid',
      PAYMENT_RECEIVED: 'paid',
      PAYMENT_OVERDUE: 'overdue',
      PAYMENT_DELETED: 'cancelled',
      PAYMENT_CANCELED: 'cancelled',
      PAYMENT_REFUNDED: 'cancelled',
    };

    const nextStatus = statusMap[event];
    const paymentDate = payment?.paymentDate || payment?.confirmedDate || null;
    const paymentStatus = String(payment?.status || nextStatus || '').toUpperCase();
    const isPaid = paymentStatus === 'RECEIVED' || paymentStatus === 'CONFIRMED' || paymentStatus === 'RECEIVED_IN_CASH' || nextStatus === 'paid';

    const supabase = createServerClient();

    // 3. Verificar idempotência — evitar processar o mesmo evento duas vezes
    if (eventId) {
      const { data: existingEvent } = await supabase
        .from('asaas_webhook_events')
        .select('id, process_status')
        .eq('event_id', eventId)
        .maybeSingle();

      if (existingEvent?.id && existingEvent.process_status === 'processed') {
        return NextResponse.json({ received: true, duplicated: true });
      }
    }

    // Log de recebimento do evento (responsabilidade de auditoria do webhook)
    const { data: webhookEvent } = await supabase
      .from('asaas_webhook_events')
      .upsert({
        event_id: eventId,
        asaas_payment_id: asaasPaymentId,
        event_type: event || 'UNKNOWN',
        payload,
        process_status: 'received',
        received_at: new Date().toISOString(),
      }, { onConflict: 'event_id' })
      .select('id')
      .maybeSingle();

    // 4. Localizar a cobrança correspondente em payments (legado)
    const updatePayload: Record<string, any> = {
      asaas_response: payload,
      asaas_status: payment?.status || nextStatus || null,
      asaas_invoice_url: payment?.invoiceUrl || null,
      asaas_bank_slip_url: payment?.bankSlipUrl || null,
      asaas_pix_qr_code: payment?.pixQrCodeUrl || null,
      asaas_last_event: event || null,
      asaas_last_event_at: new Date().toISOString(),
      asaas_last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (nextStatus) updatePayload.status = nextStatus;
    if (paymentDate) updatePayload.payment_date = paymentDate;

    const { error } = await supabase
      .from('payments')
      .update(updatePayload)
      .eq('asaas_payment_id', asaasPaymentId);

    if (error) {
      if (webhookEvent?.id) {
        await supabase
          .from('asaas_webhook_events')
          .update({
            process_status: 'error',
            process_error: error.message,
            processed_at: new Date().toISOString(),
          })
          .eq('id', webhookEvent.id);
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 5. Localizar pré-cadastro vinculado a este pagamento
    const { data: preReg } = await supabase
      .from('pre_registrations')
      .select('*')
      .eq('asaas_payment_id', asaasPaymentId)
      .maybeSingle();

    if (preReg?.id) {
      // Sincronizar dados de pagamento no pre_registration (responsabilidade do webhook)
      await supabase
        .from('pre_registrations')
        .update({
          asaas_status: payment?.status || nextStatus || preReg.asaas_status || null,
          asaas_invoice_url: payment?.invoiceUrl || preReg.asaas_invoice_url || null,
          asaas_bank_slip_url: payment?.bankSlipUrl || preReg.asaas_bank_slip_url || null,
          payment_amount: payment?.value ?? preReg.payment_amount,
          payment_due_date: payment?.dueDate || preReg.payment_due_date,
        })
        .eq('id', preReg.id);

      // 6. Se o pagamento foi confirmado, acionar o serviço de domínio para ativação
      if (isPaid && preReg.user_id) {
        const subscriptionService = new SubscriptionService();

        const activationResult = await subscriptionService.activateFromPreRegistration(
          supabase,
          preReg,
          30 // vigência padrão do Trial: 30 dias
        );

        // Notificação interna admin (responsabilidade de auditoria/notificação do webhook)
        if (activationResult.hasPreRegUpdated) {
          const planFinal = String(preReg.plan || 'basic').toLowerCase();

          await supabase
            .from('admin_notifications')
            .insert({
              type: 'trial_approved',
              title: `✅ Pagamento confirmado: ${preReg.ministry_name}`,
              message: `Pagamento confirmado para ${preReg.ministry_name}. Acesso liberado no plano ${planFinal}.`,
              is_read: false,
              created_at: new Date().toISOString(),
            });

          // Envio de email de liberação de acesso (responsabilidade de notificação do webhook)
          const resendKey = process.env.RESEND_API_KEY;
          const resendFrom = process.env.RESEND_FROM || 'noreply@gestaoeklesia.com.br';
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

          if (resendKey) {
            try {
              const resend = new Resend(resendKey);
              const html = `
                <!DOCTYPE html>
                <html lang="pt-BR">
                  <head>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <title>Acesso liberado</title>
                  </head>
                  <body style="margin:0;padding:0;background:#f6f2ea;font-family:Arial,sans-serif;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f2ea;padding:24px 0;">
                      <tr>
                        <td align="center">
                          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 30px rgba(31,27,22,0.12);">
                            <tr>
                              <td style="background:#0f766e;color:#ffffff;padding:28px 32px;">
                                <h1 style="margin:0;font-size:22px;">Acesso liberado</h1>
                                <p style="margin:8px 0 0;font-size:14px;color:#d1fae5;">Pagamento confirmado com sucesso.</p>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:32px;color:#1f1b16;">
                                <p style="margin:0 0 12px;font-size:16px;">Ola, ${preReg.pastor_name || preReg.ministry_name}!</p>
                                <p style="margin:0 0 16px;color:#5f6b66;">
                                  Seu acesso ao Gestao Eklesia foi liberado. Voce ja pode entrar no sistema com o email e senha cadastrados.
                                </p>
                                <div style="background:#ecfdf5;border-radius:12px;padding:16px;margin-bottom:16px;">
                                  <p style="margin:0 0 6px;font-size:14px;color:#1f1b16;"><strong>Plano:</strong> ${planFinal}</p>
                                  <p style="margin:0;font-size:13px;color:#5f6b66;">Email: ${preReg.email}</p>
                                </div>
                                <p style="margin:0 0 12px;font-size:13px;color:#5f6b66;">
                                  Precisa importar a base de dados? Ao acessar o sistema, abra um ticket de suporte solicitando a importacao.
                                </p>
                                <a href="${appUrl}/login" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:bold;">Acessar o sistema</a>
                              </td>
                            </tr>
                            <tr>
                              <td style="background:#f3f4f1;color:#7a857f;padding:16px 32px;font-size:11px;">
                                Gestao Eklesia © ${new Date().getFullYear()} - suporte@gestaoeklesia.com.br
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </body>
                </html>
              `;

              await resend.emails.send({
                from: resendFrom,
                to: preReg.email,
                subject: 'Gestao Eklesia | Acesso liberado',
                html,
              });
            } catch (emailError: any) {
              console.warn('[ASAAS WEBHOOK] Falha ao enviar email de liberacao:', {
                message: emailError?.message,
                statusCode: emailError?.statusCode,
              });
            }
          }
        }
      }
    }

    // 7. Registrar evento como processado com sucesso (log de auditoria do webhook)
    if (webhookEvent?.id) {
      await supabase
        .from('asaas_webhook_events')
        .update({
          process_status: 'processed',
          process_error: null,
          processed_at: new Date().toISOString(),
        })
        .eq('id', webhookEvent.id);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
