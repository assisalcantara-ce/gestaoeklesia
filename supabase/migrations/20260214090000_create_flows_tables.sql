-- Flow module tables and policies

-- 1) flow_templates
CREATE TABLE IF NOT EXISTS public.flow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  current_version INTEGER NOT NULL DEFAULT 1,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ministry_id, name)
);

-- 2) flow_template_versions
CREATE TABLE IF NOT EXISTS public.flow_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.flow_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  definition_json JSONB NOT NULL,
  published_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(template_id, version)
);

-- 3) flow_activations
CREATE TABLE IF NOT EXISTS public.flow_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.flow_templates(id) ON DELETE CASCADE,
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  assignees_json JSONB DEFAULT '{}'::jsonb,
  settings_json JSONB DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ministry_id, template_id)
);

-- 4) flow_instances
CREATE TABLE IF NOT EXISTS public.flow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.flow_templates(id) ON DELETE RESTRICT,
  template_version INTEGER NOT NULL,
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  title TEXT,
  status TEXT NOT NULL,
  data_json JSONB DEFAULT '{}'::jsonb,
  current_assignee_role TEXT,
  current_assignee_user_id UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP
);

-- 5) flow_history
CREATE TABLE IF NOT EXISTS public.flow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.flow_instances(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  user_id UUID REFERENCES auth.users(id),
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_flow_templates_ministry_id ON public.flow_templates(ministry_id);
CREATE INDEX IF NOT EXISTS idx_flow_template_versions_template_id ON public.flow_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_flow_activations_ministry_id ON public.flow_activations(ministry_id);
CREATE INDEX IF NOT EXISTS idx_flow_instances_ministry_id ON public.flow_instances(ministry_id);
CREATE INDEX IF NOT EXISTS idx_flow_instances_status ON public.flow_instances(status);
CREATE INDEX IF NOT EXISTS idx_flow_history_instance_id ON public.flow_history(instance_id);

ALTER TABLE public.flow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_history ENABLE ROW LEVEL SECURITY;

-- Helper policy expression for ministry access
-- flow_templates: select for members, insert/update for admin or owner
DROP POLICY IF EXISTS flow_templates_select ON public.flow_templates;
DROP POLICY IF EXISTS flow_templates_insert ON public.flow_templates;
DROP POLICY IF EXISTS flow_templates_update ON public.flow_templates;

CREATE POLICY flow_templates_select
  ON public.flow_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.flow_templates.ministry_id
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.flow_templates.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY flow_templates_insert
  ON public.flow_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.flow_templates.ministry_id
        AND mu.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.flow_templates.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY flow_templates_update
  ON public.flow_templates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.flow_templates.ministry_id
        AND mu.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.flow_templates.ministry_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.flow_templates.ministry_id
        AND mu.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.flow_templates.ministry_id
        AND m.user_id = auth.uid()
    )
  );

-- flow_template_versions: select for members, insert for admin/owner
DROP POLICY IF EXISTS flow_template_versions_select ON public.flow_template_versions;
DROP POLICY IF EXISTS flow_template_versions_insert ON public.flow_template_versions;
DROP POLICY IF EXISTS flow_template_versions_update ON public.flow_template_versions;

CREATE POLICY flow_template_versions_select
  ON public.flow_template_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.flow_templates t
      JOIN public.ministry_users mu
        ON mu.ministry_id = t.ministry_id
      WHERE t.id = public.flow_template_versions.template_id
        AND mu.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.flow_templates t
      JOIN public.ministries m
        ON m.id = t.ministry_id
      WHERE t.id = public.flow_template_versions.template_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY flow_template_versions_insert
  ON public.flow_template_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flow_templates t
      JOIN public.ministry_users mu
        ON mu.ministry_id = t.ministry_id
      WHERE t.id = public.flow_template_versions.template_id
        AND mu.user_id = auth.uid()
        AND mu.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.flow_templates t
      JOIN public.ministries m
        ON m.id = t.ministry_id
      WHERE t.id = public.flow_template_versions.template_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY flow_template_versions_update
  ON public.flow_template_versions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.flow_templates t
      JOIN public.ministry_users mu
        ON mu.ministry_id = t.ministry_id
      WHERE t.id = public.flow_template_versions.template_id
        AND mu.user_id = auth.uid()
        AND mu.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.flow_templates t
      JOIN public.ministries m
        ON m.id = t.ministry_id
      WHERE t.id = public.flow_template_versions.template_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flow_templates t
      JOIN public.ministry_users mu
        ON mu.ministry_id = t.ministry_id
      WHERE t.id = public.flow_template_versions.template_id
        AND mu.user_id = auth.uid()
        AND mu.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.flow_templates t
      JOIN public.ministries m
        ON m.id = t.ministry_id
      WHERE t.id = public.flow_template_versions.template_id
        AND m.user_id = auth.uid()
    )
  );

-- flow_activations: members can select, insert/update within ministry
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
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.flow_activations.ministry_id
        AND m.user_id = auth.uid()
    )
  );

-- flow_instances: members can select/insert/update within ministry
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
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.flow_instances.ministry_id
        AND m.user_id = auth.uid()
    )
  );

-- flow_history: select/insert within ministry (via instance)
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
    )
    OR EXISTS (
      SELECT 1 FROM public.flow_instances i
      JOIN public.ministries m
        ON m.id = i.ministry_id
      WHERE i.id = public.flow_history.instance_id
        AND m.user_id = auth.uid()
    )
  );
