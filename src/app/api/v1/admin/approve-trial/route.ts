import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { Resend } from 'resend'
import { buildBillingInstallments } from '@/lib/asaas'
import { TrialService, SubscriptionService, BillingService, TrialError } from '@/lib/platform'



function onlyDigits(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const digits = String(value).replace(/\D/g, '')
  return digits.length ? digits : null
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validar admin (responsabilidade da rota)
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin } = result.ctx

    const body = await request.json()
    const { pre_registration_id, approve, plan: planOverride } = body

    if (!pre_registration_id) {
      return NextResponse.json(
        { error: 'ID do pré-cadastro é obrigatório' },
        { status: 400 }
      )
    }

    console.log('[APPROVE_TRIAL] Processando:', { pre_registration_id, approve })

    // 2. TrialService: Executar aprovação ou rejeição
    const trialService = new TrialService()
    const approveResult = await trialService.approveTrial(supabaseAdmin, {
      preRegistrationId: pre_registration_id,
      approve: approve !== false,
      planOverride
    })

    // Se a ação for rejeição, pre_registrations já foi deletado
    if (approveResult.action === 'rejected') {
      console.log('[APPROVE_TRIAL] ✅ Pré-cadastro rejeitado:', pre_registration_id)
      return NextResponse.json({
        success: true,
        message: approveResult.message,
        action: 'rejected'
      }, { status: 200 })
    }

    const { preReg, planFinal, subEndDate } = approveResult
    if (!preReg || !planFinal || !subEndDate) {
      return NextResponse.json({ error: 'Dados de aprovação inválidos' }, { status: 400 })
    }


    // 3. SubscriptionService: Ativar e criar ministério (vigência de 365 dias)
    const subscriptionService = new SubscriptionService()
    const activationResult = await subscriptionService.activateFromPreRegistration(
      supabaseAdmin,
      preReg,
      365
    )

    const ministryId = activationResult.ministryId

    // 4. BillingService: Gerar 12 cobranças no Asaas + persistir na tabela payments (legada)
    const asaasKey = process.env.ASAAS_API_KEY
    if (asaasKey && ministryId) {
      try {
        const planData = await subscriptionService.getPlanBySlug(supabaseAdmin, planFinal)
        const monthlyPrice = Number(planData?.price_monthly || 0)
        const subscriptionPlanId = planData?.id || null

        if (monthlyPrice > 0) {
          const billingService = new BillingService()
          const installments = buildBillingInstallments(new Date(), monthlyPrice)

          for (let i = 0; i < installments.length; i++) {
            const inst = installments[i]
            const parcelLabel = inst.isProrated
              ? `Parcela 1/12 (proporcional)`
              : `Parcela ${i + 1}/12`
            const description = `${preReg.ministry_name} - ${planFinal} - ${parcelLabel}`

            const periodEnd = (() => {
              const d = new Date(`${inst.dueDate}T00:00:00`)
              return `${d.getFullYear()}-${String(d.getMonth() + 2 > 12 ? 1 : d.getMonth() + 2).padStart(2, '0')}-09`
            })()

            // Geramos a cobrança no gateway (com persistLocal: false para salvar na tabela payments legada)
            const invoiceResult = await billingService.generateInvoice(supabaseAdmin, {
              ministry: {
                id: ministryId,
                name: preReg.ministry_name,
                cnpj_cpf: preReg.cpf_cnpj,
                phone: onlyDigits(preReg.phone),
                email_admin: preReg.email,
                asaas_customer_id: preReg.asaas_customer_id || null,
              },
              plan: {
                id: subscriptionPlanId || '00000000-0000-0000-0000-000000000000',
                slug: planFinal,
                name: planData?.name || planFinal,
                price_monthly: monthlyPrice
              },
              validityMonths: 1,
              externalReference: `${ministryId}_p${i + 1}`,
              customAmount: inst.amount,
              customDueDate: inst.dueDate,
              customDescription: description,
              persistLocal: false // impede inserção na platform_billing_invoices
            })

            // Insere na tabela de controle payments (legada)
            await supabaseAdmin.from('payments').insert({
              ministry_id: ministryId,
              asaas_payment_id: invoiceResult.asaasPaymentId,
              subscription_plan_id: subscriptionPlanId,
              amount: inst.amount,
              description,
              due_date: inst.dueDate,
              status: 'pending',
              period_start: inst.dueDate,
              period_end: periodEnd,
              asaas_response: {
                id: invoiceResult.asaasPaymentId,
                invoiceUrl: invoiceResult.invoiceUrl,
                bankSlipUrl: invoiceResult.bankSlipUrl,
                dueDate: invoiceResult.dueDate,
                value: inst.amount
              },
            })
          }

          console.log('[APPROVE_TRIAL] ✅ 12 cobranças geradas no Asaas:', preReg.ministry_name)
        } else {
          console.warn('[APPROVE_TRIAL] Plano sem preço mensal, cobranças não geradas:', planFinal)
        }
      } catch (asaasErr: any) {
        console.error('[APPROVE_TRIAL] Erro ao gerar cobranças no Asaas (não-crítico):', asaasErr.message)
      }
    } else if (!asaasKey) {
      console.warn('[APPROVE_TRIAL] ASAAS_API_KEY não configurado - cobranças não geradas')
    }

    // Criar notificação para admin (responsabilidade de auditoria do admin)
    await supabaseAdmin
      .from('admin_notifications')
      .insert({
        type: 'trial_approved',
        title: `✅ Acesso Efetivado: ${preReg.ministry_name}`,
        message: `Ministério ${preReg.ministry_name} (Pastor: ${preReg.pastor_name}) foi efetivado no plano ${planFinal}. Vencimento: ${subEndDate!.toLocaleDateString('pt-BR')}.`,
        is_read: false,
        created_at: new Date().toISOString(),
      })

    // Enviar email de confirmação de efetivação ao cliente via Resend
    const resendKey = process.env.RESEND_API_KEY
    const resendFrom = process.env.RESEND_FROM || 'noreply@gestaoeklesia.com.br'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    if (resendKey) {
      try {
        const resend = new Resend(resendKey)
        const planLabel = planFinal.charAt(0).toUpperCase() + planFinal.slice(1)
        const html = `
          <!DOCTYPE html>
          <html lang="pt-BR">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>Acesso Efetivado - Gestão Eklesia</title>
            </head>
            <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
                      <tr>
                        <td style="background:#0f172a;color:#ffffff;padding:28px 32px;">
                          <h1 style="margin:0;font-size:22px;">Acesso Efetivado!</h1>
                          <p style="margin:8px 0 0;font-size:14px;color:#cbd5f5;">Sua assinatura esta ativa no Gestão Eklesia.</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:32px;color:#0f172a;">
                          <p style="margin:0 0 12px;font-size:16px;">Ola, ${preReg.pastor_name}!</p>
                          <p style="margin:0 0 16px;color:#475569;">
                            O acesso da instituicao <strong>${preReg.ministry_name}</strong> foi efetivado com sucesso no plano <strong>${planLabel}</strong>.
                          </p>
                          <div style="background:#f0fdf4;border-radius:12px;padding:16px;margin-bottom:16px;border-left:4px solid #22c55e;">
                            <p style="margin:0 0 8px;font-size:14px;color:#0f172a;"><strong>Detalhes da assinatura</strong></p>
                            <p style="margin:0 0 4px;font-size:13px;color:#475569;">Plano: ${planLabel}</p>
                            <p style="margin:0 0 4px;font-size:13px;color:#475569;">Valido ate: ${subEndDate!.toLocaleDateString('pt-BR')}</p>
                            <p style="margin:0;font-size:13px;color:#475569;">Email de acesso: ${preReg.email}</p>
                          </div>
                          <a href="${appUrl}/login" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:bold;">Acessar o sistema</a>
                          <p style="margin:16px 0 0;font-size:12px;color:#64748b;">Suporte WhatsApp: <a href="https://wa.me/5591981755021" style="color:#2563eb;">(91) 98175-5021</a>.</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#f8fafc;color:#94a3b8;padding:16px 32px;font-size:11px;">
                          Gestão Eklesia &copy; ${new Date().getFullYear()} - suporte@gestaoeklesia.com.br
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
          subject: 'Acesso Efetivado - Gestão Eklesia',
          html,
        })
        console.log('[APPROVE_TRIAL] ✅ Email de efetivacao enviado para:', preReg.email)
      } catch (emailError: any) {
        console.warn('[APPROVE_TRIAL] Falha ao enviar email de efetivacao (nao-critico):', {
          message: emailError?.message,
          statusCode: emailError?.statusCode,
          to: preReg.email,
        })
      }
    }

    console.log('[APPROVE_TRIAL] ✅ Usuário aprovado:', {
      user_id: preReg.user_id,
      email: preReg.email,
      ministry: preReg.ministry_name,
    })

    return NextResponse.json({
      success: true,
      message: approveResult.message,
      data: { ministry_id: ministryId },
      action: 'approved'
    }, { status: 201 })

  } catch (error: any) {
    if (error instanceof TrialError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const errorMessage = error?.message || String(error)
    console.error('[APPROVE_TRIAL] Erro geral:', errorMessage)
    return NextResponse.json(
      { error: 'Erro ao processar aprovação: ' + errorMessage },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
}
