-- ==============================================================================
-- ROLLBACK PLANEJADO: MÓDULO CÉLULAS — LOTE 1 (FUNDAÇÃO)
-- Arquivo de reversão para: 20261112140000_fase1_modulo_celulas_fundacao.sql
-- ==============================================================================
-- ATENÇÃO: Executar exclusivamente se houver necessidade de desinstalar ou reverter
-- o Lote 1 de Células no Supabase SQL Editor.
-- ==============================================================================

BEGIN;

SET LOCAL lock_timeout = '4s';
SET LOCAL statement_timeout = '30s';

-- 1. Remoção das Políticas RLS
DROP POLICY IF EXISTS "celulas_delete" ON public.celulas;
DROP POLICY IF EXISTS "celulas_update" ON public.celulas;
DROP POLICY IF EXISTS "celulas_insert" ON public.celulas;
DROP POLICY IF EXISTS "celulas_select" ON public.celulas;

DROP POLICY IF EXISTS "celulas_redes_modify" ON public.celulas_redes;
DROP POLICY IF EXISTS "celulas_redes_select" ON public.celulas_redes;

DROP POLICY IF EXISTS "celulas_configuracoes_modify" ON public.celulas_configuracoes;
DROP POLICY IF EXISTS "celulas_configuracoes_select" ON public.celulas_configuracoes;

-- 2. Remoção das Tabelas Criadas (em ordem de dependência reversa)
DROP TABLE IF EXISTS public.celulas CASCADE;
DROP TABLE IF EXISTS public.celulas_redes CASCADE;
DROP TABLE IF EXISTS public.celulas_configuracoes CASCADE;

-- 3. Remoção das Funções Helpers RLS
DROP FUNCTION IF EXISTS public.celulas_has_local_write(UUID, UUID);
DROP FUNCTION IF EXISTS public.celulas_has_global_write(UUID);

COMMIT;
