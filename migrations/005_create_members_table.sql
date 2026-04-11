-- =============================================================================
-- Migration: 005_create_members_table.sql
-- Descrição: Criação da tabela `members` (membros) com todos os campos
--            extraídos do código-fonte atual (API routes, hooks, types).
-- Dependências: ministries, congregacoes (FK opcional)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. EXTENSÕES NECESSÁRIAS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- índice GIN para busca por nome


-- -----------------------------------------------------------------------------
-- 1. TABELA members
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.members (

  -- ── Chave primária ──────────────────────────────────────────────────────────
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Multi-tenancy ───────────────────────────────────────────────────────────
  -- Toda query DEVE filtrar por ministry_id (RLS reforça isso).
  ministry_id                 UUID        NOT NULL
                                REFERENCES public.ministries(id) ON DELETE CASCADE,

  -- ── Identificadores do membro ───────────────────────────────────────────────
  -- matricula: número sequencial gerado pela UI, armazenado como texto
  matricula                   VARCHAR(50),
  -- unique_id: código de 16 chars UPPERCASE para QR Code / cartão
  unique_id                   VARCHAR(32),

  -- ── Dados básicos (obrigatório: name) ───────────────────────────────────────
  name                        VARCHAR(255) NOT NULL,
  email                       VARCHAR(255),
  phone                       VARCHAR(30),
  cpf                         VARCHAR(20),
  rg                          VARCHAR(30),
  orgao_emissor               VARCHAR(50),

  -- ── Dados pessoais ──────────────────────────────────────────────────────────
  data_nascimento             DATE,
  sexo                        VARCHAR(30),
  tipo_sanguineo              VARCHAR(10),
  escolaridade                VARCHAR(100),
  estado_civil                VARCHAR(50),
  nome_conjuge                VARCHAR(255),
  cpf_conjuge                 VARCHAR(20),
  data_nascimento_conjuge     DATE,
  nome_pai                    VARCHAR(255),
  nome_mae                    VARCHAR(255),
  nacionalidade               VARCHAR(100),
  naturalidade                VARCHAR(100),
  -- uf_naturalidade: UF (2 chars) de onde nasceu
  uf_naturalidade             VARCHAR(2),

  -- ── Documentos eleitorais ───────────────────────────────────────────────────
  titulo_eleitoral            VARCHAR(50),
  zona_eleitoral              VARCHAR(30),
  secao_eleitoral             VARCHAR(30),

  -- ── Endereço ────────────────────────────────────────────────────────────────
  cep                         VARCHAR(10),
  logradouro                  VARCHAR(255),
  numero                      VARCHAR(20),
  bairro                      VARCHAR(100),
  complemento                 VARCHAR(255),
  cidade                      VARCHAR(100),
  -- estado: UF de residência (2 chars)
  estado                      VARCHAR(2),

  -- ── Contato ─────────────────────────────────────────────────────────────────
  celular                     VARCHAR(30),
  whatsapp                    VARCHAR(30),

  -- ── Geolocalização ──────────────────────────────────────────────────────────
  -- congregacao_id: FK opcional para a congregação à qual o membro pertence
  congregacao_id              UUID
                                REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  -- latitude/longitude: coordenadas do endereço do membro (NUMERIC para precisão)
  latitude                    NUMERIC(10, 8),
  longitude                   NUMERIC(11, 8),

  -- ── Ministerial ─────────────────────────────────────────────────────────────
  -- tipo_cadastro: categoria do cadastro dentro do sistema
  --   Valores conhecidos: 'membro' | 'congregado' | 'ministro' | 'crianca'
  tipo_cadastro               VARCHAR(50)  DEFAULT 'ministro',
  -- role: alias para tipo_cadastro, usado em filtros GET (?tipoCadastro=...)
  role                        VARCHAR(50),
  profissao                   VARCHAR(255),
  cargo_ministerial           VARCHAR(255),
  -- dados_cargos: JSONB com histórico de cargos:
  --   { [nomeCargo]: { dataConsagracaoRecebimento, localConsagracao, localOrigem } }
  dados_cargos                JSONB        NOT NULL DEFAULT '{}',
  data_consagracao            DATE,
  data_emissao                DATE,
  data_validade_credencial    DATE,
  data_batismo_aguas          DATE,
  data_batismo_espirito_santo DATE,
  curso_teologico             VARCHAR(255),
  instituicao_teologica       VARCHAR(255),
  pastor_auxiliar             BOOLEAN      NOT NULL DEFAULT FALSE,
  -- procedencia: origem do membro (ex: 'batismo', 'transferencia', 'aclamacao')
  --   armazenado em lowercase pela UI
  procedencia                 VARCHAR(100),
  procedencia_local           VARCHAR(255),
  tem_funcao_igreja           BOOLEAN      NOT NULL DEFAULT FALSE,
  qual_funcao                 VARCHAR(255),
  setor_departamento          VARCHAR(255),
  observacoes_ministeriais    TEXT,

  -- ── Foto ────────────────────────────────────────────────────────────────────
  foto_url                    VARCHAR(1000),

  -- ── Campos do sistema ───────────────────────────────────────────────────────
  -- member_since: data de ingresso na organização (default = hoje)
  member_since                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- status: estado atual do membro
  --   CHECK constraint espelha Member['status'] em src/types/supabase.ts
  status                      VARCHAR(20)  NOT NULL DEFAULT 'active',
  -- custom_fields: JSONB aberto para campos extras definidos em configurations.custom_fields
  custom_fields               JSONB        NOT NULL DEFAULT '{}',
  observacoes                 TEXT,

  -- ── Auditoria ───────────────────────────────────────────────────────────────
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- ── Constraints ─────────────────────────────────────────────────────────────
  -- status enum conforme src/types/supabase.ts linha 126
  CONSTRAINT members_status_check
    CHECK (status IN ('active', 'inactive', 'deceased', 'transferred')),

  -- tipo_cadastro enum conforme UI em src/app/secretaria/membros/page.tsx
  CONSTRAINT members_tipo_cadastro_check
    CHECK (tipo_cadastro IN ('membro', 'congregado', 'ministro', 'crianca') OR tipo_cadastro IS NULL),

  -- CPF único por ministério (NULL permitido para membros sem CPF)
  CONSTRAINT members_ministry_cpf_unique
    UNIQUE NULLS NOT DISTINCT (ministry_id, cpf),

  -- Email único por ministério (NULL permitido)
  CONSTRAINT members_ministry_email_unique
    UNIQUE NULLS NOT DISTINCT (ministry_id, email),

  -- unique_id único por ministério (QR Code)
  CONSTRAINT members_ministry_unique_id_unique
    UNIQUE (ministry_id, unique_id)
);

COMMENT ON TABLE public.members IS
  'Cadastro de membros/fiéis de cada ministério (tenant). Isolado por ministry_id via RLS.';

COMMENT ON COLUMN public.members.unique_id IS
  'Código de 16 caracteres UPPER+DIGITS gerado pela UI para QR Code e cartão de identificação.';
COMMENT ON COLUMN public.members.tipo_cadastro IS
  'Categoria do cadastro: membro | congregado | ministro | crianca. Fonte: membros/page.tsx.';
COMMENT ON COLUMN public.members.role IS
  'Alias de tipo_cadastro usado em filtros GET (?tipoCadastro=). Mantido para compatibilidade.';
COMMENT ON COLUMN public.members.dados_cargos IS
  'Histórico de cargos ministeriais: { "Pastor": { dataConsagracaoRecebimento, localConsagracao, localOrigem } }';
COMMENT ON COLUMN public.members.custom_fields IS
  'Campos extras do usuário definidos em configurations.custom_fields. Formato livre JSONB.';
COMMENT ON COLUMN public.members.congregacao_id IS
  'FK opcional para congregacoes(id). NULL = membro sem congregação vinculada.';


-- -----------------------------------------------------------------------------
-- 2. ÍNDICES DE PERFORMANCE
-- -----------------------------------------------------------------------------

-- Obrigatório para RLS e todas as queries multi-tenant
CREATE INDEX IF NOT EXISTS idx_members_ministry_id
  ON public.members (ministry_id);

-- Filtragem por status (GET ?status=active)
CREATE INDEX IF NOT EXISTS idx_members_status
  ON public.members (ministry_id, status);

-- Busca tipo_cadastro / role (GET ?tipoCadastro=ministro)
CREATE INDEX IF NOT EXISTS idx_members_tipo_cadastro
  ON public.members (ministry_id, tipo_cadastro);

-- Lookup por email
CREATE INDEX IF NOT EXISTS idx_members_email
  ON public.members (ministry_id, email)
  WHERE email IS NOT NULL;

-- Lookup por CPF
CREATE INDEX IF NOT EXISTS idx_members_cpf
  ON public.members (ministry_id, cpf)
  WHERE cpf IS NOT NULL;

-- Ordenação por data de cadastro (order by created_at ASC – padrão do GET)
CREATE INDEX IF NOT EXISTS idx_members_created_at
  ON public.members (ministry_id, created_at ASC);

-- Busca full-text por nome (ilike '%search%' – GET ?search=...)
-- Exige a extensão pg_trgm (criada no bloco 0)
CREATE INDEX IF NOT EXISTS idx_members_name_trgm
  ON public.members USING GIN (name gin_trgm_ops);

-- Lookup por congregação (geolocalização)
CREATE INDEX IF NOT EXISTS idx_members_congregacao_id
  ON public.members (congregacao_id)
  WHERE congregacao_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 3. TRIGGER: atualizar updated_at automaticamente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.members_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.members_set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Subquery helper reutilizada em todas as policies:
--   ministry_id IN (SELECT ministry_id FROM ministry_users WHERE user_id = auth.uid())
-- Também cobre o owner via ministries.user_id = auth.uid() (fallback da API route).

-- 4.1  SELECT
CREATE POLICY members_select_policy ON public.members
  FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id
      FROM public.ministry_users
      WHERE user_id = auth.uid()
        AND is_active = TRUE
    )
    OR
    ministry_id IN (
      SELECT id
      FROM public.ministries
      WHERE user_id = auth.uid()
    )
  );

-- 4.2  INSERT
CREATE POLICY members_insert_policy ON public.members
  FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id
      FROM public.ministry_users
      WHERE user_id = auth.uid()
        AND is_active = TRUE
    )
    OR
    ministry_id IN (
      SELECT id
      FROM public.ministries
      WHERE user_id = auth.uid()
    )
  );

-- 4.3  UPDATE
CREATE POLICY members_update_policy ON public.members
  FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id
      FROM public.ministry_users
      WHERE user_id = auth.uid()
        AND is_active = TRUE
    )
    OR
    ministry_id IN (
      SELECT id
      FROM public.ministries
      WHERE user_id = auth.uid()
    )
  );

-- 4.4  DELETE
CREATE POLICY members_delete_policy ON public.members
  FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id
      FROM public.ministry_users
      WHERE user_id = auth.uid()
        AND is_active = TRUE
    )
    OR
    ministry_id IN (
      SELECT id
      FROM public.ministries
      WHERE user_id = auth.uid()
    )
  );
