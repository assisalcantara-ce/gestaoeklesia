-- Migration: 20260823143000_add_pix_static_fields_to_destinations.sql
-- Adiciona colunas para suporte a QR Code PIX Estático permanente ASAAS em fin_payment_destinations

ALTER TABLE public.fin_payment_destinations
  ADD COLUMN IF NOT EXISTS pix_qr_code_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pix_payload TEXT,
  ADD COLUMN IF NOT EXISTS pix_external_reference VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_fpd_pix_qr_code_id ON public.fin_payment_destinations(pix_qr_code_id);
