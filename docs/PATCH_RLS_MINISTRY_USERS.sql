-- ============================================================
-- PATCH: Corrigir RLS de ministry_users
-- Permite: (1) Membros verem seus dados OR (2) Donos gerenciarem
-- Sem comprometer segurança multi-tenant
-- ============================================================
-- Copie e execute no Supabase SQL Editor
-- ============================================================

-- PASSO 1: Remover políticas conflitantes
DROP POLICY IF EXISTS "ministry_users_owner_all" ON public.ministry_users;
DROP POLICY IF EXISTS "ministry_users_select_self" ON public.ministry_users;
DROP POLICY IF EXISTS "Usuários só veem seus ministry_users" ON public.ministry_users;
DROP POLICY IF EXISTS "ministry_users_access" ON public.ministry_users;

-- ============================================================
-- PASSO 2: Recriar com lógica única (SELECT)
-- ============================================================
CREATE POLICY "ministry_users_select"
  ON public.ministry_users
  FOR SELECT
  USING (
    -- CASO 1: Usuário é membro (pode ver seus próprios dados)
    user_id = auth.uid()
    OR
    -- CASO 2: Usuário é dono do ministério (pode gerenciar)
    ministry_id IN (
      SELECT id FROM public.ministries 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- PASSO 3: Políticas para INSERT (apenas donos)
-- ============================================================
CREATE POLICY "ministry_users_insert"
  ON public.ministry_users
  FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT id FROM public.ministries 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- PASSO 4: Políticas para UPDATE (apenas donos)
-- ============================================================
CREATE POLICY "ministry_users_update"
  ON public.ministry_users
  FOR UPDATE
  USING (
    ministry_id IN (
      SELECT id FROM public.ministries 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    ministry_id IN (
      SELECT id FROM public.ministries 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- PASSO 5: Políticas para DELETE (apenas donos)
-- ============================================================
CREATE POLICY "ministry_users_delete"
  ON public.ministry_users
  FOR DELETE
  USING (
    ministry_id IN (
      SELECT id FROM public.ministries 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- PASSO 6: Verifique se as políticas foram criadas
-- ============================================================
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'ministry_users'
ORDER BY policyname;

-- ============================================================
-- PASSO 7: Teste queries (deve funcionar agora)
-- ============================================================

-- Teste 1: Ver ministry_users do usuário (deve funcionar)
SELECT * FROM public.ministry_users 
WHERE user_id = '189775f5-3601-42a9-95ce-416108d0e7f9';

-- Teste 2: Ver members do ministério (deve funcionar)
SELECT COUNT(*) as total_members
FROM public.members 
WHERE ministry_id = 'bcab307a-f769-4980-91b8-39d566991fd8';

-- ============================================================
-- FIM DO PATCH
-- ============================================================
