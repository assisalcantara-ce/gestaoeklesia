-- Corrige persistência de perfil da instituição
-- - Evita recursão em policy de ministry_users
-- - Permite update/select de ministries por membro vinculado ao ministry
-- - Garante INSERT/UPDATE/SELECT em configurations
-- - Aumenta logo_url para TEXT (base64 > 500 chars)
-- - Garante coluna church_profile e trigger para criar configuration ao criar ministry

ALTER TABLE public.ministry_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários só veem seus ministry_users" ON public.ministry_users;
DROP POLICY IF EXISTS "ministry_users_select_self" ON public.ministry_users;
CREATE POLICY "ministry_users_select_self"
  ON public.ministry_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver seu próprio ministry" ON public.ministries;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio ministry" ON public.ministries;

CREATE POLICY "ministries_select_member_or_owner"
  ON public.ministries
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.ministry_id = public.ministries.id
        AND mu.user_id = auth.uid()
    )
  );

CREATE POLICY "ministries_update_member_or_owner"
  ON public.ministries
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.ministry_id = public.ministries.id
        AND mu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.ministry_id = public.ministries.id
        AND mu.user_id = auth.uid()
    )
  );

ALTER TABLE public.ministries
  ALTER COLUMN logo_url TYPE TEXT;

ALTER TABLE public.configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configurations
  ADD COLUMN IF NOT EXISTS church_profile JSONB DEFAULT '{}'::jsonb;

DROP POLICY IF EXISTS "Configurações isoladas por ministry" ON public.configurations;
DROP POLICY IF EXISTS "Configurações podem ser atualizadas pelo ministry" ON public.configurations;
DROP POLICY IF EXISTS "configurations_select" ON public.configurations;
DROP POLICY IF EXISTS "configurations_insert" ON public.configurations;
DROP POLICY IF EXISTS "configurations_update" ON public.configurations;

CREATE POLICY "configurations_select"
  ON public.configurations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.configurations.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.configurations.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "configurations_insert"
  ON public.configurations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.configurations.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.configurations.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "configurations_update"
  ON public.configurations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.configurations.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.configurations.ministry_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.configurations.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.configurations.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.create_configuration_on_ministry_create()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.configurations (ministry_id, nomenclaturas, church_profile)
  VALUES (NEW.id, '{}'::jsonb, '{}'::jsonb)
  ON CONFLICT (ministry_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_configuration_on_ministry_insert ON public.ministries;
CREATE TRIGGER trg_create_configuration_on_ministry_insert
  AFTER INSERT ON public.ministries
  FOR EACH ROW
  EXECUTE FUNCTION public.create_configuration_on_ministry_create();
