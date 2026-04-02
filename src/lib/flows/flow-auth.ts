import { NextRequest } from 'next/server';
import { createServerClient, createServerClientFromRequest } from '@/lib/supabase-server';

export type FlowAuthContext = {
  supabase: ReturnType<typeof createServerClientFromRequest>;
  userId: string;
  ministryId: string;
  roles: string[];
  congregacaoId?: string | null;
};

function mapBaseRole(role: string | null | undefined): string[] {
  switch ((role || '').toLowerCase()) {
    case 'admin':
      return ['ADMINISTRADOR'];
    case 'manager':
      return ['SUPERVISOR'];
    case 'supervisor':
      return ['SUPERVISOR'];
    case 'superintendent':
      return ['SUPERINTENDENTE'];
    case 'superintendente':
      return ['SUPERINTENDENTE'];
    case 'coordinator':
      return ['COORDENADOR'];
    case 'coordenador':
      return ['COORDENADOR'];
    case 'financial':
      return ['FINANCEIRO'];
    case 'financeiro':
      return ['FINANCEIRO'];
    case 'operator':
      return ['OPERADOR'];
    case 'viewer':
      return ['LEITURA'];
    default:
      return [];
  }
}

export async function requireFlowAuth(request: NextRequest): Promise<FlowAuthContext> {
  const supabase = createServerClientFromRequest(request);
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new Error('UNAUTHORIZED');
  }

  let userId: string | null = null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user?.id) userId = data.user.id;
  } catch {
    userId = null;
  }

  if (!userId) {
    userId = decodeJwtSubject(token);
  }

  if (!userId) {
    throw new Error('UNAUTHORIZED');
  }

  await ensureTrialAccess(userId);

  const resolvedMuFromRequest = await resolveMinistryUserFromRequest(supabase, userId, token);
  const resolvedMu = resolvedMuFromRequest || await resolveMinistryUser(userId);
  if (resolvedMu?.ministry_id) {
    const permissions = Array.isArray(resolvedMu.permissions) ? resolvedMu.permissions : [];
    const roles = Array.from(
      new Set([
        ...mapBaseRole(resolvedMu.role),
        ...permissions.map((p: string) => String(p).toUpperCase()),
      ])
    );

    return {
      supabase,
      userId,
      ministryId: String(resolvedMu.ministry_id),
      roles,
      congregacaoId: resolvedMu.congregacao_id ?? null,
    };
  }

  const { data: ministry } = await supabase
    .from('ministries')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (!ministry?.id) {
    throw new Error('NO_MINISTRY');
  }

  return {
    supabase,
    userId,
    ministryId: String(ministry.id),
    roles: ['ADMINISTRADOR'],
    congregacaoId: null,
  };
}

async function ensureTrialAccess(userId: string) {
  const admin = createServerClient();
  const { data, error } = await admin
    .from('pre_registrations')
    .select('id, trial_expires_at, status')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return;

  const expiresAt = data.trial_expires_at ? new Date(data.trial_expires_at) : null;
  const isExpired = data.status === 'encerrado' || (expiresAt && expiresAt.getTime() <= Date.now());

  if (isExpired) {
    if (data.status !== 'encerrado') {
      await admin
        .from('pre_registrations')
        .update({ status: 'encerrado' })
        .eq('id', data.id);
    }

    throw new Error('TRIAL_EXPIRED');
  }
}

async function resolveMinistryUser(userId: string) {
  const admin = createServerClient();
  const { data, error } = await admin
    .from('ministry_users')
    .select('ministry_id, role, permissions, congregacao_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (data) return data;
  if (process.env.NODE_ENV === 'development' && error) {
    console.warn('resolveMinistryUser admin error:', error.message);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  const url = new URL(`${supabaseUrl}/rest/v1/ministry_users`);
  url.searchParams.set('select', 'ministry_id,role,permissions,congregacao_id');
  url.searchParams.set('user_id', `eq.${userId}`);
  url.searchParams.set('limit', '1');

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

function decodeJwtSubject(token: string): string | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  try {
    const padded = payload.padEnd(payload.length + (4 - (payload.length % 4 || 4)), '=');
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    const data = JSON.parse(decoded);
    return data?.sub ? String(data.sub) : null;
  } catch {
    return null;
  }
}

async function resolveMinistryUserFromRequest(
  supabase: ReturnType<typeof createServerClientFromRequest>,
  userId: string,
  token: string
) {
  const { data, error } = await supabase
    .from('ministry_users')
    .select('ministry_id, role, permissions, congregacao_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (!error && data) return data;
  if (process.env.NODE_ENV === 'development' && error) {
    console.warn('resolveMinistryUserFromRequest error:', error.message);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const url = new URL(`${supabaseUrl}/rest/v1/ministry_users`);
  url.searchParams.set('select', 'ministry_id,role,permissions,congregacao_id');
  url.searchParams.set('user_id', `eq.${userId}`);
  url.searchParams.set('limit', '1');

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

export function hasRole(roles: string[], required: string[] | string): boolean {
  const requiredList = Array.isArray(required) ? required : [required];
  const set = new Set(roles.map(r => r.toUpperCase()));
  return requiredList.some(r => set.has(String(r).toUpperCase())) || set.has('ADMINISTRADOR');
}
