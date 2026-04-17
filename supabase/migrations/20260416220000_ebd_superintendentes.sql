-- Superintendente EBD por congregação
BEGIN;

CREATE TABLE IF NOT EXISTS public.ebd_superintendentes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  church_id   UUID NOT NULL REFERENCES public.congregacoes(id) ON DELETE CASCADE,
  member_id   UUID REFERENCES public.members(id) ON DELETE SET NULL,
  nome        TEXT NOT NULL,
  telefone    TEXT,
  email       TEXT,
  observacoes TEXT,
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (ministry_id, church_id)
);

CREATE INDEX IF NOT EXISTS idx_ebd_super_ministry ON public.ebd_superintendentes(ministry_id);
CREATE INDEX IF NOT EXISTS idx_ebd_super_church   ON public.ebd_superintendentes(church_id);

ALTER TABLE public.ebd_superintendentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ebd_super_ministry_access ON public.ebd_superintendentes;
CREATE POLICY ebd_super_ministry_access ON public.ebd_superintendentes
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
      UNION
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

COMMIT;
