-- ─────────────────────────────────────────────────────────────────────────────
-- Migração: add payer_email ao fin_payment_charges
-- Necessária para exibição na tela de cobranças PIX da Tesouraria
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.fin_payment_charges
  ADD COLUMN IF NOT EXISTS payer_email VARCHAR(255);
