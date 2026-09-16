-- ============================================================================
-- Migration: 20260916110000_allow_duplicate_codigo_registro_tesouraria.sql
-- Remove a restrição única de codigo_registro para permitir que congregações
-- e ministérios agrupem lançamentos do mesmo evento/lote com o mesmo código,
-- mantendo o índice não-único para performance de busca.
-- ============================================================================

BEGIN;

-- 1. Remove o índice UNIQUE se existir
DROP INDEX IF EXISTS public.idx_tesouraria_lancamentos_codigo_registro;

-- 2. Recria como índice convencional (não único) para manter alta performance em buscas e filtros
CREATE INDEX IF NOT EXISTS idx_tesouraria_lancamentos_codigo_registro
ON public.tesouraria_lancamentos (ministry_id, upper(trim(codigo_registro)))
WHERE codigo_registro IS NOT NULL AND trim(codigo_registro) <> '';

COMMIT;
