-- Migration: Conselho Fiscal Digital — Fase C Entrega 3
-- Cria tabela de pareceres fiscais por fechamento com RLS.

BEGIN;

-- ── Tabela principal ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.financial_fiscal_reviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id      UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  fechamento_id    UUID NOT NULL REFERENCES public.tesouraria_fechamentos(id) ON DELETE CASCADE,
  congregacao_id   UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  mes_referencia   VARCHAR(7) NOT NULL,
  status           VARCHAR(30) NOT NULL DEFAULT 'pendente',
  parecer          TEXT,
  ressalvas        TEXT,
  recomendacoes    TEXT,
  reviewed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ffr_status_check CHECK (
    status IN ('pendente','em_analise','aprovado','aprovado_com_ressalvas','rejeitado')
  ),
  CONSTRAINT ffr_unique_fechamento UNIQUE (fechamento_id)
);

CREATE INDEX IF NOT EXISTS idx_ffr_ministry     ON public.financial_fiscal_reviews (ministry_id);
CREATE INDEX IF NOT EXISTS idx_ffr_fechamento   ON public.financial_fiscal_reviews (fechamento_id);
CREATE INDEX IF NOT EXISTS idx_ffr_congregacao  ON public.financial_fiscal_reviews (congregacao_id);
CREATE INDEX IF NOT EXISTS idx_ffr_mes          ON public.financial_fiscal_reviews (mes_referencia);
CREATE INDEX IF NOT EXISTS idx_ffr_status       ON public.financial_fiscal_reviews (status);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.financial_fiscal_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ffr_select ON public.financial_fiscal_reviews;
DROP POLICY IF EXISTS ffr_insert ON public.financial_fiscal_reviews;
DROP POLICY IF EXISTS ffr_update ON public.financial_fiscal_reviews;

-- SELECT: ADMINISTRADOR, FINANCEIRO, PRESIDENCIA, CONSELHO_FISCAL, dono do ministério
CREATE POLICY "ffr_select" ON public.financial_fiscal_reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = financial_fiscal_reviews.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR mu.permissions @> '["PRESIDENCIA"]'::jsonb
          OR mu.permissions @> '["CONSELHO_FISCAL"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = financial_fiscal_reviews.ministry_id AND m.user_id = auth.uid()
    )
  );

-- INSERT: ADMINISTRADOR, CONSELHO_FISCAL, dono do ministério
CREATE POLICY "ffr_insert" ON public.financial_fiscal_reviews FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = financial_fiscal_reviews.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["CONSELHO_FISCAL"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = financial_fiscal_reviews.ministry_id AND m.user_id = auth.uid()
    )
  );

-- UPDATE: ADMINISTRADOR, CONSELHO_FISCAL, dono do ministério
-- FINANCEIRO não pode alterar após emissão (bloqueado pela regra de negócio na UI e aqui)
CREATE POLICY "ffr_update" ON public.financial_fiscal_reviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = financial_fiscal_reviews.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["CONSELHO_FISCAL"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = financial_fiscal_reviews.ministry_id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = financial_fiscal_reviews.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["CONSELHO_FISCAL"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = financial_fiscal_reviews.ministry_id AND m.user_id = auth.uid()
    )
  );

COMMIT;
