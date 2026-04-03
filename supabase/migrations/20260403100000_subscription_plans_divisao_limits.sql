-- ============================================
-- Adiciona limites de divisões hierárquicas aos planos de assinatura
-- max_divisao1: limite de 1ª divisão (Supervisão/Campo/etc.)
-- max_divisao2: limite de 2ª divisão (0 = nenhuma)
-- max_divisao3: limite de 3ª divisão (-1 = ilimitado, 0 = nenhuma)
-- ============================================

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS max_divisao1 INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_divisao2 INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_divisao3 INTEGER NOT NULL DEFAULT -1;

-- Atualizar valores padrão por plano (por slug)
UPDATE public.subscription_plans SET max_divisao1 = 5,  max_divisao2 = 0,  max_divisao3 = 0   WHERE slug = 'basic';
UPDATE public.subscription_plans SET max_divisao1 = 10, max_divisao2 = 1,  max_divisao3 = -1  WHERE slug = 'starter';
UPDATE public.subscription_plans SET max_divisao1 = 25, max_divisao2 = 3,  max_divisao3 = -1  WHERE slug IN ('intermediario', 'intermediário');
UPDATE public.subscription_plans SET max_divisao1 = 50, max_divisao2 = 10, max_divisao3 = -1  WHERE slug = 'profissional';
UPDATE public.subscription_plans SET max_divisao1 = 100,max_divisao2 = 20, max_divisao3 = -1  WHERE slug = 'expert';
