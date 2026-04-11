-- ============================================================
-- SEED — Criar usuário administrador inicial
-- Gestão Eklesia
-- Edite as variáveis abaixo antes de executar
-- ============================================================

DO $$
DECLARE
  v_user_id      UUID;
  v_ministry_id  UUID;
  v_plan_id      UUID;

  -- ⚠️ EDITE AQUI ⚠️
  v_email        TEXT    := 'admin@gestaoeklesia.com.br';
  v_password     TEXT    := 'Siren001001';
  v_nome         TEXT    := 'Administrador';
  v_ministry_name TEXT   := 'Igreja Master';
  v_ministry_slug TEXT   := 'admin-igreja';  -- sem espaços/acentos, único no sistema
  v_ministry_phone TEXT  := '';
BEGIN

  -- 1. Buscar ID do plano Starter
  SELECT id INTO v_plan_id FROM public.subscription_plans WHERE slug = 'starter' LIMIT 1;

  -- 2. Criar usuário no Supabase Auth
  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('name', v_nome),
    NOW(),
    NOW(),
    '', '', '', ''
  );

  -- 3. Criar identidade (necessário para login via email/senha)
  INSERT INTO auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id::text,   -- provider_id = sub do usuário para provider 'email'
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  -- 4. Criar ministério / igreja
  v_ministry_id := gen_random_uuid();

  INSERT INTO public.ministries (
    id,
    user_id,
    name,
    slug,
    email_admin,
    phone,
    plan,
    subscription_plan_id,
    subscription_status,
    max_users,
    is_active
  ) VALUES (
    v_ministry_id,
    v_user_id,
    v_ministry_name,
    v_ministry_slug,
    v_email,
    v_ministry_phone,
    'starter',
    v_plan_id,
    'active',
    5,
    true
  );

  -- 5. Vincular usuário ao ministério como admin
  INSERT INTO public.ministry_users (
    ministry_id,
    user_id,
    role,
    permissions,
    is_active
  ) VALUES (
    v_ministry_id,
    v_user_id,
    'admin',
    '["all"]',
    true
  );

  RAISE NOTICE '✅ Usuário criado com sucesso!';
  RAISE NOTICE '   Email: %', v_email;
  RAISE NOTICE '   user_id: %', v_user_id;
  RAISE NOTICE '   ministry_id: %', v_ministry_id;

END $$;
