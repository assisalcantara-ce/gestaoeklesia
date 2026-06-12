-- Fase C — Entrega 4 — Parecer Oficial e Assinaturas Digitais
-- Estende financial_fiscal_reviews com campos de emissão oficial.
-- Cria tabela financial_fiscal_signatures com RLS.
-- Estende constraint de tesouraria_fechamento_logs para novas ações.

BEGIN;

-- ── 1. Campos de parecer oficial em financial_fiscal_reviews ─────────────────

ALTER TABLE public.financial_fiscal_reviews
  ADD COLUMN IF NOT EXISTS parecer_status VARCHAR(30) NOT NULL DEFAULT 'rascunho',
  ADD COLUMN IF NOT EXISTS document_hash  TEXT,
  ADD COLUMN IF NOT EXISTS emitido_em     TIMESTAMPTZ;

ALTER TABLE public.financial_fiscal_reviews
  DROP CONSTRAINT IF EXISTS ffr_parecer_status_check;

ALTER TABLE public.financial_fiscal_reviews
  ADD CONSTRAINT ffr_parecer_status_check CHECK (
    parecer_status IN ('rascunho', 'aguardando_assinaturas', 'finalizado')
  );

CREATE INDEX IF NOT EXISTS idx_ffr_parecer_status ON public.financial_fiscal_reviews (parecer_status);

-- ── 2. Estender ações permitidas em tesouraria_fechamento_logs ───────────────

ALTER TABLE public.tesouraria_fechamento_logs
  DROP CONSTRAINT IF EXISTS tesouraria_flog_acao_check;

ALTER TABLE public.tesouraria_fechamento_logs
  ADD CONSTRAINT tesouraria_flog_acao_check CHECK (
    acao IN (
      'fechamento', 'reabertura', 'revisao',
      'emissao_parecer', 'assinatura', 'revogacao', 'reabertura_parecer'
    )
  );

-- ── 3. Tabela de assinaturas digitais ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.financial_fiscal_signatures (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id       UUID        NOT NULL REFERENCES public.financial_fiscal_reviews(id) ON DELETE CASCADE,
  ministry_id     UUID        NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  usuario_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  nome            TEXT        NOT NULL,
  cargo           TEXT        NOT NULL,
  tipo_assinatura VARCHAR(30) NOT NULL DEFAULT 'membro_conselho',
  hash_assinatura TEXT        NOT NULL,
  ip_address      INET,
  signed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ffs_tipo_check CHECK (
    tipo_assinatura IN (
      'presidente_conselho', 'membro_conselho', 'relator',
      'presidente_ministerio', 'tesoureiro'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_ffs_review    ON public.financial_fiscal_signatures (review_id);
CREATE INDEX IF NOT EXISTS idx_ffs_ministry  ON public.financial_fiscal_signatures (ministry_id);
CREATE INDEX IF NOT EXISTS idx_ffs_usuario   ON public.financial_fiscal_signatures (usuario_id);
CREATE INDEX IF NOT EXISTS idx_ffs_signed_at ON public.financial_fiscal_signatures (signed_at DESC);

-- ── 4. RLS em financial_fiscal_signatures ────────────────────────────────────

ALTER TABLE public.financial_fiscal_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ffs_select" ON public.financial_fiscal_signatures;
DROP POLICY IF EXISTS "ffs_insert" ON public.financial_fiscal_signatures;
DROP POLICY IF EXISTS "ffs_delete" ON public.financial_fiscal_signatures;

-- SELECT: ADMINISTRADOR, FINANCEIRO, PRESIDENCIA, CONSELHO_FISCAL, dono
CREATE POLICY "ffs_select" ON public.financial_fiscal_signatures FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = financial_fiscal_signatures.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR mu.permissions @> '["PRESIDENCIA"]'::jsonb
          OR mu.permissions @> '["CONSELHO_FISCAL"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = financial_fiscal_signatures.ministry_id AND m.user_id = auth.uid()
    )
  );

-- INSERT: ADMINISTRADOR, CONSELHO_FISCAL, PRESIDENCIA, dono
CREATE POLICY "ffs_insert" ON public.financial_fiscal_signatures FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = financial_fiscal_signatures.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["CONSELHO_FISCAL"]'::jsonb
          OR mu.permissions @> '["PRESIDENCIA"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = financial_fiscal_signatures.ministry_id AND m.user_id = auth.uid()
    )
  );

-- DELETE: ADMINISTRADOR, dono (revogação)
CREATE POLICY "ffs_delete" ON public.financial_fiscal_signatures FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = financial_fiscal_signatures.ministry_id
        AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = financial_fiscal_signatures.ministry_id AND m.user_id = auth.uid()
    )
  );

COMMIT;
