-- ============================================================
-- MODULO MEMBROS
-- Tabela: members
-- Depende de: ministries, congregacoes (modulo_usuarios + modulo_estrutura_hierarquica)
-- ============================================================

-- Garantir extensão pg_trgm para busca por nome
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- TABELA: members
-- ============================================================
CREATE TABLE IF NOT EXISTS public.members (
  -- Identidade
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id                   UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  matricula                     VARCHAR(50),
  unique_id                     VARCHAR(32),

  -- Dados básicos
  name                          VARCHAR(255) NOT NULL,
  email                         VARCHAR(255),
  phone                         VARCHAR(30),
  cpf                           VARCHAR(20),
  rg                            VARCHAR(30),
  orgao_emissor                 VARCHAR(50),

  -- Dados pessoais
  data_nascimento               DATE,
  sexo                          VARCHAR(30),
  tipo_sanguineo                VARCHAR(10),
  escolaridade                  VARCHAR(100),
  estado_civil                  VARCHAR(50),
  nome_conjuge                  VARCHAR(255),
  cpf_conjuge                   VARCHAR(20),
  data_nascimento_conjuge       DATE,
  nome_pai                      VARCHAR(255),
  nome_mae                      VARCHAR(255),
  nacionalidade                 VARCHAR(100),
  naturalidade                  VARCHAR(100),
  uf_naturalidade               VARCHAR(2),

  -- Documentos eleitorais
  titulo_eleitoral              VARCHAR(50),
  zona_eleitoral                VARCHAR(30),
  secao_eleitoral               VARCHAR(30),

  -- Datas ministeriais e espirituais
  data_batismo_aguas            DATE,
  data_batismo_espirito_santo   DATE,
  data_consagracao              DATE,
  data_emissao                  DATE,
  data_validade_credencial      DATE,

  -- Endereço
  cep                           VARCHAR(10),
  logradouro                    VARCHAR(255),
  numero                        VARCHAR(20),
  bairro                        VARCHAR(100),
  complemento                   VARCHAR(255),
  cidade                        VARCHAR(100),
  estado                        VARCHAR(2),

  -- Contato
  celular                       VARCHAR(30),
  whatsapp                      VARCHAR(30),

  -- Geolocalização
  congregacao_id                UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  latitude                      NUMERIC(10, 8),
  longitude                     NUMERIC(11, 8),

  -- Ministerial
  tipo_cadastro                 VARCHAR(50) DEFAULT 'ministro',
  role                          VARCHAR(50),
  profissao                     VARCHAR(255),
  curso_teologico               VARCHAR(255),
  instituicao_teologica         VARCHAR(255),
  pastor_auxiliar               BOOLEAN NOT NULL DEFAULT FALSE,
  procedencia                   VARCHAR(100),
  procedencia_local             VARCHAR(255),
  cargo_ministerial             VARCHAR(255),
  dados_cargos                  JSONB NOT NULL DEFAULT '{}',
  tem_funcao_igreja             BOOLEAN NOT NULL DEFAULT FALSE,
  qual_funcao                   VARCHAR(255),
  setor_departamento            VARCHAR(255),
  observacoes_ministeriais      TEXT,

  -- Foto e sistema
  foto_url                      TEXT,
  member_since                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status                        VARCHAR(20) NOT NULL DEFAULT 'active',
  custom_fields                 JSONB NOT NULL DEFAULT '{}',
  observacoes                   TEXT,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- CHECK constraints
  CONSTRAINT members_status_check
    CHECK (status IN ('active', 'inactive', 'deceased', 'transferred')),
  CONSTRAINT members_tipo_cadastro_check
    CHECK (tipo_cadastro IS NULL OR tipo_cadastro IN ('membro', 'congregado', 'ministro', 'crianca'))
);

-- ============================================================
-- UNIQUE CONSTRAINTS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'members_ministry_unique_id_unique'
  ) THEN
    ALTER TABLE public.members
      ADD CONSTRAINT members_ministry_unique_id_unique UNIQUE (ministry_id, unique_id);
  END IF;
END $$;

-- NULLS NOT DISTINCT: dois membros do mesmo ministério não podem ter mesmo CPF/email,
-- mas NULL é permitido para vários membros
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'members_ministry_cpf_unique'
  ) THEN
    ALTER TABLE public.members
      ADD CONSTRAINT members_ministry_cpf_unique UNIQUE NULLS NOT DISTINCT (ministry_id, cpf);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'members_ministry_email_unique'
  ) THEN
    ALTER TABLE public.members
      ADD CONSTRAINT members_ministry_email_unique UNIQUE NULLS NOT DISTINCT (ministry_id, email);
  END IF;
END $$;

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_members_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_members_updated_at ON public.members;
CREATE TRIGGER trg_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.update_members_updated_at();

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_members_ministry_id
  ON public.members (ministry_id);

CREATE INDEX IF NOT EXISTS idx_members_status
  ON public.members (ministry_id, status);

CREATE INDEX IF NOT EXISTS idx_members_tipo_cadastro
  ON public.members (ministry_id, tipo_cadastro);

CREATE INDEX IF NOT EXISTS idx_members_email
  ON public.members (ministry_id, email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_members_cpf
  ON public.members (ministry_id, cpf)
  WHERE cpf IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_members_created_at
  ON public.members (ministry_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_members_congregacao_id
  ON public.members (congregacao_id)
  WHERE congregacao_id IS NOT NULL;

-- Índice GIN para busca por nome (ILIKE / full-text)
CREATE INDEX IF NOT EXISTS idx_members_name_trgm
  ON public.members USING GIN (name gin_trgm_ops);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Reutiliza as funções SECURITY DEFINER criadas em patch_001_rls_fix.sql
-- para evitar recursão infinita entre ministries ↔ ministry_users

DROP POLICY IF EXISTS members_select ON public.members;
CREATE POLICY members_select ON public.members
  FOR SELECT USING (
    ministry_id IN (SELECT public.get_owned_ministry_ids())
    OR ministry_id IN (SELECT public.get_linked_ministry_ids())
  );

DROP POLICY IF EXISTS members_insert ON public.members;
CREATE POLICY members_insert ON public.members
  FOR INSERT WITH CHECK (
    ministry_id IN (SELECT public.get_owned_ministry_ids())
    OR ministry_id IN (SELECT public.get_linked_ministry_ids())
  );

DROP POLICY IF EXISTS members_update ON public.members;
CREATE POLICY members_update ON public.members
  FOR UPDATE USING (
    ministry_id IN (SELECT public.get_owned_ministry_ids())
    OR ministry_id IN (SELECT public.get_linked_ministry_ids())
  );

DROP POLICY IF EXISTS members_delete ON public.members;
CREATE POLICY members_delete ON public.members
  FOR DELETE USING (
    ministry_id IN (SELECT public.get_owned_ministry_ids())
    OR ministry_id IN (SELECT public.get_linked_ministry_ids())
  );

-- ============================================================
-- PERMISSÕES
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;

-- ============================================================
-- COMENTÁRIO
-- ============================================================
COMMENT ON TABLE public.members IS
  'Membros, congregados, ministros e crianças cadastrados por ministério. Multi-tenant com RLS.';
