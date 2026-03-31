-- Garante existência/compatibilidade da tabela public.cartoes_templates
-- e políticas RLS com fallback para dono do ministério.

CREATE TABLE IF NOT EXISTS public.cartoes_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL,

  name VARCHAR(255) NOT NULL,
  description TEXT NULL,

  template_data JSONB NOT NULL,
  preview_url VARCHAR(500) NULL,

  template_key TEXT NULL,
  tipo_cadastro TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,

  is_default BOOLEAN DEFAULT false,
  created_by UUID NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.cartoes_templates
  ADD COLUMN IF NOT EXISTS template_key TEXT,
  ADD COLUMN IF NOT EXISTS tipo_cadastro TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS preview_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE public.cartoes_templates
SET name = COALESCE(name, 'Template')
WHERE name IS NULL;

DO $$
BEGIN
  IF to_regclass('public.ministries') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.cartoes_templates'::regclass
        AND conname = 'cartoes_templates_ministry_id_fkey'
    ) THEN
      ALTER TABLE public.cartoes_templates
        ADD CONSTRAINT cartoes_templates_ministry_id_fkey
        FOREIGN KEY (ministry_id)
        REFERENCES public.ministries(id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.cartoes_templates'::regclass
        AND conname = 'cartoes_templates_created_by_fkey'
    ) THEN
      ALTER TABLE public.cartoes_templates
        ADD CONSTRAINT cartoes_templates_created_by_fkey
        FOREIGN KEY (created_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

UPDATE public.cartoes_templates
SET template_key = COALESCE(template_key, id::text)
WHERE template_key IS NULL;

UPDATE public.cartoes_templates
SET tipo_cadastro = COALESCE(tipo_cadastro, 'ministro')
WHERE tipo_cadastro IS NULL;

ALTER TABLE public.cartoes_templates
  ALTER COLUMN template_key SET NOT NULL,
  ALTER COLUMN tipo_cadastro SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cartoes_templates_unique_key_per_ministry'
  ) THEN
    ALTER TABLE public.cartoes_templates
      ADD CONSTRAINT cartoes_templates_unique_key_per_ministry
      UNIQUE (ministry_id, template_key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cartoes_templates_ministry_id ON public.cartoes_templates(ministry_id);
CREATE INDEX IF NOT EXISTS idx_cartoes_templates_default ON public.cartoes_templates(is_default);
CREATE INDEX IF NOT EXISTS idx_cartoes_templates_ministry_tipo ON public.cartoes_templates(ministry_id, tipo_cadastro);

CREATE UNIQUE INDEX IF NOT EXISTS cartoes_templates_unique_active_per_tipo
  ON public.cartoes_templates(ministry_id, tipo_cadastro)
  WHERE is_active;

ALTER TABLE public.cartoes_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cartoes_templates_select" ON public.cartoes_templates;
DROP POLICY IF EXISTS "cartoes_templates_insert" ON public.cartoes_templates;
DROP POLICY IF EXISTS "cartoes_templates_update" ON public.cartoes_templates;
DROP POLICY IF EXISTS "cartoes_templates_delete" ON public.cartoes_templates;

CREATE POLICY "cartoes_templates_select"
  ON public.cartoes_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.cartoes_templates.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.cartoes_templates.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "cartoes_templates_insert"
  ON public.cartoes_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.cartoes_templates.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.cartoes_templates.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "cartoes_templates_update"
  ON public.cartoes_templates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.cartoes_templates.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.cartoes_templates.ministry_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.cartoes_templates.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.cartoes_templates.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "cartoes_templates_delete"
  ON public.cartoes_templates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.cartoes_templates.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.cartoes_templates.ministry_id
        AND m.user_id = auth.uid()
    )
  );
