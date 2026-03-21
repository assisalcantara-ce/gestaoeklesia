-- P0 SECURITY: Lockdown de acesso à tabela admin_users
-- Objetivo: impedir SELECT/INSERT/UPDATE/DELETE por anon/authenticated (browser)
-- Observação: service_role bypassa RLS, então as rotas server-side continuam funcionando.

BEGIN;

-- Garantir RLS habilitado
ALTER TABLE IF EXISTS public.admin_users ENABLE ROW LEVEL SECURITY;

-- Remover TODAS as policies existentes (inclui as antigas que causavam recursão ou permitiam SELECT público)
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_users'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- Reforço: revogar privilégios diretos de anon/authenticated
REVOKE ALL ON TABLE public.admin_users FROM anon;
REVOKE ALL ON TABLE public.admin_users FROM authenticated;

-- Garantir que service_role (e postgres) continua com privilégios
GRANT ALL ON TABLE public.admin_users TO service_role;
GRANT ALL ON TABLE public.admin_users TO postgres;

COMMIT;
