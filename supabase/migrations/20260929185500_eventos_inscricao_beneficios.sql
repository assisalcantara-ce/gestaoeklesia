-- =============================================================================
-- Módulo Eventos: Inscrição, Formas de Pagamento e Benefícios
-- Adiciona suporte a eventos gratuitos/pagos, formas de pagamento aceitas e
-- benefícios incluídos na inscrição (alimentação, hospedagem, brinde, certificado)
-- =============================================================================

BEGIN;

-- 1. Adiciona as colunas necessárias na tabela eventos
ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS evento_pago BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS formas_pagamento TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS inclui_alimentacao BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS inclui_brinde BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS inclui_certificado BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Atualiza registros históricos: se valor_inscricao > 0, marca evento_pago = TRUE
UPDATE public.eventos
SET evento_pago = TRUE
WHERE valor_inscricao > 0 AND evento_pago = FALSE;

COMMIT;
