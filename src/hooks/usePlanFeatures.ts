'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { FeatureFlag, resolvePlanFeatures } from '@/lib/feature-flags';

export interface PlanFeatures {
  has_modulo_financeiro: boolean;
  has_modulo_financeiro_avancado: boolean;
  has_modulo_eventos: boolean;
  has_modulo_reunioes: boolean;
  has_modulo_agenda: boolean;
  has_modulo_ebd: boolean;
  has_modulo_missoes: boolean;
  has_modulo_funcionarios: boolean;
  has_modulo_comissao: boolean;
  has_modulo_kids: boolean;
  has_modulo_presidencial: boolean;
  has_modulo_conselho_fiscal: boolean;
  has_arrecadacao_digital: boolean;
  /** Mapa completo de Feature Flags resolvidos para o plano */
  flags: Record<FeatureFlag, boolean>;
  /** Método utilitário para checar qualquer Feature Flag */
  hasFeature: (feature: FeatureFlag) => boolean;
  /** Status da assinatura do ministério ('trial', 'active', 'cancelled', etc.) */
  subscription_status: string | null;
  /** Data de término da assinatura ou do trial */
  subscription_end_date: string | null;
  /** true enquanto carrega, false quando resolvido */
  loading: boolean;
}

const DEFAULT_FLAGS = resolvePlanFeatures(null);

const DEFAULT_FEATURES: PlanFeatures = {
  has_modulo_financeiro: true,
  has_modulo_financeiro_avancado: false,
  has_modulo_eventos: false,
  has_modulo_reunioes: true,
  has_modulo_agenda: false,
  has_modulo_ebd: false,          // default fail-closed para o Plano Básico enquanto carrega
  has_modulo_missoes: false,     // default fail-closed para o Plano Básico enquanto carrega
  has_modulo_funcionarios: false, // default fail-closed para o Plano Básico e Starter enquanto carrega
  has_modulo_comissao: false,     // default fail-closed para o Plano Básico e Starter enquanto carrega
  has_modulo_kids: false,         // default fail-closed para o Plano Básico e Starter enquanto carrega
  has_modulo_presidencial: false, // default fail-closed para os Planos Básico, Starter e Intermediário
  has_modulo_conselho_fiscal: false, // default fail-closed para os Planos Básico, Starter e Intermediário
  has_arrecadacao_digital: false, // default fail-closed para o Plano Básico enquanto carrega
  flags: DEFAULT_FLAGS,
  hasFeature: (feature: FeatureFlag) => DEFAULT_FLAGS[feature] ?? false,
  subscription_status: null,
  subscription_end_date: null,
  loading: true,
};

export function usePlanFeatures(): PlanFeatures {
  const supabase = useMemo(() => createClient(), []);
  const [features, setFeatures] = useState<PlanFeatures>(DEFAULT_FEATURES);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setFeatures({ ...DEFAULT_FEATURES, loading: false });
          return;
        }

        // Tenta via ministry_users (usuário secundário)
        const { data: mu } = await supabase
          .from('ministry_users')
          .select('ministry_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        const ministryId: string | null = mu?.ministry_id ?? null;

        // Fallback: owner direto na tabela ministries
        const query = ministryId
          ? supabase
              .from('ministries')
              .select('plan, subscription_plan_id, subscription_status, subscription_end_date, subscription_plans(id, slug, name, price_monthly, max_users, has_modulo_financeiro, has_modulo_financeiro_avancado, has_modulo_eventos, has_modulo_reunioes, modulos)')
              .eq('id', ministryId)
              .limit(1)
              .maybeSingle()
          : supabase
              .from('ministries')
              .select('plan, subscription_plan_id, subscription_status, subscription_end_date, subscription_plans(id, slug, name, price_monthly, max_users, has_modulo_financeiro, has_modulo_financeiro_avancado, has_modulo_eventos, has_modulo_reunioes, modulos)')
              .eq('user_id', user.id)
              .limit(1)
              .maybeSingle();

        const { data: ministry } = await query;

        const dbPlan = (ministry as any)?.subscription_plans;
        const mergedPlan = dbPlan
          ? { ...dbPlan, plan: (ministry as any)?.plan }
          : { slug: (ministry as any)?.plan, plan: (ministry as any)?.plan };

        const resolvedFlags = resolvePlanFeatures(mergedPlan);

        if (!cancelled) {
          setFeatures({
            has_modulo_financeiro: resolvedFlags.financial_module,
            has_modulo_financeiro_avancado: resolvedFlags.advanced_finance,
            has_modulo_eventos: resolvedFlags.events_module,
            has_modulo_reunioes: resolvedFlags.meetings_module,
            has_modulo_agenda: resolvedFlags.agenda_module,
            has_modulo_ebd: resolvedFlags.ebd_module,
            has_modulo_missoes: resolvedFlags.missions_module,
            has_modulo_funcionarios: resolvedFlags.employees_module,
            has_modulo_comissao: resolvedFlags.ordination_module,
            has_modulo_kids: resolvedFlags.kids_module,
            has_modulo_presidencial: resolvedFlags.presidency_module,
            has_modulo_conselho_fiscal: resolvedFlags.fiscal_council_module,
            has_arrecadacao_digital: resolvedFlags.digital_collection,
            flags: resolvedFlags,
            hasFeature: (feature: FeatureFlag) => resolvedFlags[feature] ?? false,
            subscription_status: (ministry as any)?.subscription_status ?? null,
            subscription_end_date: (ministry as any)?.subscription_end_date ?? null,
            loading: false,
          });
        }
      } catch {
        if (!cancelled) setFeatures({ ...DEFAULT_FEATURES, loading: false });
      }
    };

    load();
    return () => { cancelled = true; };
  }, [supabase]);

  return features;
}
