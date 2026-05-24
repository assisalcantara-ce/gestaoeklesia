-- =============================================================================
-- Adiciona campos de sincronização de webhook ASAAS na tabela
-- ministry_payment_gateways.
--
-- asaas_webhook_id            → ID retornado pelo ASAAS ao registrar o webhook
-- asaas_webhook_registered_at → Timestamp da última sincronização bem-sucedida
-- asaas_webhook_status        → Estado da sincronização automática
--
-- Apenas colunas ASAAS preenchem esses campos; EFI deixa NULL.
-- NULL = "não aplicável" (gateway não é ASAAS ou ainda não tentou registrar).
-- =============================================================================

BEGIN;

ALTER TABLE public.ministry_payment_gateways
  ADD COLUMN IF NOT EXISTS asaas_webhook_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_webhook_registered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS asaas_webhook_status TEXT
    CHECK (
      asaas_webhook_status IS NULL
      OR asaas_webhook_status IN ('pending', 'registered', 'failed')
    );

COMMENT ON COLUMN public.ministry_payment_gateways.asaas_webhook_id
  IS 'ID do webhook registrado na conta ASAAS do ministério (ex.: wbh_xxxxx). Usado para PUT/DELETE.';

COMMENT ON COLUMN public.ministry_payment_gateways.asaas_webhook_registered_at
  IS 'Timestamp da última sincronização automática de webhook bem-sucedida.';

COMMENT ON COLUMN public.ministry_payment_gateways.asaas_webhook_status
  IS 'Estado da sincronização automática: pending | registered | failed. NULL = não aplicável.';

COMMIT;
