-- Migration: Adicionar FINANCEIRO_LOCAL às políticas RLS de tesouraria_fechamentos
-- e tesouraria_fechamento_logs.
--
-- Problema: as políticas originais (20260416100000) só permitem ADMINISTRADOR,
-- FINANCEIRO e owner do ministério. FINANCEIRO_LOCAL não conseguia ler, inserir
-- ou atualizar fechamentos — quebrando o fluxo de fechamento por congregação.
--
-- Solução: FINANCEIRO_LOCAL pode operar APENAS nos registros da própria
-- congregação (congregacao_id = mu.congregacao_id).

BEGIN;

-- ── tesouraria_fechamentos ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS fechamento_select ON public.tesouraria_fechamentos;
DROP POLICY IF EXISTS fechamento_insert ON public.tesouraria_fechamentos;
DROP POLICY IF EXISTS fechamento_update ON public.tesouraria_fechamentos;

CREATE POLICY "fechamento_select" ON public.tesouraria_fechamentos
  FOR SELECT USING (
    -- ADMINISTRADOR / FINANCEIRO / owner vêem todos os fechamentos do ministério
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_fechamentos.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR mu.permissions @> '["PRESIDENCIA"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = tesouraria_fechamentos.ministry_id AND m.user_id = auth.uid()
    )
    -- FINANCEIRO_LOCAL: apenas fechamentos da própria congregação
    OR EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_fechamentos.ministry_id
        AND mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb
        AND tesouraria_fechamentos.congregacao_id = mu.congregacao_id
    )
  );

CREATE POLICY "fechamento_insert" ON public.tesouraria_fechamentos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_fechamentos.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = tesouraria_fechamentos.ministry_id AND m.user_id = auth.uid()
    )
    -- FINANCEIRO_LOCAL: só pode criar fechamento para sua congregação
    OR EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_fechamentos.ministry_id
        AND mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb
        AND tesouraria_fechamentos.congregacao_id = mu.congregacao_id
    )
  );

CREATE POLICY "fechamento_update" ON public.tesouraria_fechamentos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_fechamentos.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = tesouraria_fechamentos.ministry_id AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_fechamentos.ministry_id
        AND mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb
        AND tesouraria_fechamentos.congregacao_id = mu.congregacao_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_fechamentos.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = tesouraria_fechamentos.ministry_id AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_fechamentos.ministry_id
        AND mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb
        AND tesouraria_fechamentos.congregacao_id = mu.congregacao_id
    )
  );

-- ── tesouraria_fechamento_logs ─────────────────────────────────────────────────

DROP POLICY IF EXISTS tesouraria_flog_select ON public.tesouraria_fechamento_logs;
DROP POLICY IF EXISTS tesouraria_flog_insert ON public.tesouraria_fechamento_logs;

CREATE POLICY "tesouraria_flog_select" ON public.tesouraria_fechamento_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1
        FROM public.tesouraria_fechamentos tf
        JOIN public.ministry_users mu
          ON mu.ministry_id = tf.ministry_id AND mu.user_id = auth.uid()
       WHERE tf.id = tesouraria_fechamento_logs.fechamento_id
         AND (
           mu.permissions @> '["ADMINISTRADOR"]'::jsonb
           OR mu.permissions @> '["FINANCEIRO"]'::jsonb
           OR mu.permissions @> '["PRESIDENCIA"]'::jsonb
         )
    )
    OR EXISTS (
      SELECT 1
        FROM public.tesouraria_fechamentos tf
        JOIN public.ministries m ON m.id = tf.ministry_id
       WHERE tf.id = tesouraria_fechamento_logs.fechamento_id
         AND m.user_id = auth.uid()
    )
    -- FINANCEIRO_LOCAL: vê apenas logs do próprio fechamento (congregação deles)
    OR (
      tesouraria_fechamento_logs.usuario_id = auth.uid()
    )
  );

CREATE POLICY "tesouraria_flog_insert" ON public.tesouraria_fechamento_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.tesouraria_fechamentos tf
        JOIN public.ministry_users mu
          ON mu.ministry_id = tf.ministry_id AND mu.user_id = auth.uid()
       WHERE tf.id = tesouraria_fechamento_logs.fechamento_id
         AND (
           mu.permissions @> '["ADMINISTRADOR"]'::jsonb
           OR mu.permissions @> '["FINANCEIRO"]'::jsonb
           OR mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb
         )
    )
    OR EXISTS (
      SELECT 1
        FROM public.tesouraria_fechamentos tf
        JOIN public.ministries m ON m.id = tf.ministry_id
       WHERE tf.id = tesouraria_fechamento_logs.fechamento_id
         AND m.user_id = auth.uid()
    )
  );

COMMIT;
