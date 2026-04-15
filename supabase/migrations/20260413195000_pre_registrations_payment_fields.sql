-- Campos de pagamento para pre_registrations
ALTER TABLE public.pre_registrations
  ADD COLUMN IF NOT EXISTS asaas_customer_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS asaas_payment_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS asaas_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS asaas_invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS asaas_bank_slip_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS payment_due_date DATE,
  ADD COLUMN IF NOT EXISTS boleto_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.pre_registrations.asaas_customer_id IS 'ID do cliente no Asaas';
COMMENT ON COLUMN public.pre_registrations.asaas_payment_id IS 'ID do pagamento no Asaas';
COMMENT ON COLUMN public.pre_registrations.asaas_status IS 'Status do pagamento no Asaas';
COMMENT ON COLUMN public.pre_registrations.asaas_invoice_url IS 'URL da fatura no Asaas';
COMMENT ON COLUMN public.pre_registrations.asaas_bank_slip_url IS 'URL do boleto no Asaas';
COMMENT ON COLUMN public.pre_registrations.payment_amount IS 'Valor do boleto (plano)';
COMMENT ON COLUMN public.pre_registrations.payment_due_date IS 'Vencimento do boleto';
COMMENT ON COLUMN public.pre_registrations.boleto_sent_at IS 'Data de envio do boleto';
