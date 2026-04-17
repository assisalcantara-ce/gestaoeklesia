-- Trimestres EBD
BEGIN;

CREATE TABLE IF NOT EXISTS public.ebd_trimestres (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  numero      SMALLINT NOT NULL,
  ano         SMALLINT NOT NULL,
  descricao   TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim    DATE NOT NULL,
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (ministry_id, numero, ano),
  CONSTRAINT ebd_trim_numero CHECK (numero BETWEEN 1 AND 4)
);

CREATE INDEX IF NOT EXISTS idx_ebd_trimestres_ministry ON public.ebd_trimestres(ministry_id, ano DESC, numero);

ALTER TABLE public.ebd_trimestres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ebd_trimestres_access ON public.ebd_trimestres;
CREATE POLICY ebd_trimestres_access ON public.ebd_trimestres
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
      UNION
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

-- Adiciona referência de trimestre nas aulas
ALTER TABLE public.ebd_aulas
  ADD COLUMN IF NOT EXISTS trimestre_id UUID REFERENCES public.ebd_trimestres(id) ON DELETE SET NULL;

COMMIT;
