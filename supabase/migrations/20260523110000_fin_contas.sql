-- =============================================================================
-- Fase 1 — Fundação Financeira: Contas e Caixas por Ministério
-- =============================================================================
-- fin_contas: representa caixas físicos, contas bancárias, fundos e chaves PIX
-- congregacao_id NULL = conta da sede/Caixa Geral do ministério
-- is_padrao = TRUE = conta padrão para lançamentos sem conta explícita
-- UNIQUE INDEX garante apenas UMA conta padrão por ministério
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.fin_contas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id      UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id   UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  nome             VARCHAR(100) NOT NULL,
  tipo             VARCHAR(30)  NOT NULL DEFAULT 'caixa',
  banco            VARCHAR(100),
  agencia          VARCHAR(20),
  conta            VARCHAR(30),
  chave_pix        VARCHAR(255),
  saldo_inicial    NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_ativa         BOOLEAN NOT NULL DEFAULT true,
  is_padrao        BOOLEAN NOT NULL DEFAULT false,
  gateway_id       UUID,   -- FK para ministry_payment_gateways (criado na migration seguinte)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fin_contas_tipo_check CHECK (
    tipo IN ('caixa','conta_corrente','poupanca','pix','fundo','outro')
  )
);

CREATE INDEX IF NOT EXISTS idx_fin_contas_ministry    ON public.fin_contas(ministry_id);
CREATE INDEX IF NOT EXISTS idx_fin_contas_congregacao ON public.fin_contas(congregacao_id);
CREATE INDEX IF NOT EXISTS idx_fin_contas_padrao      ON public.fin_contas(ministry_id, is_padrao);

-- Garante apenas uma conta padrão por ministério
CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_contas_padrao
  ON public.fin_contas(ministry_id)
  WHERE is_padrao = true;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.fin_contas ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer usuário membro do ministério
DROP POLICY IF EXISTS fin_contas_select ON public.fin_contas;
CREATE POLICY "fin_contas_select" ON public.fin_contas FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid() AND mu.ministry_id = fin_contas.ministry_id
  )
  OR EXISTS (
    SELECT 1 FROM public.ministries m
    WHERE m.id = fin_contas.ministry_id AND m.user_id = auth.uid()
  )
);

-- INSERT: ADMINISTRADOR ou FINANCEIRO
DROP POLICY IF EXISTS fin_contas_insert ON public.fin_contas;
CREATE POLICY "fin_contas_insert" ON public.fin_contas FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid() AND mu.ministry_id = fin_contas.ministry_id
      AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["FINANCEIRO"]'::jsonb)
  )
  OR EXISTS (
    SELECT 1 FROM public.ministries m
    WHERE m.id = fin_contas.ministry_id AND m.user_id = auth.uid()
  )
);

-- UPDATE: ADMINISTRADOR ou FINANCEIRO
DROP POLICY IF EXISTS fin_contas_update ON public.fin_contas;
CREATE POLICY "fin_contas_update" ON public.fin_contas FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid() AND mu.ministry_id = fin_contas.ministry_id
      AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["FINANCEIRO"]'::jsonb)
  )
  OR EXISTS (
    SELECT 1 FROM public.ministries m
    WHERE m.id = fin_contas.ministry_id AND m.user_id = auth.uid()
  )
);

-- DELETE: apenas ADMINISTRADOR
DROP POLICY IF EXISTS fin_contas_delete ON public.fin_contas;
CREATE POLICY "fin_contas_delete" ON public.fin_contas FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid() AND mu.ministry_id = fin_contas.ministry_id
      AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb
  )
  OR EXISTS (
    SELECT 1 FROM public.ministries m
    WHERE m.id = fin_contas.ministry_id AND m.user_id = auth.uid()
  )
);

-- ─── Função: seed da conta padrão por ministério ──────────────────────────────
-- Chamar manualmente para ministérios já existentes:
--   SELECT fin_seed_conta_padrao('<ministry_id>');
-- Em produção, invocar para cada ministry_id existente após aplicar a migration.

CREATE OR REPLACE FUNCTION public.fin_seed_conta_padrao(p_ministry_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Só cria se ainda não há conta padrão para este ministério
  SELECT id INTO v_id
  FROM public.fin_contas
  WHERE ministry_id = p_ministry_id AND is_padrao = true
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.fin_contas (ministry_id, nome, tipo, is_ativa, is_padrao)
    VALUES (p_ministry_id, 'Caixa Geral', 'caixa', true, true)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fin_seed_conta_padrao TO authenticated;

COMMIT;
