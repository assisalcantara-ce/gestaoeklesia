-- Adiciona coluna has_modulo_financeiro_avancado (módulo Financeiro: contas a pagar/receber)
-- Disponível apenas no plano Profissional. Atualmente false para todos (módulo não implementado).
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS has_modulo_financeiro_avancado BOOLEAN NOT NULL DEFAULT FALSE;

-- Quando o módulo for implementado, descomentar a linha abaixo:
-- UPDATE public.subscription_plans SET has_modulo_financeiro_avancado = true WHERE slug = 'profissional';
