-- =============================================================================
-- Fase 1 — Fundação Financeira: Configuração de Gateways por Ministério
-- =============================================================================
-- ministry_payment_gateways: cada ministério configura sua própria conta
-- no gateway de pagamento (ASAAS, EFI etc).
--
-- SEGURANÇA:
--   encrypted_credentials é TEXT contendo um payload AES-256-GCM criptografado
--   e codificado em base64. A chave de criptografia fica em CREDENTIALS_ENCRYPTION_KEY
--   (Vercel Secret / env). NUNCA retorne este campo ao frontend.
--
--   Use a RPC get_ministry_gateways() para consultas seguras (sem credenciais).
--
-- WEBHOOK:
--   webhook_token é um UUID único gerado automaticamente por registro.
--   A URL do webhook será: /api/v1/ministry-webhook/{gateway}/{webhook_token}
--   Isso garante isolamento multi-tenant: o gateway não precisa saber o ministry_id.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.ministry_payment_gateways (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id           UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  gateway               VARCHAR(30) NOT NULL,
  environment           VARCHAR(12) NOT NULL DEFAULT 'sandbox',
  display_name          VARCHAR(100),
  is_active             BOOLEAN NOT NULL DEFAULT false,
  status                VARCHAR(20) NOT NULL DEFAULT 'not_configured',
  -- Credenciais criptografadas (AES-256-GCM + base64). NUNCA expor ao frontend.
  encrypted_credentials TEXT,
  webhook_token         UUID NOT NULL DEFAULT gen_random_uuid(),
  webhook_url_hint      TEXT,
  last_test_at          TIMESTAMPTZ,
  last_test_ok          BOOLEAN,
  last_error            TEXT,
  connection_latency_ms INTEGER,
  configured_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT mpg_gateway_check     CHECK (gateway IN ('asaas','efi')),
  CONSTRAINT mpg_environment_check CHECK (environment IN ('sandbox','production')),
  CONSTRAINT mpg_status_check      CHECK (status IN ('not_configured','configured','connected','error'))
);

CREATE INDEX IF NOT EXISTS idx_mpg_ministry      ON public.ministry_payment_gateways(ministry_id);
CREATE INDEX IF NOT EXISTS idx_mpg_webhook_token ON public.ministry_payment_gateways(webhook_token);
CREATE INDEX IF NOT EXISTS idx_mpg_ministry_gw   ON public.ministry_payment_gateways(ministry_id, gateway);

-- Apenas um gateway ativo por tipo por ministério
CREATE UNIQUE INDEX IF NOT EXISTS uq_mpg_active_gateway
  ON public.ministry_payment_gateways(ministry_id, gateway)
  WHERE is_active = true;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.ministry_payment_gateways ENABLE ROW LEVEL SECURITY;

-- SELECT: ADMINISTRADOR e FINANCEIRO podem ver o registro, mas a coluna
-- encrypted_credentials NUNCA é retornada nas queries (controlado pela API/RPC)
DROP POLICY IF EXISTS mpg_select ON public.ministry_payment_gateways;
CREATE POLICY "mpg_select" ON public.ministry_payment_gateways FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid() AND mu.ministry_id = ministry_payment_gateways.ministry_id
      AND (
        mu.permissions @> '["ADMINISTRADOR"]'::jsonb
        OR mu.permissions @> '["FINANCEIRO"]'::jsonb
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.ministries m
    WHERE m.id = ministry_payment_gateways.ministry_id AND m.user_id = auth.uid()
  )
);

-- INSERT/UPDATE/DELETE: apenas ADMINISTRADOR
DROP POLICY IF EXISTS mpg_insert ON public.ministry_payment_gateways;
CREATE POLICY "mpg_insert" ON public.ministry_payment_gateways FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid() AND mu.ministry_id = ministry_payment_gateways.ministry_id
      AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb
  )
  OR EXISTS (
    SELECT 1 FROM public.ministries m
    WHERE m.id = ministry_payment_gateways.ministry_id AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS mpg_update ON public.ministry_payment_gateways;
CREATE POLICY "mpg_update" ON public.ministry_payment_gateways FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid() AND mu.ministry_id = ministry_payment_gateways.ministry_id
      AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb
  )
  OR EXISTS (
    SELECT 1 FROM public.ministries m
    WHERE m.id = ministry_payment_gateways.ministry_id AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS mpg_delete ON public.ministry_payment_gateways;
CREATE POLICY "mpg_delete" ON public.ministry_payment_gateways FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid() AND mu.ministry_id = ministry_payment_gateways.ministry_id
      AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb
  )
  OR EXISTS (
    SELECT 1 FROM public.ministries m
    WHERE m.id = ministry_payment_gateways.ministry_id AND m.user_id = auth.uid()
  )
);

-- ─── RPC segura: retorna gateways sem encrypted_credentials ──────────────────

CREATE OR REPLACE FUNCTION public.get_ministry_gateways(p_ministry_id UUID)
RETURNS TABLE (
  id                    UUID,
  ministry_id           UUID,
  gateway               VARCHAR,
  environment           VARCHAR,
  display_name          VARCHAR,
  is_active             BOOLEAN,
  status                VARCHAR,
  has_credentials       BOOLEAN,
  webhook_token         UUID,
  webhook_url_hint      TEXT,
  last_test_at          TIMESTAMPTZ,
  last_test_ok          BOOLEAN,
  last_error            TEXT,
  connection_latency_ms INTEGER,
  configured_by         UUID,
  created_at            TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica acesso ao ministério
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid() AND mu.ministry_id = p_ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = p_ministry_id AND m.user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado ao ministério %', p_ministry_id USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    mpg.id,
    mpg.ministry_id,
    mpg.gateway,
    mpg.environment,
    mpg.display_name,
    mpg.is_active,
    mpg.status,
    (mpg.encrypted_credentials IS NOT NULL) AS has_credentials,
    mpg.webhook_token,
    mpg.webhook_url_hint,
    mpg.last_test_at,
    mpg.last_test_ok,
    mpg.last_error,
    mpg.connection_latency_ms,
    mpg.configured_by,
    mpg.created_at,
    mpg.updated_at
  FROM public.ministry_payment_gateways mpg
  WHERE mpg.ministry_id = p_ministry_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ministry_gateways TO authenticated;

COMMIT;
