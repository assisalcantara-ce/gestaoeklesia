-- Migration: Create platform_billing_invoices table
-- Created at: 2026-06-15

CREATE TABLE IF NOT EXISTS public.platform_billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  subscription_plan_id UUID NULL REFERENCES public.subscription_plans(id),
  plano_slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE NULL,
  period_start TIMESTAMPTZ NULL,
  period_end TIMESTAMPTZ NULL,
  asaas_customer_id TEXT NULL,
  asaas_payment_id TEXT NULL,
  asaas_invoice_url TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_platform_billing_invoices_ministry_id 
  ON public.platform_billing_invoices(ministry_id);

CREATE INDEX IF NOT EXISTS idx_platform_billing_invoices_status 
  ON public.platform_billing_invoices(status);

CREATE INDEX IF NOT EXISTS idx_platform_billing_invoices_due_date 
  ON public.platform_billing_invoices(due_date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_billing_invoices_asaas_payment_id 
  ON public.platform_billing_invoices(asaas_payment_id) 
  WHERE asaas_payment_id IS NOT NULL;

-- Enable Row Level Security (RLS)
ALTER TABLE public.platform_billing_invoices ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "platform_billing_invoices_admin_all" ON public.platform_billing_invoices;
CREATE POLICY "platform_billing_invoices_admin_all" 
  ON public.platform_billing_invoices
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.role = 'admin'
        AND au.is_active = true
    )
  );

DROP POLICY IF EXISTS "platform_billing_invoices_tenant_select" ON public.platform_billing_invoices;
CREATE POLICY "platform_billing_invoices_tenant_select" 
  ON public.platform_billing_invoices
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid() 
        AND mu.ministry_id = platform_billing_invoices.ministry_id
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = platform_billing_invoices.ministry_id 
        AND m.user_id = auth.uid()
    )
  );
