-- Corrige policies por role para NÃO vazar cross-tenant e para realmente filtrar
-- (policies permissivas são combinadas por OR; aqui usamos RESTRICTIVE para impor filtro)

-- =========================
-- Congregações
-- =========================

ALTER TABLE public.congregacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "congregacoes_filtered_by_role" ON public.congregacoes;

CREATE POLICY "congregacoes_filtered_by_role"
  ON public.congregacoes
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = congregacoes.ministry_id
        AND (
          mu.role IN ('admin', 'manager', 'viewer')
          OR (mu.role = 'supervisor' AND mu.supervisao_id = congregacoes.supervisao_id)
          OR (mu.role = 'operator' AND mu.congregacao_id = congregacoes.id)
        )
    )
  );


-- =========================
-- Members / Membros (compat)
-- =========================

DO $$
BEGIN
  IF to_regclass('public.members') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.members ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "members_filtered_by_role" ON public.members';

    EXECUTE $$
      CREATE POLICY "members_filtered_by_role"
        ON public.members
        AS RESTRICTIVE
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.ministry_users mu
            WHERE mu.user_id = auth.uid()
              AND mu.ministry_id = members.ministry_id
              AND (
                mu.role IN ('admin', 'manager', 'viewer')
                OR (
                  mu.role = 'supervisor'
                  AND EXISTS (
                    SELECT 1
                    FROM public.congregacoes c
                    WHERE c.id = members.congregacao_id
                      AND c.ministry_id = members.ministry_id
                      AND c.supervisao_id = mu.supervisao_id
                  )
                )
                OR (
                  mu.role = 'operator'
                  AND mu.congregacao_id = members.congregacao_id
                )
              )
          )
        )
    $$;
  END IF;

  IF to_regclass('public.membros') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.membros ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "membros_filtered_by_role" ON public.membros';

    EXECUTE $$
      CREATE POLICY "membros_filtered_by_role"
        ON public.membros
        AS RESTRICTIVE
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.ministry_users mu
            WHERE mu.user_id = auth.uid()
              AND mu.ministry_id = membros.ministry_id
              AND (
                mu.role IN ('admin', 'manager', 'viewer')
                OR (
                  mu.role = 'supervisor'
                  AND EXISTS (
                    SELECT 1
                    FROM public.congregacoes c
                    WHERE c.id = membros.congregacao_id
                      AND c.ministry_id = membros.ministry_id
                      AND c.supervisao_id = mu.supervisao_id
                  )
                )
                OR (
                  mu.role = 'operator'
                  AND mu.congregacao_id = membros.congregacao_id
                )
              )
          )
        )
    $$;
  END IF;
END
$$;
