# 🗄️ SCHEMA SUPABASE COMPLETO
## SQL para criação de todas as tabelas - Gestão Eklesia

---

## ⚙️ COMO USAR ESTE SQL

1. **Opção A:** Copiar tudo e colar em `Supabase Dashboard → SQL Editor → New Query`
2. **Opção B:** Executar via `psql` direto no terminal
3. **Opção C:** Usar em migrations (se usar Prisma depois)

---

## SQL COMPLETO

```sql
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
  max_storage_bytes BIGINT DEFAULT 5368709120, -- 5GB
  storage_used_bytes BIGINT DEFAULT 0,
  
  -- Metadata
  timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT positive_storage CHECK (storage_used_bytes >= 0)
);

-- Índices
CREATE INDEX idx_ministries_user_id ON public.ministries(user_id);
CREATE INDEX idx_ministries_slug ON public.ministries(slug);
CREATE INDEX idx_ministries_status ON public.ministries(subscription_status);

-- RLS
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
  
  -- Role e permissões
  role VARCHAR(50) NOT NULL DEFAULT 'operator',
  permissions JSONB DEFAULT '[]',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_activity TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(ministry_id, user_id),
  CONSTRAINT valid_role CHECK (role IN ('admin', 'manager', 'operator', 'viewer'))
);

-- Índices
CREATE INDEX idx_ministry_users_ministry_id ON public.ministry_users(ministry_id);
CREATE INDEX idx_ministry_users_user_id ON public.ministry_users(user_id);
CREATE INDEX idx_ministry_users_role ON public.ministry_users(role);

-- RLS
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
  
  -- Informações básicas
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  cpf VARCHAR(20),
  
  -- Dados pessoais
  birth_date DATE,
  gender VARCHAR(20),
  marital_status VARCHAR(50),
  occupation VARCHAR(255),
  
  -- Endereço
  address VARCHAR(500),
  complement VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2),
  zipcode VARCHAR(20),
  
  -- Ministério
  member_since DATE DEFAULT CURRENT_DATE,
  role VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  
  -- Dados customizados
  custom_fields JSONB DEFAULT '{}',
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(ministry_id, cpf),
  UNIQUE(ministry_id, email),
  CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'deceased', 'transferred'))
);

-- Índices
CREATE INDEX idx_members_ministry_id ON public.members(ministry_id);
CREATE INDEX idx_members_cpf ON public.members(cpf);
CREATE INDEX idx_members_status ON public.members(status);
CREATE INDEX idx_members_name ON public.members USING GIN (name gin_trgm_ops);

-- RLS
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
  
  -- Ação
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID,
  
  -- Dados
  old_data JSONB,
  new_data JSONB,
  changes JSONB,
  
  -- Request info
  ip_address INET,
  user_agent VARCHAR(500),
  status_code INTEGER,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_action CHECK (
    action IN ('CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN', 'LOGOUT', 'DOWNLOAD')
  )
);

-- Índices
CREATE INDEX idx_audit_logs_ministry_id ON public.audit_logs(ministry_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- RLS
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
  
  -- Nome e descrição
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Design
  template_data JSONB NOT NULL, -- JSON com layout, cores, campos
  preview_url VARCHAR(500),
  
  -- Metadata
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_cartoes_templates_ministry_id ON public.cartoes_templates(ministry_id);
CREATE INDEX idx_cartoes_templates_default ON public.cartoes_templates(is_default);

-- RLS
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
  
  -- PDF/Arquivo
  pdf_url VARCHAR(500),
  qr_code_data VARCHAR(500),
  
  -- Metadata
  generated_by UUID REFERENCES auth.users(id),
  printed_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT same_ministry CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.members WHERE id = member_id
    )
  )
);

-- Índices
CREATE INDEX idx_cartoes_gerados_ministry_id ON public.cartoes_gerados(ministry_id);
CREATE INDEX idx_cartoes_gerados_member_id ON public.cartoes_gerados(member_id);
CREATE INDEX idx_cartoes_gerados_created_at ON public.cartoes_gerados(created_at);

-- RLS
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
  
  -- Nomenclaturas dinâmicas
  nomenclaturas JSONB DEFAULT '{
    "member": "Membro",
    "members": "Membros",
    "role": "Cargo",
    "roles": "Cargos",
    "division": "Divisão",
    "divisions": "Divisões"
  }',
  
  -- Configurações de notificação
  notification_settings JSONB DEFAULT '{}',
  
  -- Configurações de relatório
  report_settings JSONB DEFAULT '{}',
  
  -- Dados customizados
  custom_fields JSONB DEFAULT '[]',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RLS
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
  
  -- Info do arquivo
  filename VARCHAR(255) NOT NULL,
  mimetype VARCHAR(100),
  size_bytes BIGINT NOT NULL,
  
  -- Armazenamento
  storage_path VARCHAR(500) NOT NULL,
  url VARCHAR(500),
  
  -- Metadata
  uploaded_by UUID REFERENCES auth.users(id),
  resource_type VARCHAR(50), -- member, template, report, etc
  resource_id UUID,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT positive_size CHECK (size_bytes > 0)
);

-- Índices
CREATE INDEX idx_arquivos_ministry_id ON public.arquivos(ministry_id);
CREATE INDEX idx_arquivos_resource ON public.arquivos(resource_type, resource_id);
CREATE INDEX idx_arquivos_created_at ON public.arquivos(created_at DESC);

-- RLS
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

-- Atualizar timestamp de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para ministries
CREATE TRIGGER trigger_ministries_updated_at
  BEFORE UPDATE ON public.ministries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para members
CREATE TRIGGER trigger_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para cartoes_templates
CREATE TRIGGER trigger_cartoes_templates_updated_at
  BEFORE UPDATE ON public.cartoes_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para configurations
CREATE TRIGGER trigger_configurations_updated_at
  BEFORE UPDATE ON public.configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- VIEWS ÚTEIS
-- ============================================

-- Visão de ministries com contagem de members
CREATE OR REPLACE VIEW public.ministries_with_stats AS
SELECT
  m.id,
  m.name,
  m.slug,
  m.plan,
  m.subscription_status,
  COUNT(DISTINCT mem.id) as total_members,
  COUNT(DISTINCT mu.id) as total_users,
  m.storage_used_bytes,
  m.created_at
FROM public.ministries m
LEFT JOIN public.members mem ON m.id = mem.ministry_id
LEFT JOIN public.ministry_users mu ON m.id = mu.ministry_id
GROUP BY m.id, m.name, m.slug, m.plan, m.subscription_status, m.storage_used_bytes, m.created_at;


-- ============================================
-- DADOS INICIAIS (OPCIONAL)
-- ============================================

-- Planos padrão (você precisa criar os usuários manualmente via Supabase Auth)
-- Insira um ministry de teste quando tiver um user_id real:
/*
INSERT INTO public.ministries (user_id, name, slug, email_admin, plan)
VALUES (
  'uuid-do-usuario-aqui',
  'Meu Ministério',
  'meu-ministerio',
  'admin@exemplo.com',
  'starter'
);
*/
```

---

## 📋 CHECKLIST APÓS EXECUTAR

- [ ] SQL executado sem erros
- [ ] 9 tabelas criadas
- [ ] RLS ativado em cada tabela
- [ ] Índices criados
- [ ] Triggers criados
- [ ] Views criadas
- [ ] Tipo no Supabase Dashboard: `SELECT * FROM auth.users LIMIT 1;` (deve retorgar sucesso)

---

## 🚀 PRÓXIMAS AÇÕES

1. Criar primeiro usuário via Supabase Auth
2. Criar primeiro ministry
3. Testar isolamento RLS
4. Começar implementação de APIs

**Status:** Pronto para executar SQL? ✅

