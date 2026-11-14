-- ==============================================================================
-- ROLLBACK SEGURO — LOTE 5: MULTIPLICAÇÃO ASSISTIDA E GENEALOGIA
-- ==============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.efetivar_multiplicacao_celula(UUID, UUID, UUID);
DROP TABLE IF EXISTS public.celulas_multiplicacao_participantes CASCADE;
DROP TABLE IF EXISTS public.celulas_multiplicacoes CASCADE;

COMMIT;
