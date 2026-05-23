ALTER TABLE public.casamento_registros DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS casamento_ministry_select ON public.casamento_registros;
DROP POLICY IF EXISTS casamento_ministry_insert ON public.casamento_registros;
DROP POLICY IF EXISTS casamento_ministry_update ON public.casamento_registros;
DROP POLICY IF EXISTS casamento_ministry_delete ON public.casamento_registros;

ALTER TABLE public.casamento_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "casamento_ministry_select"
  ON public.casamento_registros FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = casamento_registros.ministry_id
        AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.user_id = auth.uid()
        AND m.id = casamento_registros.ministry_id
    )
  );

CREATE POLICY "casamento_ministry_insert"
  ON public.casamento_registros FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = casamento_registros.ministry_id
        AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.user_id = auth.uid()
        AND m.id = casamento_registros.ministry_id
    )
  );

CREATE POLICY "casamento_ministry_update"
  ON public.casamento_registros FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = casamento_registros.ministry_id
        AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.user_id = auth.uid()
        AND m.id = casamento_registros.ministry_id
    )
  );

CREATE POLICY "casamento_ministry_delete"
  ON public.casamento_registros FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = casamento_registros.ministry_id
        AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.user_id = auth.uid()
        AND m.id = casamento_registros.ministry_id
    )
  );
