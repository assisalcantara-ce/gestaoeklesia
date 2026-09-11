import { SupabaseClient } from '@supabase/supabase-js';

export interface PlanoComercialResolvido {
  id: string;
  slug: string;
  name: string;
  price_monthly: number;
}

/**
 * Serviço centralizado para validação e resolução de planos comerciais oficiais.
 * A única fonte da verdade é a tabela subscription_plans.
 * Impede que slugs não-comerciais (como 'avulsa', 'padrao', etc.) virem planos de tenant ou contratos.
 */
export class PlanResolutionService {
  /**
   * Resolve um plano comercial pelo seu slug oficial.
   */
  static async resolveBySlug(
    supabaseAdmin: SupabaseClient,
    slug: string | null | undefined
  ): Promise<PlanoComercialResolvido | null> {
    if (!slug || typeof slug !== 'string') return null;
    const cleanSlug = slug.trim().toLowerCase();

    // Slugs estritamente não-comerciais que nunca podem ser planos
    const nonCommercialSlugs = ['avulsa', 'avulso', 'padrao', 'custom', 'outro', 'none', 'null'];
    if (nonCommercialSlugs.includes(cleanSlug)) {
      return null;
    }

    const { data } = await supabaseAdmin
      .from('subscription_plans')
      .select('id, name, slug, price_monthly')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (data) {
      return {
        id: data.id,
        slug: data.slug,
        name: data.name,
        price_monthly: Number(data.price_monthly || 0),
      };
    }

    return null;
  }

  /**
   * Resolve um plano comercial pelo seu UUID (subscription_plan_id).
   */
  static async resolveById(
    supabaseAdmin: SupabaseClient,
    planId: string | null | undefined
  ): Promise<PlanoComercialResolvido | null> {
    if (!planId || typeof planId !== 'string') return null;

    const { data } = await supabaseAdmin
      .from('subscription_plans')
      .select('id, name, slug, price_monthly')
      .eq('id', planId.trim())
      .maybeSingle();

    if (data) {
      return {
        id: data.id,
        slug: data.slug,
        name: data.name,
        price_monthly: Number(data.price_monthly || 0),
      };
    }

    return null;
  }

  /**
   * Resolve o plano comercial de um ministério garantindo que nunca retorne 'avulsa'.
   * Se o ministério possuir um plano válido, retorna-o.
   */
  static async resolveMinistryPlan(
    supabaseAdmin: SupabaseClient,
    ministryId: string
  ): Promise<PlanoComercialResolvido | null> {
    const { data: ministry } = await supabaseAdmin
      .from('ministries')
      .select('id, plan, subscription_plan_id')
      .eq('id', ministryId)
      .maybeSingle();

    if (!ministry) return null;

    if (ministry.subscription_plan_id) {
      const byId = await this.resolveById(supabaseAdmin, ministry.subscription_plan_id);
      if (byId) return byId;
    }

    if (ministry.plan) {
      const bySlug = await this.resolveBySlug(supabaseAdmin, ministry.plan);
      if (bySlug) return bySlug;
    }

    return null;
  }

  /**
   * Lista todos os planos comerciais ativos oficiais.
   */
  static async listActivePlans(
    supabaseAdmin: SupabaseClient
  ): Promise<PlanoComercialResolvido[]> {
    const { data } = await supabaseAdmin
      .from('subscription_plans')
      .select('id, name, slug, price_monthly')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    return (data || []).map((p: any) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      price_monthly: Number(p.price_monthly || 0),
    }));
  }
}
