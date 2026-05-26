-- Migration: habilita has_modulo_eventos em todos os planos ativos
-- Motivo: o módulo de Eventos está completamente construído e funcional,
-- mas a migration 20260410100000 deixou has_modulo_eventos = FALSE em todos
-- os planos por engano, tornando o item invisível no menu lateral.

UPDATE public.subscription_plans
SET
  has_modulo_eventos = TRUE,
  updated_at         = CURRENT_TIMESTAMP
WHERE is_active = TRUE;
