-- Módulo Departamentos

BEGIN;

CREATE TABLE IF NOT EXISTS public.departamentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id  UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  sigla        VARCHAR(20) NOT NULL,
  nome         VARCHAR(255) NOT NULL,
  slug         VARCHAR(100) NOT NULL,
  descricao    TEXT,
  logo_url     TEXT,
  coordenacao  JSONB NOT NULL DEFAULT '[]',
  ativo        BOOLEAN NOT NULL DEFAULT true,
  ordem        INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT departamentos_unique_slug_per_ministry UNIQUE (ministry_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_departamentos_ministry_id ON public.departamentos(ministry_id);
CREATE INDEX IF NOT EXISTS idx_departamentos_ativo ON public.departamentos(ministry_id) WHERE ativo = true;

ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS departamentos_select ON public.departamentos;
DROP POLICY IF EXISTS departamentos_insert ON public.departamentos;
DROP POLICY IF EXISTS departamentos_update ON public.departamentos;
DROP POLICY IF EXISTS departamentos_delete ON public.departamentos;

CREATE POLICY "departamentos_select"
  ON public.departamentos FOR SELECT
  USING (ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "departamentos_insert"
  ON public.departamentos FOR INSERT
  WITH CHECK (ministry_id IN (
    SELECT ministry_id FROM public.ministry_users
    WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
  ));

CREATE POLICY "departamentos_update"
  ON public.departamentos FOR UPDATE
  USING (ministry_id IN (
    SELECT ministry_id FROM public.ministry_users
    WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
  ));

CREATE POLICY "departamentos_delete"
  ON public.departamentos FOR DELETE
  USING (ministry_id IN (
    SELECT ministry_id FROM public.ministry_users
    WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
  ));

COMMIT;
