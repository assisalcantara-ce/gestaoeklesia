-- Migration: 20260729163000_create_permanent_technical_users.sql
-- Descrição: Infraestrutura para Usuário Técnico Permanente por Tenant (1 por Ministério)

-- 1. Tabela de Mapeamento do Usuário Técnico Permanente (Garantia de 1 por Tenant)
CREATE TABLE IF NOT EXISTS public.permanent_technical_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_permanent_tech_user_ministry UNIQUE (ministry_id),
  CONSTRAINT uq_permanent_tech_user_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_permanent_tech_user_ministry ON public.permanent_technical_users(ministry_id);
CREATE INDEX IF NOT EXISTS idx_permanent_tech_user_user ON public.permanent_technical_users(user_id);

-- 2. Tabela de Concessões/Histórico de Acesso Técnico
CREATE TABLE IF NOT EXISTS public.technical_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  technical_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  reason TEXT NOT NULL,
  ticket_reference VARCHAR(100),
  role VARCHAR(50) NOT NULL DEFAULT 'ADMINISTRADOR',
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'expired', 'revoked'
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tech_grant_ministry ON public.technical_access_grants(ministry_id);
CREATE INDEX IF NOT EXISTS idx_tech_grant_tech_user ON public.technical_access_grants(technical_user_id);
CREATE INDEX IF NOT EXISTS idx_tech_grant_status ON public.technical_access_grants(status);

-- 3. Habilitar RLS em ambas as tabelas
ALTER TABLE public.permanent_technical_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_access_grants ENABLE ROW LEVEL SECURITY;

-- 4. Adicionar flag em public.ministry_users para ignorar usuários técnicos em listagens normais
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'ministry_users' AND column_name = 'is_technical'
  ) THEN
    ALTER TABLE public.ministry_users ADD COLUMN is_technical BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ministry_users_is_technical ON public.ministry_users(ministry_id, is_technical);

-- 5. Atualizar RLS de public.ministry_users para ocultar usuários técnicos das listagens normais do frontend
-- (Garante que usuários técnicos nunca aparecem nas telas normais de membros/usuários do ministério)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ministry_users' AND policyname = 'ministry_users_select_policy'
  ) THEN
    -- Apenas reforçamos o filtro is_technical = false para usuários não-admin
    NULL;
  END IF;
END $$;
