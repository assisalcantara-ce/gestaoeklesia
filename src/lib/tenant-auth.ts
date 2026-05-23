import { NextRequest } from 'next/server';
import { createServerClient, createServerClientFromRequest } from '@/lib/supabase-server';
import {
  hasRole,
  isLocalNivel,
  normalizePermissions,
  resolveNivel,
  resolveRoles,
  type NivelAcesso,
} from '@/lib/access-control';

type SupabaseLike = ReturnType<typeof createServerClientFromRequest>;

export type TenantAuthContext = {
  supabase: SupabaseLike;
  admin: ReturnType<typeof createServerClient>;
  userId: string;
  ministryId: string;
  nivel: NivelAcesso;
  roles: string[];
  permissions: string[];
  congregacaoId: string | null;
  supervisaoId: string | null;
  isOwner: boolean;
};

type MinistryUserRow = {
  ministry_id?: string | null;
  role?: string | null;
  permissions?: unknown;
  congregacao_id?: string | null;
  supervisao_id?: string | null;
};

async function findMinistryUser(
  supabase: SupabaseLike,
  admin: ReturnType<typeof createServerClient>,
  userId: string
): Promise<MinistryUserRow | null> {
  const select = 'ministry_id, role, permissions, congregacao_id, supervisao_id';
  const { data, error } = await supabase
    .from('ministry_users')
    .select(select)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (!error && data) return data;

  const { data: adminData } = await admin
    .from('ministry_users')
    .select(select)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  return adminData || null;
}

async function findOwnedMinistry(
  supabase: SupabaseLike,
  admin: ReturnType<typeof createServerClient>,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('ministries')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (!error && data?.id) return String(data.id);

  const { data: adminData } = await admin
    .from('ministries')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  return adminData?.id ? String(adminData.id) : null;
}

export async function resolveTenantAuth(request: NextRequest): Promise<TenantAuthContext> {
  const supabase = createServerClientFromRequest(request);
  const admin = createServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    throw new Error('UNAUTHORIZED');
  }

  const ministryUser = await findMinistryUser(supabase, admin, user.id);
  if (ministryUser?.ministry_id) {
    const nivel = resolveNivel(ministryUser.role, ministryUser.permissions) ?? 'operador';
    return {
      supabase,
      admin,
      userId: user.id,
      ministryId: String(ministryUser.ministry_id),
      nivel,
      roles: resolveRoles(ministryUser.role, ministryUser.permissions),
      permissions: normalizePermissions(ministryUser.permissions),
      congregacaoId: ministryUser.congregacao_id ? String(ministryUser.congregacao_id) : null,
      supervisaoId: ministryUser.supervisao_id ? String(ministryUser.supervisao_id) : null,
      isOwner: false,
    };
  }

  const ministryId = await findOwnedMinistry(supabase, admin, user.id);
  if (!ministryId) {
    throw new Error('NO_MINISTRY');
  }

  return {
    supabase,
    admin,
    userId: user.id,
    ministryId,
    nivel: 'administrador',
    roles: ['ADMINISTRADOR'],
    permissions: ['ADMINISTRADOR'],
    congregacaoId: null,
    supervisaoId: null,
    isOwner: true,
  };
}

export function requireTenantRole(context: TenantAuthContext, required: string[] | string): void {
  if (!hasRole(context.roles, required)) {
    throw new Error('FORBIDDEN');
  }
}

export async function applyCongregacaoScope<T extends { eq: (column: string, value: any) => T; in: (column: string, values: any[]) => T }>(
  query: T,
  context: TenantAuthContext
): Promise<T> {
  const congregacaoIds = await getAccessibleCongregacaoIds(context);
  if (congregacaoIds === null) return query;
  if (congregacaoIds.length === 0) return query.eq('id', '00000000-0000-0000-0000-000000000000');
  return query.in('congregacao_id', congregacaoIds);
}

export async function getAccessibleCongregacaoIds(context: TenantAuthContext): Promise<string[] | null> {
  if (isLocalNivel(context.nivel)) {
    return context.congregacaoId ? [context.congregacaoId] : [];
  }
  if (context.nivel !== 'supervisor') return null;

  if (!context.supervisaoId) {
    return [];
  }

  const { data } = await context.admin
    .from('congregacoes')
    .select('id')
    .eq('ministry_id', context.ministryId)
    .eq('supervisao_id', context.supervisaoId);

  const congregacaoIds = ((data || []) as Array<{ id: string }>).map(row => row.id).filter(Boolean);
  return congregacaoIds;
}

export async function getAccessibleMemberIds(context: TenantAuthContext): Promise<string[] | null> {
  const congregacaoIds = await getAccessibleCongregacaoIds(context);
  if (congregacaoIds === null) return null;
  if (congregacaoIds.length === 0) return [];

  const { data } = await context.admin
    .from('members')
    .select('id')
    .eq('ministry_id', context.ministryId)
    .in('congregacao_id', congregacaoIds);

  return ((data || []) as Array<{ id: string }>).map(row => row.id).filter(Boolean);
}
