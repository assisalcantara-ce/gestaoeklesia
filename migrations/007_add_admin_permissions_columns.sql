-- Adicionar colunas de permissões à tabela admin_users
ALTER TABLE admin_users
ADD COLUMN IF NOT EXISTS can_manage_ministries BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_payments BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_plans BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_support BOOLEAN DEFAULT false;

-- Atualizar admins existentes para ter todas as permissões
UPDATE admin_users
SET 
  can_manage_ministries = true,
  can_manage_payments = true,
  can_manage_plans = true,
  can_manage_support = true
WHERE role IN ('admin', 'super_admin');

-- Atualizar usuários de suporte
UPDATE admin_users
SET can_manage_support = true
WHERE role = 'suporte';

-- Atualizar usuários financeiros
UPDATE admin_users
SET can_manage_payments = true
WHERE role = 'financeiro';
