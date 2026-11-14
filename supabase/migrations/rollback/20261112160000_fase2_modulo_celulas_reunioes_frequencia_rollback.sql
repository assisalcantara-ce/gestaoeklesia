-- ==============================================================================
-- ROLLBACK SEGURO: MÓDULO CÉLULAS — LOTE 2 (REUNIÕES, FREQUÊNCIA E TOKENS)
-- ATENÇÃO: NÃO EXECUTAR EM PRODUÇÃO SE JÁ HOUVER DADOS OPERACIONAIS CADASTRADOS.
-- ==============================================================================

BEGIN;

DROP TABLE IF EXISTS public.celulas_chamada_tokens CASCADE;
DROP TABLE IF EXISTS public.celulas_frequencias CASCADE;
DROP TABLE IF EXISTS public.celulas_reunioes CASCADE;

COMMIT;
