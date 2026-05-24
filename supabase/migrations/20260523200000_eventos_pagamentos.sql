-- =============================================================================
-- Fase 4A — Eventos Pagos: Tabela de Pagamentos e Novos Status de Inscrição
-- =============================================================================
-- Adiciona suporte a inscrições pagas via PIX (ASAAS) nos eventos.
--
-- NOVOS STATUS em eventos_inscricoes:
--   aguardando_pagamento — inscrição criada, PIX gerado, aguardando confirmação
--   expirado             — prazo de pagamento expirou sem confirmação
--
-- TABELA eventos_pagamentos:
--   Armazena o ciclo de vida de cada cobrança PIX:
--   pendente → pago | cancelado | expirado | estornado
-- =============================================================================

BEGIN;

-- ─── 1. Adicionar novos status ao CHECK de eventos_inscricoes ─────────────────
ALTER TABLE public.eventos_inscricoes
  DROP CONSTRAINT IF EXISTS inscricao_status_valido;

ALTER TABLE public.eventos_inscricoes
  ADD CONSTRAINT inscricao_status_valido CHECK (
    status IN ('confirmado','cancelado','lista_espera','aguardando_pagamento','expirado')
  );

-- ─── 2. Tabela eventos_pagamentos ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.eventos_pagamentos (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id              UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  evento_id                UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  inscricao_id             UUID NOT NULL REFERENCES public.eventos_inscricoes(id) ON DELETE CASCADE,

  -- Gateway
  gateway                  VARCHAR(20) NOT NULL DEFAULT 'asaas',
  gateway_charge_id        VARCHAR(255),          -- ID da cobrança no ASAAS
  gateway_customer_id      VARCHAR(255),          -- ID do customer no ASAAS
  gateway_response         JSONB,                 -- Resposta completa (para auditoria)

  -- Pagamento
  payment_method           VARCHAR(20) NOT NULL DEFAULT 'pix',
  valor                    NUMERIC(12,2) NOT NULL,
  status                   VARCHAR(20) NOT NULL DEFAULT 'pendente',

  -- PIX
  pix_payload              TEXT,                  -- Copia-e-cola (EMV)
  pix_qrcode               TEXT,                  -- URL da imagem do QR Code
  invoice_url              TEXT,                  -- URL da fatura ASAAS

  -- Tesouraria (preenchido após confirmação de pagamento)
  tesouraria_lancamento_id UUID,

  -- Datas
  expires_at               TIMESTAMPTZ,           -- Prazo de validade do PIX
  paid_at                  TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ep_gateway_valido CHECK (gateway IN ('asaas','efi')),
  CONSTRAINT ep_method_valido  CHECK (payment_method IN ('pix','boleto','cartao')),
  CONSTRAINT ep_status_valido  CHECK (
    status IN ('pendente','pago','cancelado','expirado','estornado')
  )
);

-- ─── Índices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ep_ministry        ON public.eventos_pagamentos(ministry_id);
CREATE INDEX IF NOT EXISTS idx_ep_evento          ON public.eventos_pagamentos(evento_id);
CREATE INDEX IF NOT EXISTS idx_ep_inscricao       ON public.eventos_pagamentos(inscricao_id);
CREATE INDEX IF NOT EXISTS idx_ep_charge          ON public.eventos_pagamentos(gateway_charge_id);
CREATE INDEX IF NOT EXISTS idx_ep_status_expires  ON public.eventos_pagamentos(status, expires_at)
  WHERE status = 'pendente';

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.eventos_pagamentos ENABLE ROW LEVEL SECURITY;

-- Leitura: admins, secretários e financeiros do ministério
DROP POLICY IF EXISTS ep_select ON public.eventos_pagamentos;
CREATE POLICY "ep_select" ON public.eventos_pagamentos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = eventos_pagamentos.ministry_id
        AND mu.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = eventos_pagamentos.ministry_id AND m.user_id = auth.uid()
    )
  );

-- Inserção/atualização apenas via service_role (API routes — sem policy pública)
-- A ausência de policy INSERT/UPDATE faz com que apenas service_role consiga escrever.

COMMIT;
