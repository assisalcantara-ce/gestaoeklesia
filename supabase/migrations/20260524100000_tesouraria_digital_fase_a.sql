-- ============================================================================
-- Tesouraria Digital — Fase A: Arrecadação via PIX (ASAAS)
-- Migration: 20260524100000
-- Criado em: 2026-05-24
-- ============================================================================
-- Cria as tabelas:
--   - fin_payment_destinations  : destinos/QRs configurados pelo ministério
--   - fin_payment_charges       : cobranças PIX geradas pelo sistema
--   - fin_webhook_events        : log de eventos recebidos pelo webhook
-- ============================================================================

BEGIN;

-- ─── fin_payment_destinations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_payment_destinations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id      UUID        NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  gateway_id       UUID        NOT NULL REFERENCES public.ministry_payment_gateways(id) ON DELETE CASCADE,

  congregacao_id   UUID        REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  conta_id         UUID        REFERENCES public.fin_contas(id) ON DELETE SET NULL,
  categoria_id     UUID        REFERENCES public.fin_categorias(id) ON DELETE SET NULL,

  tipo_recebimento VARCHAR(30) NOT NULL,
  label            VARCHAR(100) NOT NULL,
  descricao        TEXT,
  cor              VARCHAR(7),
  icone            VARCHAR(50),

  public_token     UUID        NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  valor_fixo       NUMERIC(12,2),
  is_ativo         BOOLEAN     NOT NULL DEFAULT true,
  expires_at       TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fpd_tipo_valido CHECK (
    tipo_recebimento IN ('dizimo','oferta','missoes','doacao','campanha_local','evento_local')
  )
);

CREATE INDEX IF NOT EXISTS idx_fpd_ministry     ON public.fin_payment_destinations(ministry_id);
CREATE INDEX IF NOT EXISTS idx_fpd_gateway      ON public.fin_payment_destinations(gateway_id);
CREATE INDEX IF NOT EXISTS idx_fpd_public_token ON public.fin_payment_destinations(public_token);
CREATE INDEX IF NOT EXISTS idx_fpd_congregacao  ON public.fin_payment_destinations(congregacao_id);
CREATE INDEX IF NOT EXISTS idx_fpd_ativo        ON public.fin_payment_destinations(ministry_id, is_ativo);


-- ─── fin_payment_charges ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_payment_charges (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id              UUID        NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  destination_id           UUID        NOT NULL REFERENCES public.fin_payment_destinations(id) ON DELETE CASCADE,

  gateway                  VARCHAR(20) NOT NULL DEFAULT 'asaas',
  gateway_charge_id        VARCHAR(255) UNIQUE,
  gateway_customer_id      VARCHAR(255),
  gateway_external_ref     VARCHAR(200),
  gateway_response         JSONB,

  charge_type              VARCHAR(20) NOT NULL DEFAULT 'pix_dinamico',
  payment_method           VARCHAR(20),
  valor_solicitado         NUMERIC(12,2),
  valor_pago               NUMERIC(12,2),

  pix_payload              TEXT,
  pix_qrcode_url           TEXT,
  invoice_url              TEXT,

  payer_name               VARCHAR(255),
  payer_document           VARCHAR(30),

  status                   VARCHAR(20) NOT NULL DEFAULT 'pendente',

  tesouraria_lancamento_id UUID,
  idempotency_key          VARCHAR(100) UNIQUE,

  expires_at               TIMESTAMPTZ,
  paid_at                  TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fpc_status_valido CHECK (
    status IN ('pendente','pago','cancelado','expirado','estornado')
  )
);

CREATE INDEX IF NOT EXISTS idx_fpc_ministry    ON public.fin_payment_charges(ministry_id);
CREATE INDEX IF NOT EXISTS idx_fpc_destination ON public.fin_payment_charges(destination_id);
CREATE INDEX IF NOT EXISTS idx_fpc_charge_id   ON public.fin_payment_charges(gateway_charge_id);
CREATE INDEX IF NOT EXISTS idx_fpc_status      ON public.fin_payment_charges(ministry_id, status);


-- ─── fin_webhook_events ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_webhook_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id      UUID        NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,

  gateway          VARCHAR(20) NOT NULL,
  event_type       VARCHAR(50) NOT NULL,
  gateway_event_id VARCHAR(255),
  charge_id        VARCHAR(255),
  external_ref     VARCHAR(200),
  payload          JSONB       NOT NULL DEFAULT '{}',

  processed        BOOLEAN     NOT NULL DEFAULT false,
  processed_at     TIMESTAMPTZ,
  processing_error TEXT,
  destination_id   UUID,
  lancamento_id    UUID,

  received_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(gateway, gateway_event_id)
);

CREATE INDEX IF NOT EXISTS idx_fwe_ministry ON public.fin_webhook_events(ministry_id);
CREATE INDEX IF NOT EXISTS idx_fwe_charge   ON public.fin_webhook_events(charge_id);


-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.fin_payment_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_payment_charges      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_webhook_events       ENABLE ROW LEVEL SECURITY;

-- ── fin_payment_destinations ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "fpd_select" ON public.fin_payment_destinations;
DROP POLICY IF EXISTS "fpd_insert" ON public.fin_payment_destinations;
DROP POLICY IF EXISTS "fpd_update" ON public.fin_payment_destinations;
DROP POLICY IF EXISTS "fpd_delete" ON public.fin_payment_destinations;

CREATE POLICY "fpd_select" ON public.fin_payment_destinations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = fin_payment_destinations.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR (
            mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb
            AND (
              fin_payment_destinations.congregacao_id = mu.congregacao_id
              OR fin_payment_destinations.congregacao_id IS NULL
            )
          )
        )
    )
  );

CREATE POLICY "fpd_insert" ON public.fin_payment_destinations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = fin_payment_destinations.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR (
            mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb
            AND fin_payment_destinations.congregacao_id = mu.congregacao_id
          )
        )
    )
  );

CREATE POLICY "fpd_update" ON public.fin_payment_destinations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = fin_payment_destinations.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
        )
    )
  );

CREATE POLICY "fpd_delete" ON public.fin_payment_destinations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = fin_payment_destinations.ministry_id
        AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb
    )
  );

-- ── fin_payment_charges ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "fpc_select" ON public.fin_payment_charges;

CREATE POLICY "fpc_select" ON public.fin_payment_charges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = fin_payment_charges.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR (
            mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb
            AND EXISTS (
              SELECT 1 FROM public.fin_payment_destinations fpd
              WHERE fpd.id = fin_payment_charges.destination_id
                AND fpd.congregacao_id = mu.congregacao_id
            )
          )
        )
    )
  );

-- ── fin_webhook_events ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "fwe_select" ON public.fin_webhook_events;

CREATE POLICY "fwe_select" ON public.fin_webhook_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = fin_webhook_events.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
        )
    )
  );

COMMIT;
