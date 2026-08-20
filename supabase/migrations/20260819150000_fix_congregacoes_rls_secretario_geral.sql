-- Migration: Corrigir RLS RESTRICTIVE de congregacoes para perfis gerais da secretaria (SECRETÁRIO GERAL, AUXILIAR SECRETARIA, SECRETARIA LOCAL) e role='operator'
-- Contexto: O cadastro de congregação/distrito/campo por usuários como "SECRETÁRIO GERAL" (cujo role em `ministry_users` é 'operator' e permissions contêm 'SECRETARIO_GERAL')
-- falhava porque a policy RESTRICTIVE "congregacoes_filtered_by_role" (ou "congregacoes_ministry_insert") exigia mu.role IN ('admin', 'manager', 'viewer') para vizualizar/inserir congregações no nível do ministério,
-- ou limitava mu.role = 'operator' apenas se mu.congregacao_id = congregacoes.id (o que impede INSERT de novas congregações cujo ID ainda não existe).

BEGIN;

-- 1. Atualizar policy RESTRICTIVE para SELECT de congregacoes
DROP POLICY IF EXISTS "congregacoes_filtered_by_role" ON public.congregacoes;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ministry_users'
      AND column_name = 'supervisao_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ministry_users'
      AND column_name = 'congregacao_id'
  ) THEN
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
                OR mu.permissions @> '["ADMINISTRADOR"]'::jsonb
                OR mu.permissions @> '["SECRETARIO_GERAL"]'::jsonb
                OR mu.permissions @> '["AUXILIAR_SECRETARIA"]'::jsonb
                OR (mu.role = 'supervisor' AND mu.supervisao_id = congregacoes.supervisao_id)
                OR (mu.role = 'operator' AND (mu.congregacao_id IS NULL OR mu.congregacao_id = congregacoes.id))
              )
          )
        )
    $policy$;
  ELSE
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

-- 2. Garantir que as policies PERMISSIVAS de INSERT em congregacoes, supervisoes e campos aceitem qualquer usuário vinculado ao ministério
DROP POLICY IF EXISTS "congregacoes_insert" ON public.congregacoes;
DROP POLICY IF EXISTS "congregacoes_ministry_insert" ON public.congregacoes;

CREATE POLICY "congregacoes_insert"
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

DROP POLICY IF EXISTS "supervisoes_insert" ON public.supervisoes;
DROP POLICY IF EXISTS "supervisoes_ministry_insert" ON public.supervisoes;

CREATE POLICY "supervisoes_insert"
  ON public.supervisoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    supervisoes.ministry_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.ministry_users mu
        WHERE mu.user_id = auth.uid()
          AND mu.ministry_id = public.supervisoes.ministry_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.ministries m
        WHERE m.id = public.supervisoes.ministry_id
          AND m.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "campos_insert" ON public.campos;
DROP POLICY IF EXISTS "campos_ministry_insert" ON public.campos;

CREATE POLICY "campos_insert"
  ON public.campos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    campos.ministry_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.ministry_users mu
        WHERE mu.user_id = auth.uid()
          AND mu.ministry_id = public.campos.ministry_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.ministries m
        WHERE m.id = public.campos.ministry_id
          AND m.user_id = auth.uid()
      )
    )
  );

COMMIT;
