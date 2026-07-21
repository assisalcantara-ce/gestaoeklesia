import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { TrialService, BillingService, TrialError } from '@/lib/platform'

const onlyDigits = (value?: string | null) => (value ? String(value).replace(/\D/g, '') : '')

export async function POST(request: NextRequest) {
  try {
    // 1. Validar autenticação (responsabilidade da rota)
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !authData?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const planId = String(body?.plan_id || body?.planId || '').trim()
    const planSlug = String(body?.plan_slug || body?.planSlug || '').trim()

    // 2. TrialService: Preparar checkout (valida preReg, status, planos e pagamento existente)
    const trialService = new TrialService()
    const checkoutContext = await trialService.prepareCheckout(supabaseAdmin, {
      userId: authData.user.id,
      planId,
      planSlug
    })

    const { preReg, planRow, planPrice, existingPayment } = checkoutContext

    // Se já existia uma cobrança ativa e válida no Asaas, ela já foi atualizada e retornada pelo serviço
    if (existingPayment) {
      return NextResponse.json({
        success: true,
        existing: true,
        payment: existingPayment
      })
    }

    // 3. BillingService: Gerar cobrança no gateway (com persistLocal: false por ser lead temporário)
    const billingService = new BillingService()
    const invoiceResult = await billingService.generateInvoice(supabaseAdmin, {
      ministry: {
        id: preReg.id, // provisoriamente passamos o id de pre_registrations
        name: preReg.ministry_name || preReg.pastor_name || 'Ministerio',
        cnpj_cpf: onlyDigits(preReg.cpf_cnpj) || null,
        phone: onlyDigits(preReg.phone) || null,
        email_admin: preReg.email || null,
        asaas_customer_id: preReg.asaas_customer_id || null
      },
      plan: {
        id: planRow.id,
        slug: planRow.slug,
        name: planRow.name,
        price_monthly: planPrice
      },
      validityMonths: 1, // checkout padrão do trial
      dueDays: 3, // vencimento em 3 dias
      externalReference: `pre-${preReg.id}`,
      persistLocal: false // impede inserção em platform_billing_invoices (not-null ministry_id)
    })

    // 4. Salvar informações do boleto em pre_registrations
    await supabaseAdmin
      .from('pre_registrations')
      .update({
        plan: planRow.slug,
        asaas_payment_id: invoiceResult.asaasPaymentId,
        asaas_status: 'PENDING',
        asaas_invoice_url: invoiceResult.invoiceUrl || null,
        asaas_bank_slip_url: invoiceResult.bankSlipUrl || null,
        payment_amount: planPrice,
        payment_due_date: invoiceResult.dueDate,
        boleto_sent_at: new Date().toISOString(),
      })
      .eq('id', preReg.id)

    // 5. Enviar e-mail de aviso com o boleto via Resend (se configurado)
    const boletoUrl = invoiceResult.bankSlipUrl || invoiceResult.invoiceUrl || ''
    const resendKey = process.env.RESEND_API_KEY
    const resendFrom = process.env.RESEND_FROM || 'noreply@gestaoeklesia.com.br'

    if (resendKey) {
      try {
        const resend = new Resend(resendKey)
        const html = `
          <!DOCTYPE html>
          <html lang="pt-BR">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>Boleto - Gestao Eklesia</title>
            </head>
            <body style="margin:0;padding:0;background:#f6f2ea;font-family:Arial,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f2ea;padding:24px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 30px rgba(31,27,22,0.12);">
                      <tr>
                        <td style="background:#0f766e;color:#ffffff;padding:28px 32px;">
                          <h1 style="margin:0;font-size:22px;">Boleto gerado</h1>
                          <p style="margin:8px 0 0;font-size:14px;color:#d1fae5;">Finalize a assinatura para liberar seu acesso definitivo.</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:32px;color:#1f1b16;">
                          <p style="margin:0 0 12px;font-size:16px;">Ola, ${preReg.pastor_name || preReg.ministry_name}!</p>
                          <p style="margin:0 0 16px;color:#5f6b66;">
                            O boleto do plano <strong>${planRow.name}</strong> foi gerado.
                          </p>
                          <div style="background:#f3f4f1;border-radius:12px;padding:16px;margin-bottom:16px;">
                            <p style="margin:0 0 6px;font-size:14px;color:#1f1b16;"><strong>Valor:</strong> R$ ${planPrice.toFixed(2).replace('.', ',')}</p>
                            <p style="margin:0;font-size:13px;color:#5f6b66;">Vencimento: ${new Date(invoiceResult.dueDate).toLocaleDateString('pt-BR')}</p>
                          </div>
                          ${boletoUrl ? `<a href="${boletoUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:bold;">Abrir boleto</a>` : ''}
                          <p style="margin:16px 0 0;font-size:12px;color:#5f6b66;">Se precisar de ajuda, fale com nosso suporte.</p>
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
        `

        await resend.emails.send({
          from: resendFrom,
          to: preReg.email,
          subject: 'Gestao Eklesia | Seu boleto foi gerado',
          html,
        })
      } catch (emailError: any) {
        console.warn('[TRIAL_CHECKOUT] Falha ao enviar boleto:', {
          message: emailError?.message,
          statusCode: emailError?.statusCode,
        })
      }
    }

    return NextResponse.json({
      success: true,
      payment: {
        status: 'PENDING',
        invoice_url: invoiceResult.invoiceUrl || null,
        bank_slip_url: invoiceResult.bankSlipUrl || null,
        due_date: invoiceResult.dueDate,
        amount: planPrice,
      }
    })
  } catch (error: any) {
    if (error instanceof TrialError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json(
      { error: error?.message || 'Erro ao gerar boleto' },
      { status: 500 }
    )
  }
}
