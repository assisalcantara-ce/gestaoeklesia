-- Módulo Tesouraria

BEGIN;

-- ─── Tabela principal de lançamentos ─────────────────────────────────────────
-- congregacao_id IS NULL  → Caixa Geral (sede)
-- congregacao_id NOT NULL → Caixa da congregação específica

CREATE TABLE IF NOT EXISTS public.tesouraria_lancamentos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id        UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id     UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  departamento_id    UUID REFERENCES public.departamentos(id) ON DELETE SET NULL,

  tipo_recebimento   VARCHAR(30) NOT NULL,
  -- 'oferta' | 'dizimo' | 'evento' | 'campanha' | 'contribuicao'

  descricao          VARCHAR(255),
  referencia         VARCHAR(255),          -- nome do evento / campanha
  valor              NUMERIC(12,2) NOT NULL,
  forma_pagamento    VARCHAR(30) NOT NULL DEFAULT 'dinheiro',
  -- 'dinheiro' | 'pix' | 'cartao' | 'transferencia' | 'cheque'

  data_lancamento    DATE NOT NULL DEFAULT CURRENT_DATE,
  observacoes        TEXT,
  criado_por         UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT tesouraria_valor_positivo CHECK (valor > 0),
  CONSTRAINT tesouraria_tipo_valido CHECK (
    tipo_recebimento IN ('oferta','dizimo','evento','campanha','contribuicao')
  )
);

CREATE INDEX IF NOT EXISTS idx_tesouraria_ministry     ON public.tesouraria_lancamentos(ministry_id);
CREATE INDEX IF NOT EXISTS idx_tesouraria_congregacao  ON public.tesouraria_lancamentos(congregacao_id);
CREATE INDEX IF NOT EXISTS idx_tesouraria_data         ON public.tesouraria_lancamentos(data_lancamento);
CREATE INDEX IF NOT EXISTS idx_tesouraria_tipo         ON public.tesouraria_lancamentos(tipo_recebimento);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.tesouraria_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tesouraria_select         ON public.tesouraria_lancamentos;
DROP POLICY IF EXISTS tesouraria_insert         ON public.tesouraria_lancamentos;
DROP POLICY IF EXISTS tesouraria_update         ON public.tesouraria_lancamentos;
DROP POLICY IF EXISTS tesouraria_delete         ON public.tesouraria_lancamentos;

-- SELECT:
--   ADMINISTRADOR ou FINANCEIRO → vê todos os lançamentos do ministério
--   FINANCEIRO_LOCAL            → vê apenas lançamentos da sua congregação
CREATE POLICY "tesouraria_select"
  ON public.tesouraria_lancamentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_lancamentos.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR (
            mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb
            AND tesouraria_lancamentos.congregacao_id = mu.congregacao_id
          )
        )
    )
  );

-- INSERT:
--   ADMINISTRADOR ou FINANCEIRO → pode inserir em qualquer caixa
--   FINANCEIRO_LOCAL            → só pode inserir na sua própria congregação
CREATE POLICY "tesouraria_insert"
  ON public.tesouraria_lancamentos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_lancamentos.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR (
            mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb
            AND tesouraria_lancamentos.congregacao_id = mu.congregacao_id
          )
        )
    )
  );

-- UPDATE: mesma lógica do INSERT
CREATE POLICY "tesouraria_update"
  ON public.tesouraria_lancamentos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_lancamentos.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR (
            mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb
            AND tesouraria_lancamentos.congregacao_id = mu.congregacao_id
          )
        )
    )
  );

-- DELETE: apenas ADMINISTRADOR e FINANCEIRO geral
CREATE POLICY "tesouraria_delete"
  ON public.tesouraria_lancamentos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_lancamentos.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
        )
    )
  );

COMMIT;
