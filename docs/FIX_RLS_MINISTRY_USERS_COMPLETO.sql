-- ============================================================
-- LIMPEZA COMPLETA + RECRIAÇÃO DE RLS MINISTRY_USERS
-- Remove TODAS as policies antigas conflitantes e recria de forma robusta
-- ============================================================

-- PASSO 1: Ver todas as policies atuais
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'ministry_users'
ORDER BY policyname;

-- ============================================================
-- PASSO 2: REMOVER TODAS as policies (limpeza completa)
-- ============================================================
DROP POLICY IF EXISTS "ministry_users_owner_all" ON public.ministry_users;
DROP POLICY IF EXISTS "ministry_users_select_self" ON public.ministry_users;
DROP POLICY IF EXISTS "ministry_users_select" ON public.ministry_users;
DROP POLICY IF EXISTS "ministry_users_insert" ON public.ministry_users;
DROP POLICY IF EXISTS "ministry_users_update" ON public.ministry_users;
DROP POLICY IF EXISTS "ministry_users_delete" ON public.ministry_users;
DROP POLICY IF EXISTS "Usuários só veem seus ministry_users" ON public.ministry_users;
DROP POLICY IF EXISTS "ministry_users_access" ON public.ministry_users;

-- ============================================================
-- PASSO 3: DESABILITAR E REABILITAR RLS (força reset)
-- ============================================================
ALTER TABLE public.ministry_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ministry_users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PASSO 4: DEFINIR UMA ÚNICA POLICY ROBUSTA (SELECT)
-- Simples e clara: Usuário pode ver seus próprios registros OU é dono
-- ============================================================
CREATE POLICY "ministry_users_select_v2"
  ON public.ministry_users
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR 
    EXISTS (
      SELECT 1 FROM public.ministries m 
      WHERE m.id = ministry_id 
        AND m.user_id = auth.uid()
    )
  );

-- ============================================================
-- PASSO 5: POLICY PARA INSERT (apenas donos do ministério)
-- ============================================================
CREATE POLICY "ministry_users_insert_v2"
  ON public.ministry_users
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministries m 
      WHERE m.id = ministry_id 
        AND m.user_id = auth.uid()
    )
  );

-- ============================================================
-- PASSO 6: POLICY PARA UPDATE (apenas donos)
-- ============================================================
CREATE POLICY "ministry_users_update_v2"
  ON public.ministry_users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministries m 
      WHERE m.id = ministry_id 
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministries m 
      WHERE m.id = ministry_id 
        AND m.user_id = auth.uid()
    )
  );

-- ============================================================
-- PASSO 7: POLICY PARA DELETE (apenas donos)
-- ============================================================
CREATE POLICY "ministry_users_delete_v2"
  ON public.ministry_users
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministries m 
      WHERE m.id = ministry_id 
        AND m.user_id = auth.uid()
    )
  );

-- ============================================================
-- PASSO 8: Verificar que as policies foram criadas
-- ============================================================
SELECT COUNT(*) as total_policies FROM pg_policies 
WHERE tablename = 'ministry_users';

-- ============================================================
-- PASSO 9: ASOCIAR USUÁRIO TRIAL AO MINISTÉRIO
-- ============================================================
-- Primeiro, encontrar ou criar o ministério "AD ROCHA ETERNA DE MARITUBA"
SELECT id, name FROM public.ministries 
WHERE name ILIKE '%ROCHA ETERNA%' OR name ILIKE '%MARITUBA%';

-- Se não existir, criar:
-- INSERT INTO public.ministries (name, slug, email_admin, user_id, plan, subscription_status)
-- VALUES (
--   'AD ROCHA ETERNA DE MARITUBA',
--   'ad-rocha-eterna-marituba',
--   'assisalcantara.ce@gmail.com',
--   (SELECT id FROM auth.users WHERE email = 'assisalcantara.ce@gmail.com'),
--   'starter',
--   'active'
-- );

-- Associar usuário trial ao ministério (ajuste ministry_id conforme necessário)
-- INSERT INTO public.ministry_users (user_id, ministry_id, role, is_active)
-- VALUES (
--   (SELECT id FROM auth.users WHERE email = 'assisalcantara.ce@gmail.com'),
--   (SELECT id FROM public.ministries WHERE name ILIKE '%ROCHA ETERNA%' LIMIT 1),
--   'admin',
--   true
-- )
-- ON CONFLICT (user_id, ministry_id) DO NOTHING;

-- ============================================================
-- PASSO 10: TESTE - Verificar se os usuários conseguem ver seus ministry_users
-- ============================================================

-- Teste para admin@gestaoeklesia.com.br
SELECT 'admin@gestaoeklesia.com.br' as user_email,
  COUNT(*) as ministry_count,
  array_agg(m.name) as ministries
FROM public.ministry_users mu
LEFT JOIN public.ministries m ON mu.ministry_id = m.id
WHERE mu.user_id = (SELECT id FROM auth.users WHERE email = 'admin@gestaoeklesia.com.br');

-- Teste para wciinfo@gmail.com
SELECT 'wciinfo@gmail.com' as user_email,
  COUNT(*) as ministry_count,
  array_agg(m.name) as ministries
FROM public.ministry_users mu
LEFT JOIN public.ministries m ON mu.ministry_id = m.id
WHERE mu.user_id = (SELECT id FROM auth.users WHERE email = 'wciinfo@gmail.com');

-- ============================================================
-- FIM DA LIMPEZA E RECRIAÇÃO
-- ============================================================
