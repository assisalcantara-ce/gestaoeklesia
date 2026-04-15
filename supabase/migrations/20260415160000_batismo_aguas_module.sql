-- Modulo Batismo nas Aguas: registros e certificados

BEGIN;

-- ================================
-- REGISTROS DE BATISMO
-- ================================

CREATE TABLE IF NOT EXISTS public.batismo_aguas_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,

  -- Candidato (pode vir do autocomplete de congregados ou ser digitado manualmente)
  candidato_id UUID,  -- referencia opcional ao member
  candidato_nome VARCHAR(255) NOT NULL,
  candidato_data_nascimento DATE,
  candidato_sexo VARCHAR(20),
  candidato_telefone VARCHAR(50),

  -- Dados do batismo
  data_batismo DATE,
  local_batismo TEXT,
  pastor_nome VARCHAR(255),

  status TEXT NOT NULL DEFAULT 'registrado',
  observacoes TEXT,

  certificado_template_key TEXT,
  certificado_emitido_em TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_batismo_aguas_ministry_id
  ON public.batismo_aguas_registros(ministry_id);
CREATE INDEX IF NOT EXISTS idx_batismo_aguas_candidato_id
  ON public.batismo_aguas_registros(candidato_id);
CREATE INDEX IF NOT EXISTS idx_batismo_aguas_data_batismo
  ON public.batismo_aguas_registros(data_batismo);
CREATE INDEX IF NOT EXISTS idx_batismo_aguas_status
  ON public.batismo_aguas_registros(status);

-- FK opcional para members
DO $$
BEGIN
  IF to_regclass('public.members') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_batismo_aguas_candidato'
  ) THEN
    ALTER TABLE public.batismo_aguas_registros
      ADD CONSTRAINT fk_batismo_aguas_candidato
      FOREIGN KEY (candidato_id)
      REFERENCES public.members(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.batismo_aguas_registros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS batismo_aguas_ministry_select ON public.batismo_aguas_registros;
DROP POLICY IF EXISTS batismo_aguas_ministry_insert ON public.batismo_aguas_registros;
DROP POLICY IF EXISTS batismo_aguas_ministry_update ON public.batismo_aguas_registros;
DROP POLICY IF EXISTS batismo_aguas_ministry_delete ON public.batismo_aguas_registros;

CREATE POLICY "batismo_aguas_ministry_select"
  ON public.batismo_aguas_registros FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "batismo_aguas_ministry_insert"
  ON public.batismo_aguas_registros FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "batismo_aguas_ministry_update"
  ON public.batismo_aguas_registros FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "batismo_aguas_ministry_delete"
  ON public.batismo_aguas_registros FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

COMMIT;
