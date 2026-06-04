-- ============================================
-- SUPORTE: Correção Completa Admin Dashboard
-- ============================================
-- Cole tudo isso no SQL Editor do Supabase
-- Depois clique em RUN
-- ============================================

-- 1️⃣ PASSO 1: Adicionar colunas de permissões à tabela admin_users
-- (Se não existirem)
ALTER TABLE admin_users
ADD COLUMN IF NOT EXISTS can_manage_ministries BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_payments BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_plans BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_support BOOLEAN DEFAULT false;

-- 2️⃣ PASSO 2: Atualizar permissões de usuários existentes
-- (Admins ganham todas as permissões)
UPDATE admin_users
SET 
  can_manage_ministries = true,
  can_manage_payments = true,
  can_manage_plans = true,
  can_manage_support = true
WHERE role IN ('admin', 'super_admin')
AND (
  can_manage_ministries IS false 
  OR can_manage_ministries IS NULL
);

-- (Suporte - permissão apenas para suporte)
UPDATE admin_users
SET can_manage_support = true
WHERE role = 'suporte'
AND (can_manage_support IS false OR can_manage_support IS NULL);

-- (Financeiro - permissão para pagamentos)
UPDATE admin_users
SET can_manage_payments = true
WHERE role = 'financeiro'
AND (can_manage_payments IS false OR can_manage_payments IS NULL);

-- 3️⃣ PASSO 3: Deletar usuário de suporte anterior (se existir e falhar)
-- ⚠️ Remova as aspas para executar - CUIDADO! Deleta dados!
-- DELETE FROM admin_users 
-- WHERE email = 'suporte@gestaoeklesia.com.br' AND status = 'INATIVO';

-- 4️⃣ PASSO 4: Verificar status - execute depois para confirmar
-- SELECT 
--   id,
--   email,
--   role,
--   status,
--   can_manage_ministries,
--   can_manage_payments,
--   can_manage_plans,
--   can_manage_support,
--   criado_em
-- FROM admin_users
-- WHERE role IN ('admin', 'suporte', 'financeiro')
-- ORDER BY criado_em DESC;

-- ============================================
-- ✅ PRONTO! Agora:
-- 1. Vá para: Authentication → Users
-- 2. Delete o usuário anterior (se existir)
-- 3. Crie novo usuário: suporte@gestaoeklesia.com.br
-- 4. Teste login em: /admin/login
-- ============================================
