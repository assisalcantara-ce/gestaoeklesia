-- ============================================================
-- DIAGNÓSTICO: Usuários e Ministérios Órfãos
-- ============================================================

-- 1. Quantos usuários existem no auth
SELECT COUNT(*) as total_users FROM auth.users;

-- 2. Todos os usuários (mostrar os primeiros 20)
SELECT id, email, created_at FROM auth.users 
ORDER BY created_at DESC 
LIMIT 20;

-- 3. Quantos ministérios existem
SELECT COUNT(*) as total_ministries FROM public.ministries;

-- 4. Todos os ministérios
SELECT id, name, user_id as owner_id, is_active, created_at 
FROM public.ministries 
ORDER BY created_at DESC;

-- 5. USUÁRIOS ÓRFÃOS (sem ministério e sem ser dono)
SELECT 
  u.id,
  u.email,
  u.created_at,
  'SEM MINISTÉRIO' as status
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = u.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.ministries m WHERE m.user_id = u.id
)
ORDER BY u.created_at DESC;

-- 6. Todas as relações ministry_users
SELECT 
  mu.user_id,
  u.email,
  mu.ministry_id,
  m.name as ministry_name,
  mu.role,
  mu.is_active
FROM public.ministry_users mu
LEFT JOIN auth.users u ON mu.user_id = u.id
LEFT JOIN public.ministries m ON mu.ministry_id = m.id
ORDER BY u.email;

-- 7. Usuários que são donos de ministérios
SELECT 
  u.id,
  u.email,
  COUNT(m.id) as num_ministries,
  array_agg(m.name) as ministry_names
FROM auth.users u
LEFT JOIN public.ministries m ON u.id = m.user_id
GROUP BY u.id, u.email
HAVING COUNT(m.id) > 0
ORDER BY u.email;

-- ============================================================
-- FIM DO DIAGNÓSTICO
-- ============================================================
