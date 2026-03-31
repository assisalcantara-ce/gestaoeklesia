-- ============================================
-- SCRIPT PARA CRIAR USUÁRIO DE TESTE
-- ============================================
-- 
-- Este script cria:
-- 1. Um usuário no auth.users (Supabase Auth)
-- 2. Um ministry (tenant) associado
-- 3. Um vínculo ministry_users com role 'admin'
--
-- ANTES DE EXECUTAR:
-- 1. Acesse: https://supabase.com/dashboard → projeto novo
-- 2. Vá para: SQL Editor → New Query
-- 3. Copy/Paste este SCRIPT
-- 4. Clique em "Run" (botão verde)
--
-- CREDENCIAIS DE TESTE:
-- Email: pastor@iglesia.local
-- Senha: Teste123456! (você precisa criar isso no Supabase Auth manualmente)
-- 
-- ============================================

-- ============================================
-- PASSO 1: CRIAR USUÁRIO NO AUTH.USERS
-- ============================================
-- Este comando precisa ser executado via Supabase Auth ou Dashboard
-- Alternativa: Usar `/api/v1/signup` da aplicação

-- Para criar via Dashboard do Supabase:
-- 1. Vá para: Authentication → Users
-- 2. Clique em "Add User"
-- 3. Email: pastor@iglesia.local
-- 4. Senha: Teste123456!
-- 5. Confirme email: ✓ (marque)
-- 6. Clique em "Create User"
--
-- Pegue o UUID do usuário criado e substitua na variável abaixo:

-- SUBSTITUA ESTE UUID PELO UID DO NOVO USUÁRIO!
-- Formato: 550e8400-e29b-41d4-a716-446655440000

-- ============================================
-- PASSO 2: CRIAR MINISTRY (TENANT)
-- ============================================

WITH new_user AS (
  SELECT 'SEU_UUID_AQUI'::uuid as user_id
),
new_ministry AS (
  INSERT INTO public.ministries (
    user_id,
    name,
    slug,
    email_admin,
    cnpj_cpf,
    phone,
    plan,
    subscription_status,
    timezone
  )
  SELECT
    user_id,
    'Igreja de Teste',
    'igreja-teste-' || to_char(now(), 'yyyymmddhh24miss'),
    'pastor@iglesia.local',
    '00.000.000/0001-00',
    '(11) 99999-9999',
    'trial',
    'active',
    'America/Sao_Paulo'
  FROM new_user
  RETURNING id as ministry_id, user_id
)
-- ============================================
-- PASSO 3: CRIAR MINISTRY_USERS (PERMISSÕES)
-- ============================================
INSERT INTO public.ministry_users (
  ministry_id,
  user_id,
  role,
  is_active
)
SELECT
  ministry_id,
  user_id,
  'admin',
  true
FROM new_ministry;

-- ============================================
-- RESULTADO ESPERADO:
-- ============================================
-- Se chegou aqui sem erro:
-- ✅ Usuario criado em auth.users
-- ✅ Ministry criado em public.ministries
-- ✅ Vínculo criado em public.ministry_users com role 'admin'
--
-- AGORA, FAÇA LOGIN COM:
-- Email: pastor@iglesia.local
-- Senha: Teste123456!
--
-- ============================================
-- INSTRUÇÕES PARA FAZER LOGIN
-- ============================================
--
-- 1. Abra a aplicação em: http://localhost:3000 (dev) ou URL de produção
-- 2. Vá para a página de Login
-- 3. Digite:
--    Email: pastor@iglesia.local
--    Senha: Teste123456!
-- 4. Clique em "Entrar"
-- 5. Se receber erro "Confirme seu email", verifique:
--    - Dashboard do Supabase → Authentication → Users
--    - O email deve estar com ✓ Confirmed
--
-- ============================================
-- ALTERNATIVA: USAR /api/v1/SIGNUP (FLUXO NORMAL)
-- ============================================
--
-- Se preferir usar o fluxo de sign-up normal (recomendado):
--
-- 1. A aplicação deve estar rodando (localhost:3000 ou produção)
-- 2. Vá para: /signup ou página inicial
-- 3. Preencha o formulário:
--    - Ministério: Igreja de Teste
--    - Pastor: Seu Nome
--    - CPF: 00000000000
--    - WhatsApp: (11) 99999-9999
--    - Email: pastor@iglesia.local
--    - Senha: Teste123456!
-- 4. Clique em "Registrar"
-- 5. Você receberá um email com link de confirmação
-- 6. Clique no link para confirmar
-- 7. Após confirmar, faça login
--
-- O trial iniciará automáticamente com 7 dias de validade.
--
-- ============================================

