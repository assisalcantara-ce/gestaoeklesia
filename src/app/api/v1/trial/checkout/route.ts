import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { createAsaasCustomer, findAsaasCustomer, createAsaasPayment, getAsaasPayment } from '@/lib/asaas'

const onlyDigits = (value?: string | null) => (value ? String(value).replace(/\D/g, '') : '')

const formatDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function POST(request: NextRequest) {
  try {
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

    if (!planId && !planSlug) {
      return NextResponse.json({ error: 'Plano obrigatorio' }, { status: 400 })
    }

    const { data: preReg, error: preRegError } = await supabaseAdmin
      .from('pre_registrations')
      .select('*')
      .eq('user_id', authData.user.id)
      .maybeSingle()

    if (preRegError || !preReg) {
      return NextResponse.json({ error: 'Pre-cadastro nao encontrado' }, { status: 404 })
    }

    const expiresAt = preReg.trial_expires_at ? new Date(preReg.trial_expires_at) : null
    const isExpired = preReg.status === 'encerrado' || (expiresAt && expiresAt.getTime() <= Date.now())

    if (!isExpired) {
      return NextResponse.json({ error: 'Trial ainda ativo' }, { status: 400 })
    }

    let planRow: any = null
    if (planId) {
      const { data } = await supabaseAdmin
        .from('subscription_plans')
        .select('id,name,slug,price_monthly')
        .eq('id', planId)
        .eq('is_active', true)
        .maybeSingle()
      planRow = data
    }

    if (!planRow && planSlug) {
      const { data } = await supabaseAdmin
        .from('subscription_plans')
        .select('id,name,slug,price_monthly')
        .eq('slug', planSlug)
        .eq('is_active', true)
        .maybeSingle()
      planRow = data
    }

    if (!planRow?.id) {
      return NextResponse.json({ error: 'Plano nao encontrado' }, { status: 404 })
    }

    const planPrice = Number(planRow.price_monthly || 0)
    if (!Number.isFinite(planPrice) || planPrice <= 0) {
      return NextResponse.json({ error: 'Plano sem valor mensal valido' }, { status: 400 })
    }

    if (preReg.asaas_payment_id) {
      try {
        const payment = await getAsaasPayment(preReg.asaas_payment_id)
        const nextStatus = String(payment.status || '').trim()

        await supabaseAdmin
          .from('pre_registrations')
          .update({
            asaas_status: nextStatus || preReg.asaas_status,
            asaas_invoice_url: payment.invoiceUrl || preReg.asaas_invoice_url,
            asaas_bank_slip_url: payment.bankSlipUrl || preReg.asaas_bank_slip_url,
            payment_amount: payment.value ?? preReg.payment_amount,
            payment_due_date: payment.dueDate || preReg.payment_due_date,
          })
          .eq('id', preReg.id)

        return NextResponse.json({
          success: true,
          existing: true,
          payment: {
            status: nextStatus,
            invoice_url: payment.invoiceUrl || null,
            bank_slip_url: payment.bankSlipUrl || null,
            due_date: payment.dueDate || null,
            amount: payment.value || planPrice,
          }
        })
      } catch {
        // se falhar, tentamos gerar um novo boleto
      }
    }

    let customerId = preReg.asaas_customer_id || ''
    if (!customerId) {
      const existing = await findAsaasCustomer({
        cpfCnpj: onlyDigits(preReg.cpf_cnpj) || null,
        email: preReg.email || null,
      })

      if (existing?.id) {
        customerId = existing.id
      } else {
        const customer = await createAsaasCustomer({
          name: preReg.ministry_name || preReg.pastor_name || 'Ministerio',
          email: preReg.email || `no-email-${preReg.id}@gestaoeklesia.local`,
          cpfCnpj: onlyDigits(preReg.cpf_cnpj) || null,
          phone: onlyDigits(preReg.phone) || null,
          mobilePhone: onlyDigits(preReg.whatsapp) || null,
          address: preReg.address_street || null,
          addressNumber: preReg.address_number || null,
          complement: preReg.address_complement || null,
          province: preReg.address_neighborhood || preReg.address_city || null,
          postalCode: onlyDigits(preReg.address_zip) || null,
        })
        customerId = customer.id
      }

      if (customerId) {
        await supabaseAdmin
          .from('pre_registrations')
          .update({ asaas_customer_id: customerId })
          .eq('id', preReg.id)
      }
    }

    if (!customerId) {
      return NextResponse.json({ error: 'Nao foi possivel criar cliente no Asaas' }, { status: 400 })
    }

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 3)

    const payment = await createAsaasPayment({
      customer: customerId,
      value: planPrice,
      dueDate: formatDate(dueDate),
      description: `${preReg.ministry_name} - Plano ${planRow.name}`,
      billingType: 'BOLETO',
      externalReference: `pre-${preReg.id}`,
    })

    await supabaseAdmin
      .from('pre_registrations')
      .update({
        plan: planRow.slug,
        asaas_payment_id: payment.id,
        asaas_status: payment.status || 'PENDING',
        asaas_invoice_url: payment.invoiceUrl || null,
        asaas_bank_slip_url: payment.bankSlipUrl || null,
        payment_amount: planPrice,
        payment_due_date: payment.dueDate || formatDate(dueDate),
        boleto_sent_at: new Date().toISOString(),
      })
      .eq('id', preReg.id)

    const boletoUrl = payment.bankSlipUrl || payment.invoiceUrl || ''
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
                            <p style="margin:0;font-size:13px;color:#5f6b66;">Vencimento: ${new Date(payment.dueDate || dueDate).toLocaleDateString('pt-BR')}</p>
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
        status: payment.status,
        invoice_url: payment.invoiceUrl || null,
        bank_slip_url: payment.bankSlipUrl || null,
        due_date: payment.dueDate || formatDate(dueDate),
        amount: planPrice,
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao gerar boleto' },
      { status: 500 }
    )
  }
}
