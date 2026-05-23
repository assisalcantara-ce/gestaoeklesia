-- Modulo Casamento: registros e certificados

BEGIN;

-- ================================
-- REGISTROS DE CASAMENTO
-- ================================

CREATE TABLE IF NOT EXISTS public.casamento_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,

  -- Conjuge 1 (pode vir do autocomplete de membros ou ser digitado manualmente)
  conjuge1_id UUID,  -- referencia opcional ao member
  conjuge1_nome VARCHAR(255) NOT NULL,
  conjuge1_data_nascimento DATE,
  conjuge1_sexo VARCHAR(20),
  conjuge1_telefone VARCHAR(50),

  -- Conjuge 2 (pode vir do autocomplete de membros ou ser digitado manualmente)
  conjuge2_id UUID,  -- referencia opcional ao member
  conjuge2_nome VARCHAR(255) NOT NULL,
  conjuge2_data_nascimento DATE,
  conjuge2_sexo VARCHAR(20),
  conjuge2_telefone VARCHAR(50),

  -- Dados do casamento
  data_casamento DATE,
  local_casamento TEXT,
  pastor_nome VARCHAR(255),
  tipo_casamento VARCHAR(30) NOT NULL DEFAULT 'religioso', -- religioso | civil | civil_religioso

  status TEXT NOT NULL DEFAULT 'registrado', -- registrado | realizado | cancelado
  observacoes TEXT,

  certificado_template_key TEXT,
  certificado_emitido_em TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casamento_ministry_id
  ON public.casamento_registros(ministry_id);
CREATE INDEX IF NOT EXISTS idx_casamento_conjuge1_id
  ON public.casamento_registros(conjuge1_id);
CREATE INDEX IF NOT EXISTS idx_casamento_conjuge2_id
  ON public.casamento_registros(conjuge2_id);
CREATE INDEX IF NOT EXISTS idx_casamento_data_casamento
  ON public.casamento_registros(data_casamento);
CREATE INDEX IF NOT EXISTS idx_casamento_status
  ON public.casamento_registros(status);

-- FK opcional para members (conjuge1)
DO $$
BEGIN
  IF to_regclass('public.members') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_casamento_conjuge1'
  ) THEN
    ALTER TABLE public.casamento_registros
      ADD CONSTRAINT fk_casamento_conjuge1
      FOREIGN KEY (conjuge1_id)
      REFERENCES public.members(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- FK opcional para members (conjuge2)
DO $$
BEGIN
  IF to_regclass('public.members') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_casamento_conjuge2'
  ) THEN
    ALTER TABLE public.casamento_registros
      ADD CONSTRAINT fk_casamento_conjuge2
      FOREIGN KEY (conjuge2_id)
      REFERENCES public.members(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.casamento_registros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS casamento_ministry_select ON public.casamento_registros;
DROP POLICY IF EXISTS casamento_ministry_insert ON public.casamento_registros;
DROP POLICY IF EXISTS casamento_ministry_update ON public.casamento_registros;
DROP POLICY IF EXISTS casamento_ministry_delete ON public.casamento_registros;

-- Somente ADMINISTRADOR do tenancy (sede) tem acesso
CREATE POLICY "casamento_ministry_select"
  ON public.casamento_registros FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id     = auth.uid()
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
      WHERE mu.user_id     = auth.uid()
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
      WHERE mu.user_id     = auth.uid()
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
      WHERE mu.user_id     = auth.uid()
        AND mu.ministry_id = casamento_registros.ministry_id
        AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.user_id = auth.uid()
        AND m.id = casamento_registros.ministry_id
    )
  );

COMMIT;
