-- ============================================
-- Adiciona módulos extras aos planos de assinatura
-- has_modulo_financeiro: acesso ao módulo financeiro
-- has_modulo_eventos: acesso ao módulo de eventos
-- has_modulo_reunioes: acesso ao módulo de reuniões
-- ============================================

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS has_modulo_financeiro BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_modulo_eventos BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_modulo_reunioes BOOLEAN NOT NULL DEFAULT FALSE;
