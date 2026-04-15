/**
 * API ROUTE: Subscription Plans Management
 * Gerenciar planos de assinatura
 */

import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createServerClient()

    // Extrair token do header
    const authHeader = request.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    
    let isAdmin = false
    if (token) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
      const user = !authError ? authData.user : null

      if (user?.email) {
        const { data: adminUser } = await supabaseAdmin
          .from('admin_users')
          .select('*')
          .eq('email', user.email)
          .maybeSingle()

        const isActive = adminUser?.status === 'ATIVO' || adminUser?.ativo === true
        const role = adminUser?.role
        isAdmin = Boolean(isActive && (role === 'admin' || role === 'super_admin'))
      }
    }

    let query = supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .order('display_order', { ascending: true })

    // Se for admin, mostrar todos. Se não, mostrar apenas ativos
    if (!isAdmin) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase, adminUser } = result.ctx
    const body = await request.json()

    const name = String(body?.name || '').trim()
    const slug = String(body?.slug || '').trim()
    const priceMonthly = Number(body?.price_monthly)
    const priceAnnually = Number(body?.price_annually || 0)
    const setupFee = Number(body?.setup_fee || 0)
    const maxUsers = Number(body?.max_users)
    const maxMembers = Number(body?.max_members ?? 0)
    const maxMinisterios = Number(body?.max_ministerios)
    const additionalChurchMonthlyFee = Number(body?.additional_church_monthly_fee ?? 50)
    const additionalAdminsPerChurch = Number(body?.additional_admin_users_per_church ?? 2)

    // Validar campos
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: name, slug' },
        { status: 400 }
      )
    }

    if (!Number.isFinite(priceMonthly) || priceMonthly <= 0) {
      return NextResponse.json({ error: 'price_monthly inválido' }, { status: 400 })
    }

    if (!Number.isFinite(maxUsers) || maxUsers <= 0) {
      return NextResponse.json({ error: 'max_users inválido' }, { status: 400 })
    }

    if (!Number.isFinite(maxMinisterios) || maxMinisterios <= 0) {
      return NextResponse.json({ error: 'max_ministerios inválido' }, { status: 400 })
    }

    if (!Number.isFinite(maxMembers) || maxMembers < 0) {
      return NextResponse.json({ error: 'max_members inválido (use 0 para ilimitado)' }, { status: 400 })
    }

    if (!Number.isFinite(additionalChurchMonthlyFee) || additionalChurchMonthlyFee < 0) {
      return NextResponse.json({ error: 'additional_church_monthly_fee inválido' }, { status: 400 })
    }

    if (!Number.isFinite(additionalAdminsPerChurch) || additionalAdminsPerChurch < 0) {
      return NextResponse.json({ error: 'additional_admin_users_per_church inválido' }, { status: 400 })
    }

    // Criar plano
    const { data, error } = await supabase
      .from('subscription_plans')
      .insert([{
        name,
        slug,
        description: body.description,
        price_monthly: priceMonthly,
        price_annually: Number.isFinite(priceAnnually) ? priceAnnually : 0,
        setup_fee: Number.isFinite(setupFee) ? setupFee : 0,
        max_users: maxUsers,
        max_storage_bytes: body.max_storage_bytes ?? 0,
        max_members: maxMembers,
        max_ministerios: maxMinisterios,
        additional_church_monthly_fee: additionalChurchMonthlyFee,
        additional_admin_users_per_church: additionalAdminsPerChurch,
        max_divisao2: body.max_divisao2 ?? 0,
        max_divisao3: body.max_divisao3 ?? -1,
        has_api_access: body.has_api_access || false,
        has_custom_domain: body.has_custom_domain || false,
        has_advanced_reports: body.has_advanced_reports || false,
        has_priority_support: body.has_priority_support || false,
        has_modulo_financeiro: body.has_modulo_financeiro || false,
        has_modulo_eventos: body.has_modulo_eventos || false,
        has_modulo_reunioes: body.has_modulo_reunioes || false,
        has_white_label: body.has_white_label || false,
        has_automation: body.has_automation || false,
        modulos: Array.isArray(body.modulos) ? body.modulos : [],
        is_active: true,
        display_order: body.display_order || 0,
      }])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Log auditoria
    await logAuditAction(supabase, adminUser.id, 'CREATE_PLAN', 'subscription_plans', data.id, {})

    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
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
