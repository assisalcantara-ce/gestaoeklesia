-- ============================================================
-- MÓDULO REUNIÕES — REMOÇÃO DA TABELA LEGADA DE MODELOS DE ADVERTÊNCIA
-- Migration: 20260929000000_drop_reunioes_modelos_advertencia.sql
-- ============================================================

-- A geração de Carta de Advertência Ministerial agora é 100% dinâmica
-- via motor de PDF em memória com dados reais do banco.
-- Esta tabela legada de modelos de templates estáticos foi descontinuada.

DROP TABLE IF EXISTS public.reunioes_modelos_advertencia CASCADE;
