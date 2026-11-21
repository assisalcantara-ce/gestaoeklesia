-- ==============================================================================
-- Migration: Campos específicos e metadados para itens de patrimônio
-- Arquivo: supabase/migrations/20261013210000_patrimonio_campos_especificos.sql
-- Descrição: Adiciona a coluna dados_especificos (JSONB) à tabela patrimonio_itens
--            para suportar atributos específicos por categoria (imóveis, terrenos,
--            veículos, móveis, som/imagem, etc.) sem perda de compatibilidade.
-- ==============================================================================

BEGIN;

-- Adiciona a coluna dados_especificos caso ainda não exista
ALTER TABLE public.patrimonio_itens
  ADD COLUMN IF NOT EXISTS dados_especificos JSONB DEFAULT '{}'::jsonb;

-- Cria índice GIN para consultas rápidas sobre os metadados específicos
CREATE INDEX IF NOT EXISTS idx_patrimonio_itens_dados_especificos
  ON public.patrimonio_itens USING GIN (dados_especificos);

COMMENT ON COLUMN public.patrimonio_itens.dados_especificos IS 
  'Metadados dinâmicos por categoria (ex: área, matrícula, placa, renavam, material, localização interna)';

COMMIT;
