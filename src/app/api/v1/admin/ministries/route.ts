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
  if (v.includes('expert') || v.includes('enterprise') || v.includes('empresarial')) return 'expert'
  if (v.includes('profissional') || v.includes('professional')) return 'profissional'
  if (v.includes('intermediario') || v.includes('intermediate')) return 'intermediario'
  return 'starter'
}

function onlyDigits(value: unknown) {
  if (value === null || value === undefined) return null
  const digits = String(value).replace(/\D/g, '')
  return digits.length ? digits : null
}

function upperText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  if (!normalized) return null
  return normalized.toUpperCase()
}

function lowerText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  if (!normalized) return null
  return normalized.toLowerCase()
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
    const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(body, key)

    const name = upperText(body?.name)
    const emailAdmin = lowerText(body?.email_admin || body?.contact_email)
    const phone: string | undefined = body?.phone || body?.contact_phone
    const cnpjCpf: string | undefined = body?.cnpj_cpf || body?.cnpj
    const website = lowerText(body?.website)
    const hasLogoUrl = hasOwn('logo_url')
    const logoUrl = hasLogoUrl ? (String(body?.logo_url || '').trim() || null) : undefined
    const description = upperText(body?.description)
    const whatsapp: string | undefined = body?.whatsapp
    const responsibleName = upperText(body?.responsible_name)
    const addressStreet = upperText(body?.address_street)
    const addressNumber = upperText(body?.address_number)
    const addressComplement = upperText(body?.address_complement)
    const addressCity = upperText(body?.address_city)
    const addressState = upperText(body?.address_state)
    const addressZip: string | undefined = body?.address_zip
    const quantityTemples = body?.quantity_temples
    const quantityMembers = body?.quantity_members

    if (!name || !emailAdmin) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: name, contact_email' },
        { status: 400 }
      )
    }

    // Criar usuário dono (Auth)
    // Prioriza access_email/access_password se fornecidos pelo admin
    const authEmail = lowerText(body?.access_email) || emailAdmin
    const password = (body?.access_password && String(body.access_password).trim().length >= 6)
      ? String(body.access_password).trim()
      : cryptoRandomPassword(12)
    const { data: authUserData, error: authError } = await supabase.auth.admin.createUser({
      email: authEmail,
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

    // Trial
    const isTrial = body?.trial_mode === true
    const trialDays = isTrial ? Math.max(1, Math.min(90, Number(body?.trial_days) || 7)) : 0
    const subscriptionStatus = isTrial ? 'trial' : 'active'
    const subscriptionEndDate = isTrial
      ? new Date(Date.now() + trialDays * 86400 * 1000).toISOString()
      : null

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
          whatsapp: onlyDigits(whatsapp),
          website,
          logo_url: logoUrl,
          description,
          responsible_name: responsibleName,
          address_street: addressStreet,
          address_number: addressNumber,
          address_complement: addressComplement,
          address_city: addressCity,
          address_state: addressState,
          address_zip: onlyDigits(addressZip),
          quantity_temples: typeof quantityTemples === 'number' ? quantityTemples : 1,
          quantity_members: typeof quantityMembers === 'number' ? quantityMembers : 0,
          plan,
          subscription_status: subscriptionStatus,
          subscription_end_date: subscriptionEndDate,
          auto_renew: !isTrial && body?.auto_renew !== false,
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
          email: authEmail,
          password,
        },
      },
      { status: 201 }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredCapability: 'can_manage_ministries' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase, adminUser } = result.ctx
    const body = await request.json()
    const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(body, key)

    const id: string | undefined = body?.id
    if (!id) {
      return NextResponse.json({ error: 'ID do ministério é obrigatório' }, { status: 400 })
    }

    const name = upperText(body?.name)
    const hasEmailAdmin = hasOwn('email_admin') || hasOwn('contact_email')
    const emailAdmin = lowerText(body?.email_admin || body?.contact_email)
    const hasPhone = hasOwn('phone') || hasOwn('contact_phone')
    const phone: string | undefined = body?.phone || body?.contact_phone
    const hasCnpj = hasOwn('cnpj_cpf') || hasOwn('cnpj')
    const cnpjCpf: string | undefined = body?.cnpj_cpf || body?.cnpj
    const website = lowerText(body?.website)
    const hasLogoUrl = hasOwn('logo_url')
    const logoUrl = hasLogoUrl ? (String(body?.logo_url || '').trim() || null) : undefined
    const description = upperText(body?.description)
    const whatsapp: string | undefined = body?.whatsapp
    const responsibleName = upperText(body?.responsible_name)
    const addressStreet = upperText(body?.address_street)
    const addressNumber = upperText(body?.address_number)
    const addressComplement = upperText(body?.address_complement)
    const addressCity = upperText(body?.address_city)
    const addressState = upperText(body?.address_state)
    const addressZip: string | undefined = body?.address_zip
    const rawSubPlanId: string | undefined = body?.subscription_plan_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    let plan: string
    let resolvedPlanUUID: string | null = null

    if (rawSubPlanId && uuidRegex.test(rawSubPlanId)) {
      // UUID enviado pelo form: buscar slug correspondente
      resolvedPlanUUID = rawSubPlanId
      const { data: planRow } = await supabase
        .from('subscription_plans')
        .select('slug')
        .eq('id', rawSubPlanId)
        .maybeSingle()
      plan = body?.plan ? String(body.plan) : (planRow?.slug || mapPlan(rawSubPlanId))
    } else {
      // Slug ou vazio: mapear e buscar UUID
      plan = body?.plan ? String(body.plan) : mapPlan(rawSubPlanId)
      const { data: planRow } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('slug', plan)
        .maybeSingle()
      resolvedPlanUUID = planRow?.id || null
    }

    const accessEmail = lowerText(body?.access_email)
    const accessPassword: string | undefined = body?.access_password

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (hasOwn('name')) payload.name = name
    if (hasEmailAdmin) payload.email_admin = emailAdmin
    if (hasPhone) payload.phone = onlyDigits(phone)
    if (hasOwn('whatsapp')) payload.whatsapp = onlyDigits(whatsapp)
    if (hasCnpj) payload.cnpj_cpf = onlyDigits(cnpjCpf)
    if (hasOwn('website')) payload.website = website
    if (hasLogoUrl) payload.logo_url = logoUrl
    if (hasOwn('description')) payload.description = description
    if (hasOwn('responsible_name')) payload.responsible_name = responsibleName
    if (hasOwn('address_street')) payload.address_street = addressStreet
    if (hasOwn('address_number')) payload.address_number = addressNumber
    if (hasOwn('address_complement')) payload.address_complement = addressComplement
    if (hasOwn('address_city')) payload.address_city = addressCity
    if (hasOwn('address_state')) payload.address_state = addressState
    if (hasOwn('address_zip')) payload.address_zip = onlyDigits(addressZip)
    if (body?.quantity_temples !== undefined) payload.quantity_temples = Number(body.quantity_temples) || 0
    if (body?.quantity_members !== undefined) payload.quantity_members = Number(body.quantity_members) || 0
    if (plan) payload.plan = plan
    if (resolvedPlanUUID) payload.subscription_plan_id = resolvedPlanUUID
    if (body?.is_active !== undefined) payload.is_active = Boolean(body.is_active)

    if (accessPassword && accessPassword.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter no minimo 6 caracteres' }, { status: 400 })
    }

    if (accessEmail || accessPassword) {
      const { data: ministryRow, error: ministryError } = await supabase
        .from('ministries')
        .select('user_id')
        .eq('id', id)
        .single()

      if (ministryError || !ministryRow?.user_id) {
        return NextResponse.json({ error: 'Nao foi possivel localizar o usuario do tenant' }, { status: 400 })
      }

      const updatePayload: Record<string, any> = {}
      if (accessEmail) updatePayload.email = accessEmail
      if (accessPassword) updatePayload.password = accessPassword

      const { error: authError } = await supabase.auth.admin.updateUserById(
        ministryRow.user_id,
        updatePayload
      )

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }

      if (accessEmail) payload.email_admin = accessEmail
    }

    const { data, error } = await supabase
      .from('ministries')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await logAuditAction(supabase, adminUser.id, 'UPDATE_MINISTRY', 'ministries', id, payload)

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredCapability: 'can_manage_ministries' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase, adminUser } = result.ctx
    const body = await request.json()

    const id: string | undefined = body?.id
    if (!id) {
      return NextResponse.json({ error: 'ID do ministério é obrigatório' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('ministries')
      .delete()
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await logAuditAction(supabase, adminUser.id, 'DELETE_MINISTRY', 'ministries', id, {})

    return NextResponse.json({ data })
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
