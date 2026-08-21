-- Migration: Incluir TESOUREIRO_GERAL e TESOURARIA_LOCAL nas políticas RLS de tesouraria_lancamentos
-- Contexto: Usuários cadastrados com permissões ["TESOUREIRO_GERAL"] ou ["TESOURARIA_LOCAL"] não eram contemplados nas checagens
-- das RLS de SELECT/INSERT/UPDATE/DELETE em public.tesouraria_lancamentos, fazendo com que a consulta do banco retornasse 0 registros para eles.

BEGIN;

-- ─── SELECT ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tesouraria_select" ON public.tesouraria_lancamentos;

CREATE POLICY "tesouraria_select"
  ON public.tesouraria_lancamentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_lancamentos.ministry_id
        AND (
          mu.role IN ('admin', 'super_admin', 'dono')
          OR mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR mu.permissions @> '["TESOUREIRO_GERAL"]'::jsonb
          OR mu.permissions @> '["PRESIDENCIA"]'::jsonb
          OR mu.permissions @> '["CONSELHO_FISCAL"]'::jsonb
          OR (
            (mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb OR mu.permissions @> '["TESOURARIA_LOCAL"]'::jsonb)
            AND tesouraria_lancamentos.congregacao_id = mu.congregacao_id
          )
        )
    )
    OR
    -- Owner direto do ministério (sem registro em ministry_users)
    EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = tesouraria_lancamentos.ministry_id
        AND m.user_id = auth.uid()
    )
  );

-- ─── INSERT ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tesouraria_insert" ON public.tesouraria_lancamentos;

CREATE POLICY "tesouraria_insert"
  ON public.tesouraria_lancamentos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_lancamentos.ministry_id
        AND (
          mu.role IN ('admin', 'super_admin', 'dono')
          OR mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR mu.permissions @> '["TESOUREIRO_GERAL"]'::jsonb
          OR (
            (mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb OR mu.permissions @> '["TESOURARIA_LOCAL"]'::jsonb)
            AND tesouraria_lancamentos.congregacao_id = mu.congregacao_id
          )
        )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = tesouraria_lancamentos.ministry_id
        AND m.user_id = auth.uid()
    )
  );

-- ─── UPDATE ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tesouraria_update" ON public.tesouraria_lancamentos;

CREATE POLICY "tesouraria_update"
  ON public.tesouraria_lancamentos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_lancamentos.ministry_id
        AND (
          mu.role IN ('admin', 'super_admin', 'dono')
          OR mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR mu.permissions @> '["TESOUREIRO_GERAL"]'::jsonb
          OR (
            (mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb OR mu.permissions @> '["TESOURARIA_LOCAL"]'::jsonb)
            AND tesouraria_lancamentos.congregacao_id = mu.congregacao_id
          )
        )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = tesouraria_lancamentos.ministry_id
        AND m.user_id = auth.uid()
    )
  );

-- ─── DELETE ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tesouraria_delete" ON public.tesouraria_lancamentos;

CREATE POLICY "tesouraria_delete"
  ON public.tesouraria_lancamentos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_lancamentos.ministry_id
        AND (
          mu.role IN ('admin', 'super_admin', 'dono')
          OR mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR mu.permissions @> '["TESOUREIRO_GERAL"]'::jsonb
        )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = tesouraria_lancamentos.ministry_id
        AND m.user_id = auth.uid()
    )
  );

COMMIT;
