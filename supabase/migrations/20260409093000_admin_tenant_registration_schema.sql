-- ============================================================
-- MIGRATION: Cadastro de Tenants (Admin > Ministérios)
-- Objetivo: garantir o schema mínimo para o fluxo de criação/edição
--           de tenants via /api/v1/admin/ministries.
-- Idempotente: pode ser executada mais de uma vez.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) TABELA ministries (garantia de existência e colunas)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ministries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  email_admin VARCHAR(255) UNIQUE NOT NULL,
  cnpj_cpf VARCHAR(20),
  phone VARCHAR(20),
  whatsapp VARCHAR(20),
  website VARCHAR(255),
  logo_url TEXT,
  description TEXT,
  responsible_name VARCHAR(255),
  address_street VARCHAR(255),
  address_number VARCHAR(50),
  address_complement VARCHAR(255),
  address_city VARCHAR(100),
  address_state VARCHAR(2),
  address_zip VARCHAR(20),
  quantity_temples INTEGER DEFAULT 1,
  quantity_members INTEGER DEFAULT 0,
  plan VARCHAR(50) NOT NULL DEFAULT 'starter',
  subscription_plan_id UUID REFERENCES public.subscription_plans(id),
  subscription_status VARCHAR(50) NOT NULL DEFAULT 'active',
  subscription_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  subscription_end_date TIMESTAMP,
  auto_renew BOOLEAN DEFAULT true,
  max_users INTEGER DEFAULT 5,
  max_storage_bytes BIGINT DEFAULT 5368709120,
  storage_used_bytes BIGINT DEFAULT 0,
  timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.ministries
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS slug VARCHAR(100),
  ADD COLUMN IF NOT EXISTS email_admin VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cnpj_cpf VARCHAR(20),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20),
  ADD COLUMN IF NOT EXISTS website VARCHAR(255),
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS responsible_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_street VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS address_complement VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address_state VARCHAR(2),
  ADD COLUMN IF NOT EXISTS address_zip VARCHAR(20),
  ADD COLUMN IF NOT EXISTS quantity_temples INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quantity_members INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS subscription_plan_id UUID,
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_storage_bytes BIGINT DEFAULT 5368709120,
  ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Constraints/FKs (best-effort)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ministries'::regclass
      AND conname = 'ministries_user_id_fkey'
  ) THEN
    ALTER TABLE public.ministries
      ADD CONSTRAINT ministries_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.subscription_plans') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.ministries'::regclass
        AND conname = 'ministries_subscription_plan_id_fkey'
    ) THEN
      ALTER TABLE public.ministries
        ADD CONSTRAINT ministries_subscription_plan_id_fkey
        FOREIGN KEY (subscription_plan_id)
        REFERENCES public.subscription_plans(id);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ministries'::regclass
      AND conname = 'ministries_slug_key'
  ) THEN
    ALTER TABLE public.ministries
      ADD CONSTRAINT ministries_slug_key UNIQUE (slug);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ministries'::regclass
      AND conname = 'ministries_email_admin_key'
  ) THEN
    ALTER TABLE public.ministries
      ADD CONSTRAINT ministries_email_admin_key UNIQUE (email_admin);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ministries_user_id ON public.ministries(user_id);
CREATE INDEX IF NOT EXISTS idx_ministries_slug ON public.ministries(slug);
CREATE INDEX IF NOT EXISTS idx_ministries_status ON public.ministries(subscription_status);
CREATE INDEX IF NOT EXISTS idx_ministries_plan_id ON public.ministries(subscription_plan_id);

-- ------------------------------------------------------------
-- 2) TABELA ministry_users (vínculo tenant x usuário)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ministry_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'operator',
  permissions JSONB DEFAULT '[]',
  supervisao_id UUID,
  congregacao_id UUID,
  is_active BOOLEAN DEFAULT true,
  last_activity TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ministry_users_ministry_user_unique UNIQUE (ministry_id, user_id)
);

ALTER TABLE public.ministry_users
  ADD COLUMN IF NOT EXISTS ministry_id UUID,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'operator',
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS supervisao_id UUID,
  ADD COLUMN IF NOT EXISTS congregacao_id UUID,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ministry_users'::regclass
      AND conname = 'ministry_users_ministry_id_fkey'
  ) THEN
    ALTER TABLE public.ministry_users
      ADD CONSTRAINT ministry_users_ministry_id_fkey
      FOREIGN KEY (ministry_id)
      REFERENCES public.ministries(id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ministry_users'::regclass
      AND conname = 'ministry_users_user_id_fkey'
  ) THEN
    ALTER TABLE public.ministry_users
      ADD CONSTRAINT ministry_users_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ministry_users'::regclass
      AND conname = 'ministry_users_ministry_user_unique'
  ) THEN
    ALTER TABLE public.ministry_users
      ADD CONSTRAINT ministry_users_ministry_user_unique
      UNIQUE (ministry_id, user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ministry_users'::regclass
      AND conname = 'ministry_users_role_check'
  ) THEN
    ALTER TABLE public.ministry_users
      ADD CONSTRAINT ministry_users_role_check
      CHECK (role IN ('admin', 'manager', 'operator', 'viewer', 'financeiro', 'supervisor'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ministry_users_ministry_id ON public.ministry_users(ministry_id);
CREATE INDEX IF NOT EXISTS idx_ministry_users_user_id ON public.ministry_users(user_id);
CREATE INDEX IF NOT EXISTS idx_ministry_users_role ON public.ministry_users(role);
CREATE INDEX IF NOT EXISTS idx_ministry_users_supervisao_id ON public.ministry_users(supervisao_id);
CREATE INDEX IF NOT EXISTS idx_ministry_users_congregacao_id ON public.ministry_users(congregacao_id);

-- ------------------------------------------------------------
-- 3) RLS: compatível com owner-fallback (tenant owner + vinculado)
-- ------------------------------------------------------------
ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ministry_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ministries_owner_select" ON public.ministries;
DROP POLICY IF EXISTS "ministries_member_select" ON public.ministries;
DROP POLICY IF EXISTS "ministries_owner_insert" ON public.ministries;
DROP POLICY IF EXISTS "ministries_owner_update" ON public.ministries;

CREATE POLICY "ministries_owner_select"
  ON public.ministries FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "ministries_member_select"
  ON public.ministries FOR SELECT
  USING (
    id IN (
      SELECT mu.ministry_id
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
    )
  );

CREATE POLICY "ministries_owner_insert"
  ON public.ministries FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ministries_owner_update"
  ON public.ministries FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ministry_users_owner_all" ON public.ministry_users;
DROP POLICY IF EXISTS "ministry_users_select_self" ON public.ministry_users;

CREATE POLICY "ministry_users_owner_all"
  ON public.ministry_users FOR ALL
  USING (
    ministry_id IN (
      SELECT m.id
      FROM public.ministries m
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "ministry_users_select_self"
  ON public.ministry_users FOR SELECT
  USING (user_id = auth.uid());

COMMIT;
