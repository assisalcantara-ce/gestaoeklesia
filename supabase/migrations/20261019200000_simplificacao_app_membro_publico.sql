-- ============================================================================
-- MIGRATION: Simplificação do App do Membro — Acesso Público e Pedidos de Oração
-- Data: 2026-10-19
-- ============================================================================
--
-- ATENÇÃO: NÃO EXECUTADA AUTOMATICAMENTE.
-- Preparada para aplicação manual pelo administrador no console do Supabase.
--
-- Objetivos:
-- 1. Garantir que a coluna 'member_id' em 'pastoral_pedidos_oracao' aceite NULL
--    para permitir pedidos de oração públicos/visitantes vinculados apenas ao tenant (ministry_id).
-- 2. Adicionar campos opcionais de identificação do solicitante visitante (nome_solicitante, contato_solicitante).
-- 3. Garantir índices de consulta por tenant e data.
-- 4. Adicionar política RLS ou manter acesso via server-client service_role.
-- ============================================================================

BEGIN;

-- 1. Permitir pedidos de oração públicos sem membro autenticado (visitantes / membros deslogados)
ALTER TABLE IF EXISTS public.pastoral_pedidos_oracao 
  ALTER COLUMN member_id DROP NOT NULL;

-- 2. Adicionar colunas opcionais para visitante (nome e contato) caso não existam
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'pastoral_pedidos_oracao' 
      AND column_name = 'nome_solicitante'
  ) THEN
    ALTER TABLE public.pastoral_pedidos_oracao ADD COLUMN nome_solicitante VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'pastoral_pedidos_oracao' 
      AND column_name = 'contato_solicitante'
  ) THEN
    ALTER TABLE public.pastoral_pedidos_oracao ADD COLUMN contato_solicitante VARCHAR(100);
  END IF;
END $$;

-- 3. Índice para acelerar busca de pedidos por ministério
CREATE INDEX IF NOT EXISTS idx_pastoral_pedidos_ministry_created 
  ON public.pastoral_pedidos_oracao(ministry_id, created_at DESC);

COMMIT;
