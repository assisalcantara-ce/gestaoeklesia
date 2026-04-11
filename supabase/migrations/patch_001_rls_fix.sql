-- ============================================================
-- PATCH 001 — Correções críticas de RLS e storage
-- Gestão Eklesia
-- Problema 1: logo_url VARCHAR(500) → base64 cabe em TEXT
-- Problema 2: RLS recursivo entre ministries e ministry_users
-- ============================================================

-- ============================================================
-- 1. CORRIGIR COLUNA logo_url (VARCHAR → TEXT)
-- ============================================================
ALTER TABLE public.ministries
  ALTER COLUMN logo_url TYPE TEXT;

-- ============================================================
-- 2. FUNÇÕES SECURITY DEFINER para quebrar recursão nas RLS
--    SECURITY DEFINER executa sem RLS → evita o loop infinito
-- ============================================================

-- IDs dos ministérios que o usuário atual POSSUI
CREATE OR REPLACE FUNCTION public.get_owned_ministry_ids()
RETURNS SETOF UUID
LANGUAGE SQL SECURITY DEFINER STABLE
AS $$
  SELECT id FROM public.ministries WHERE user_id = auth.uid();
$$;

-- IDs dos ministérios aos quais o usuário está vinculado como membro
CREATE OR REPLACE FUNCTION public.get_linked_ministry_ids()
RETURNS SETOF UUID
LANGUAGE SQL SECURITY DEFINER STABLE
AS $$
  SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid();
$$;

-- ============================================================
-- 3. CORRIGIR POLÍTICAS RLS — ministries
-- ============================================================
DROP POLICY IF EXISTS "ministries_owner_select" ON public.ministries;
DROP POLICY IF EXISTS "ministries_member_select" ON public.ministries;

-- Dono: acesso direto sem subquery em ministry_users (sem recursão)
CREATE POLICY "ministries_owner_select"
  ON public.ministries FOR SELECT
  USING (user_id = auth.uid());

-- Membro/usuário secundário: usa função SECURITY DEFINER
CREATE POLICY "ministries_member_select"
  ON public.ministries FOR SELECT
  USING (id IN (SELECT public.get_linked_ministry_ids()));

-- ============================================================
-- 4. CORRIGIR POLÍTICAS RLS — ministry_users
-- ============================================================
DROP POLICY IF EXISTS "ministry_users_owner_all" ON public.ministry_users;
DROP POLICY IF EXISTS "ministry_users_select_self" ON public.ministry_users;

-- Dono do ministério: acesso total usando função SECURITY DEFINER
CREATE POLICY "ministry_users_owner_all"
  ON public.ministry_users FOR ALL
  USING (ministry_id IN (SELECT public.get_owned_ministry_ids()));

-- Usuário secundário: vê apenas o próprio vínculo
CREATE POLICY "ministry_users_select_self"
  ON public.ministry_users FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- 5. CORRIGIR POLÍTICAS RLS — supervisoes e congregacoes
--    (também usavam ministry_users diretamente)
-- ============================================================
DROP POLICY IF EXISTS "supervisoes_ministry_access" ON public.supervisoes;
CREATE POLICY "supervisoes_ministry_access"
  ON public.supervisoes FOR SELECT
  TO authenticated
  USING (
    ministry_id IN (
      SELECT public.get_owned_ministry_ids()
      UNION
      SELECT public.get_linked_ministry_ids()
    )
  );

DROP POLICY IF EXISTS "congregacoes_ministry_access" ON public.congregacoes;
CREATE POLICY "congregacoes_ministry_access"
  ON public.congregacoes FOR SELECT
  TO authenticated
  USING (
    ministry_id IN (
      SELECT public.get_owned_ministry_ids()
      UNION
      SELECT public.get_linked_ministry_ids()
    )
  );

-- ============================================================
-- 6. CORRIGIR POLÍTICAS RLS — configurations
-- ============================================================
DROP POLICY IF EXISTS "configurations_owner_all"   ON public.configurations;
DROP POLICY IF EXISTS "configurations_member_read" ON public.configurations;

CREATE POLICY "configurations_owner_all"
  ON public.configurations FOR ALL
  USING (ministry_id IN (SELECT public.get_owned_ministry_ids()));

CREATE POLICY "configurations_member_read"
  ON public.configurations FOR SELECT
  TO authenticated
  USING (ministry_id IN (SELECT public.get_linked_ministry_ids()));

-- ============================================================
-- 7. CORRIGIR POLÍTICAS RLS — cartoes_templates
-- ============================================================
DROP POLICY IF EXISTS "cartoes_templates_owner_all"   ON public.cartoes_templates;
DROP POLICY IF EXISTS "cartoes_templates_member_read" ON public.cartoes_templates;

CREATE POLICY "cartoes_templates_owner_all"
  ON public.cartoes_templates FOR ALL
  USING (ministry_id IN (SELECT public.get_owned_ministry_ids()));

CREATE POLICY "cartoes_templates_member_read"
  ON public.cartoes_templates FOR SELECT
  TO authenticated
  USING (ministry_id IN (SELECT public.get_linked_ministry_ids()));

-- ============================================================
-- 8. CORRIGIR POLÍTICAS RLS — certificados_templates
-- ============================================================
DROP POLICY IF EXISTS "certificados_templates_owner_all"   ON public.certificados_templates;
DROP POLICY IF EXISTS "certificados_templates_member_read" ON public.certificados_templates;

CREATE POLICY "certificados_templates_owner_all"
  ON public.certificados_templates FOR ALL
  USING (ministry_id IN (SELECT public.get_owned_ministry_ids()));

CREATE POLICY "certificados_templates_member_read"
  ON public.certificados_templates FOR SELECT
  TO authenticated
  USING (ministry_id IN (SELECT public.get_linked_ministry_ids()));

-- ============================================================
-- 9. CORRIGIR POLÍTICAS RLS — support_tickets
-- ============================================================
DROP POLICY IF EXISTS "support_tickets_owner_select" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_owner_insert" ON public.support_tickets;

CREATE POLICY "support_tickets_owner_select"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (
    ministry_id IN (
      SELECT public.get_owned_ministry_ids()
      UNION
      SELECT public.get_linked_ministry_ids()
    )
  );

CREATE POLICY "support_tickets_owner_insert"
  ON public.support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND ministry_id IN (
      SELECT public.get_owned_ministry_ids()
      UNION
      SELECT public.get_linked_ministry_ids()
    )
  );

-- ============================================================
-- 10. CORRIGIR POLÍTICAS RLS — audit_logs
-- ============================================================
DROP POLICY IF EXISTS "audit_logs_ministry_select" ON public.audit_logs;

CREATE POLICY "audit_logs_ministry_select"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR ministry_id IN (
      SELECT ministry_id FROM public.ministry_users
        WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- ============================================================
-- FIM DO PATCH
-- ============================================================
