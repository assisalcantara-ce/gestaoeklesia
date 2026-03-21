/**
 * API ROUTE: Ministries Management (Admin)
 * Listar, criar, atualizar ministérios
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { randomBytes } from 'node:crypto'

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)
}

function mapPlan(subscriptionPlanId?: string) {
  const v = (subscriptionPlanId || '').toLowerCase()
  if (v.includes('premium') || v.includes('enterprise')) return 'enterprise'
  if (v.includes('standard') || v.includes('growth')) return 'growth'
  return 'starter'
}

function onlyDigits(value: unknown) {
  if (value === null || value === undefined) return null
  const digits = String(value).replace(/\D/g, '')
  return digits.length ? digits : null
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredCapability: 'can_manage_ministries' })
    if (!result.ok) return result.response
    const { supabaseAdmin } = result.ctx
    const searchParams = request.nextUrl.searchParams
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const plan = searchParams.get('plan')

    const offset = (page - 1) * limit
    let query = supabaseAdmin
      .from('ministries')
      .select('*', { count: 'exact' })

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    if (status) {
      query = query.eq('subscription_status', status)
    }

    if (plan) {
      query = query.eq('plan', plan)
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      data,
      count,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredCapability: 'can_manage_ministries' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase, adminUser } = result.ctx
    const body = await request.json()

    // Compatibilidade com o formulário atual do admin
    const name: string | undefined = body?.name
    const emailAdmin: string | undefined = body?.email_admin || body?.contact_email
    const phone: string | undefined = body?.phone || body?.contact_phone
    const cnpjCpf: string | undefined = body?.cnpj_cpf || body?.cnpj
    const website: string | undefined = body?.website
    const logoUrl: string | undefined = body?.logo_url
    const description: string | undefined = body?.description

    if (!name || !emailAdmin) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: name, contact_email' },
        { status: 400 }
      )
    }

    // Criar usuário dono (Auth)
    const password = cryptoRandomPassword(12)
    const { data: authUserData, error: authError } = await supabase.auth.admin.createUser({
      email: emailAdmin,
      password,
      email_confirm: true,
      user_metadata: {
        created_by: 'admin_panel',
        ministry_name: name,
      },
    })

    if (authError || !authUserData?.user) {
      const msg = authError?.message || 'Erro ao criar usuário'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const slug = body?.slug ? String(body.slug) : slugify(name)
    const plan = body?.plan ? String(body.plan) : mapPlan(body?.subscription_plan_id)

    // Criar ministério
    const { data, error } = await supabase
      .from('ministries')
      .insert([
        {
          user_id: authUserData.user.id,
          name,
          slug,
          email_admin: emailAdmin,
          cnpj_cpf: onlyDigits(cnpjCpf),
          phone: onlyDigits(phone),
          website: website || null,
          logo_url: logoUrl || null,
          description: description || null,
          plan,
          subscription_status: 'active',
          auto_renew: body?.auto_renew !== false,
          max_users: body?.max_users || 10,
          max_storage_bytes: body?.max_storage_bytes || 5368709120,
          timezone: body?.timezone || 'America/Sao_Paulo',
          is_active: body?.is_active !== false,
        },
      ])
      .select()
      .single()

    if (error) {
      try {
        await supabase.auth.admin.deleteUser(authUserData.user.id)
      } catch {
        // best-effort
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Vincular o usuário como admin do ministry
    const { error: linkError } = await supabase.from('ministry_users').insert({
      ministry_id: data.id,
      user_id: authUserData.user.id,
      role: 'admin',
      is_active: true,
    })

    if (linkError) {
      try {
        await supabase.from('ministries').delete().eq('id', data.id)
      } catch {
        // best-effort
      }
      try {
        await supabase.auth.admin.deleteUser(authUserData.user.id)
      } catch {
        // best-effort
      }
      return NextResponse.json({ error: linkError.message }, { status: 400 })
    }

    // Log auditoria
    await logAuditAction(supabase, adminUser.id, 'CREATE_MINISTRY', 'ministries', data.id, {})

    return NextResponse.json(
      {
        data,
        credentials: {
          email: emailAdmin,
          password,
        },
      },
      { status: 201 }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function cryptoRandomPassword(length = 12) {
  // Senha gerada server-side com entropia real
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*'
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length]
  }
  return out
}

async function logAuditAction(
  supabase: any,
  adminUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  changes: any
) {
  try {
    await supabase
      .from('admin_audit_logs')
      .insert([{
        admin_user_id: adminUserId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        changes,
        status: 'success',
      }])
  } catch (err) {
    console.error('Erro ao fazer log de auditoria:', err)
  }
}
