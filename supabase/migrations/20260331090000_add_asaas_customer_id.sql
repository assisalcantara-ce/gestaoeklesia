ALTER TABLE public.ministries
  ADD COLUMN IF NOT EXISTS asaas_customer_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_ministries_asaas_customer_id
  ON public.ministries(asaas_customer_id);
