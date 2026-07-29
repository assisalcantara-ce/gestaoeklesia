import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_MODULOS_ACESSO, type AdminRole } from '@/lib/access-control'

export type RequireAdminOptions = {
  requiredRole?: AdminRole
  requiredCapability?: string
  requiredModule?: string
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
  if (adminUser?.role === 'super_admin') return true

  // Verifica na lista de capabilities caso existam no profile do admin
  if (Array.isArray(adminUser?.capabilities)) {
    return adminUser.capabilities.includes(requiredCapability)
  }

  return adminUser?.[requiredCapability] === true
}

export async function requireAdmin(
  request: NextRequest,
  options: RequireAdminOptions = {}
): Promise<{ ok: true; ctx: AdminContext } | { ok: false; response: NextResponse }> {
  const supabaseAdmin = createServerClient()

  const authHeader = request.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  // 1. Obter usuário autenticado via Supabase Auth
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  // 2. Verificar se o usuário existe em admin_users e está ATIVO
  const { data: adminUser, error: adminError } = await supabaseAdmin
    .from('admin_users')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (adminError || !adminUser || !isActiveAdmin(adminUser)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  // 3. Validar Role
  if (!hasRequiredRole(adminUser, options.requiredRole)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  // 4. Validar Capability
  if (!hasCapability(adminUser, options.requiredCapability)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  // 5. Validar Módulo Solicitado
  if (options.requiredModule) {
    const roleNorm = String(adminUser?.role || '').toLowerCase().trim() as AdminRole;
    const allowed = ADMIN_MODULOS_ACESSO[roleNorm]?.includes(options.requiredModule);
    if (!allowed && roleNorm !== 'admin' && roleNorm !== 'super_admin') {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      }
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
