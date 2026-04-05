'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase-client';

export interface PlanFeatures {
  has_modulo_financeiro: boolean;
  has_modulo_eventos: boolean;
  has_modulo_reunioes: boolean;
  /** true enquanto carrega, false quando resolvido */
  loading: boolean;
}

const DEFAULT_FEATURES: PlanFeatures = {
  has_modulo_financeiro: true,
  has_modulo_eventos: true,
  has_modulo_reunioes: true,
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
              .select('subscription_plan_id, subscription_plans(has_modulo_financeiro, has_modulo_eventos, has_modulo_reunioes)')
              .eq('id', ministryId)
              .limit(1)
              .maybeSingle()
          : supabase
              .from('ministries')
              .select('subscription_plan_id, subscription_plans(has_modulo_financeiro, has_modulo_eventos, has_modulo_reunioes)')
              .eq('user_id', user.id)
              .limit(1)
              .maybeSingle();

        const { data: ministry } = await query;

        const plan = (ministry as any)?.subscription_plans;

        if (!cancelled) {
          setFeatures({
            has_modulo_financeiro: plan?.has_modulo_financeiro ?? true,
            has_modulo_eventos: plan?.has_modulo_eventos ?? true,
            has_modulo_reunioes: plan?.has_modulo_reunioes ?? true,
            loading: false,
          });
        }
      } catch {
        // Em caso de erro, libera acesso (fail-open) para não bloquear usuários
        if (!cancelled) setFeatures({ ...DEFAULT_FEATURES, loading: false });
      }
    };

    load();
    return () => { cancelled = true; };
  }, [supabase]);

  return features;
}
