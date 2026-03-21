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

    // Validar campos
    if (!body.name || !body.slug || !body.price_monthly || !body.max_users) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: name, slug, price_monthly, max_users, max_members, max_storage_bytes' },
        { status: 400 }
      )
    }

    // Criar plano
    const { data, error } = await supabase
      .from('subscription_plans')
      .insert([{
        name: body.name,
        slug: body.slug,
        description: body.description,
        price_monthly: body.price_monthly,
        price_annually: body.price_annually,
        setup_fee: body.setup_fee || 0,
        max_users: body.max_users,
        max_storage_bytes: body.max_storage_bytes,
        max_members: body.max_members,
        max_ministerios: body.max_ministerios || 1,
        has_api_access: body.has_api_access || false,
        has_custom_domain: body.has_custom_domain || false,
        has_advanced_reports: body.has_advanced_reports || false,
        has_priority_support: body.has_priority_support || false,
        has_white_label: body.has_white_label || false,
        has_automation: body.has_automation || false,
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
