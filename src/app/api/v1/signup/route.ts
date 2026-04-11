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

    const ip = getClientIp(request)
    const limit = Number(process.env.PUBLIC_RATE_LIMIT_SIGNUP_PER_10MIN || 5)
    const windowMs = 10 * 60 * 1000
    const rate = await consumeRateLimit({ bucketKey: `v1/signup:${ip}`, limit, windowMs })
    if (!rate.allowed) {
      await logPublicApiEvent({
        request,
        route: 'v1/signup',
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
      senha,
      phone,
      website,
      responsible_name,
      address_zip,
      address_street,
      address_number,
      address_complement,
      address_city,
      address_state,
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
    const addressZip = onlyDigits(address_zip) || null
    const addressStreet = upperText(address_street) || null
    const addressNumber = upperText(address_number) || null
    const addressComplement = upperText(address_complement) || null
    const addressCity = upperText(address_city) || null
    const addressState = upperText(address_state) || null
    const descriptionValue = upperText(description) || null

    console.log('[SIGNUP] Recebido:', {
      ministerio: ministryName,
      pastor: pastorName,
      cpf: cpfCnpj,
      whatsapp: whatsappNumber,
      email: emailValue,
      senhaLength: senha?.length,
    })

    // Validações
    if (!ministryName) {
      console.error('[SIGNUP] Validação falhou: ministerio vazio')
      return NextResponse.json(
        { error: 'Nome do ministério é obrigatório' },
        { status: 400 }
      )
    }

    if (!pastorName) {
      console.error('[SIGNUP] Validação falhou: pastor vazio')
      return NextResponse.json(
        { error: 'Nome do pastor é obrigatório' },
        { status: 400 }
      )
    }

    if (!cpfCnpj) {
      console.error('[SIGNUP] Validação falhou: cpf vazio')
      return NextResponse.json(
        { error: 'CPF/CNPJ é obrigatório' },
        { status: 400 }
      )
    }

    if (!whatsappNumber) {
      console.error('[SIGNUP] Validação falhou: whatsapp vazio')
      return NextResponse.json(
        { error: 'WhatsApp é obrigatório' },
        { status: 400 }
      )
    }

    if (!emailValue) {
      console.error('[SIGNUP] Validação falhou: email vazio')
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      )
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      console.error('[SIGNUP] Validação falhou: email inválido:', emailValue)
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      )
    }

    if (!senha?.trim() || senha.length < 6) {
      console.error('[SIGNUP] Validação falhou: senha < 6 chars')
      return NextResponse.json(
        { error: 'Senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      )
    }

    // Criar cliente Supabase normal (anon)
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )

    // Cliente admin (service_role) apenas para checagens/limpeza no servidor
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Checagem rápida (case-insensitive / cpf digits-only) para evitar criar usuário órfão
    try {
      const { data: dupData, error: dupError } = await supabaseAdmin.rpc(
        'check_pre_registration_duplicate',
        {
          p_email: emailValue,
          p_cpf_cnpj: cpfCnpj,
        }
      )

      const hasConflict =
        !dupError &&
        (dupData?.conflict === true ||
          (typeof (dupData as any)?.field === 'string' && String((dupData as any).field).length > 0))

      if (hasConflict) {
        const field = String(dupData.field || '')
        const msg =
          field === 'cpf_cnpj'
            ? 'Já existe um pré-cadastro em andamento para este CPF/CNPJ.'
            : 'Já existe um pré-cadastro em andamento para este email.'

        return NextResponse.json(
          { error: msg },
          { status: 409 }
        )
      }
    } catch {
      // Se RPC não existir (rollout) ou falhar, seguimos e deixamos o banco validar.
    }

    // Criar usuário no Supabase Auth via signup (sem service_role)
    const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
      email: emailValue,
      password: senha,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
      },
    })

    if (signUpError || !signUpData.user) {
      console.error('[SIGNUP] Erro no signup:', signUpError)

      // Tratamento específico para email já registrado
      const message = signUpError?.message || 'Erro ao criar usuário'
      if (message.toLowerCase().includes('already') || message.toLowerCase().includes('registered')) {
        return NextResponse.json(
          { error: 'Este email já foi registrado. Faça login ou use outro email.' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: message },
        { status: 400 }
      )
    }

    // Calcular data de expiração do trial (7 dias)
    const trialExpiresAt = new Date()
    trialExpiresAt.setDate(trialExpiresAt.getDate() + 7)

    // Busca slugs ativos no banco para validar o plano enviado
    const { data: planosValidos } = await supabaseAdmin
      .from('subscription_plans')
      .select('slug')
      .eq('is_active', true)
    const slugsValidos = new Set(
      (planosValidos || []).map((p: any) => (p.slug as string)?.toLowerCase()).filter(Boolean)
    )
    const planLower = typeof plan === 'string' ? plan.toLowerCase() : ''
    const planValue = slugsValidos.has(planLower)
      ? planLower
      : (slugsValidos.size > 0 ? [...slugsValidos][0] : 'basic')

    // Salvar pré-cadastro na tabela pre_registrations
    const { data: prescadastro, error: prescadastroError } = await supabaseClient
      .from('pre_registrations')
      .insert({
        user_id: signUpData.user.id,
        ministry_name: ministryName,
        pastor_name: pastorName,
        cpf_cnpj: cpfCnpj,
        whatsapp: whatsappNumber,
        email: emailValue,
        phone: phoneValue,
        website: websiteValue,
        responsible_name: responsibleName,
        address_zip: addressZip,
        address_street: addressStreet,
        address_number: addressNumber,
        address_complement: addressComplement,
        address_city: addressCity,
        address_state: addressState,
        description: descriptionValue,
        plan: planValue,
        trial_expires_at: trialExpiresAt.toISOString(),
        trial_days: 7,
        status: 'trial',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (prescadastroError) {
      console.error('[SIGNUP] Erro ao salvar pré-cadastro:', prescadastroError)

      // Se o banco bloqueou por duplicidade, tentar limpar o user recém-criado
      const pgCode = (prescadastroError as any)?.code
      if (pgCode === '23505' && signUpData.user?.id) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id)
        } catch {
          // best-effort
        }

        return NextResponse.json(
          { error: 'Já existe um pré-cadastro em andamento com este email/CPF/CNPJ.' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: 'Erro ao completar cadastro: ' + (prescadastroError?.message || 'desconhecido') },
        { status: 400 }
      )
    }

    // Criar notificação para o admin
    const { error: notificationError } = await supabaseClient
      .from('admin_notifications')
      .insert({
        admin_id: null, // Notificação para todos os admins
        type: 'new_trial_signup',
        title: `📝 Novo Pré-Cadastro: ${ministryName}`,
        message: `Pastor: ${pastorName} | Email: ${emailValue} | Vencimento: ${trialExpiresAt.toLocaleDateString('pt-BR')}`,
        data: {
          prescadastro_id: prescadastro.id,
          ministry_name: ministryName,
          pastor_name: pastorName,
          email: emailValue,
          trial_expires_at: trialExpiresAt.toISOString(),
        },
        is_read: false,
        created_at: new Date().toISOString(),
      })

    if (notificationError) {
      console.warn('[SIGNUP] Erro ao criar notificação (não-crítico):', notificationError)
      // Não falhar se notificação não funcionar
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const resendKey = process.env.RESEND_API_KEY
    const resendFrom = process.env.RESEND_FROM || 'noreply@gestaoeklesia.com.br'

    if (resendKey) {
      try {
        const resend = new Resend(resendKey)
        const planLabel = planValue.charAt(0).toUpperCase() + planValue.slice(1)
        const html = `
          <!DOCTYPE html>
          <html lang="pt-BR">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>Bem-vindo ao Gestão Eklesia</title>
            </head>
            <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
                      <tr>
                        <td style="background:#0f172a;color:#ffffff;padding:28px 32px;">
                          <h1 style="margin:0;font-size:22px;">Bem-vindo ao Gestão Eklesia</h1>
                          <p style="margin:8px 0 0;font-size:14px;color:#cbd5f5;">Seu acesso de teste já está ativo.</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:32px;color:#0f172a;">
                          <p style="margin:0 0 12px;font-size:16px;">Olá, ${pastorName}!</p>
                          <p style="margin:0 0 16px;color:#475569;">
                            Recebemos o pré-cadastro da instituição <strong>${ministryName}</strong> no plano <strong>${planLabel}</strong>.
                          </p>
                          <div style="background:#f1f5f9;border-radius:12px;padding:16px;margin-bottom:16px;">
                            <p style="margin:0 0 8px;font-size:14px;color:#0f172a;"><strong>Período de teste:</strong> 7 dias</p>
                            <p style="margin:0;font-size:13px;color:#475569;">Seu acesso expira em ${trialExpiresAt.toLocaleDateString('pt-BR')}.</p>
                          </div>
                          <div style="background:#ecfeff;border-radius:12px;padding:16px;margin-bottom:16px;">
                            <p style="margin:0 0 6px;font-size:14px;color:#0f172a;"><strong>Dados de acesso</strong></p>
                            <p style="margin:0;font-size:13px;color:#475569;">Email: ${emailValue}</p>
                            <p style="margin:4px 0 0;font-size:13px;color:#475569;">Use o email e a senha que você cadastrou para acessar o sistema.</p>
                          </div>
                          <a href="${appUrl}/login" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:bold;">Acessar o sistema</a>
                          <p style="margin:16px 0 0;font-size:12px;color:#64748b;">Suporte WhatsApp: <a href="https://wa.me/5591981755021" style="color:#2563eb;">(91) 98175-5021</a>.</p>
                          <p style="margin:8px 0 0;font-size:12px;color:#64748b;">Se você não solicitou este acesso, ignore este email.</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#f8fafc;color:#94a3b8;padding:16px 32px;font-size:11px;">
                          Gestão Eklesia © ${new Date().getFullYear()} - suporte@gestaoeklesia.com.br
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
          to: emailValue,
          subject: 'Bem-vindo ao Gestão Eklesia - acesso de teste',
          html,
        })
        console.log('[SIGNUP] ✅ Email enviado para:', emailValue)
      } catch (emailError: any) {
        console.warn('[SIGNUP] Falha ao enviar email de boas-vindas:', {
          message: emailError?.message,
          statusCode: emailError?.statusCode,
          name: emailError?.name,
          from: resendFrom,
          to: emailValue,
        })
      }
    } else {
      console.warn('[SIGNUP] RESEND_API_KEY não configurado — email não enviado.')
    }

    console.log('[SIGNUP] ✅ Pré-cadastro criado com sucesso:', {
      user_id: signUpData.user.id,
      email: emailValue,
      ministry_name: ministryName,
      trial_expires_at: trialExpiresAt.toISOString(),
    })

    await logPublicApiEvent({
      request,
      route: 'v1/signup',
      type: 'request_ok',
      email: emailValue,
      meta: {
        prescadastro_id: prescadastro.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Cadastro realizado com sucesso! Verifique seu email para confirmar.',
      data: {
        user_id: signUpData.user.id,
        email: emailValue,
        trial_expires_at: trialExpiresAt.toISOString(),
        trial_days: 7,
      },
    }, { status: 201 })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[SIGNUP] Erro geral:', {
      message: errorMessage,
      error: error,
      stack: error instanceof Error ? error.stack : undefined,
    })

    try {
      await logPublicApiEvent({
        request,
        route: 'v1/signup',
        type: 'request_error',
        meta: {
          error: errorMessage,
        },
      })
    } catch {
      // ignore
    }

    return NextResponse.json(
      { error: 'Erro ao processar cadastro: ' + errorMessage },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
}
