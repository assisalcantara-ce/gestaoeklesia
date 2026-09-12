-- =============================================================================
-- 20260912120000_cartas_e_declaracoes_categoria.sql
-- Adiciona suporte a categorias ('carta' | 'declaracao') em cartas_templates e cartas_registros
-- =============================================================================

BEGIN;

-- 1. cartas_templates
ALTER TABLE IF EXISTS public.cartas_templates 
  ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'carta';

-- Atualiza registros existentes nulos caso a tabela tenha sido criada sem NOT NULL inicialmente
UPDATE public.cartas_templates
SET categoria = 'carta'
WHERE categoria IS NULL;

-- Índice para performance de filtros por categoria
CREATE INDEX IF NOT EXISTS idx_cartas_templates_categoria
  ON public.cartas_templates(categoria);

-- 2. cartas_registros
ALTER TABLE IF EXISTS public.cartas_registros
  ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'carta';

UPDATE public.cartas_registros
SET categoria = 'carta'
WHERE categoria IS NULL;

-- Índice para performance de histórico e relatórios por categoria
CREATE INDEX IF NOT EXISTS idx_cartas_registros_categoria
  ON public.cartas_registros(categoria);

COMMIT;
