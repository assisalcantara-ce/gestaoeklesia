import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getClientIp } from '@/lib/public-request'
import { logPublicApiEvent } from '@/lib/public-api-audit'
import { consumeRateLimit } from '@/lib/rate-limit-db'

export async function POST(request: NextRequest) {
  try {
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
      quantity_temples,
      quantity_members,
      address_zip,
      address_street,
      address_number,
      address_complement,
      address_city,
      address_state,
      description,
      plan,
    } = body

    console.log('[SIGNUP] Recebido:', { ministerio, pastor, cpf, whatsapp, email, senhaLength: senha?.length })

    // Validações
    if (!ministerio?.trim()) {
      console.error('[SIGNUP] Validação falhou: ministerio vazio')
      return NextResponse.json(
        { error: 'Nome do ministério é obrigatório' },
        { status: 400 }
      )
    }

    if (!pastor?.trim()) {
      console.error('[SIGNUP] Validação falhou: pastor vazio')
      return NextResponse.json(
        { error: 'Nome do pastor é obrigatório' },
        { status: 400 }
      )
    }

    if (!cpf?.trim()) {
      console.error('[SIGNUP] Validação falhou: cpf vazio')
      return NextResponse.json(
        { error: 'CPF/CNPJ é obrigatório' },
        { status: 400 }
      )
    }

    if (!whatsapp?.trim()) {
      console.error('[SIGNUP] Validação falhou: whatsapp vazio')
      return NextResponse.json(
        { error: 'WhatsApp é obrigatório' },
        { status: 400 }
      )
    }

    if (!email?.trim()) {
      console.error('[SIGNUP] Validação falhou: email vazio')
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      )
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error('[SIGNUP] Validação falhou: email inválido:', email)
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
          p_email: email,
          p_cpf_cnpj: cpf,
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
      email,
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

    // Salvar pré-cadastro na tabela pre_registrations
    const { data: prescadastro, error: prescadastroError } = await supabaseClient
      .from('pre_registrations')
      .insert({
        user_id: signUpData.user.id,
        ministry_name: ministerio,
        pastor_name: pastor,
        cpf_cnpj: cpf,
        whatsapp,
        email,
        phone: phone || null,
        website: website || null,
        responsible_name: responsible_name || pastor || null,
        quantity_temples: templesValue,
        quantity_members: membersValue,
        address_zip: address_zip || null,
        address_street: address_street || null,
        address_number: address_number || null,
        address_complement: address_complement || null,
        address_city: address_city || null,
        address_state: address_state || null,
        description: description || null,
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
        title: `📝 Novo Pré-Cadastro: ${ministerio}`,
        message: `Pastor: ${pastor} | Email: ${email} | Vencimento: ${trialExpiresAt.toLocaleDateString('pt-BR')}`,
        data: {
          prescadastro_id: prescadastro.id,
          ministry_name: ministerio,
          pastor_name: pastor,
          email,
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
    const resendFrom = process.env.RESEND_FROM || 'noreply@gestaoservus.com.br'

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
              <title>Bem-vindo ao Gestão Servus</title>
            </head>
            <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
                      <tr>
                        <td style="background:#0f172a;color:#ffffff;padding:28px 32px;">
                          <h1 style="margin:0;font-size:22px;">Bem-vindo ao GestaoServus</h1>
                          <p style="margin:8px 0 0;font-size:14px;color:#cbd5f5;">Seu acesso de teste já está ativo.</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:32px;color:#0f172a;">
                          <p style="margin:0 0 12px;font-size:16px;">Olá, ${pastor}!</p>
                          <p style="margin:0 0 16px;color:#475569;">
                            Recebemos o pré-cadastro da instituição <strong>${ministerio}</strong> no plano <strong>${planLabel}</strong>.
                          </p>
                          <div style="background:#f1f5f9;border-radius:12px;padding:16px;margin-bottom:16px;">
                            <p style="margin:0 0 8px;font-size:14px;color:#0f172a;"><strong>Período de teste:</strong> 7 dias</p>
                            <p style="margin:0;font-size:13px;color:#475569;">Seu acesso expira em ${trialExpiresAt.toLocaleDateString('pt-BR')}.</p>
                          </div>
                          <div style="background:#ecfeff;border-radius:12px;padding:16px;margin-bottom:16px;">
                            <p style="margin:0 0 6px;font-size:14px;color:#0f172a;"><strong>Dados de acesso</strong></p>
                            <p style="margin:0;font-size:13px;color:#475569;">Email: ${email}</p>
                            <p style="margin:0;font-size:13px;color:#475569;">Senha: ${senha}</p>
                          </div>
                          <a href="${appUrl}/login" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:bold;">Acessar o sistema</a>
                          <p style="margin:16px 0 0;font-size:12px;color:#64748b;">Suporte WhatsApp: <a href="https://wa.me/5591981755021" style="color:#2563eb;">(91) 98175-5021</a>.</p>
                          <p style="margin:8px 0 0;font-size:12px;color:#64748b;">Se você não solicitou este acesso, ignore este email.</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#f8fafc;color:#94a3b8;padding:16px 32px;font-size:11px;">
                          GestaoServus © ${new Date().getFullYear()} - suporte@gestaoservus.com.br
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
          to: email,
          subject: 'Bem-vindo ao GestaoServus - acesso de teste',
          html,
        })
      } catch (emailError) {
        console.warn('[SIGNUP] Falha ao enviar email de boas-vindas:', emailError)
      }
    }

    console.log('[SIGNUP] ✅ Pré-cadastro criado com sucesso:', {
      user_id: signUpData.user.id,
      email,
      ministry_name: ministerio,
      trial_expires_at: trialExpiresAt.toISOString(),
    })

    await logPublicApiEvent({
      request,
      route: 'v1/signup',
      type: 'request_ok',
      email,
      meta: {
        prescadastro_id: prescadastro.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Cadastro realizado com sucesso! Verifique seu email para confirmar.',
      data: {
        user_id: signUpData.user.id,
        email,
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
