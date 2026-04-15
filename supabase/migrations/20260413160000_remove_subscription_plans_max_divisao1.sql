-- Remove max_divisao1 (limite nao utilizado)
ALTER TABLE public.subscription_plans
  DROP COLUMN IF EXISTS max_divisao1;
