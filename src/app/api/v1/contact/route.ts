import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getClientIp } from '@/lib/public-request'
import { logPublicApiEvent } from '@/lib/public-api-audit'
import { consumeRateLimit } from '@/lib/rate-limit-db'

export async function POST(request: NextRequest) {
  try {
    const upperText = (value?: string | null) => value?.trim().toUpperCase() || ''
    const lowerText = (value?: string | null) => value?.trim().toLowerCase() || ''
    const onlyDigits = (value?: string | null) => value?.replace(/\D/g, '') || ''

    const buildTicketNumber = () => `LND-${Date.now().toString(36).toUpperCase()}`
    const ip = getClientIp(request)
    const limit = Number(process.env.PUBLIC_RATE_LIMIT_CONTACT_PER_10MIN || 10)
    const windowMs = 10 * 60 * 1000
    const rate = await consumeRateLimit({ bucketKey: `v1/contact:${ip}`, limit, windowMs })
    if (!rate.allowed) {
      await logPublicApiEvent({
        request,
        route: 'v1/contact',
        type: 'rate_limited',
        meta: {
          limit,
          windowMs,
          source: rate.source,
          retryAfterSeconds: rate.retryAfterSeconds,
        },
      })

      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rate.retryAfterSeconds),
          },
        }
      )
    }

    const body = await request.json()
    const {
      ministerio,
      pastor,
      cpf,
      whatsapp,
      email,
      phone,
      website,
      responsible_name,
      quantity_temples,
      quantity_members,
      address_street,
      address_number,
      address_complement,
      address_city,
      address_state,
      address_zip,
      description,
      plan,
    } = body

    const ministryName = upperText(ministerio)
    const pastorName = upperText(pastor)
    const cpfCnpj = onlyDigits(cpf)
    const whatsappNumber = onlyDigits(whatsapp)
    const emailValue = lowerText(email)
    const phoneValue = onlyDigits(phone) || null
    const websiteValue = lowerText(website) || null
    const responsibleName = upperText(responsible_name) || pastorName || null
    const addressStreet = upperText(address_street) || null
    const addressNumber = upperText(address_number) || null
    const addressComplement = upperText(address_complement) || null
    const addressCity = upperText(address_city) || null
    const addressState = upperText(address_state) || null
    const addressZip = onlyDigits(address_zip) || null
    const descriptionValue = upperText(description) || null

    console.log('[CONTACT] Recebido:', {
      ministerio: ministryName,
      pastor: pastorName,
      cpf: cpfCnpj,
      whatsapp: whatsappNumber,
      email: emailValue,
    })

    // Validações básicas
    if (!ministryName) {
      return NextResponse.json(
        { error: 'Nome do ministério é obrigatório' },
        { status: 400 }
      )
    }

    if (!pastorName) {
      return NextResponse.json(
        { error: 'Nome do pastor é obrigatório' },
        { status: 400 }
      )
    }

    if (!cpfCnpj) {
      return NextResponse.json(
        { error: 'CPF/CNPJ é obrigatório' },
        { status: 400 }
      )
    }

    if (!whatsappNumber) {
      return NextResponse.json(
        { error: 'WhatsApp é obrigatório' },
        { status: 400 }
      )
    }

    if (!emailValue) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      )
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      )
    }

    // Criar cliente Supabase
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )

    // Cliente admin (service_role) apenas para checagem de duplicidade no servidor
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Checagem de duplicidade pelo e-mail para tratamento de reenvio amigável
    try {
      const { data: existing } = await supabaseAdmin
        .from('pre_registrations')
        .select('id, status, trial_activation_token, email, ministry_name, pastor_name')
        .eq('email', emailValue)
        .maybeSingle()

      if (existing && ['trial', 'pending', 'new'].includes(existing.status || '')) {
        // Lead já existe mas ainda não ativou a conta — reenviar link de ativação
        const resendKey  = process.env.RESEND_API_KEY
        const resendFrom = process.env.RESEND_FROM || 'noreply@gestaoeklesia.com.br'
        const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL || 'https://gestaoeklesia.com.br'

        // Garantir que o token existe; gerar um novo se necessário
        let activationToken = existing.trial_activation_token
        if (!activationToken) {
          activationToken = crypto.randomUUID()
          await supabaseAdmin
            .from('pre_registrations')
            .update({ trial_activation_token: activationToken })
            .eq('id', existing.id)
        }

        if (resendKey) {
          const activationLink = `${siteUrl}/pre-cadastro?plan=starter&trial=true&lead_id=${existing.id}&token=${activationToken}`
          const resend = new Resend(resendKey)
          const pastorName = existing.pastor_name || emailValue
          await resend.emails.send({
            from: resendFrom,
            to: existing.email,
            subject: 'Seu acesso ao Gestão Eklésia está liberado! 🎉',
            html: buildTrialEmail({ pastorName, activationLink }),
          }).catch(e => console.warn('[CONTACT] Resend re-send error:', e))
        }

        return NextResponse.json(
          {
            success: true,
            resent: true,
            message: 'Reenviamos o link de ativação para o seu e-mail!',
          },
          { status: 200 }
        )
      }

      // Verificar duplicidade de CPF/CNPJ
      const { data: dupCpf } = await supabaseAdmin
        .from('pre_registrations')
        .select('id')
        .eq('cpf_cnpj', cpfCnpj)
        .maybeSingle()

      if (dupCpf) {
        return NextResponse.json(
          { error: 'Já existe um pré-cadastro em andamento para este CPF/CNPJ.' },
          { status: 409 }
        )
      }
    } catch {
      // ignore
    }

    const allowedPlans = new Set(['starter', 'intermediario', 'profissional', 'expert'])
    const planValue = typeof plan === 'string' && allowedPlans.has(plan.toLowerCase())
      ? plan.toLowerCase()
      : 'starter'

    const templesValue = Number.isFinite(Number(quantity_temples))
      ? Number(quantity_temples)
      : 1
    const membersValue = Number.isFinite(Number(quantity_members))
      ? Number(quantity_members)
      : 0

    // Gerar token seguro de ativação do trial
    const activationToken = crypto.randomUUID()

    // Salvar solicitação de contato em pre_registrations
    const { data: contact, error: contactError } = await supabaseClient
      .from('pre_registrations')
      .insert({
        user_id: null,
        ministry_name: ministryName,
        pastor_name: pastorName,
        cpf_cnpj: cpfCnpj,
        whatsapp: whatsappNumber,
        email: emailValue,
        phone: phoneValue,
        website: websiteValue,
        responsible_name: responsibleName,
        quantity_temples: templesValue,
        quantity_members: membersValue,
        address_street: addressStreet,
        address_number: addressNumber,
        address_complement: addressComplement,
        address_city: addressCity,
        address_state: addressState,
        address_zip: addressZip,
        description: descriptionValue,
        plan: planValue,
        trial_expires_at: new Date().toISOString(),
        trial_days: 0,
        status: 'trial',
        trial_activation_token: activationToken,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (contactError) {
      console.error('[CONTACT] Erro ao salvar contato:', contactError)

      const pgCode = (contactError as any)?.code
      if (pgCode === '23505') {
        return NextResponse.json(
          { error: 'Já existe um pré-cadastro em andamento com este email/CPF/CNPJ.' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: 'Erro ao registrar contato: ' + (contactError?.message || 'desconhecido') },
        { status: 400 }
      )
    }

    console.log('[CONTACT] Contato registrado com sucesso:', contact.id)

    await logPublicApiEvent({
      request,
      route: 'v1/contact',
      type: 'request_ok',
      email: emailValue,
      meta: {
        contact_id: contact.id,
      },
    })

    const landingTicketNumber = buildTicketNumber()
    const landingDescription = descriptionValue
      ? descriptionValue
      : 'Solicitação de contato recebida pela landing page.'

    const { error: landingTicketError } = await supabaseAdmin
      .from('support_tickets_landing')
      .insert({
        ticket_number: landingTicketNumber,
        institution_name: ministryName,
        contact_name: responsibleName || pastorName,
        email: emailValue,
        whatsapp: whatsappNumber,
        description: landingDescription,
        status: 'open',
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

    if (landingTicketError) {
      console.warn('[CONTACT] Aviso ao criar ticket landing:', landingTicketError)
      // Não falha o request por causa disso
    }

    // Criar notificação para o admin
    const { error: notificationError } = await supabaseClient
      .from('admin_notifications')
      .insert({
        admin_id: null, // Notificação para todos os admins
        type: 'new_contact_request',
        title: `📝 Nova Solicitação de Contato: ${ministryName}`,
        message: `Pastor: ${pastorName} | Email: ${emailValue} | WhatsApp: ${whatsappNumber} | Plano: ${planValue}`,
        data: {
          contact_id: contact.id,
          ministry_name: ministryName,
          pastor_name: pastorName,
          cpf_cnpj: cpfCnpj,
          email: emailValue,
          whatsapp: whatsappNumber,
          plan: planValue,
        },
        is_read: false,
        created_at: new Date().toISOString(),
      })

    if (notificationError) {
      console.warn('[CONTACT] Aviso ao criar notificação:', notificationError)
      // Não falha o request por causa disso
    }

    // Enviar e-mail de ativação do trial via Resend
    const resendKey  = process.env.RESEND_API_KEY
    const resendFrom = process.env.RESEND_FROM || 'noreply@gestaoeklesia.com.br'
    const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL || 'https://gestaoeklesia.com.br'
    let emailSent = false

    if (resendKey) {
      try {
        const activationLink = `${siteUrl}/pre-cadastro?plan=starter&trial=true&lead_id=${contact.id}&token=${activationToken}`
        const resend = new Resend(resendKey)
        await resend.emails.send({
          from: resendFrom,
          to: emailValue,
          subject: 'Seu acesso ao Gestão Eklésia está liberado! 🎉',
          html: buildTrialEmail({ pastorName, activationLink }),
        })
        emailSent = true
      } catch (emailErr) {
        console.warn('[CONTACT] Resend error:', emailErr)
      }
    }

    // Resposta de sucesso
    return NextResponse.json(
      {
        success: true,
        message: 'Solicitação de contato registrada com sucesso',
        email_sent: emailSent,
        data: {
          id: contact.id,
          email: contact.email,
          ministerio: contact.ministry_name,
        }
      },
      { status: 201 }
    )

  } catch (error: any) {
    console.error('[CONTACT] Erro geral:', error)

    try {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await logPublicApiEvent({
        request,
        route: 'v1/contact',
        type: 'request_error',
        meta: {
          error: errorMessage,
        },
      })
    } catch {
      // ignore
    }

    return NextResponse.json(
      { error: 'Erro ao processar solicitação. Tente novamente.' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// E-mail template helpers
// ---------------------------------------------------------------------------

function buildTrialEmail({
  pastorName,
  activationLink,
}: {
  pastorName: string
  activationLink: string
}): string {
  const firstName = pastorName.split(' ')[0]
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Seu teste grátis do Gestão Eklésia está pronto</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,0.10);max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#064e3b 0%,#065f46 100%);padding:32px 40px;text-align:center;">
            <p style="margin:0 0 8px;font-size:12px;color:#6ee7b7;letter-spacing:0.2em;text-transform:uppercase;">Gestão Eklésia</p>
            <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;line-height:1.3;">Seu acesso está liberado! 🎉</h1>
            <p style="margin:10px 0 0;font-size:14px;color:#a7f3d0;">O ambiente de testes da sua igreja já está reservado.</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;color:#1e293b;">
            <p style="margin:0 0 16px;font-size:16px;">Olá, <strong>${firstName}</strong>!</p>
            <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
              Excelente decisão! O ambiente de testes para a sua igreja já está reservado no <strong>Gestão Eklésia</strong>.
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
              Você tem <strong>7 dias grátis</strong> de acesso ilimitado para conhecer na prática todas as ferramentas que vão revolucionar a organização e o dia a dia do seu ministério.
            </p>

            <!-- CTA -->
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 28px;">
              <tr>
                <td style="border-radius:10px;background:#059669;">
                  <a href="${activationLink}"
                     style="display:inline-block;padding:15px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
                    Iniciar meu teste grátis →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Features -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0fdf4;border-radius:12px;padding:4px;margin-bottom:24px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#064e3b;">O que você pode testar gratuitamente:</p>
                  <p style="margin:0 0 6px;font-size:13px;color:#374151;">✅ Gestão completa de membros e congregações</p>
                  <p style="margin:0 0 6px;font-size:13px;color:#374151;">✅ Módulo financeiro e tesouraria</p>
                  <p style="margin:0 0 6px;font-size:13px;color:#374151;">✅ Agenda e planejamento ministerial</p>
                  <p style="margin:0 0 6px;font-size:13px;color:#374151;">✅ Relatórios espirituais e cultos</p>
                  <p style="margin:0;font-size:13px;color:#374151;">✅ Escola Bíblica Dominical (EBD)</p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;font-size:13px;color:#64748b;">
              Precisa de ajuda para começar? Nossa equipe está disponível:
            </p>
            <p style="margin:0;font-size:13px;color:#374151;">
              📱 WhatsApp: <a href="https://wa.me/5585991823050" style="color:#059669;text-decoration:none;font-weight:600;">(85) 99182-3050</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;">
              Gestão Eklésia · Sistema de Gestão Ministerial
            </p>
            <p style="margin:0;font-size:11px;color:#cbd5e1;">
              Se você não solicitou este e-mail, pode ignorá-lo com segurança.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
