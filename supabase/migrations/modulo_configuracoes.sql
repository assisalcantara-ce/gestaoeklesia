-- ============================================================
-- MÓDULO CONFIGURAÇÕES — Gestão Eklesia
-- Depende de: modulo_usuarios.sql (ministries, ministry_users, auth.users)
-- Execute no SQL Editor do Supabase (cole e rode tudo de uma vez)
-- Script idempotente: pode ser reexecutado sem erro
-- ============================================================

-- ============================================================
-- 1. CONFIGURAÇÕES DA IGREJA (configurations)
--    Armazena dados complementares do perfil que não ficam
--    em ministries: endereço (texto livre), responsável, logo (base64),
--    e nomenclaturas organizacionais (JSONB).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.configurations (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id  UUID    NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,

  -- Perfil complementar (campos gerenciados via igreja-config-utils.ts)
  -- Estrutura esperada de church_profile:
  --   { "endereco": "...", "responsavel": "..." }
  church_profile  JSONB NOT NULL DEFAULT '{}',

  -- Nomenclaturas organizacionais e cargos ministeriais
  -- Estrutura esperada de nomenclaturas:
  --   {
  --     "divisoes_organizacionais": {
  --       "schemaVersion": 3,
  --       "divisaoPrincipal":  { "opcao1": "IGREJA",  "custom": [] },
  --       "divisaoSecundaria": { "opcao1": "CAMPO",   "custom": [] },
  --       "divisaoTerciaria":  { "opcao1": "NENHUMA", "custom": [] }
  --     },
  --     "cargos_ministeriais": [{ "id": "...", "nome": "...", "ativo": true }]
  --   }
  nomenclaturas   JSONB NOT NULL DEFAULT '{}',

  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT configurations_ministry_unique UNIQUE (ministry_id)
);

CREATE INDEX IF NOT EXISTS idx_configurations_ministry_id ON public.configurations(ministry_id);

ALTER TABLE public.configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "configurations_owner_all"   ON public.configurations;
DROP POLICY IF EXISTS "configurations_member_read" ON public.configurations;

-- Dono do ministério: acesso total
CREATE POLICY "configurations_owner_all"
  ON public.configurations FOR ALL
  USING (
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

-- Usuários vinculados ao ministério: somente leitura
CREATE POLICY "configurations_member_read"
  ON public.configurations FOR SELECT
  TO authenticated
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS configurations_updated_at ON public.configurations;
CREATE TRIGGER configurations_updated_at
  BEFORE UPDATE ON public.configurations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. TEMPLATES DE CARTÕES (cartoes_templates)
--    Editor canvas de cartões de membro/credencial.
--    onConflict: ministry_id,template_key
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cartoes_templates (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id   UUID    NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  template_key  VARCHAR(255) NOT NULL,
  tipo_cadastro VARCHAR(100) NOT NULL,      -- ex: 'membro', 'credencial', 'visitante'
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  template_data JSONB NOT NULL DEFAULT '{}', -- dados completos do canvas
  preview_url   VARCHAR(500),               -- URL opcional (não base64 — limite 500 chars)
  is_default    BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT cartoes_templates_unique UNIQUE (ministry_id, template_key)
);

-- Garante apenas um template ativo por tipo por ministério (índice parcial único)
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_per_tipo
  ON public.cartoes_templates (ministry_id, tipo_cadastro)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_cartoes_templates_ministry_id   ON public.cartoes_templates(ministry_id);
CREATE INDEX IF NOT EXISTS idx_cartoes_templates_tipo_cadastro ON public.cartoes_templates(tipo_cadastro);
CREATE INDEX IF NOT EXISTS idx_cartoes_templates_is_active     ON public.cartoes_templates(is_active);

ALTER TABLE public.cartoes_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cartoes_templates_owner_all"   ON public.cartoes_templates;
DROP POLICY IF EXISTS "cartoes_templates_member_read" ON public.cartoes_templates;

CREATE POLICY "cartoes_templates_owner_all"
  ON public.cartoes_templates FOR ALL
  USING (
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "cartoes_templates_member_read"
  ON public.cartoes_templates FOR SELECT
  TO authenticated
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS cartoes_templates_updated_at ON public.cartoes_templates;
CREATE TRIGGER cartoes_templates_updated_at
  BEFORE UPDATE ON public.cartoes_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. TEMPLATES DE CERTIFICADOS (certificados_templates)
--    Editor canvas de certificados (batismo, conclusão, etc.)
--    onConflict: ministry_id,template_key
-- ============================================================
CREATE TABLE IF NOT EXISTS public.certificados_templates (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id   UUID    NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  template_key  VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  template_data JSONB NOT NULL DEFAULT '{}', -- dados completos do canvas
  preview_url   VARCHAR(500),
  is_default    BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT certificados_templates_unique UNIQUE (ministry_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_certificados_templates_ministry_id ON public.certificados_templates(ministry_id);
CREATE INDEX IF NOT EXISTS idx_certificados_templates_is_active   ON public.certificados_templates(is_active);

ALTER TABLE public.certificados_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "certificados_templates_owner_all"   ON public.certificados_templates;
DROP POLICY IF EXISTS "certificados_templates_member_read" ON public.certificados_templates;

CREATE POLICY "certificados_templates_owner_all"
  ON public.certificados_templates FOR ALL
  USING (
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "certificados_templates_member_read"
  ON public.certificados_templates FOR SELECT
  TO authenticated
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS certificados_templates_updated_at ON public.certificados_templates;
CREATE TRIGGER certificados_templates_updated_at
  BEFORE UPDATE ON public.certificados_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. TICKETS DE SUPORTE (support_tickets)
--    Criado ao solicitar upgrade de plano e para suporte geral.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject     VARCHAR(500) NOT NULL,
  description TEXT,
  category    VARCHAR(100) NOT NULL DEFAULT 'Geral',
  priority    VARCHAR(20)  NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status      VARCHAR(30)  NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution  TEXT,
  resolved_at TIMESTAMP,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_ministry_id ON public.support_tickets(ministry_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id     ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status      ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category    ON public.support_tickets(category);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets_owner_select" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_owner_insert" ON public.support_tickets;

-- Usuário vê e cria tickets do próprio ministério
CREATE POLICY "support_tickets_owner_select"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
      UNION
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "support_tickets_owner_insert"
  ON public.support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
      UNION
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. LOGS DE AUDITORIA (audit_logs)
--    Registra todas as ações dos usuários no sistema.
--    Suporta o schema atual (usuario_id + campos descritivos)
--    e o schema legado (ministry_id + action mapeado).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Schema atual (preferencial)
  usuario_id       UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_email    VARCHAR(255),
  acao             VARCHAR(100),   -- criar, editar, deletar, visualizar, exportar, login...
  modulo           VARCHAR(100),   -- configuracoes, usuarios, membros, financeiro...
  area             VARCHAR(100),   -- plano, perfil, nomenclaturas...
  tabela_afetada   VARCHAR(100),
  registro_id      UUID,
  descricao        TEXT,
  dados_anteriores JSONB,
  dados_novos      JSONB,
  status           VARCHAR(30)  DEFAULT 'sucesso'
                   CHECK (status IN ('sucesso', 'erro', 'aviso')),
  mensagem_erro    TEXT,

  -- Schema legado (fallback)
  ministry_id      UUID    REFERENCES public.ministries(id) ON DELETE CASCADE,
  user_id          UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  action           VARCHAR(50),    -- CREATE, UPDATE, DELETE, READ, EXPORT, LOGIN...
  resource_type    VARCHAR(100),
  resource_id      UUID,
  old_data         JSONB,
  new_data         JSONB,
  changes          JSONB,
  status_code      INTEGER,
  error_message    TEXT,

  -- Rede / contexto
  ip_address       VARCHAR(45),
  user_agent       TEXT,

  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_usuario_id   ON public.audit_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ministry_id  ON public.audit_logs(ministry_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_acao         ON public.audit_logs(acao);
CREATE INDEX IF NOT EXISTS idx_audit_logs_modulo       ON public.audit_logs(modulo);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at   ON public.audit_logs(created_at DESC);

-- audit_logs: sem RLS (inserção feita via service_role na API route)
-- SELECT: usuário vê apenas logs do próprio ministério
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_ministry_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_service_insert"  ON public.audit_logs;

CREATE POLICY "audit_logs_ministry_select"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
      UNION
      SELECT ministry_id FROM public.ministry_users
        WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
