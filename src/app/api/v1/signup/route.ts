import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { buildPasswordFingerprint } from '@/lib/password-fingerprint'
import { getClientIp } from '@/lib/public-request'
import { logPublicApiEvent } from '@/lib/public-api-audit'
import { consumeRateLimit } from '@/lib/rate-limit-db'

// ─── Helpers de log e erro ───────────────────────────────────────────────────

/** Mascara email para logs: joao@exemplo.com → j***@exemplo.com */
function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  if (!domain) return '***'
  return `${user.slice(0, 1)}***@${domain}`
}

/**
 * Mapeia erros do Supabase Auth para mensagens amigáveis em pt-BR.
 * Nunca expõe detalhes internos sensíveis ao cliente.
 */
function mapAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already exists'))
    return 'Este e-mail já possui uma conta. Tente fazer login ou recupere sua senha.'
  if (m.includes('invalid email') || m.includes('unable to validate email'))
    return 'E-mail inválido. Verifique e tente novamente.'
  if (m.includes('password should be') || m.includes('password is too short') || m.includes('weak password'))
    return 'Senha fraca. Use pelo menos 8 caracteres com letras e números.'
  if (m.includes('rate limit') || m.includes('too many requests'))
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (m.includes('network') || m.includes('fetch'))
    return 'Erro de conexão. Verifique sua internet e tente novamente.'
  if (m.includes('signup is disabled') || m.includes('signups not allowed'))
    return 'Cadastros temporariamente desativados. Entre em contato com o suporte.'
  // Retorna mensagem original sanitizada (sem stack trace — sem 's' flag para compatibilidade)
  return message.split('\n')[0].slice(0, 200)
}

/** Loga etapa do signup sem dados sensíveis */
function logStep(
  step: string,
  level: 'info' | 'warn' | 'error',
  meta: Record<string, unknown>,
) {
  const entry = { '[SIGNUP]': step, ...meta, ts: new Date().toISOString() }
  if (level === 'error') console.error(entry)
  else if (level === 'warn')  console.warn(entry)
  else                        console.log(entry)
}

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
      address_neighborhood,
      address_complement,
      address_city,
      address_state,
      description,
      plan,
      trial,
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
    const addressNeighborhood = upperText(address_neighborhood) || null
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

    // Bloquear reuso de senha entre usuarios
    let passwordFingerprint = ''
    try {
      passwordFingerprint = buildPasswordFingerprint(senha)
    } catch {
      return NextResponse.json(
        { error: 'Configuracao de senha nao definida. Contate o administrador.' },
        { status: 500 }
      )
    }

    const { data: existingFingerprint } = await supabaseAdmin
      .from('user_password_fingerprints')
      .select('user_id')
      .eq('fingerprint', passwordFingerprint)
      .maybeSingle()

    if (existingFingerprint?.user_id) {
      return NextResponse.json(
        { error: 'Senha ja utilizada por outro usuario. Escolha outra senha.' },
        { status: 400 }
      )
    }

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
      const rawMsg = signUpError?.message || 'Erro ao criar usuário'
      logStep('auth.signUp falhou', 'error', {
        email: maskEmail(emailValue),
        plan: plan ?? 'N/A',
        trial: trial,  // variável bruta do body (planLower/isTrialFlow ainda não declarados aqui)
        errorCode: (signUpError as any)?.code,
        errorStatus: (signUpError as any)?.status,
        errorMessage: rawMsg,
      })
      return NextResponse.json({ error: mapAuthError(rawMsg) }, { status: 400 })
    }

    const { error: fingerprintError } = await supabaseAdmin
      .from('user_password_fingerprints')
      .insert({ user_id: signUpData.user.id, fingerprint: passwordFingerprint })

    if (fingerprintError) {
      // ⚠️ Registro de fingerprint é best-effort.
      // A verificação de duplicidade já foi feita ANTES do signup.
      // Se a tabela estiver indisponível ou com RLS, logamos e continuamos
      // para não bloquear o cadastro por falha em sistema auxiliar de segurança.
      logStep('fingerprint.insert falhou (non-fatal)', 'warn', {
        email: maskEmail(emailValue),
        plan: plan ?? 'N/A',
        trial: trial,  // planValue/isTrialFlow ainda não declarados neste ponto
        userId: signUpData.user.id,
        errorCode: (fingerprintError as any)?.code,
        errorMessage: fingerprintError?.message,
        hint: (fingerprintError as any)?.hint,
        details: (fingerprintError as any)?.details,
      })
      // Não aborta — segue para criar ministério
    }

    // Calcular data de expiração do trial (7 dias)
    const trialExpiresAt = new Date()
    trialExpiresAt.setDate(trialExpiresAt.getDate() + 7)

    // Busca planos ativos para validar o plano enviado e obter o ID
    const { data: planosValidos } = await supabaseAdmin
      .from('subscription_plans')
      .select('id, slug')
      .eq('is_active', true)
    const planosList = (planosValidos || []) as { id: string; slug: string }[]
    const slugsValidos = new Set(planosList.map((p) => p.slug?.toLowerCase()).filter(Boolean))
    const planLower = typeof plan === 'string' ? plan.toLowerCase() : ''
    const isTrialFlow = trial === true || trial === 'true'

    // Segurança: fluxo de teste gratuito (trial=true) sempre usa Starter.
    // Impede manipulação de ?plan=profissional no fluxo de teste grátis.
    const planValue = isTrialFlow
      ? 'starter'
      : (slugsValidos.has(planLower)
          ? planLower
          : (slugsValidos.size > 0 ? [...slugsValidos][0] : 'basic'))
    const planRow = planosList.find((p) => p.slug?.toLowerCase() === planValue) || null

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
        address_neighborhood: addressNeighborhood,
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
      logStep('pre_registrations.insert falhou', 'error', {
        email: maskEmail(emailValue),
        plan: planValue,
        trial: isTrialFlow,
        userId: signUpData.user?.id,
        errorCode: (prescadastroError as any)?.code,
        errorMessage: prescadastroError?.message,
      })

      const pgCode = (prescadastroError as any)?.code
      if (pgCode === '23505' && signUpData.user?.id) {
        try { await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id) } catch { /* best-effort */ }
        return NextResponse.json(
          { error: 'Já existe um pré-cadastro em andamento com este e-mail ou CPF/CNPJ. Verifique seu e-mail ou entre em contato com o suporte.' },
          { status: 409 }
        )
      }

      try { await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id) } catch { /* best-effort */ }
      return NextResponse.json(
        { error: `Erro ao salvar pré-cadastro (PRECAD_SAVE_FAILED). ${prescadastroError?.message || ''}`.trim() },
        { status: 400 }
      )
    }

    // =========================================================
    // Criar ministério + vínculo do usuário para acesso imediato
    // =========================================================
    const buildSlug = (base: string, suffix?: string) => {
      const slugBase = String(base || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 70)
      return (slugBase || 'ministerio') + (suffix ? `-${suffix}` : '')
    }

    // Garante unicidade do slug
    let ministrySlug = buildSlug(ministryName)
    const { data: slugConflict } = await supabaseAdmin
      .from('ministries')
      .select('id')
      .eq('slug', ministrySlug)
      .maybeSingle()
    if (slugConflict) {
      ministrySlug = buildSlug(ministryName, Date.now().toString().slice(-6))
    }

    const { data: ministry, error: ministryError } = await supabaseAdmin
      .from('ministries')
      .insert({
        user_id: signUpData.user.id,
        name: ministryName,
        slug: ministrySlug,
        email_admin: emailValue,
        cnpj_cpf: cpfCnpj || null,
        phone: phoneValue,
        whatsapp: whatsappNumber || null,
        website: websiteValue,
        responsible_name: responsibleName,
        description: descriptionValue,
        address_street: addressStreet,
        address_number: addressNumber,
        address_complement: addressComplement,
        address_city: addressCity,
        address_state: addressState,
        address_zip: addressZip,
        plan: planValue,
        subscription_plan_id: planRow?.id || null,
        subscription_status: 'trial',
        subscription_start_date: new Date().toISOString(),
        subscription_end_date: trialExpiresAt.toISOString(),
        is_active: true,
      })
      .select('id')
      .single()

    if (ministryError || !ministry) {
      logStep('ministries.insert falhou — rollback iniciado', 'error', {
        email: maskEmail(emailValue),
        plan: planValue,
        trial: isTrialFlow,
        userId: signUpData.user?.id,
        errorCode: (ministryError as any)?.code,
        errorMessage: ministryError?.message,
      })
      try { await supabaseAdmin.from('pre_registrations').delete().eq('id', prescadastro.id) } catch { /* best-effort */ }
      try { await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id) } catch { /* best-effort */ }
      return NextResponse.json(
        { error: 'Não foi possível configurar o ambiente da sua igreja (MINISTRY_CREATE_FAILED). Tente novamente ou entre em contato com o suporte.' },
        { status: 400 }
      )
    }

    const { error: muError } = await supabaseAdmin
      .from('ministry_users')
      .insert({
        ministry_id: ministry.id,
        user_id: signUpData.user.id,
        role: 'admin',
        permissions: ['ADMINISTRADOR'],
        is_active: true,
      })

    if (muError) {
      logStep('ministry_users.insert falhou — rollback iniciado', 'error', {
        email: maskEmail(emailValue),
        plan: planValue,
        trial: isTrialFlow,
        userId: signUpData.user?.id,
        ministryId: ministry.id,
        errorCode: (muError as any)?.code,
        errorMessage: muError?.message,
      })
      try { await supabaseAdmin.from('ministries').delete().eq('id', ministry.id) } catch { /* best-effort */ }
      try { await supabaseAdmin.from('pre_registrations').delete().eq('id', prescadastro.id) } catch { /* best-effort */ }
      try { await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id) } catch { /* best-effort */ }
      return NextResponse.json(
        { error: 'Não foi possível configurar as permissões de acesso (PERM_CREATE_FAILED). Tente novamente ou entre em contato com o suporte.' },
        { status: 400 }
      )
    }

    logStep('trial_created', 'info', {
      email: maskEmail(emailValue),
      ministryId: ministry.id,
      slug: ministrySlug,
      plan: planValue,
      trial: isTrialFlow,
      trialExpiresAt: trialExpiresAt.toISOString(),
    })
    logStep('admin_user_created', 'info', {
      email: maskEmail(emailValue),
      ministryId: ministry.id,
      userId: signUpData.user.id,
    })

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

    const loginUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.gestaoeklesia.com.br'
    const resendKey = process.env.RESEND_API_KEY
    const resendFrom = process.env.RESEND_FROM || 'noreply@gestaoeklesia.com.br'
    let emailSent = false

    if (resendKey) {
      try {
        const resend = new Resend(resendKey)
        const planLabel = planValue.charAt(0).toUpperCase() + planValue.slice(1)
        const emailSubject = isTrialFlow
          ? 'Gestão Eklesia | Seu teste grátis está ativo!'
          : 'Gestão Eklesia | Pré-cadastro confirmado'
        const emailHeadline = isTrialFlow
          ? 'Teste grátis ativo — acesse agora!'
          : 'Pré-cadastro confirmado'
        const emailSubheadline = isTrialFlow
          ? 'Seu painel já está disponível. Use o e-mail e a senha cadastrados.'
          : 'Recebemos seus dados e entraremos em contato em breve.'
        const html = `
          <!DOCTYPE html>
          <html lang="pt-BR">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>Pré-cadastro confirmado</title>
            </head>
            <body style="margin:0;padding:0;background:#f6f2ea;font-family:Arial,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f2ea;padding:24px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 30px rgba(31,27,22,0.12);">
                      <tr>
                        <td style="background:#0f766e;color:#ffffff;padding:28px 32px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="width:48px;padding-right:12px;">
                                <img src="https://www.gestaoeklesia.com.br/img/logo-eklesia.png" alt="Gestao Eklesia" width="40" height="40" style="display:block;border-radius:8px;" />
                              </td>
                              <td>
                                <h1 style="margin:0;font-size:22px;">${emailHeadline}</h1>
                                <p style="margin:8px 0 0;font-size:14px;color:#d1fae5;">${emailSubheadline}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:32px;color:#1f1b16;">
                          <p style="margin:0 0 12px;font-size:16px;">Olá, ${pastorName}!</p>
                          <p style="margin:0 0 16px;color:#5f6b66;">
                            ${isTrialFlow ? `Seu acesso trial da igreja/ministério <strong>${ministryName}</strong> no plano <strong>${planLabel}</strong> está ativo!` : `Recebemos o pré-cadastro da igreja/ministério <strong>${ministryName}</strong> no plano <strong>${planLabel}</strong>.`}
                          </p>
                          <div style="background:#f3f4f1;border-radius:12px;padding:16px;margin-bottom:16px;">
                            <p style="margin:0 0 8px;font-size:14px;color:#1f1b16;"><strong>Período de teste:</strong> 7 dias</p>
                            <p style="margin:0;font-size:13px;color:#5f6b66;">Seu acesso expira em ${trialExpiresAt.toLocaleDateString('pt-BR')}.</p>
                          </div>
                          <div style="background:#ecfdf5;border-radius:12px;padding:16px;margin-bottom:16px;">
                            <p style="margin:0 0 6px;font-size:14px;color:#1f1b16;"><strong>Dados de acesso</strong></p>
                            <p style="margin:0;font-size:13px;color:#5f6b66;">Email: ${emailValue}</p>
                            <p style="margin:4px 0 0;font-size:13px;color:#5f6b66;">Use o email e a senha cadastrados para acessar o sistema.</p>
                          </div>
                          <a href="${loginUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:bold;">Acessar o sistema</a>
                          <p style="margin:8px 0 0;font-size:12px;color:#5f6b66;">Se você não solicitou este acesso, ignore este email.</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#f3f4f1;color:#7a857f;padding:16px 32px;font-size:11px;">
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
          subject: emailSubject,
          html,
        })
        emailSent = true
        logStep('welcome_email_sent', 'info', {
          email: maskEmail(emailValue),
          plan: planValue,
          trial: isTrialFlow,
          subject: emailSubject,
        })
      } catch (emailError: any) {
        logStep('welcome_email_failed', 'warn', {
          email: maskEmail(emailValue),
          plan: planValue,
          trial: isTrialFlow,
          errorMessage: emailError?.message,
          errorStatus: emailError?.statusCode,
          from: resendFrom,
        })
      }
    } else {
      logStep('welcome_email_failed', 'warn', {
        reason: 'RESEND_API_KEY_NOT_SET',
        plan: planValue,
        trial: isTrialFlow,
      })
    }

    logStep('signup_success', 'info', {
      email: maskEmail(emailValue),
      ministryId: ministry.id,
      plan: planValue,
      trial: isTrialFlow,
      emailSent,
      trialExpiresAt: trialExpiresAt.toISOString(),
    })

    await logPublicApiEvent({
      request,
      route: 'v1/signup',
      type: 'request_ok',
      email: emailValue,
      meta: {
        prescadastro_id: prescadastro.id,
        is_trial: isTrialFlow,
        email_sent: emailSent,
      },
    })

    return NextResponse.json({
      success: true,
      message: isTrialFlow
        ? 'Teste grátis ativado! Acesse o sistema com o e-mail e senha cadastrados.'
        : 'Cadastro realizado com sucesso! Nosso time entrará em contato.',
      data: {
        user_id: signUpData.user.id,
        email: emailValue,
        trial_expires_at: trialExpiresAt.toISOString(),
        trial_days: 7,
        is_trial: isTrialFlow,
        email_sent: emailSent,
        plan: planValue,
        login_url: loginUrl,
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
