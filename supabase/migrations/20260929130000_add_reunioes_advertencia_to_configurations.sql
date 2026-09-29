-- ============================================================
-- Migration: 20260929130000_add_reunioes_advertencia_to_configurations.sql
-- Módulo de Reuniões Ministeriais: Configurações de Texto da Carta de Advertência
-- ============================================================

-- Adiciona a coluna reunioes_advertencia na tabela configurations para armazenar os textos institucionais da carta
ALTER TABLE public.configurations 
ADD COLUMN IF NOT EXISTS reunioes_advertencia JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.configurations.reunioes_advertencia IS 'Textos institucionais e fundamentação normativa configurados pelo ministério para a Carta de Advertência Ministerial';
