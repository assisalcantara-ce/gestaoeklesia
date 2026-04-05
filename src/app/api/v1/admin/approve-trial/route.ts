import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { Resend } from 'resend'
import { ensureAsaasCustomer, createAsaasPayment, buildBillingInstallments } from '@/lib/asaas'

export async function POST(request: NextRequest) {
  try {
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

    // Buscar pré-cadastro
    const { data: preReg, error: fetchError } = await supabaseAdmin
      .from('pre_registrations')
      .select('*')
      .eq('id', pre_registration_id)
      .single()

    if (fetchError || !preReg) {
      console.error('[APPROVE_TRIAL] Pré-cadastro não encontrado:', fetchError)
      return NextResponse.json(
        { error: 'Pré-cadastro não encontrado' },
        { status: 404 }
      )
    }

    if (approve === false) {
      // Deletar pré-cadastro (rejeição)
      const { error: deleteError } = await supabaseAdmin
        .from('pre_registrations')
        .delete()
        .eq('id', pre_registration_id)

      if (deleteError) {
        console.error('[APPROVE_TRIAL] Erro ao rejeitar:', deleteError)
        return NextResponse.json(
          { error: 'Erro ao rejeitar pré-cadastro' },
          { status: 400 }
        )
      }

      console.log('[APPROVE_TRIAL] ✅ Pré-cadastro rejeitado:', pre_registration_id)
      return NextResponse.json({
        success: true,
        message: 'Pré-cadastro rejeitado com sucesso',
        action: 'rejected'
      }, { status: 200 })
    }

    if (!preReg.user_id) {
      return NextResponse.json(
        { error: 'Pré-cadastro sem usuário associado. Gere credenciais antes de aprovar.' },
        { status: 400 }
      )
    }

    const slug = String(preReg.ministry_name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 80) || `ministerio-${Date.now()}`

    const { data: existingMinistry } = await supabaseAdmin
      .from('ministries')
      .select('id, asaas_customer_id')
      .eq('user_id', preReg.user_id)
      .maybeSingle()

    let ministryId = existingMinistry?.id || null

    // Data de vencimento: 1 ano a partir da data de efetivação
    const subEndDate = new Date()
    subEndDate.setFullYear(subEndDate.getFullYear() + 1)
    const subEndDateISO = subEndDate.toISOString()
    const planFinal = planOverride || preReg.plan || 'basic'

    if (!ministryId) {
      const { data: ministry, error: ministryError } = await supabaseAdmin
        .from('ministries')
        .insert({
          user_id: preReg.user_id,
          name: preReg.ministry_name,
          slug,
          email_admin: preReg.email,
          cnpj_cpf: preReg.cpf_cnpj,
          phone: preReg.phone || null,
          website: preReg.website || null,
          description: preReg.description || null,
          plan: planFinal,
          subscription_status: 'active',
          subscription_start_date: new Date().toISOString(),
          subscription_end_date: subEndDateISO,
          is_active: true,
        })
        .select('id')
        .single()

      if (ministryError || !ministry) {
        console.error('[APPROVE_TRIAL] Erro ao criar ministerio:', ministryError)
        return NextResponse.json(
          { error: 'Erro ao liberar acesso: ' + (ministryError?.message || 'ministerio') },
          { status: 400 }
        )
      }

      ministryId = ministry.id
    } else {
      // Ministério já existia (trial anterior): atualizar assinatura
      await supabaseAdmin
        .from('ministries')
        .update({
          plan: planFinal,
          subscription_status: 'active',
          subscription_start_date: new Date().toISOString(),
          subscription_end_date: subEndDateISO,
          is_active: true,
        })
        .eq('id', ministryId)
    }

    if (ministryId) {
      const { data: existingLink } = await supabaseAdmin
        .from('ministry_users')
        .select('id')
        .eq('ministry_id', ministryId)
        .eq('user_id', preReg.user_id)
        .maybeSingle()

      if (!existingLink) {
        const { error: linkError } = await supabaseAdmin
          .from('ministry_users')
          .insert({
            ministry_id: ministryId,
            user_id: preReg.user_id,
            role: 'admin',
            is_active: true,
          })

        if (linkError) {
          console.error('[APPROVE_TRIAL] Erro ao vincular usuario ao ministerio:', linkError)
          return NextResponse.json(
            { error: 'Erro ao vincular usuario ao ministerio: ' + linkError.message },
            { status: 400 }
          )
        }
      }
    }

    // =========================================================
    // Gerar 12 cobranças no Asaas + persistir em payments
    // Operação não-bloqueante: erro aqui não cancela a efetivação
    // =========================================================
    const asaasKey = process.env.ASAAS_API_KEY
    if (asaasKey && ministryId) {
      try {
        const { data: planData } = await supabaseAdmin
          .from('subscription_plans')
          .select('id, price_monthly')
          .eq('slug', planFinal)
          .maybeSingle()

        const monthlyPrice = Number(planData?.price_monthly || 0)
        const subscriptionPlanId = planData?.id || null

        if (monthlyPrice > 0) {
          const ministryForAsaas = {
            id: ministryId,
            asaas_customer_id: existingMinistry?.asaas_customer_id || null,
            name: preReg.ministry_name,
            email_admin: preReg.email,
            cnpj_cpf: preReg.cpf_cnpj,
            phone: preReg.phone || null,
            whatsapp: preReg.whatsapp || null,
            address_street: preReg.address_street || null,
            address_number: preReg.address_number || null,
            address_complement: preReg.address_complement || null,
            address_city: preReg.address_city || null,
            address_zip: preReg.address_zip || null,
          }

          const customerId = await ensureAsaasCustomer(supabaseAdmin, ministryForAsaas)
          const installments = buildBillingInstallments(new Date(), monthlyPrice)

          for (let i = 0; i < installments.length; i++) {
            const inst = installments[i]
            const parcelLabel = inst.isProrated
              ? `Parcela 1/12 (proporcional)`
              : `Parcela ${i + 1}/12`
            const description = `${preReg.ministry_name} - ${planFinal} - ${parcelLabel}`

            const payment = await createAsaasPayment({
              customer: customerId,
              value: inst.amount,
              dueDate: inst.dueDate,
              description,
              billingType: 'BOLETO',
              externalReference: `${ministryId}_p${i + 1}`,
            })

            const periodEnd = (() => {
              const d = new Date(`${inst.dueDate}T00:00:00`)
              return `${d.getFullYear()}-${String(d.getMonth() + 2 > 12 ? 1 : d.getMonth() + 2).padStart(2, '0')}-09`
            })()

            await supabaseAdmin.from('payments').insert({
              ministry_id: ministryId,
              asaas_payment_id: payment.id,
              subscription_plan_id: subscriptionPlanId,
              amount: inst.amount,
              description,
              due_date: inst.dueDate,
              status: 'pending',
              period_start: inst.dueDate,
              period_end: periodEnd,
              asaas_response: payment,
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

    // Atualizar status em pre_registrations
    const { error: updateError } = await supabaseAdmin
      .from('pre_registrations')
      .update({ status: 'efetivado' })
      .eq('id', pre_registration_id)

    if (updateError) {
      console.warn('[APPROVE_TRIAL] Aviso ao atualizar status:', updateError)
      // Não falhar por isso
    }

    // Criar notificação para admin
    await supabaseAdmin
      .from('admin_notifications')
      .insert({
        type: 'trial_approved',
        title: `✅ Acesso Efetivado: ${preReg.ministry_name}`,
        message: `Ministério ${preReg.ministry_name} (Pastor: ${preReg.pastor_name}) foi efetivado no plano ${planFinal}. Vencimento: ${subEndDate.toLocaleDateString('pt-BR')}.`,
        is_read: false,
        created_at: new Date().toISOString(),
      })

    // Enviar email de confirmação de efetivação ao cliente
    const resendKey = process.env.RESEND_API_KEY
    const resendFrom = process.env.RESEND_FROM || 'noreply@gestaoservus.com.br'
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
              <title>Acesso Efetivado - GestaoServus</title>
            </head>
            <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
                      <tr>
                        <td style="background:#0f172a;color:#ffffff;padding:28px 32px;">
                          <h1 style="margin:0;font-size:22px;">Acesso Efetivado!</h1>
                          <p style="margin:8px 0 0;font-size:14px;color:#cbd5f5;">Sua assinatura esta ativa no GestaoServus.</p>
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
                            <p style="margin:0 0 4px;font-size:13px;color:#475569;">Valido ate: ${subEndDate.toLocaleDateString('pt-BR')}</p>
                            <p style="margin:0;font-size:13px;color:#475569;">Email de acesso: ${preReg.email}</p>
                          </div>
                          <a href="${appUrl}/login" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:bold;">Acessar o sistema</a>
                          <p style="margin:16px 0 0;font-size:12px;color:#64748b;">Suporte WhatsApp: <a href="https://wa.me/5591981755021" style="color:#2563eb;">(91) 98175-5021</a>.</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#f8fafc;color:#94a3b8;padding:16px 32px;font-size:11px;">
                          GestaoServus &copy; ${new Date().getFullYear()} - suporte@gestaoservus.com.br
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
          subject: 'Acesso Efetivado - GestaoServus',
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
    } else {
      console.warn('[APPROVE_TRIAL] RESEND_API_KEY ausente - email de efetivacao nao enviado')
    }

    console.log('[APPROVE_TRIAL] ✅ Usuário aprovado:', {
      user_id: preReg.user_id,
      email: preReg.email,
      ministry: preReg.ministry_name,
    })

    return NextResponse.json({
      success: true,
      message: 'Acesso liberado com sucesso! Usuário pode fazer login.',
      data: { ministry_id: ministryId },
      action: 'approved'
    }, { status: 201 })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
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
