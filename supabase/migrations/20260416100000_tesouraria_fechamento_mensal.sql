-- Módulo Tesouraria: Fechamento Mensal + Saídas/Despesas
-- Adiciona tipo_movimento (entrada/saida), cria tabela de fechamentos

BEGIN;

-- ─── 1. Adiciona tipo_movimento em tesouraria_lancamentos ─────────────────────
ALTER TABLE public.tesouraria_lancamentos
  ADD COLUMN IF NOT EXISTS tipo_movimento VARCHAR(10) NOT NULL DEFAULT 'entrada';

ALTER TABLE public.tesouraria_lancamentos
  ADD CONSTRAINT tesouraria_movimento_valido
    CHECK (tipo_movimento IN ('entrada', 'saida'));

-- ─── 2. Atualiza CHECK de tipo_recebimento para permitir categorias de saída ──
ALTER TABLE public.tesouraria_lancamentos
  DROP CONSTRAINT IF EXISTS tesouraria_tipo_valido;

ALTER TABLE public.tesouraria_lancamentos
  ADD CONSTRAINT tesouraria_tipo_valido CHECK (
    tipo_movimento = 'saida'
    OR tipo_recebimento IN (
      'oferta','dizimo','evento','campanha','contribuicao','outros','missoes'
    )
  );

-- ─── 3. Tabela de fechamentos mensais ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tesouraria_fechamentos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id      UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  mes_referencia   VARCHAR(7)   NOT NULL,   -- 'YYYY-MM'
  saldo_inicial    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_entradas   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_saidas     NUMERIC(12,2) NOT NULL DEFAULT 0,
  saldo_final      NUMERIC(12,2) NOT NULL DEFAULT 0,
  status           VARCHAR(20)  NOT NULL DEFAULT 'aberto',
  observacoes      TEXT,
  fechado_por      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fechado_em       TIMESTAMP,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (ministry_id, mes_referencia),
  CONSTRAINT fechamento_status CHECK (status IN ('aberto', 'fechado'))
);

CREATE INDEX IF NOT EXISTS idx_fechamentos_ministry ON public.tesouraria_fechamentos(ministry_id);
CREATE INDEX IF NOT EXISTS idx_fechamentos_mes      ON public.tesouraria_fechamentos(mes_referencia);

-- ─── 4. RLS fechamentos ───────────────────────────────────────────────────────
ALTER TABLE public.tesouraria_fechamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fechamento_select ON public.tesouraria_fechamentos;
DROP POLICY IF EXISTS fechamento_insert ON public.tesouraria_fechamentos;
DROP POLICY IF EXISTS fechamento_update ON public.tesouraria_fechamentos;

CREATE POLICY "fechamento_select" ON public.tesouraria_fechamentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_fechamentos.ministry_id
        AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["FINANCEIRO"]'::jsonb)
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = tesouraria_fechamentos.ministry_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "fechamento_insert" ON public.tesouraria_fechamentos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_fechamentos.ministry_id
        AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["FINANCEIRO"]'::jsonb)
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = tesouraria_fechamentos.ministry_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "fechamento_update" ON public.tesouraria_fechamentos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_fechamentos.ministry_id
        AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["FINANCEIRO"]'::jsonb)
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = tesouraria_fechamentos.ministry_id AND m.user_id = auth.uid()
    )
  );

COMMIT;
