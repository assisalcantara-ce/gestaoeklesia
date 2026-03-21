-- ⚠️ CORREÇÃO: Recursão Infinita em admin_users RLS
-- 
-- Problema: Política RLS original fazia SELECT recursivo em admin_users
-- quando tentava ler a tabela, causando "infinite recursion detected"
--
-- Solução: Desabilitar RLS para admin_users LEITURA, ou permitir leitura pública

-- 1. Desabilitar RLS temporariamente
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;

-- 2. Remover política problemática
DROP POLICY IF EXISTS "admin_users_admin_all" ON public.admin_users;

-- 3. Re-habilitar RLS com nova política segura
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 4. Criar política que permite SELECT público (seguro porque valida no middleware)
CREATE POLICY "admin_users_select_public" ON public.admin_users
  FOR SELECT USING (true);

-- 5. Restringir UPDATE/DELETE apenas para admins (sem recursão)
CREATE POLICY "admin_users_update_delete_superadmin" ON public.admin_users
  FOR UPDATE USING (auth.uid()::text = 'superadmin-uid-here')
  WITH CHECK (auth.uid()::text = 'superadmin-uid-here');

-- Nota: UPDATE/DELETE com RLS pode ser problemático também
-- Melhor abordagem: Desabilitar RLS completamente em admin_users
-- e fazer validação de permissão no backend (já fazemos no middleware)

-- ALTERNATIVA RECOMENDADA:
-- Descomentar linha abaixo para desabilitar RLS completamente em admin_users
-- ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;
