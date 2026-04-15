-- ============================================================
-- SETUP: Associar user_id 189775f5-3601-42a9-95ce-416108d0e7f9
-- a um ministério EXISTENTE
-- ============================================================

-- PASSO 1: Liste os ministérios disponíveis
-- Execute isto PRIMEIRO para ver qual ministério usar:
SELECT 
  id as ministry_id,
  name as ministry_name,
  user_id as owner_id,
  is_active,
  subscription_status,
  created_at
FROM public.ministries 
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================
-- PASSO 2: Associar ao ministério IEADMI
-- ============================================================

INSERT INTO public.ministry_users (user_id, ministry_id, role)
VALUES (
  '189775f5-3601-42a9-95ce-416108d0e7f9',
  'bcab307a-f769-4980-91b8-39d566991fd8',
  'admin'
)
ON CONFLICT (user_id, ministry_id) DO NOTHING;

-- ============================================================
-- PASSO 3: Verifique se funcionou
-- ============================================================
SELECT 
  u.id as user_id,
  u.email,
  m.id as ministry_id,
  m.name as ministry_name,
  'membro' as tipo
FROM auth.users u
LEFT JOIN public.ministry_users mu ON u.id = mu.user_id
LEFT JOIN public.ministries m ON mu.ministry_id = m.id
WHERE u.id = '189775f5-3601-42a9-95ce-416108d0e7f9';
