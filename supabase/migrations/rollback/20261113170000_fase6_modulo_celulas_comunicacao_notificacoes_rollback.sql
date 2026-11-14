-- ==============================================================================
-- ROLLBACK SEGURO — LOTE 6: COMUNICAÇÃO MINISTERIAL E NOTIFICAÇÕES
-- ==============================================================================

BEGIN;

DROP TABLE IF EXISTS public.celulas_mensagens_logs CASCADE;
DROP TABLE IF EXISTS public.celulas_templates_mensagens CASCADE;
DROP TABLE IF EXISTS public.celulas_comunicados CASCADE;

COMMIT;
