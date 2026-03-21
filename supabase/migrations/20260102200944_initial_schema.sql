-- ============================================
-- 1. ENABLE EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 2. MINISTRIES (Tenants)
-- ============================================

CREATE TABLE public.ministries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Info básico
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  email_admin VARCHAR(255) UNIQUE NOT NULL,
  cnpj_cpf VARCHAR(20),
  phone VARCHAR(20),
  website VARCHAR(255),
  
  -- Branding
  logo_url VARCHAR(500),
  description TEXT,
  
  -- Subscription
  plan VARCHAR(50) NOT NULL DEFAULT 'starter',
  subscription_status VARCHAR(50) NOT NULL DEFAULT 'active',
  subscription_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  subscription_end_date TIMESTAMP,
  auto_renew BOOLEAN DEFAULT true,
  
  -- Quotas
  max_users INTEGER DEFAULT 10,
  max_storage_bytes BIGINT DEFAULT 5368709120,
  storage_used_bytes BIGINT DEFAULT 0,
  
  -- Metadata
  timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT positive_storage CHECK (storage_used_bytes >= 0)
);

CREATE INDEX idx_ministries_user_id ON public.ministries(user_id);
CREATE INDEX idx_ministries_slug ON public.ministries(slug);
CREATE INDEX idx_ministries_status ON public.ministries(subscription_status);

ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seu próprio ministry"
  ON public.ministries FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Usuários podem atualizar seu próprio ministry"
  ON public.ministries FOR UPDATE
  USING (user_id = auth.uid());


-- ============================================
-- 3. MINISTRY_USERS (Usuários do ministério)
-- ============================================

CREATE TABLE public.ministry_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  role VARCHAR(50) NOT NULL DEFAULT 'operator',
  permissions JSONB DEFAULT '[]',
  
  is_active BOOLEAN DEFAULT true,
  last_activity TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(ministry_id, user_id),
  CONSTRAINT valid_role CHECK (role IN ('admin', 'manager', 'operator', 'viewer'))
);

CREATE INDEX idx_ministry_users_ministry_id ON public.ministry_users(ministry_id);
CREATE INDEX idx_ministry_users_user_id ON public.ministry_users(user_id);
CREATE INDEX idx_ministry_users_role ON public.ministry_users(role);

ALTER TABLE public.ministry_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários só veem seus ministry_users"
  ON public.ministry_users FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );


-- ============================================
-- 4. MEMBERS (Membros da comunidade)
-- ============================================

CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  cpf VARCHAR(20),
  
  birth_date DATE,
  gender VARCHAR(20),
  marital_status VARCHAR(50),
  occupation VARCHAR(255),
  
  address VARCHAR(500),
  complement VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2),
  zipcode VARCHAR(20),
  
  member_since DATE DEFAULT CURRENT_DATE,
  role VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  
  custom_fields JSONB DEFAULT '{}',
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(ministry_id, cpf),
  UNIQUE(ministry_id, email),
  CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'deceased', 'transferred'))
);

CREATE INDEX idx_members_ministry_id ON public.members(ministry_id);
CREATE INDEX idx_members_cpf ON public.members(cpf);
CREATE INDEX idx_members_status ON public.members(status);
CREATE INDEX idx_members_name ON public.members USING GIN (name gin_trgm_ops);

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros isolados por ministry"
  ON public.members FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem ser inseridos no seu ministry"
  ON public.members FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem ser atualizados no seu ministry"
  ON public.members FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem ser deletados no seu ministry"
  ON public.members FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );


-- ============================================
-- 5. AUDIT_LOGS (Auditoria)
-- ============================================

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID,
  
  old_data JSONB,
  new_data JSONB,
  changes JSONB,
  
  ip_address INET,
  user_agent VARCHAR(500),
  status_code INTEGER,
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_action CHECK (
    action IN ('CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN', 'LOGOUT', 'DOWNLOAD')
  )
);

CREATE INDEX idx_audit_logs_ministry_id ON public.audit_logs(ministry_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários só veem logs do seu ministry"
  ON public.audit_logs FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );


-- ============================================
-- 6. CARTOES_TEMPLATES (Templates de cartão)
-- ============================================

CREATE TABLE public.cartoes_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  template_data JSONB NOT NULL,
  preview_url VARCHAR(500),
  
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cartoes_templates_ministry_id ON public.cartoes_templates(ministry_id);
CREATE INDEX idx_cartoes_templates_default ON public.cartoes_templates(is_default);

ALTER TABLE public.cartoes_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates isolados por ministry"
  ON public.cartoes_templates FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );


-- ============================================
-- 7. CARTOES_GERADOS (Cartões impressos)
-- ============================================

CREATE TABLE public.cartoes_gerados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.cartoes_templates(id),
  
  pdf_url VARCHAR(500),
  qr_code_data VARCHAR(500),
  
  generated_by UUID REFERENCES auth.users(id),
  printed_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cartoes_gerados_ministry_id ON public.cartoes_gerados(ministry_id);
CREATE INDEX idx_cartoes_gerados_member_id ON public.cartoes_gerados(member_id);
CREATE INDEX idx_cartoes_gerados_created_at ON public.cartoes_gerados(created_at);

ALTER TABLE public.cartoes_gerados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cartões isolados por ministry"
  ON public.cartoes_gerados FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );


-- ============================================
-- 8. CONFIGURATIONS (Configurações por ministry)
-- ============================================

CREATE TABLE public.configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL UNIQUE REFERENCES public.ministries(id) ON DELETE CASCADE,
  
  nomenclaturas JSONB DEFAULT '{
    "member": "Membro",
    "members": "Membros",
    "role": "Cargo",
    "roles": "Cargos",
    "division": "Divisão",
    "divisions": "Divisões"
  }',
  
  notification_settings JSONB DEFAULT '{}',
  
  report_settings JSONB DEFAULT '{}',
  
  custom_fields JSONB DEFAULT '[]',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Configurações isoladas por ministry"
  ON public.configurations FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Configurações podem ser atualizadas pelo ministry"
  ON public.configurations FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );


-- ============================================
-- 9. ARQUIVOS (File storage metadata)
-- ============================================

CREATE TABLE public.arquivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  
  filename VARCHAR(255) NOT NULL,
  mimetype VARCHAR(100),
  size_bytes BIGINT NOT NULL,
  
  storage_path VARCHAR(500) NOT NULL,
  url VARCHAR(500),
  
  uploaded_by UUID REFERENCES auth.users(id),
  resource_type VARCHAR(50),
  resource_id UUID,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT positive_size CHECK (size_bytes > 0)
);

CREATE INDEX idx_arquivos_ministry_id ON public.arquivos(ministry_id);
CREATE INDEX idx_arquivos_resource ON public.arquivos(resource_type, resource_id);
CREATE INDEX idx_arquivos_created_at ON public.arquivos(created_at DESC);

ALTER TABLE public.arquivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Arquivos isolados por ministry"
  ON public.arquivos FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );


-- ============================================
-- FUNÇÕES HELPER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ministries_updated_at
  BEFORE UPDATE ON public.ministries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_cartoes_templates_updated_at
  BEFORE UPDATE ON public.cartoes_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_configurations_updated_at
  BEFORE UPDATE ON public.configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- 10. EMPLOYEES (Funcionários)
-- ============================================

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  
  -- Informações profissionais
  grupo VARCHAR(100) NOT NULL,
  funcao VARCHAR(100) NOT NULL,
  data_admissao DATE NOT NULL,
  
  -- Contato
  email VARCHAR(255),
  telefone VARCHAR(20),
  whatsapp VARCHAR(20),
  
  -- Documentação
  rg VARCHAR(20),
  
  -- Endereço
  endereco VARCHAR(500),
  cep VARCHAR(20),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  uf VARCHAR(2),
  
  -- Dados financeiros
  banco VARCHAR(50),
  agencia VARCHAR(20),
  conta_corrente VARCHAR(20),
  pix VARCHAR(255),
  
  -- Informações adicionais
  obs TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'ATIVO',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_status CHECK (status IN ('ATIVO', 'INATIVO'))
);

CREATE INDEX idx_employees_ministry_id ON public.employees(ministry_id);
CREATE INDEX idx_employees_member_id ON public.employees(member_id);
CREATE INDEX idx_employees_status ON public.employees(status);
CREATE INDEX idx_employees_grupo ON public.employees(grupo);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionários isolados por ministry"
  ON public.employees FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Funcionários podem ser inseridos no seu ministry"
  ON public.employees FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Funcionários podem ser atualizados no seu ministry"
  ON public.employees FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Funcionários podem ser deletados no seu ministry"
  ON public.employees FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );


-- ============================================
-- VIEWS ÚTEIS
-- ============================================

CREATE OR REPLACE VIEW public.employees_with_member_info AS
SELECT
  e.id,
  e.ministry_id,
  e.member_id,
  e.grupo,
  e.funcao,
  e.data_admissao,
  e.email,
  e.telefone,
  e.whatsapp,
  e.rg,
  e.endereco,
  e.cep,
  e.bairro,
  e.cidade,
  e.uf,
  e.banco,
  e.agencia,
  e.conta_corrente,
  e.pix,
  e.obs,
  e.status,
  e.created_at,
  e.updated_at,
  m.name as member_name,
  m.cpf as member_cpf,
  m.phone as member_phone,
  m.birth_date as member_birth_date
FROM public.employees e
LEFT JOIN public.members m ON e.member_id = m.id;


CREATE OR REPLACE VIEW public.ministries_with_stats AS
SELECT
  m.id,
  m.name,
  m.slug,
  m.plan,
  m.subscription_status,
  COUNT(DISTINCT mem.id) as total_members,
  COUNT(DISTINCT mu.id) as total_users,
  COUNT(DISTINCT e.id) as total_employees,
  m.storage_used_bytes,
  m.created_at
FROM public.ministries m
LEFT JOIN public.members mem ON m.id = mem.ministry_id
LEFT JOIN public.ministry_users mu ON m.id = mu.ministry_id
LEFT JOIN public.employees e ON m.id = e.ministry_id
GROUP BY m.id, m.name, m.slug, m.plan, m.subscription_status, m.storage_used_bytes, m.created_at;
