-- Flow congregations scope: add congregation_id + RLS tightening

-- Ensure congregacoes table exists (minimal schema if missing)
DO $$
BEGIN
  IF to_regclass('public.congregacoes') IS NULL THEN
    EXECUTE '
      CREATE TABLE public.congregacoes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
        nome text NOT NULL,
        created_at timestamp DEFAULT CURRENT_TIMESTAMP
      )
    ';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_congregacoes_ministry_id ON public.congregacoes(ministry_id)';
    EXECUTE 'ALTER TABLE public.congregacoes ENABLE ROW LEVEL SECURITY';
  END IF;
END
$$;

-- Seed a default congregation per ministry when missing
INSERT INTO public.congregacoes (ministry_id, nome)
SELECT m.id, 'SEDE'
FROM public.ministries m
WHERE NOT EXISTS (
  SELECT 1 FROM public.congregacoes c WHERE c.ministry_id = m.id
);

-- Ensure ministry_users has congregacao_id
ALTER TABLE public.ministry_users
  ADD COLUMN IF NOT EXISTS congregacao_id uuid REFERENCES public.congregacoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ministry_users_congregacao_id ON public.ministry_users(congregacao_id);

-- Add congregation_id columns
ALTER TABLE public.flow_activations ADD COLUMN IF NOT EXISTS congregation_id uuid;
ALTER TABLE public.flow_instances ADD COLUMN IF NOT EXISTS congregation_id uuid;

-- Backfill congregation_id using the first congregation per ministry
UPDATE public.flow_activations fa
SET congregation_id = (
  SELECT c.id
  FROM public.congregacoes c
  WHERE c.ministry_id = fa.ministry_id
  ORDER BY c.created_at ASC NULLS LAST, c.id
  LIMIT 1
)
WHERE fa.congregation_id IS NULL;

UPDATE public.flow_instances fi
SET congregation_id = (
  SELECT c.id
  FROM public.congregacoes c
  WHERE c.ministry_id = fi.ministry_id
  ORDER BY c.created_at ASC NULLS LAST, c.id
  LIMIT 1
)
WHERE fi.congregation_id IS NULL;

-- Ensure NOT NULL + foreign keys
ALTER TABLE public.flow_activations ALTER COLUMN congregation_id SET NOT NULL;
ALTER TABLE public.flow_instances ALTER COLUMN congregation_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'flow_activations_congregation_id_fkey'
  ) THEN
    ALTER TABLE public.flow_activations
      ADD CONSTRAINT flow_activations_congregation_id_fkey
      FOREIGN KEY (congregation_id) REFERENCES public.congregacoes(id) ON DELETE RESTRICT;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'flow_instances_congregation_id_fkey'
  ) THEN
    ALTER TABLE public.flow_instances
      ADD CONSTRAINT flow_instances_congregation_id_fkey
      FOREIGN KEY (congregation_id) REFERENCES public.congregacoes(id) ON DELETE RESTRICT;
  END IF;
END
$$;

-- Update unique constraint for activations
ALTER TABLE public.flow_activations
  DROP CONSTRAINT IF EXISTS flow_activations_ministry_id_template_id_key;

ALTER TABLE public.flow_activations
  ADD CONSTRAINT flow_activations_ministry_id_congregation_id_template_id_key
  UNIQUE (ministry_id, congregation_id, template_id);

-- Indexes for congregation scoping
CREATE INDEX IF NOT EXISTS idx_flow_activations_ministry_congregation_active
  ON public.flow_activations(ministry_id, congregation_id, is_active);

CREATE INDEX IF NOT EXISTS idx_flow_instances_ministry_congregation_status
  ON public.flow_instances(ministry_id, congregation_id, status);

-- RLS: flow_activations
DROP POLICY IF EXISTS flow_activations_select ON public.flow_activations;
DROP POLICY IF EXISTS flow_activations_insert ON public.flow_activations;
DROP POLICY IF EXISTS flow_activations_update ON public.flow_activations;

CREATE POLICY flow_activations_select
  ON public.flow_activations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.flow_activations.ministry_id
        AND (
          mu.role IN ('admin', 'manager')
          OR (
            mu.role IN ('operator', 'viewer')
            AND mu.congregacao_id = public.flow_activations.congregation_id
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.flow_activations.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY flow_activations_insert
  ON public.flow_activations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.flow_activations.ministry_id
        AND (
          mu.role IN ('admin', 'manager')
          OR (
            mu.role = 'operator'
            AND mu.congregacao_id = public.flow_activations.congregation_id
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.flow_activations.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY flow_activations_update
  ON public.flow_activations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.flow_activations.ministry_id
        AND (
          mu.role IN ('admin', 'manager')
          OR (
            mu.role = 'operator'
            AND mu.congregacao_id = public.flow_activations.congregation_id
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.flow_activations.ministry_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.flow_activations.ministry_id
        AND (
          mu.role IN ('admin', 'manager')
          OR (
            mu.role = 'operator'
            AND mu.congregacao_id = public.flow_activations.congregation_id
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.flow_activations.ministry_id
        AND m.user_id = auth.uid()
    )
  );

-- RLS: flow_instances
DROP POLICY IF EXISTS flow_instances_select ON public.flow_instances;
DROP POLICY IF EXISTS flow_instances_insert ON public.flow_instances;
DROP POLICY IF EXISTS flow_instances_update ON public.flow_instances;

CREATE POLICY flow_instances_select
  ON public.flow_instances
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.flow_instances.ministry_id
        AND (
          mu.role IN ('admin', 'manager')
          OR (
            mu.role IN ('operator', 'viewer')
            AND mu.congregacao_id = public.flow_instances.congregation_id
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.flow_instances.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY flow_instances_insert
  ON public.flow_instances
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.flow_instances.ministry_id
        AND (
          mu.role IN ('admin', 'manager')
          OR (
            mu.role = 'operator'
            AND mu.congregacao_id = public.flow_instances.congregation_id
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.flow_instances.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY flow_instances_update
  ON public.flow_instances
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.flow_instances.ministry_id
        AND (
          mu.role IN ('admin', 'manager')
          OR (
            mu.role = 'operator'
            AND mu.congregacao_id = public.flow_instances.congregation_id
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.flow_instances.ministry_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.flow_instances.ministry_id
        AND (
          mu.role IN ('admin', 'manager')
          OR (
            mu.role = 'operator'
            AND mu.congregacao_id = public.flow_instances.congregation_id
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.flow_instances.ministry_id
        AND m.user_id = auth.uid()
    )
  );

-- RLS: flow_history (scope via instance + congregation)
DROP POLICY IF EXISTS flow_history_select ON public.flow_history;
DROP POLICY IF EXISTS flow_history_insert ON public.flow_history;

CREATE POLICY flow_history_select
  ON public.flow_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.flow_instances i
      JOIN public.ministry_users mu
        ON mu.ministry_id = i.ministry_id
      WHERE i.id = public.flow_history.instance_id
        AND mu.user_id = auth.uid()
        AND (
          mu.role IN ('admin', 'manager')
          OR (
            mu.role IN ('operator', 'viewer')
            AND mu.congregacao_id = i.congregation_id
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.flow_instances i
      JOIN public.ministries m
        ON m.id = i.ministry_id
      WHERE i.id = public.flow_history.instance_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY flow_history_insert
  ON public.flow_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flow_instances i
      JOIN public.ministry_users mu
        ON mu.ministry_id = i.ministry_id
      WHERE i.id = public.flow_history.instance_id
        AND mu.user_id = auth.uid()
        AND (
          mu.role IN ('admin', 'manager')
          OR (
            mu.role = 'operator'
            AND mu.congregacao_id = i.congregation_id
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.flow_instances i
      JOIN public.ministries m
        ON m.id = i.ministry_id
      WHERE i.id = public.flow_history.instance_id
        AND m.user_id = auth.uid()
    )
  );
