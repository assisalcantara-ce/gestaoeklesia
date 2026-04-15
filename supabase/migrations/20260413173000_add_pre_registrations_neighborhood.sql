-- Pre-registro (trial) + bairro em uma unica migracao
CREATE TABLE IF NOT EXISTS public.pre_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ministry_name VARCHAR(255) NOT NULL,
  pastor_name VARCHAR(255) NOT NULL,
  cpf_cnpj VARCHAR(20) NOT NULL,
  whatsapp VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  trial_expires_at TIMESTAMP NOT NULL,
  trial_days INTEGER DEFAULT 7,
  status VARCHAR(50) DEFAULT 'trial' CHECK (status IN ('trial', 'encerrado')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

ALTER TABLE public.pre_registrations
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS website VARCHAR(255),
  ADD COLUMN IF NOT EXISTS responsible_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS quantity_temples INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quantity_members INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS address_street VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS address_neighborhood VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address_complement VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address_state VARCHAR(2),
  ADD COLUMN IF NOT EXISTS address_zip VARCHAR(10),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'starter';

ALTER TABLE public.pre_registrations
  DROP CONSTRAINT IF EXISTS pre_registrations_user_id_key;

ALTER TABLE public.pre_registrations
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.pre_registrations
  DROP CONSTRAINT IF EXISTS fk_pre_registrations_user_id;

ALTER TABLE public.pre_registrations
  ADD CONSTRAINT fk_pre_registrations_user_id
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pre_registrations_email ON public.pre_registrations(email);
CREATE INDEX IF NOT EXISTS idx_pre_registrations_user_id ON public.pre_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_pre_registrations_status ON public.pre_registrations(status);
CREATE INDEX IF NOT EXISTS idx_pre_registrations_trial_expires_at ON public.pre_registrations(trial_expires_at);
CREATE INDEX IF NOT EXISTS idx_pre_registrations_plan ON public.pre_registrations(plan);
CREATE INDEX IF NOT EXISTS idx_pre_registrations_city ON public.pre_registrations(address_city);

ALTER TABLE public.pre_registrations DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_pre_registrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pre_registrations_updated_at ON public.pre_registrations;
CREATE TRIGGER trigger_pre_registrations_updated_at
BEFORE UPDATE ON public.pre_registrations
FOR EACH ROW
EXECUTE FUNCTION update_pre_registrations_updated_at();

COMMENT ON COLUMN public.pre_registrations.address_neighborhood IS 'Bairro';

-- Notificacoes admin (usadas no pre-cadastro)
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_admin_id ON public.admin_notifications(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON public.admin_notifications(type);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON public.admin_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON public.admin_notifications(created_at);

ALTER TABLE public.admin_notifications DISABLE ROW LEVEL SECURITY;
