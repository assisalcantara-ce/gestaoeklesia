import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClientIp } from '@/lib/public-request'
import { logPublicApiEvent } from '@/lib/public-api-audit'
import { consumeRateLimit } from '@/lib/rate-limit-db'

export async function POST(request: NextRequest) {
  try {
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
    const { ministerio, pastor, cpf, whatsapp, email } = body

    console.log('[CONTACT] Recebido:', { ministerio, pastor, cpf, whatsapp, email })

    // Validações básicas
    if (!ministerio?.trim()) {
      return NextResponse.json(
        { error: 'Nome do ministério é obrigatório' },
        { status: 400 }
      )
    }

    if (!pastor?.trim()) {
      return NextResponse.json(
        { error: 'Nome do pastor é obrigatório' },
        { status: 400 }
      )
    }

    if (!cpf?.trim()) {
      return NextResponse.json(
        { error: 'CPF/CNPJ é obrigatório' },
        { status: 400 }
      )
    }

    if (!whatsapp?.trim()) {
      return NextResponse.json(
        { error: 'WhatsApp é obrigatório' },
        { status: 400 }
      )
    }

    if (!email?.trim()) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      )
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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

    // Checagem (case-insensitive / cpf digits-only). Se falhar, seguimos e deixamos o banco validar.
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
      // ignore
    }

    // Salvar solicitação de contato em pre_registrations
    const { data: contact, error: contactError } = await supabaseClient
      .from('pre_registrations')
      .insert({
        user_id: null,
        ministry_name: ministerio,
        pastor_name: pastor,
        cpf_cnpj: cpf,
        whatsapp,
        email,
        trial_expires_at: new Date().toISOString(), // Data de hoje para pendente; será atualizada quando aprovado
        trial_days: 0,
        status: 'pending',
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
      email,
      meta: {
        contact_id: contact.id,
      },
    })

    // Criar notificação para o admin
    const { error: notificationError } = await supabaseClient
      .from('admin_notifications')
      .insert({
        admin_id: null, // Notificação para todos os admins
        type: 'new_contact_request',
        title: `📝 Nova Solicitação de Contato: ${ministerio}`,
        message: `Pastor: ${pastor} | Email: ${email} | WhatsApp: ${whatsapp}`,
        data: {
          contact_id: contact.id,
          ministry_name: ministerio,
          pastor_name: pastor,
          cpf_cnpj: cpf,
          email,
          whatsapp,
        },
        is_read: false,
        created_at: new Date().toISOString(),
      })

    if (notificationError) {
      console.warn('[CONTACT] Aviso ao criar notificação:', notificationError)
      // Não falha o request por causa disso
    }

    // Resposta de sucesso
    return NextResponse.json(
      {
        success: true,
        message: 'Solicitação de contato registrada com sucesso',
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
