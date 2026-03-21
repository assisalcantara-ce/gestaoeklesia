-- Ajusta RLS de congregacoes para permitir também o "owner" do ministério (fallback)
-- além de usuários associados via ministry_users.
--
-- Motivo: algumas telas resolvem ministry_id via public.ministries.user_id (owner) quando não há linha em ministry_users.
-- Sem este fallback, INSERT/UPDATE podem falhar com: "new row violates row-level security policy".

-- Ensure: algumas bases legadas podem não ter ministry_id em public.congregacoes.
-- Este bloco evita falhas ao criar policies que referenciam a coluna.
DO $$
DECLARE
  v_single_ministry uuid;
BEGIN
  IF to_regclass('public.congregacoes') IS NULL THEN
    RAISE NOTICE 'Tabela public.congregacoes não existe; pulando ajustes de RLS.';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.congregacoes ADD COLUMN IF NOT EXISTS ministry_id uuid';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_congregacoes_ministry_id ON public.congregacoes(ministry_id)';

  -- Backfill best-effort: se existir apenas 1 ministério, atribui a ele os registros sem ministry_id.
  SELECT id INTO v_single_ministry
  FROM public.ministries
  LIMIT 2;

  IF (SELECT COUNT(*) FROM public.ministries) = 1 THEN
    UPDATE public.congregacoes
    SET ministry_id = v_single_ministry
    WHERE ministry_id IS NULL;
  END IF;

  BEGIN
    EXECUTE 'ALTER TABLE public.congregacoes ALTER COLUMN ministry_id SET NOT NULL';
  EXCEPTION WHEN others THEN
    -- Não força NOT NULL se ainda houver nulos (ou se a base não permitir neste momento)
    RAISE NOTICE 'Não foi possível definir ministry_id como NOT NULL agora; mantendo como está.';
  END;

  BEGIN
    EXECUTE 'ALTER TABLE public.congregacoes ADD CONSTRAINT congregacoes_ministry_id_fkey FOREIGN KEY (ministry_id) REFERENCES public.ministries(id) ON DELETE CASCADE';
  EXCEPTION WHEN duplicate_object THEN
    -- já existe
    NULL;
  WHEN others THEN
    RAISE NOTICE 'Não foi possível criar FK congregacoes_ministry_id_fkey agora; mantendo sem FK.';
  END;
END
$$;

ALTER TABLE public.congregacoes ENABLE ROW LEVEL SECURITY;

-- =========================
-- Policies base por ministry (CRUD)
-- =========================

DROP POLICY IF EXISTS "congregacoes_ministry_select" ON public.congregacoes;
CREATE POLICY "congregacoes_ministry_select"
  ON public.congregacoes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = congregacoes.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = congregacoes.ministry_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "congregacoes_ministry_insert" ON public.congregacoes;
CREATE POLICY "congregacoes_ministry_insert"
  ON public.congregacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    congregacoes.ministry_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.ministry_users mu
        WHERE mu.user_id = auth.uid()
          AND mu.ministry_id = congregacoes.ministry_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.ministries m
        WHERE m.id = congregacoes.ministry_id
          AND m.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "congregacoes_ministry_update" ON public.congregacoes;
CREATE POLICY "congregacoes_ministry_update"
  ON public.congregacoes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = congregacoes.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = congregacoes.ministry_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    congregacoes.ministry_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.ministry_users mu
        WHERE mu.user_id = auth.uid()
          AND mu.ministry_id = congregacoes.ministry_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.ministries m
        WHERE m.id = congregacoes.ministry_id
          AND m.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "congregacoes_ministry_delete" ON public.congregacoes;
CREATE POLICY "congregacoes_ministry_delete"
  ON public.congregacoes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = congregacoes.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = congregacoes.ministry_id
        AND m.user_id = auth.uid()
    )
  );

-- =========================
-- Policy RESTRICTIVE por role (SELECT)
-- =========================

DROP POLICY IF EXISTS "congregacoes_filtered_by_role" ON public.congregacoes;

DO $$
DECLARE
  has_supervisao_id boolean;
  has_congregacao_id boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ministry_users'
      AND column_name = 'supervisao_id'
  ) INTO has_supervisao_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ministry_users'
      AND column_name = 'congregacao_id'
  ) INTO has_congregacao_id;

  IF has_supervisao_id AND has_congregacao_id THEN
    EXECUTE $policy$
      CREATE POLICY "congregacoes_filtered_by_role"
        ON public.congregacoes
        AS RESTRICTIVE
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.ministries m
            WHERE m.id = congregacoes.ministry_id
              AND m.user_id = auth.uid()
          )
          OR EXISTS (
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
        )
    $policy$;
  ELSE
    -- Fallback simples: garante isolamento por ministry_id sem depender de colunas opcionais.
    EXECUTE $policy$
      CREATE POLICY "congregacoes_filtered_by_role"
        ON public.congregacoes
        AS RESTRICTIVE
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.ministries m
            WHERE m.id = congregacoes.ministry_id
              AND m.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.ministry_users mu
            WHERE mu.user_id = auth.uid()
              AND mu.ministry_id = congregacoes.ministry_id
          )
        )
    $policy$;
  END IF;
END
$$;
