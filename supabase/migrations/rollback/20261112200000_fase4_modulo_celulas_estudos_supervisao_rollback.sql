-- ==============================================================================
-- ROLLBACK SEGURO — LOTE 4: ESTUDOS BÍBLICOS E SUPERVISÃO PASTORAL
-- ==============================================================================

BEGIN;

DROP TABLE IF EXISTS public.celulas_supervisoes CASCADE;
DROP TABLE IF EXISTS public.celulas_estudos CASCADE;

COMMIT;
