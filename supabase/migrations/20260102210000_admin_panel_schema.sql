-- ============================================
-- ADMIN PANEL SCHEMA
-- Tabelas para gerenciar multi-tenancy: planos, pagamentos, suporte
-- ============================================

-- ============================================
-- 1. PLANS (Planos de Assinatura)
-- ============================================

CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Info básico
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  
  -- Pricing
  price_monthly DECIMAL(10, 2) NOT NULL,
  price_annually DECIMAL(10, 2),
  setup_fee DECIMAL(10, 2) DEFAULT 0,
  
  -- Features
  max_users INTEGER NOT NULL,
  max_storage_bytes BIGINT NOT NULL,
  max_members INTEGER NOT NULL,
  max_ministerios INTEGER NOT NULL DEFAULT 1,
  
  -- Features booleanas
  has_api_access BOOLEAN DEFAULT false,
  has_custom_domain BOOLEAN DEFAULT false,
  has_advanced_reports BOOLEAN DEFAULT false,
  has_priority_support BOOLEAN DEFAULT false,
  has_white_label BOOLEAN DEFAULT false,
  has_automation BOOLEAN DEFAULT false,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. PAYMENTS (Pagamentos via ASAAS)
-- ============================================

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  
  -- Informações do Pagamento
  asaas_payment_id VARCHAR(100) UNIQUE,
  subscription_plan_id UUID REFERENCES public.subscription_plans(id),
  
  -- Detalhes financeiros
  amount DECIMAL(10, 2) NOT NULL,
  description VARCHAR(500),
  due_date DATE NOT NULL,
  
  -- Status do pagamento
  status VARCHAR(50) DEFAULT 'pending', -- pending, paid, overdue, cancelled, failed
  payment_method VARCHAR(50), -- credit_card, bank_transfer, pix, boleto
  payment_date TIMESTAMP,
  
  -- Período de cobertura
  period_start DATE,
  period_end DATE,
  
  -- Metadados ASAAS
  asaas_response JSONB,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_ministry_id ON public.payments(ministry_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_due_date ON public.payments(due_date);

-- ============================================
-- 3. SUPPORT TICKETS (Suporte Técnico)
-- ============================================

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Ticket info
  ticket_number VARCHAR(20) UNIQUE NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  
  -- Categorização
  category VARCHAR(50) NOT NULL, -- bug, feature_request, billing, technical, general
  priority VARCHAR(50) DEFAULT 'medium', -- low, medium, high, urgent
  status VARCHAR(50) DEFAULT 'open', -- open, in_progress, waiting_customer, resolved, closed
  
  -- Resolução
  resolution_notes TEXT,
  resolved_at TIMESTAMP,
  
  -- SLA
  sla_minutes INTEGER,
  response_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_support_tickets_ministry_id ON public.support_tickets(ministry_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON public.support_tickets(priority);
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets(created_at);

-- ============================================
-- 4. SUPPORT TICKET MESSAGES (Conversa do Ticket)
-- ============================================

CREATE TABLE public.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Mensagem
  message TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false, -- Nota interna ou resposta ao cliente
  
  -- Attachment
  attachments JSONB,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ticket_messages_ticket_id ON public.support_ticket_messages(ticket_id);
CREATE INDEX idx_ticket_messages_created_at ON public.support_ticket_messages(created_at);

-- ============================================
-- 5. ADMIN USERS (Usuários do Painel Admin)
-- ============================================

CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Info
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- admin, support, accounting, viewer
  
  -- Permissions
  can_manage_ministries BOOLEAN DEFAULT false,
  can_manage_payments BOOLEAN DEFAULT false,
  can_manage_plans BOOLEAN DEFAULT false,
  can_manage_support BOOLEAN DEFAULT false,
  can_view_analytics BOOLEAN DEFAULT false,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_user UNIQUE(user_id)
);

-- ============================================
-- 6. AUDIT LOG (Log de auditoria admin)
-- ============================================

CREATE TABLE public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  
  -- Ação
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100), -- ministry, payment, ticket, plan
  entity_id VARCHAR(100),
  
  -- Detalhes
  changes JSONB,
  status VARCHAR(50), -- success, error
  error_message TEXT,
  ip_address VARCHAR(50),
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_audit_logs_admin_user_id ON public.admin_audit_logs(admin_user_id);
CREATE INDEX idx_admin_audit_logs_entity_type ON public.admin_audit_logs(entity_type);
CREATE INDEX idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at);

-- ============================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Planos: todos podem ler (públicos)
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_select_public" ON public.subscription_plans
  FOR SELECT USING (is_active = true);

-- Pagamentos: apenas admin ou ministry owner
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_admin_all" ON public.payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() 
      AND au.can_manage_payments = true
      AND au.is_active = true
    )
  );

CREATE POLICY "payments_ministry_own" ON public.payments
  FOR SELECT USING (
    ministry_id IN (
      SELECT id FROM public.ministries 
      WHERE user_id = auth.uid()
    )
  );

-- Tickets: admin ou ministry owner
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_admin_all" ON public.support_tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() 
      AND au.can_manage_support = true
      AND au.is_active = true
    )
  );

CREATE POLICY "tickets_ministry_own" ON public.support_tickets
  FOR ALL USING (
    ministry_id IN (
      SELECT id FROM public.ministries 
      WHERE user_id = auth.uid()
    )
  );

-- Mensagens de ticket: admin ou ministry com ticket
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_messages_admin_all" ON public.support_ticket_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() 
      AND au.can_manage_support = true
      AND au.is_active = true
    )
  );

CREATE POLICY "ticket_messages_ministry_own" ON public.support_ticket_messages
  FOR ALL USING (
    ticket_id IN (
      SELECT id FROM public.support_tickets 
      WHERE ministry_id IN (
        SELECT id FROM public.ministries WHERE user_id = auth.uid()
      )
    )
  );

-- Admin Users: apenas admin podem gerenciar
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_users_admin_all" ON public.admin_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() 
      AND au.role = 'admin'
      AND au.is_active = true
    )
  );

-- Audit logs: apenas admin
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_admin_read" ON public.admin_audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() 
      AND au.role = 'admin'
      AND au.is_active = true
    )
  );

CREATE POLICY "audit_logs_admin_insert" ON public.admin_audit_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() 
      AND au.is_active = true
    )
  );

-- ============================================
-- 8. TRIGGERS
-- ============================================

-- Atualizar updated_at em subscription_plans
CREATE OR REPLACE FUNCTION update_subscription_plans_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_plans_timestamp();

-- Atualizar updated_at em payments
CREATE OR REPLACE FUNCTION update_payments_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_timestamp();

-- Atualizar updated_at em support_tickets
CREATE OR REPLACE FUNCTION update_support_tickets_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_tickets_timestamp();

-- Atualizar updated_at em support_ticket_messages
CREATE OR REPLACE FUNCTION update_support_ticket_messages_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER support_ticket_messages_updated_at
  BEFORE UPDATE ON public.support_ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_support_ticket_messages_timestamp();

-- Atualizar updated_at em admin_users
CREATE OR REPLACE FUNCTION update_admin_users_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_users_timestamp();

-- Gerar ticket_number automaticamente
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ticket_number = 'TKT-' || DATE_FORMAT(CURRENT_TIMESTAMP, '%Y%m%d') || '-' || LPAD(NEXTVAL('ticket_number_seq')::text, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar sequência para ticket_number
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1 INCREMENT 1;

CREATE TRIGGER generate_ticket_number_trigger
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION generate_ticket_number();

-- ============================================
-- 9. INITIAL DATA
-- ============================================

-- Inserir planos padrão
INSERT INTO public.subscription_plans (name, slug, description, price_monthly, price_annually, max_users, max_storage_bytes, max_members, has_api_access, has_custom_domain, has_advanced_reports, has_priority_support)
VALUES 
  ('Starter', 'starter', 'Para ministérios pequenos', 0, 0, 5, 5368709120, 100, false, false, false, false),
  ('Profissional', 'professional', 'Para ministérios em crescimento', 99.90, 999.00, 20, 10737418240, 500, true, false, true, true),
  ('Empresarial', 'enterprise', 'Para grandes ministérios', 299.90, 2999.00, 100, 107374182400, 5000, true, true, true, true)
ON CONFLICT (slug) DO NOTHING;
