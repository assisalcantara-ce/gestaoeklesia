-- ============================================================
-- MÓDULO USUÁRIOS — Gestão Eklesia
-- Execute no SQL Editor do Supabase (cole e rode tudo de uma vez)
-- Script idempotente: pode ser reexecutado sem erro
-- ============================================================

-- ============================================================
-- 1. EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. FUNÇÃO GENÉRICA updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. PLANOS DE ASSINATURA (subscription_plans)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(100) NOT NULL UNIQUE,
  slug                  VARCHAR(50)  UNIQUE NOT NULL,
  description           TEXT,
  price_monthly         DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_annually        DECIMAL(10,2),
  setup_fee             DECIMAL(10,2) DEFAULT 0,
  max_users             INTEGER NOT NULL DEFAULT 3,
  max_storage_bytes     BIGINT  NOT NULL DEFAULT 524288000,
  max_members           INTEGER NOT NULL DEFAULT 100,
  max_ministerios       INTEGER NOT NULL DEFAULT 1,
  max_divisao2          INTEGER NOT NULL DEFAULT 0,
  max_divisao3          INTEGER NOT NULL DEFAULT 0,
  has_api_access        BOOLEAN DEFAULT false,
  has_custom_domain     BOOLEAN DEFAULT false,
  has_advanced_reports  BOOLEAN DEFAULT false,
  has_priority_support  BOOLEAN DEFAULT false,
  has_white_label       BOOLEAN DEFAULT false,
  has_automation        BOOLEAN DEFAULT false,
  has_modulo_financeiro BOOLEAN DEFAULT false,
  has_modulo_eventos    BOOLEAN DEFAULT false,
  has_modulo_reunioes   BOOLEAN DEFAULT false,
  is_active             BOOLEAN DEFAULT true,
  display_order         INTEGER DEFAULT 0,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans_select_public" ON public.subscription_plans;
CREATE POLICY "plans_select_public"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true);

DROP TRIGGER IF EXISTS subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Dados dos planos
INSERT INTO public.subscription_plans
  (name, slug, description, price_monthly, price_annually, max_users, max_storage_bytes, max_members,
   max_divisao2, max_divisao3, has_api_access, has_advanced_reports, has_priority_support, display_order)
VALUES
  ('Starter',       'starter',       'Para igrejas pequenas',          0,      0,        5,   5368709120,   100, 0,  0,  false, false, false, 1),
  ('Intermediário', 'intermediario', 'Para igrejas em crescimento',    79.90,  799.00,   10,  10737418240,  500, 3,  -1, false, true,  false, 2),
  ('Profissional',  'profissional',  'Para igrejas estabelecidas',     149.90, 1499.00,  30,  21474836480,  2000,10, -1, true,  true,  false, 3),
  ('Expert',        'expert',        'Para redes e denominações',      299.90, 2999.00,  100, 107374182400, 10000,20, -1, true,  true,  true,  4)
ON CONFLICT (slug) DO UPDATE SET
  name             = EXCLUDED.name,
  description      = EXCLUDED.description,
  price_monthly    = EXCLUDED.price_monthly,
  price_annually   = EXCLUDED.price_annually,
  max_users        = EXCLUDED.max_users,
  max_members      = EXCLUDED.max_members,
  max_divisao2     = EXCLUDED.max_divisao2,
  max_divisao3     = EXCLUDED.max_divisao3,
  updated_at       = CURRENT_TIMESTAMP;

-- ============================================================
-- 4. MINISTÉRIOS / IGREJAS (ministries)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ministries (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 VARCHAR(255) NOT NULL,
  slug                 VARCHAR(100) UNIQUE NOT NULL,
  email_admin          VARCHAR(255) UNIQUE NOT NULL,
  cnpj_cpf             VARCHAR(20),
  phone                VARCHAR(20),
  whatsapp             VARCHAR(20),
  website              VARCHAR(255),
  logo_url             VARCHAR(500),
  description          TEXT,
  responsible_name     VARCHAR(255),
  address_street       VARCHAR(255),
  address_number       VARCHAR(50),
  address_complement   VARCHAR(255),
  address_city         VARCHAR(100),
  address_state        VARCHAR(2),
  address_zip          VARCHAR(20),
  quantity_temples     INTEGER DEFAULT 1,
  quantity_members     INTEGER DEFAULT 0,
  plan                 VARCHAR(50) NOT NULL DEFAULT 'starter',
  subscription_plan_id UUID REFERENCES public.subscription_plans(id),
  subscription_status  VARCHAR(50) NOT NULL DEFAULT 'active',
  subscription_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  subscription_end_date   TIMESTAMP,
  auto_renew           BOOLEAN DEFAULT true,
  max_users            INTEGER DEFAULT 5,
  max_storage_bytes    BIGINT  DEFAULT 5368709120,
  storage_used_bytes   BIGINT  DEFAULT 0,
  timezone             VARCHAR(50) DEFAULT 'America/Sao_Paulo',
  is_active            BOOLEAN DEFAULT true,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT positive_storage CHECK (storage_used_bytes >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ministries_user_id       ON public.ministries(user_id);
CREATE INDEX IF NOT EXISTS idx_ministries_slug          ON public.ministries(slug);
CREATE INDEX IF NOT EXISTS idx_ministries_status        ON public.ministries(subscription_status);
CREATE INDEX IF NOT EXISTS idx_ministries_plan_id       ON public.ministries(subscription_plan_id);

ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ministries_owner_select" ON public.ministries;
DROP POLICY IF EXISTS "ministries_owner_insert" ON public.ministries;
DROP POLICY IF EXISTS "ministries_owner_update" ON public.ministries;
DROP POLICY IF EXISTS "Usuários podem ver seu próprio ministry"    ON public.ministries;
DROP POLICY IF EXISTS "Usuários podem inserir seu próprio ministry" ON public.ministries;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio ministry" ON public.ministries;

-- Política SELECT simples (será atualizada após criação de ministry_users na seção 8)
CREATE POLICY "ministries_owner_select"
  ON public.ministries FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "ministries_owner_insert"
  ON public.ministries FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ministries_owner_update"
  ON public.ministries FOR UPDATE
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS ministries_updated_at ON public.ministries;
CREATE TRIGGER ministries_updated_at
  BEFORE UPDATE ON public.ministries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. SUPERVISÕES (necessário para FK de congregacoes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.supervisoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  nome        VARCHAR(255) NOT NULL,
  descricao   TEXT,
  cidade      VARCHAR(100),
  endereco    TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ministry_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_supervisoes_ministry_id ON public.supervisoes(ministry_id);

ALTER TABLE public.supervisoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supervisoes_ministry_access" ON public.supervisoes;
-- Política simples (será atualizada após criação de ministry_users na seção 8)
CREATE POLICY "supervisoes_ministry_access"
  ON public.supervisoes FOR SELECT
  TO authenticated
  USING (
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS supervisoes_updated_at ON public.supervisoes;
CREATE TRIGGER supervisoes_updated_at
  BEFORE UPDATE ON public.supervisoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 6. CONGREGAÇÕES (necessário para FK de ministry_users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.congregacoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id  UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  supervisao_id UUID REFERENCES public.supervisoes(id) ON DELETE SET NULL,
  nome         VARCHAR(255) NOT NULL,
  endereco     TEXT,
  cidade       VARCHAR(100),
  uf           VARCHAR(2),
  cep          VARCHAR(20),
  latitude     DOUBLE PRECISION,
  longitude    DOUBLE PRECISION,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ministry_id, supervisao_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_congregacoes_ministry_id ON public.congregacoes(ministry_id);
CREATE INDEX IF NOT EXISTS idx_congregacoes_is_active   ON public.congregacoes(is_active);

ALTER TABLE public.congregacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "congregacoes_ministry_access" ON public.congregacoes;
-- Política simples (será atualizada após criação de ministry_users na seção 8)
CREATE POLICY "congregacoes_ministry_access"
  ON public.congregacoes FOR SELECT
  TO authenticated
  USING (
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS congregacoes_updated_at ON public.congregacoes;
CREATE TRIGGER congregacoes_updated_at
  BEFORE UPDATE ON public.congregacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 7. USUÁRIOS DO MINISTÉRIO (ministry_users) — tabela principal do módulo
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ministry_users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id    UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role           VARCHAR(50) NOT NULL DEFAULT 'operator',
  permissions    JSONB DEFAULT '[]',
  supervisao_id  UUID REFERENCES public.supervisoes(id) ON DELETE SET NULL,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  is_active      BOOLEAN DEFAULT true,
  last_activity  TIMESTAMP,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ministry_id, user_id),
  CONSTRAINT valid_role CHECK (role IN ('admin', 'manager', 'operator', 'viewer', 'financeiro', 'supervisor'))
);

CREATE INDEX IF NOT EXISTS idx_ministry_users_ministry_id    ON public.ministry_users(ministry_id);
CREATE INDEX IF NOT EXISTS idx_ministry_users_user_id        ON public.ministry_users(user_id);
CREATE INDEX IF NOT EXISTS idx_ministry_users_role           ON public.ministry_users(role);
CREATE INDEX IF NOT EXISTS idx_ministry_users_supervisao_id  ON public.ministry_users(supervisao_id);
CREATE INDEX IF NOT EXISTS idx_ministry_users_congregacao_id ON public.ministry_users(congregacao_id);

ALTER TABLE public.ministry_users ENABLE ROW LEVEL SECURITY;

-- Policy sem recursão: cada usuário vê apenas seus próprios vínculos
DROP POLICY IF EXISTS "ministry_users_select_self"     ON public.ministry_users;
DROP POLICY IF EXISTS "Usuários só veem seus ministry_users" ON public.ministry_users;
DROP POLICY IF EXISTS "ministry_users_owner_all"       ON public.ministry_users;

-- Dono do ministério pode gerenciar todos os usuários
CREATE POLICY "ministry_users_owner_all"
  ON public.ministry_users FOR ALL
  USING (
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

-- Usuário secundário vê apenas o próprio vínculo
CREATE POLICY "ministry_users_select_self"
  ON public.ministry_users FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- 8. RECRIAR POLÍTICAS QUE REFERENCIAM ministry_users
--    (precisam existir após a tabela ministry_users ser criada)
-- ============================================================

-- ministries: usuários secundários também podem ver o ministério deles
DROP POLICY IF EXISTS "ministries_owner_select" ON public.ministries;
CREATE POLICY "ministries_owner_select"
  ON public.ministries FOR SELECT
  USING (
    user_id = auth.uid()
    OR id IN (SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid())
  );

-- supervisoes: usuários secundários também acessam
DROP POLICY IF EXISTS "supervisoes_ministry_access" ON public.supervisoes;
CREATE POLICY "supervisoes_ministry_access"
  ON public.supervisoes FOR SELECT
  TO authenticated
  USING (
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
      UNION
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

-- congregacoes: usuários secundários também acessam
DROP POLICY IF EXISTS "congregacoes_ministry_access" ON public.congregacoes;
CREATE POLICY "congregacoes_ministry_access"
  ON public.congregacoes FOR SELECT
  TO authenticated
  USING (
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
      UNION
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
