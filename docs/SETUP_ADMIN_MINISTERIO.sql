-- ============================================================
-- SETUP: ASSOCIAR admin@gestaoeklesia.com.br A UM MINISTÉRIO
-- ============================================================
-- Copie e execute este script no Supabase SQL Editor
-- ============================================================

-- PASSO 1: Encontrar o user_id
-- Execute isto primeiro para obter o USER_ID
SELECT id as user_id, email FROM auth.users 
WHERE email = 'admin@gestaoeklesia.com.br';

-- ============================================================
-- PASSO 2: OPÇÃO A - Se o usuário NÃO tem ministério
-- Crie um ministério para ele
-- ============================================================
-- Descomente e execute se precisar criar:

-- INSERT INTO public.ministries (name, user_id, status)
-- VALUES (
--   'Gestão Eklesia Admin',
--   (SELECT id FROM auth.users WHERE email = 'admin@gestaoeklesia.com.br'),
--   'ATIVO'
-- )
-- ON CONFLICT DO NOTHING;

-- ============================================================
-- PASSO 3: OPÇÃO B - Ou associar a um ministério existente
-- ============================================================
-- Primeiro, verifique quais ministérios existem:

SELECT id as ministry_id, name, user_id 
FROM public.ministries 
LIMIT 10;

-- Se quiser associar o usuário a um ministério existente, use:
-- (Substitua MINISTRY_ID_UUID pelo ID retornado acima)

-- INSERT INTO public.ministry_users (user_id, ministry_id, role)
-- VALUES (
--   (SELECT id FROM auth.users WHERE email = 'admin@gestaoeklesia.com.br'),
--   'MINISTRY_ID_UUID',
--   'admin'
-- )
-- ON CONFLICT (user_id, ministry_id) DO NOTHING;

-- ============================================================
-- PASSO 4: Verifique o resultado
-- ============================================================
-- Após executar um dos passos acima, verifique:

SELECT 
  u.id as user_id,
  u.email,
  COALESCE(m.id, m2.id) as ministry_id,
  COALESCE(m.name, m2.name) as ministry_name,
  'proprietário' as tipo
FROM auth.users u
LEFT JOIN public.ministries m ON u.id = m.user_id
LEFT JOIN public.ministry_users mu ON u.id = mu.user_id
LEFT JOIN public.ministries m2 ON mu.ministry_id = m2.id
WHERE u.email = 'admin@gestaoeklesia.com.br';

-- ============================================================
-- FIM DO SETUP
-- ============================================================
