-- ============================================================================
-- Migration: 20260911220000_platform_corporate_finance.sql
-- Descrição: Estrutura da Central Financeira Corporativa da Gestão Eklésia
-- Módulos: Categorias Corporativas, Receitas Manuais, Despesas e Saldos
-- Isolamento: 100% isolado do financeiro dos tenants/igrejas
-- ============================================================================

-- 1. Categorias Financeiras Corporativas (Receitas & Despesas da Empresa)
CREATE TABLE IF NOT EXISTS public.platform_financial_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Receitas Manuais da Plataforma (Não provenientes do billing de assinaturas)
CREATE TABLE IF NOT EXISTS public.platform_manual_revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.platform_financial_categories(id) ON DELETE SET NULL,
  description VARCHAR(255) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  reference_date DATE NOT NULL,
  received_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'canceled')),
  payment_method VARCHAR(50),
  payer_name VARCHAR(255),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Despesas Corporativas da Plataforma (Custos operacionais e administrativos)
CREATE TABLE IF NOT EXISTS public.platform_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.platform_financial_categories(id) ON DELETE SET NULL,
  description VARCHAR(255) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  reference_date DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'canceled')),
  payment_method VARCHAR(50),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recipient_name VARCHAR(255),
  receipt_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Saldos Financeiros Iniciais / Contas Financeiras da Plataforma
CREATE TABLE IF NOT EXISTS public.platform_financial_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name VARCHAR(100) NOT NULL DEFAULT 'Conta Principal Gestão Eklésia',
  reference_year INT NOT NULL,
  reference_month INT NOT NULL CHECK (reference_month BETWEEN 1 AND 12),
  initial_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_platform_financial_balances_account_period UNIQUE (account_name, reference_year, reference_month)
);

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_platform_fin_cat_type ON public.platform_financial_categories(type, is_active);
CREATE INDEX IF NOT EXISTS idx_platform_man_rev_date ON public.platform_manual_revenues(reference_date, status);
CREATE INDEX IF NOT EXISTS idx_platform_man_rev_rec ON public.platform_manual_revenues(received_at);
CREATE INDEX IF NOT EXISTS idx_platform_exp_date ON public.platform_expenses(reference_date, due_date, status);
CREATE INDEX IF NOT EXISTS idx_platform_exp_paid ON public.platform_expenses(paid_at);
CREATE INDEX IF NOT EXISTS idx_platform_fin_bal_period ON public.platform_financial_balances(reference_year, reference_month);

-- 5. Configuração de RLS (Row Level Security) Restrito a Super Admin
ALTER TABLE public.platform_financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_manual_revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_financial_balances ENABLE ROW LEVEL SECURITY;

-- Policies para Super Admin
DROP POLICY IF EXISTS super_admin_manage_platform_fin_categories ON public.platform_financial_categories;
CREATE POLICY super_admin_manage_platform_fin_categories
  ON public.platform_financial_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = true
        AND (au.role = 'admin' OR au.role = 'super_admin' OR au.capabilities @> '[pagamentos]'::jsonb)
    )
  );

DROP POLICY IF EXISTS super_admin_manage_platform_manual_revenues ON public.platform_manual_revenues;
CREATE POLICY super_admin_manage_platform_manual_revenues
  ON public.platform_manual_revenues
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = true
        AND (au.role = 'admin' OR au.role = 'super_admin' OR au.capabilities @> '[pagamentos]'::jsonb)
    )
  );

DROP POLICY IF EXISTS super_admin_manage_platform_expenses ON public.platform_expenses;
CREATE POLICY super_admin_manage_platform_expenses
  ON public.platform_expenses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = true
        AND (au.role = 'admin' OR au.role = 'super_admin' OR au.capabilities @> '[pagamentos]'::jsonb)
    )
  );

DROP POLICY IF EXISTS super_admin_manage_platform_financial_balances ON public.platform_financial_balances;
CREATE POLICY super_admin_manage_platform_financial_balances
  ON public.platform_financial_balances
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = true
        AND (au.role = 'admin' OR au.role = 'super_admin' OR au.capabilities @> '[pagamentos]'::jsonb)
    )
  );

-- 6. Inserção das Categorias Padrão da Empresa (Idempotente)
INSERT INTO public.platform_financial_categories (name, type, description)
VALUES
  -- Receitas Manuais
  ('Serviços de Implantação', 'INCOME', 'Configuração inicial e onboarding assistido de igrejas'),
  ('Consultoria e Treinamento', 'INCOME', 'Treinamento presencial/remoto para equipes pastorais e secretarias'),
  ('Desenvolvimento Sob Demanda', 'INCOME', 'Customizações de relatórios e fluxos específicos'),
  ('Aporte de Sócios / Capital', 'INCOME', 'Integralização de capital e aportes operacionais'),
  ('Outras Receitas', 'INCOME', 'Receitas operacionais diversas não recorrentes'),

  -- Despesas Corporativas
  ('Infraestrutura & Cloud', 'EXPENSE', 'Servidores Supabase, AWS, Vercel e Cloudflare'),
  ('Comunicação & Mensageria', 'EXPENSE', 'APIs WhatsApp, Resend, gateways de SMS e e-mail'),
  ('Gateways & Taxas Financeiras', 'EXPENSE', 'Tarifas do ASAAS, taxas de antecipação e bancárias'),
  ('Ferramentas & Softwares', 'EXPENSE', 'Licenças de desenvolvimento, IDEs, Google Workspace, GitHub'),
  ('Marketing & Aquisição', 'EXPENSE', 'Anúncios Google/Meta, landing pages e eventos'),
  ('Pessoal & Prestadores', 'EXPENSE', 'Honorários contábeis, jurídicos, suporte e prestadores de serviços'),
  ('Pró-labore dos Sócios', 'EXPENSE', 'Distribuição de pró-labore dos sócios fundadores'),
  ('Impostos & Tributos', 'EXPENSE', 'Simples Nacional, ISS, taxas municipais e federais'),
  ('Outras Despesas Operacionais', 'EXPENSE', 'Despesas administrativas e gerais da empresa')
ON CONFLICT DO NOTHING;
