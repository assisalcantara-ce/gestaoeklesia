import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { resolveTenantAuth } from '@/lib/tenant-auth';

export type FlowAuthContext = {
  supabase: Awaited<ReturnType<typeof resolveTenantAuth>>['supabase'];
  userId: string;
  ministryId: string;
  roles: string[];
  congregacaoId?: string | null;
  supervisaoId?: string | null;
};

export async function requireFlowAuth(request: NextRequest): Promise<FlowAuthContext> {
  const context = await resolveTenantAuth(request);
  await ensureTrialAccess(context.userId);

  return {
    supabase: context.supabase,
    userId: context.userId,
    ministryId: context.ministryId,
    roles: context.roles,
    congregacaoId: context.congregacaoId,
    supervisaoId: context.supervisaoId,
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

  // Pagamento confirmado via webhook: acesso garantido independente da data
  if (data.status === 'efetivado') return;

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

export { hasRole } from '@/lib/access-control';
