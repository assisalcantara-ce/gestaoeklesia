-- Migration: Add paid_at column to platform_billing_invoices
-- Created at: 2026-08-23

ALTER TABLE public.platform_billing_invoices 
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ NULL;
