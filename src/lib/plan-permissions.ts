import { SupabaseClient } from '@supabase/supabase-js';
import {
  FeatureFlag,
  isFeatureEnabled,
} from '@/lib/feature-flags';

export type { FeatureFlag } from '@/lib/feature-flags';

/**
 * Retorna se a Feature Flag especificada está liberada para o objeto de plano fornecido.
 */
export function hasFeatureFlag(planObj?: any, feature: FeatureFlag = 'digital_collection'): boolean {
  return isFeatureEnabled(planObj, feature);
}

/**
 * Atalho de compatibilidade para Arrecadação Digital (delegação direta à Feature Flag 'digital_collection').
 */
export function hasArrecadacaoDigitalPlanAccess(planSlug?: string | null, planObj?: any): boolean {
  const mergedPlan = planObj ? { ...planObj, slug: planSlug || planObj.slug } : { slug: planSlug };
  return isFeatureEnabled(mergedPlan, 'digital_collection');
}

/**
 * Verifica no banco de dados (server-side) se o ministério do tenant possui acesso a uma Feature Flag específica.
 */
export async function isFeatureAllowedForTenant(
  adminClient: SupabaseClient,
  ministryId: string,
  feature: FeatureFlag
): Promise<boolean> {
  if (!ministryId) return false;

  const { data: ministry } = await adminClient
    .from('ministries')
    .select('plan, subscription_plan_id, subscription_plans(id, slug, name, price_monthly, max_users, modulos, has_modulo_financeiro, has_modulo_financeiro_avancado, has_modulo_eventos, has_modulo_reunioes)')
    .eq('id', ministryId)
    .maybeSingle();

  if (!ministry) return false;

  const planObj = (ministry as any)?.subscription_plans;
  const mergedPlan = planObj
    ? { ...planObj, plan: ministry.plan }
    : { slug: ministry.plan, plan: ministry.plan };

  return isFeatureEnabled(mergedPlan, feature);
}

/**
 * Atalho de compatibilidade server-side para Arrecadação Digital.
 */
export async function isArrecadacaoDigitalAllowedForTenant(
  adminClient: SupabaseClient,
  ministryId: string
): Promise<boolean> {
  return isFeatureAllowedForTenant(adminClient, ministryId, 'digital_collection');
}
