-- Admin module schema fixes: pre_registrations, notifications, admin_users compatibility,
-- and support tickets default ticket_number.

-- 1) pre_registrations (used by signup/contact/admin flows)
CREATE TABLE IF NOT EXISTS public.pre_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ministry_name VARCHAR(255) NOT NULL,
  pastor_name VARCHAR(255) NOT NULL,
  responsible_name VARCHAR(255),
  email VARCHAR(255) NOT NULL,
  whatsapp VARCHAR(30),
  phone VARCHAR(30),
  website VARCHAR(255),
  cpf_cnpj VARCHAR(20),
  quantity_temples INTEGER DEFAULT 1,
  quantity_members INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  trial_expires_at TIMESTAMP WITH TIME ZONE,
  trial_days INTEGER DEFAULT 7,
  address_street VARCHAR(255),
  address_number VARCHAR(20),
  address_complement VARCHAR(255),
  address_city VARCHAR(100),
  address_state VARCHAR(2),
  address_zip VARCHAR(10),
  description TEXT,
  plan VARCHAR(50) DEFAULT 'starter',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pre_registrations_status ON public.pre_registrations(status);
CREATE INDEX IF NOT EXISTS idx_pre_registrations_email ON public.pre_registrations(email);
CREATE INDEX IF NOT EXISTS idx_pre_registrations_cpf_cnpj ON public.pre_registrations(cpf_cnpj);

-- 2) admin_notifications (admin bell + signup/contact notifications)
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_admin_id ON public.admin_notifications(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON public.admin_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON public.admin_notifications(created_at DESC);

-- 3) admin_users compatibility (migrate legacy -> new schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_users'
  ) THEN
    EXECUTE $sql$
      CREATE TABLE public.admin_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        can_manage_ministries BOOLEAN DEFAULT false,
        can_manage_payments BOOLEAN DEFAULT false,
        can_manage_plans BOOLEAN DEFAULT false,
        can_manage_support BOOLEAN DEFAULT false,
        can_view_analytics BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user UNIQUE(user_id)
      )
    $sql$;
  END IF;
END $$;

ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS can_manage_ministries BOOLEAN;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS can_manage_payments BOOLEAN;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS can_manage_plans BOOLEAN;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS can_manage_support BOOLEAN;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS can_view_analytics BOOLEAN;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public.admin_users ALTER COLUMN is_active SET DEFAULT true;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'nome'
  ) THEN
    EXECUTE 'UPDATE public.admin_users SET name = COALESCE(name, nome) WHERE name IS NULL';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'status'
  ) THEN
    EXECUTE 'UPDATE public.admin_users SET is_active = COALESCE(is_active, status = ''ATIVO'') WHERE is_active IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'ativo'
  ) THEN
    EXECUTE 'UPDATE public.admin_users SET is_active = COALESCE(is_active, ativo) WHERE is_active IS NULL';
  END IF;
END $$;

UPDATE public.admin_users
SET
  can_manage_ministries = COALESCE(can_manage_ministries, role IN ('admin', 'super_admin')),
  can_manage_payments = COALESCE(can_manage_payments, role IN ('admin', 'super_admin', 'financeiro', 'accounting')),
  can_manage_plans = COALESCE(can_manage_plans, role IN ('admin', 'super_admin')),
  can_manage_support = COALESCE(can_manage_support, role IN ('admin', 'super_admin', 'suporte', 'support')),
  can_view_analytics = COALESCE(can_view_analytics, role IN ('admin', 'super_admin'))
WHERE true;

-- 4) support_tickets ticket_number default
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'support_tickets' AND column_name = 'ticket_number'
  ) THEN
    EXECUTE 'ALTER TABLE public.support_tickets ALTER COLUMN ticket_number SET DEFAULT (''TK-'' || upper(substr(gen_random_uuid()::text, 1, 8)))';
    EXECUTE 'UPDATE public.support_tickets SET ticket_number = COALESCE(ticket_number, ''TK-'' || upper(substr(gen_random_uuid()::text, 1, 8))) WHERE ticket_number IS NULL';
  END IF;
END $$;
