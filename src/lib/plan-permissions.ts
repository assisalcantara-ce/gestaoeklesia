import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Retorna se um determinado slug de plano ou objeto de plano possui acesso à Arrecadação Digital.
 * Regra de Negócio:
 * - Plano Básico ('starter', 'basic', 'basico'): NÃO possui acesso.
 * - Plano Intermediário ('intermediario', 'intermediate'): Possui acesso.
 * - Planos Superiores ('profissional', 'expert', etc. e futuros): Possuem acesso automaticamente.
 */
export function hasArrecadacaoDigitalPlanAccess(planSlug?: string | null, planObj?: any): boolean {
  const slug = (planSlug || '').toLowerCase().trim();

  // Se o objeto do plano contiver um array de módulos explicitando 'Arrecadação Digital'
  const modulosList = Array.isArray(planObj?.modulos) ? planObj.modulos : [];
  if (modulosList.includes('Arrecadação Digital') || modulosList.includes('Arrecadacao Digital')) {
    return true;
  }

  // Planos Básicos (sem acesso)
  if (['starter', 'basic', 'basico'].includes(slug)) {
    return false;
  }

  // Plano Intermediário e todos os planos superiores (atuais e futuros possuem acesso automaticamente)
  return true;
}

/**
 * Verifica no banco de dados (server-side) se o ministério do tenant possui plano com acesso à Arrecadação Digital.
 */
export async function isArrecadacaoDigitalAllowedForTenant(
  adminClient: SupabaseClient,
  ministryId: string
): Promise<boolean> {
  if (!ministryId) return false;

  const { data: ministry } = await adminClient
    .from('ministries')
    .select('plan, subscription_plan_id, subscription_plans(id, slug, name, modulos)')
    .eq('id', ministryId)
    .maybeSingle();

  if (!ministry) return false;

  const planObj = (ministry as any)?.subscription_plans;
  const planSlug = (planObj?.slug || ministry.plan || 'starter').toLowerCase().trim();

  return hasArrecadacaoDigitalPlanAccess(planSlug, planObj);
}
