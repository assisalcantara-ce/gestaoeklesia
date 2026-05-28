-- Migration: habilita has_modulo_eventos somente no plano Profissional
-- Regra comercial: módulo Eventos é exclusivo do plano Profissional.
-- Planos Basic, Starter e Intermediário permanecem com has_modulo_eventos = FALSE.

-- Garante FALSE em todos os planos primeiro (corrige possíveis inconsistências)
UPDATE public.subscription_plans
SET
  has_modulo_eventos = FALSE,
  updated_at         = CURRENT_TIMESTAMP
WHERE is_active = TRUE;

-- Habilita apenas no Profissional
UPDATE public.subscription_plans
SET
  has_modulo_eventos = TRUE,
  updated_at         = CURRENT_TIMESTAMP
WHERE slug = 'profissional';
