import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_MODULOS_ACESSO, type AdminRole } from '@/lib/access-control'
import { ImpersonationService } from '@/lib/security/ImpersonationService'
import { verifyImpersonationToken } from '@/lib/security/impersonation-jwt'

export type RequireAdminOptions = {
  requiredRole?: AdminRole
  requiredCapability?: string
  requiredModule?: string
}

export type AdminContext = {
  supabaseAdmin: ReturnType<typeof createServerClient>
  user: NonNullable<Awaited<ReturnType<ReturnType<typeof createServerClient>['auth']['getUser']>>['data']['user']>
  adminUser: any
  // Contexto de Impersonação (Admin Impersonation 2.0B)
  isImpersonating?: boolean
  originalAdmin?: {
    id: string
    email: string
    role: string
    nome?: string
  } | null
  impersonationSessionId?: string | null
  readOnly?: boolean
  targetTenantId?: string | null
  targetTenantName?: string | null
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
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  // 1. Checar se o token enviado é um JWT exclusivo de Impersonação
  const verifyCheck = verifyImpersonationToken(token)
  if (verifyCheck.payload?.type === 'impersonation') {
    const valResult = await ImpersonationService.validateImpersonation(token)
    if (!valResult.valid || !valResult.session || valResult.status !== 'active') {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Unauthorized', details: valResult.error || 'Sessão de impersonação inválida ou expirada.' },
          { status: 401 }
        ),
      }
    }

    const session = valResult.session

    // Buscar o Super Admin original no banco de dados
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('id', session.adminId)
      .single()

    if (adminError || !adminUser || !isActiveAdmin(adminUser)) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      }
    }

    if (!hasRequiredRole(adminUser, options.requiredRole) || !hasCapability(adminUser, options.requiredCapability)) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      }
    }

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
        user: { id: adminUser.id, email: adminUser.email } as any,
        adminUser,
        isImpersonating: true,
        originalAdmin: {
          id: adminUser.id,
          email: adminUser.email,
          role: adminUser.role,
          nome: adminUser.nome,
        },
        impersonationSessionId: session.id,
        readOnly: session.readOnly,
        targetTenantId: session.tenantId,
        targetTenantName: session.tenantName,
      },
    }
  }

  // 2. Fluxo nativo Supabase Auth (quando não for token de impersonação)
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
      isImpersonating: false,
      originalAdmin: null,
      impersonationSessionId: null,
      readOnly: false,
      targetTenantId: null,
      targetTenantName: null,
    },
  }
}
