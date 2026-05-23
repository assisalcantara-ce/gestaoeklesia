-- =============================================================================
-- Fase 1 — Fundação Financeira: Campos de rastreabilidade em tesouraria_lancamentos
-- =============================================================================
-- Todos os campos são nullable para preservar compatibilidade com dados históricos.
-- Lançamentos antigos ficam com conta_id/categoria_id/origem_modulo = NULL.
-- Novos lançamentos manuais recebem origem_modulo='manual' via código.
-- O índice único parcial garante que um mesmo registro de origem não gere
-- dois lançamentos contábeis.
-- =============================================================================

BEGIN;

-- ─── 1. Novos campos ──────────────────────────────────────────────────────────

ALTER TABLE public.tesouraria_lancamentos
  ADD COLUMN IF NOT EXISTS conta_id       UUID REFERENCES public.fin_contas(id)     ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS categoria_id   UUID REFERENCES public.fin_categorias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origem_modulo  VARCHAR(30),
  ADD COLUMN IF NOT EXISTS origem_id      UUID,
  -- transaction_id: FK para ministry_transactions (criado na Fase 3)
  -- mantido como UUID simples sem FK por enquanto para evitar dependência futura
  ADD COLUMN IF NOT EXISTS transaction_id UUID;

-- ─── 2. Constraint de valores válidos para origem_modulo ─────────────────────
-- DROP IF EXISTS garante idempotência (ALTER TABLE não suporta ADD CONSTRAINT IF NOT EXISTS)

ALTER TABLE public.tesouraria_lancamentos
  DROP CONSTRAINT IF EXISTS tesouraria_origem_modulo_check;

ALTER TABLE public.tesouraria_lancamentos
  ADD CONSTRAINT tesouraria_origem_modulo_check CHECK (
    origem_modulo IS NULL
    OR origem_modulo IN ('manual','missoes','ebd','evento','dizimo','gateway','loja','curso')
  );

-- ─── 3. Índices ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tesouraria_conta
  ON public.tesouraria_lancamentos(ministry_id, conta_id)
  WHERE conta_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tesouraria_categoria
  ON public.tesouraria_lancamentos(ministry_id, categoria_id)
  WHERE categoria_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tesouraria_origem
  ON public.tesouraria_lancamentos(origem_modulo, origem_id)
  WHERE origem_modulo IS NOT NULL;

-- Unicidade: mesmo registro de origem não gera dois lançamentos
-- (evita duplicidade caso dois módulos tentem criar o mesmo lançamento)
CREATE UNIQUE INDEX IF NOT EXISTS uq_tesouraria_origem
  ON public.tesouraria_lancamentos(ministry_id, origem_modulo, origem_id)
  WHERE origem_modulo IS NOT NULL AND origem_id IS NOT NULL;

COMMIT;
