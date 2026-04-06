import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

type AdminRole = string

export type RequireAdminOptions = {
  requiredRole?: AdminRole
  requiredCapability?: string
}

export type AdminContext = {
  supabaseAdmin: ReturnType<typeof createServerClient>
  user: NonNullable<Awaited<ReturnType<ReturnType<typeof createServerClient>['auth']['getUser']>>['data']['user']>
  adminUser: any
}

function isActiveAdmin(adminUser: any): boolean {
  if (!adminUser) return false
  if (typeof adminUser.is_active === 'boolean') return adminUser.is_active === true
  if (typeof adminUser.status === 'string') return adminUser.status === 'ATIVO'
  if (typeof adminUser.ativo === 'boolean') return adminUser.ativo === true
  return false
}

function hasRequiredRole(adminUser: any, requiredRole?: AdminRole): boolean {
  if (!requiredRole) return true
  const role = adminUser?.role
  if (!role) return false

  // requiredRole=admin aceita super_admin também
  if (requiredRole === 'admin') {
    return role === 'admin' || role === 'super_admin'
  }

  return role === requiredRole
}

function hasCapability(adminUser: any, requiredCapability?: string): boolean {
  if (!requiredCapability) return true

  // Compatibilidade: alguns ambientes usam um schema antigo de admin_users
  // sem colunas can_manage_*; nesse caso, admin tem acesso total.
  const role = adminUser?.role
  if ((role === 'admin' || role === 'super_admin') && adminUser?.[requiredCapability] == null) {
    return true
  }

  return adminUser?.[requiredCapability] === true
}

export async function requireAdmin(
  request: NextRequest,
  options: RequireAdminOptions = {}
): Promise<{ ok: true; ctx: AdminContext } | { ok: false; response: NextResponse }> {
  const supabaseAdmin = createServerClient()

  const authHeader = request.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !authData.user || !authData.user.email) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const user = authData.user

  const { data: adminUser, error: adminError } = await supabaseAdmin
    .from('admin_users')
    .select('*')
    .eq('email', user.email)
    .single()

  if (adminError || !adminUser) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  if (!isActiveAdmin(adminUser)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  if (!hasRequiredRole(adminUser, options.requiredRole)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  if (!hasCapability(adminUser, options.requiredCapability)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return {
    ok: true,
    ctx: {
      supabaseAdmin,
      user,
      adminUser,
    },
  }
}
