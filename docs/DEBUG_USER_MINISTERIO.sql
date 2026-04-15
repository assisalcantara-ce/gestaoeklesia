-- ============================================================
-- DEBUG: Verificar associação do user 189775f5-3601-42a9-95ce-416108d0e7f9
-- ============================================================

-- 1. Verifique se o usuário existe
SELECT id, email, created_at FROM auth.users 
WHERE id = '189775f5-3601-42a9-95ce-416108d0e7f9';

-- 2. Verifique se há registros em ministry_users
SELECT * FROM public.ministry_users 
WHERE user_id = '189775f5-3601-42a9-95ce-416108d0e7f9';

-- 3. Verifique se há registros em ministries (como owner)
SELECT id, name, user_id FROM public.ministries 
WHERE user_id = '189775f5-3601-42a9-95ce-416108d0e7f9';

-- 4. Verifique o ministério IEADMI existe
SELECT id, name FROM public.ministries 
WHERE id = 'bcab307a-f769-4980-91b8-39d566991fd8';

-- 5. Verifique se há membros nesse ministério
SELECT COUNT(*) as total_membros FROM public.members 
WHERE ministry_id = 'bcab307a-f769-4980-91b8-39d566991fd8';

-- ============================================================
-- Se tudo passar, execute isto para FORÇAR a associação:
-- ============================================================

-- Limpar se existir conflito
DELETE FROM public.ministry_users 
WHERE user_id = '189775f5-3601-42a9-95ce-416108d0e7f9' 
  AND ministry_id = 'bcab307a-f769-4980-91b8-39d566991fd8';

-- Recriar
INSERT INTO public.ministry_users (user_id, ministry_id, role)
VALUES (
  '189775f5-3601-42a9-95ce-416108d0e7f9',
  'bcab307a-f769-4980-91b8-39d566991fd8',
  'admin'
);

-- Verificar novamente
SELECT * FROM public.ministry_users 
WHERE user_id = '189775f5-3601-42a9-95ce-416108d0e7f9';
