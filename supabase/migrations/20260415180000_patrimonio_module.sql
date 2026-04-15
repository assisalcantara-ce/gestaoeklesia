-- Modulo Patrimônio

BEGIN;

-- ================================
-- ITENS DE PATRIMÔNIO
-- ================================

CREATE TABLE IF NOT EXISTS public.patrimonio_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,

  -- Vínculo com congregação/campo (onde o bem está)
  congregacao_id UUID,
  campo_id UUID,
  local_descricao TEXT, -- texto livre caso não haja FK

  -- Dados do bem
  numero_tombamento VARCHAR(60),
  descricao TEXT NOT NULL,
  categoria VARCHAR(80) NOT NULL DEFAULT 'equipamento',
  marca_modelo VARCHAR(255),
  numero_serie VARCHAR(255),
  cor VARCHAR(80),
  estado_conservacao VARCHAR(30) NOT NULL DEFAULT 'bom', -- 'otimo'|'bom'|'regular'|'ruim'|'inservivel'

  -- Valores
  valor_aquisicao NUMERIC(14,2),
  data_aquisicao DATE,
  origem VARCHAR(80) DEFAULT 'compra', -- 'compra'|'doacao'|'transferencia'|'outros'

  -- Responsável atual pelo bem
  responsavel_nome VARCHAR(255),
  responsavel_cargo VARCHAR(120),

  -- Controle
  status VARCHAR(30) NOT NULL DEFAULT 'ativo', -- 'ativo'|'baixado'|'emprestado'|'extraviado'
  data_baixa DATE,
  motivo_baixa TEXT,
  observacoes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patrimonio_itens_ministry_id
  ON public.patrimonio_itens(ministry_id);
CREATE INDEX IF NOT EXISTS idx_patrimonio_itens_congregacao_id
  ON public.patrimonio_itens(congregacao_id);
CREATE INDEX IF NOT EXISTS idx_patrimonio_itens_campo_id
  ON public.patrimonio_itens(campo_id);
CREATE INDEX IF NOT EXISTS idx_patrimonio_itens_status
  ON public.patrimonio_itens(status);
CREATE INDEX IF NOT EXISTS idx_patrimonio_itens_categoria
  ON public.patrimonio_itens(categoria);

-- FKs opcionais
DO $$
BEGIN
  IF to_regclass('public.congregacoes') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_patrimonio_congregacao'
  ) THEN
    ALTER TABLE public.patrimonio_itens
      ADD CONSTRAINT fk_patrimonio_congregacao
      FOREIGN KEY (congregacao_id) REFERENCES public.congregacoes(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.campos') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_patrimonio_campo'
  ) THEN
    ALTER TABLE public.patrimonio_itens
      ADD CONSTRAINT fk_patrimonio_campo
      FOREIGN KEY (campo_id) REFERENCES public.campos(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.patrimonio_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patrimonio_itens_ministry_select ON public.patrimonio_itens;
DROP POLICY IF EXISTS patrimonio_itens_ministry_insert ON public.patrimonio_itens;
DROP POLICY IF EXISTS patrimonio_itens_ministry_update ON public.patrimonio_itens;
DROP POLICY IF EXISTS patrimonio_itens_ministry_delete ON public.patrimonio_itens;

CREATE POLICY "patrimonio_itens_ministry_select"
  ON public.patrimonio_itens FOR SELECT
  USING (ministry_id IN (SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()));

CREATE POLICY "patrimonio_itens_ministry_insert"
  ON public.patrimonio_itens FOR INSERT
  WITH CHECK (ministry_id IN (SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()));

CREATE POLICY "patrimonio_itens_ministry_update"
  ON public.patrimonio_itens FOR UPDATE
  USING (ministry_id IN (SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()));

CREATE POLICY "patrimonio_itens_ministry_delete"
  ON public.patrimonio_itens FOR DELETE
  USING (ministry_id IN (SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()));

COMMIT;
