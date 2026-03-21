/**
 * API ROUTE: Admin Users Management
 * Listar, criar, atualizar e deletar usuários admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

function sanitizeAdminUser(row: any) {
  if (!row || typeof row !== 'object') return row
  const { password_hash, password, senha, ...rest } = row
  return rest
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase, adminUser } = result.ctx

    const { data, error, count } = await supabase
      .from('admin_users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data: (data || []).map(sanitizeAdminUser), count, requested_by: adminUser.email })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ============================================
// POST: Criar novo admin user
// ============================================

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase, adminUser } = result.ctx

    const body = await request.json()

    // Validar campos obrigatórios
    if (!body.email || !body.role) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: email, role' },
        { status: 400 }
      )
    }

    // Inserir novo admin user
    const { data, error } = await supabase
      .from('admin_users')
      .insert([{
        nome: body.nome || body.name,
        email: body.email,
        password_hash: body.password_hash || '',
        role: body.role,
        status: body.status || 'ATIVO',
      }])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Log auditoria
    await logAuditAction(supabase, adminUser.id, 'CREATE_ADMIN_USER', 'admin_users', data.id, {})

    return NextResponse.json(sanitizeAdminUser(data), { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ============================================
// Helper: Log auditoria
// ============================================

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
