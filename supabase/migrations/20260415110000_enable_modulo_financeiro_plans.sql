-- Módulo financeiro (Tesouraria) disponível a partir do plano Starter
-- Basic não tem acesso. Profissional futuramente terá módulo financeiro avançado.
UPDATE public.subscription_plans
SET
  has_modulo_financeiro = true,
  updated_at = CURRENT_TIMESTAMP
WHERE slug IN ('starter', 'intermediario', 'profissional');

UPDATE public.subscription_plans
SET
  has_modulo_financeiro = false,
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'basic';
