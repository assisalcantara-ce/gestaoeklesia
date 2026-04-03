-- Migration: Adiciona subscription_plan_id (UUID FK) à tabela ministries
-- Execute no SQL Editor do Supabase

ALTER TABLE public.ministries
  ADD COLUMN IF NOT EXISTS subscription_plan_id UUID REFERENCES public.subscription_plans(id);

-- Preencher subscription_plan_id baseado no campo plan (slug)
UPDATE public.ministries m
SET subscription_plan_id = sp.id
FROM public.subscription_plans sp
WHERE sp.slug = m.plan
  AND m.subscription_plan_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_ministries_subscription_plan_id
  ON public.ministries(subscription_plan_id);
