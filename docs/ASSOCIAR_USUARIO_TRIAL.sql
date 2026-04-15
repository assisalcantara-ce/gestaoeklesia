-- ============================================================
-- ASSOCIAR USUÁRIO TRIAL: assisalcantara.ce@gmail.com
-- ao ministério: AD ROCHA ETERNA DE MARITUBA
-- ============================================================

-- PASSO 1: Verificar se o ministério existe
SELECT id as ministry_id, name 
FROM public.ministries 
WHERE name ILIKE '%ROCHA ETERNA%' 
   OR name ILIKE '%MARITUBA%'
   OR name ILIKE '%AD%ROCHA%';

-- PASSO 2: Se não existir, CRIAR o ministério
-- (Descomente se precisar criar)
-- INSERT INTO public.ministries (name, slug, email_admin, user_id, plan, subscription_status, is_active)
-- VALUES (
--   'AD ROCHA ETERNA DE MARITUBA',
--   'ad-rocha-eterna-marituba',
--   'assisalcantara.ce@gmail.com',
--   (SELECT id FROM auth.users WHERE email = 'assisalcantara.ce@gmail.com'),
--   'starter',
--   'active',
--   true
-- );

-- PASSO 3: ASSOCIAR O USUÁRIO AO MINISTÉRIO
-- Após executar PASSO 1 e confirmar o ministry_id, execute isto:

INSERT INTO public.ministry_users (user_id, ministry_id, role, is_active)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'assisalcantara.ce@gmail.com'),
  (SELECT id FROM public.ministries WHERE name ILIKE '%ROCHA ETERNA%' LIMIT 1),
  'admin',
  true
)
ON CONFLICT (user_id, ministry_id) DO NOTHING;

-- PASSO 4: VERIFICAR que funcionou
SELECT 
  u.email,
  m.name as ministry_name,
  mu.role,
  mu.is_active
FROM public.ministry_users mu
LEFT JOIN auth.users u ON mu.user_id = u.id
LEFT JOIN public.ministries m ON mu.ministry_id = m.id
WHERE u.email = 'assisalcantara.ce@gmail.com';

-- ============================================================
-- FIM DA ASSOCIAÇÃO DO USUÁRIO TRIAL
-- ============================================================
