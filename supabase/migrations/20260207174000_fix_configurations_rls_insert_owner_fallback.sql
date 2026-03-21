-- Corrige RLS/policies de public.configurations para permitir acesso por:
-- 1) vínculo em ministry_users OU
-- 2) usuário dono do ministério (ministries.user_id = auth.uid())
--
-- Também cria a tabela (best-effort) em bases legadas.

CREATE TABLE IF NOT EXISTS public.configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL UNIQUE,

  nomenclaturas JSONB DEFAULT '{}'::jsonb,
  notification_settings JSONB DEFAULT '{}'::jsonb,
  report_settings JSONB DEFAULT '{}'::jsonb,
  custom_fields JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF to_regclass('public.ministries') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.configurations'::regclass
        AND conname = 'configurations_ministry_id_fkey'
    ) THEN
      ALTER TABLE public.configurations
        ADD CONSTRAINT configurations_ministry_id_fkey
        FOREIGN KEY (ministry_id)
        REFERENCES public.ministries(id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

ALTER TABLE public.configurations ENABLE ROW LEVEL SECURITY;

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
