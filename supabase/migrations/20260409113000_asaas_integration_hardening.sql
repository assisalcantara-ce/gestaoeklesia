-- ============================================
-- ASAAS Integration Hardening
-- - Estrutura para metadados de cobranca no payments
-- - Historico idempotente de eventos de webhook
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Garante tabela base de pagamentos quando o ambiente ainda nao aplicou o schema admin completo.
DO $$
BEGIN
  IF to_regclass('public.payments') IS NULL THEN
    IF to_regclass('public.ministries') IS NULL THEN
      RAISE EXCEPTION 'Tabela public.ministries nao existe. Execute primeiro as migracoes base de tenant/admin.';
    END IF;

    CREATE TABLE public.payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
      asaas_payment_id VARCHAR(100) UNIQUE,
      subscription_plan_id UUID,
      amount DECIMAL(10, 2) NOT NULL,
      description VARCHAR(500),
      due_date DATE NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      payment_method VARCHAR(50),
      payment_date TIMESTAMP,
      period_start DATE,
      period_end DATE,
      asaas_response JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    IF to_regclass('public.subscription_plans') IS NOT NULL THEN
      ALTER TABLE public.payments
        ADD CONSTRAINT payments_subscription_plan_id_fkey
        FOREIGN KEY (subscription_plan_id)
        REFERENCES public.subscription_plans(id);
    END IF;

    CREATE INDEX IF NOT EXISTS idx_payments_ministry_id ON public.payments(ministry_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
    CREATE INDEX IF NOT EXISTS idx_payments_due_date ON public.payments(due_date);
  END IF;
END $$;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS asaas_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS asaas_invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS asaas_bank_slip_url TEXT,
  ADD COLUMN IF NOT EXISTS asaas_pix_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS asaas_last_event VARCHAR(100),
  ADD COLUMN IF NOT EXISTS asaas_last_event_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS asaas_last_sync_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payments_asaas_status
  ON public.payments(asaas_status);

CREATE INDEX IF NOT EXISTS idx_payments_asaas_last_sync_at
  ON public.payments(asaas_last_sync_at DESC);

CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(120) UNIQUE,
  asaas_payment_id VARCHAR(100),
  event_type VARCHAR(80) NOT NULL,
  payload JSONB NOT NULL,
  process_status VARCHAR(20) NOT NULL DEFAULT 'received',
  process_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_payment_id
  ON public.asaas_webhook_events(asaas_payment_id);

CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_event_type
  ON public.asaas_webhook_events(event_type);

CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_received_at
  ON public.asaas_webhook_events(received_at DESC);

ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.admin_users') IS NOT NULL
    AND NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'asaas_webhook_events'
      AND policyname = 'asaas_webhook_events_admin_read'
  ) THEN
    CREATE POLICY asaas_webhook_events_admin_read
      ON public.asaas_webhook_events
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.admin_users au
          WHERE au.user_id = auth.uid()
            AND au.is_active = true
            AND (
              au.can_manage_payments = true
              OR au.role = 'admin'
            )
        )
      );
  ELSIF to_regclass('public.admin_users') IS NULL THEN
    RAISE NOTICE 'Tabela public.admin_users nao encontrada. Policy de leitura admin em asaas_webhook_events foi ignorada.';
  END IF;
END $$;
