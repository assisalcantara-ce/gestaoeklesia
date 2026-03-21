-- ============================================
-- TABELAS PARA PÉ-CADASTRO E NOTIFICAÇÕES
-- ============================================

-- 1. Tabela de Pré-Cadastros (Trial)
CREATE TABLE IF NOT EXISTS public.pre_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  ministry_name VARCHAR(255) NOT NULL,
  pastor_name VARCHAR(255) NOT NULL,
  cpf_cnpj VARCHAR(20) NOT NULL,
  whatsapp VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  trial_expires_at TIMESTAMP NOT NULL,
  trial_days INTEGER DEFAULT 7,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'converted')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Índices para pre_registrations
CREATE INDEX idx_pre_registrations_email ON public.pre_registrations(email);
CREATE INDEX idx_pre_registrations_user_id ON public.pre_registrations(user_id);
CREATE INDEX idx_pre_registrations_status ON public.pre_registrations(status);
CREATE INDEX idx_pre_registrations_trial_expires_at ON public.pre_registrations(trial_expires_at);

-- 2. Tabela de Notificações do Admin
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

-- Índices para admin_notifications
CREATE INDEX idx_admin_notifications_admin_id ON public.admin_notifications(admin_id);
CREATE INDEX idx_admin_notifications_type ON public.admin_notifications(type);
CREATE INDEX idx_admin_notifications_is_read ON public.admin_notifications(is_read);
CREATE INDEX idx_admin_notifications_created_at ON public.admin_notifications(created_at);

-- 3. Habilitar RLS (se necessário)
ALTER TABLE public.pre_registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications DISABLE ROW LEVEL SECURITY;

-- 4. Função para verificar e expirar trials automaticamente
CREATE OR REPLACE FUNCTION check_trial_expiration()
RETURNS VOID AS $$
BEGIN
  UPDATE public.pre_registrations
  SET status = 'expired'
  WHERE trial_expires_at <= NOW() AND status IN ('pending', 'active');
  
  -- Opcional: deletar usuários cujo trial expirou
  -- DELETE FROM auth.users
  -- WHERE id IN (
  --   SELECT user_id FROM pre_registrations
  --   WHERE status = 'expired' AND trial_expires_at < NOW() - INTERVAL '30 days'
  -- );
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger para atualizar updated_at
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

-- 6. Inserir notificação de exemplo
-- INSERT INTO public.admin_notifications (type, title, message)
-- VALUES (
--   'test',
--   'Teste de Notificação',
--   'Esta é uma notificação de teste'
-- );
