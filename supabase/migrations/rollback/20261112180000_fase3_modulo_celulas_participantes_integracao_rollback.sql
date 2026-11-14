-- ==============================================================================
-- ROLLBACK SEGURO: MÓDULO CÉLULAS — LOTE 3 (PARTICIPANTES E TRANSFERÊNCIAS)
-- ATENÇÃO: NÃO EXECUTAR EM PRODUÇÃO SE JÁ HOUVER DADOS OPERACIONAIS CADASTRADOS.
-- ==============================================================================

BEGIN;

DROP TABLE IF EXISTS public.celulas_transferencias CASCADE;
DROP TABLE IF EXISTS public.celulas_participantes CASCADE;

COMMIT;
