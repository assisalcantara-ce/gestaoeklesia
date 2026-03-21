-- Modulo Casamentos: agendamentos, cadastros e registros

BEGIN;

-- ================================
-- AGENDAMENTOS
-- ================================

CREATE TABLE IF NOT EXISTS public.casamentos_agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,

  data_evento DATE NOT NULL,
  hora_evento TIME,

  supervisao_id UUID,
  campo_id UUID,
  congregacao_id UUID,

  local_texto TEXT,
  status TEXT NOT NULL DEFAULT 'agendado',
  observacoes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casamentos_agendamentos_ministry_id
  ON public.casamentos_agendamentos(ministry_id);
CREATE INDEX IF NOT EXISTS idx_casamentos_agendamentos_data_evento
  ON public.casamentos_agendamentos(data_evento);
CREATE INDEX IF NOT EXISTS idx_casamentos_agendamentos_status
  ON public.casamentos_agendamentos(status);

DO $$
BEGIN
  IF to_regclass('public.supervisoes') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_casamentos_agendamentos_supervisao'
  ) THEN
    ALTER TABLE public.casamentos_agendamentos
      ADD CONSTRAINT fk_casamentos_agendamentos_supervisao
      FOREIGN KEY (supervisao_id)
      REFERENCES public.supervisoes(id)
      ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.campos') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_casamentos_agendamentos_campo'
  ) THEN
    ALTER TABLE public.casamentos_agendamentos
      ADD CONSTRAINT fk_casamentos_agendamentos_campo
      FOREIGN KEY (campo_id)
      REFERENCES public.campos(id)
      ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.congregacoes') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_casamentos_agendamentos_congregacao'
  ) THEN
    ALTER TABLE public.casamentos_agendamentos
      ADD CONSTRAINT fk_casamentos_agendamentos_congregacao
      FOREIGN KEY (congregacao_id)
      REFERENCES public.congregacoes(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.casamentos_agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "casamentos_agendamentos_ministry_select"
  ON public.casamentos_agendamentos FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "casamentos_agendamentos_ministry_insert"
  ON public.casamentos_agendamentos FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "casamentos_agendamentos_ministry_update"
  ON public.casamentos_agendamentos FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "casamentos_agendamentos_ministry_delete"
  ON public.casamentos_agendamentos FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

-- ================================
-- CADASTROS (CASAIS)
-- ================================

CREATE TABLE IF NOT EXISTS public.casamentos_cadastros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,

  noivo_nome VARCHAR(255) NOT NULL,
  noiva_nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(50),
  observacoes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casamentos_cadastros_ministry_id
  ON public.casamentos_cadastros(ministry_id);
CREATE INDEX IF NOT EXISTS idx_casamentos_cadastros_noivo_nome
  ON public.casamentos_cadastros(noivo_nome);
CREATE INDEX IF NOT EXISTS idx_casamentos_cadastros_noiva_nome
  ON public.casamentos_cadastros(noiva_nome);

ALTER TABLE public.casamentos_cadastros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "casamentos_cadastros_ministry_select"
  ON public.casamentos_cadastros FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "casamentos_cadastros_ministry_insert"
  ON public.casamentos_cadastros FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "casamentos_cadastros_ministry_update"
  ON public.casamentos_cadastros FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "casamentos_cadastros_ministry_delete"
  ON public.casamentos_cadastros FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

-- ================================
-- REGISTROS (CASAMENTOS)
-- ================================

CREATE TABLE IF NOT EXISTS public.casamentos_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  agendamento_id UUID,
  cadastro_id UUID,

  data_casamento DATE,
  local_texto TEXT,
  celebrante_nome TEXT,
  status TEXT NOT NULL DEFAULT 'agendado',
  observacoes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casamentos_registros_ministry_id
  ON public.casamentos_registros(ministry_id);
CREATE INDEX IF NOT EXISTS idx_casamentos_registros_agendamento_id
  ON public.casamentos_registros(agendamento_id);
CREATE INDEX IF NOT EXISTS idx_casamentos_registros_cadastro_id
  ON public.casamentos_registros(cadastro_id);
CREATE INDEX IF NOT EXISTS idx_casamentos_registros_data
  ON public.casamentos_registros(data_casamento);
CREATE INDEX IF NOT EXISTS idx_casamentos_registros_status
  ON public.casamentos_registros(status);

DO $$
BEGIN
  IF to_regclass('public.casamentos_agendamentos') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_casamentos_registros_agendamento'
  ) THEN
    ALTER TABLE public.casamentos_registros
      ADD CONSTRAINT fk_casamentos_registros_agendamento
      FOREIGN KEY (agendamento_id)
      REFERENCES public.casamentos_agendamentos(id)
      ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.casamentos_cadastros') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_casamentos_registros_cadastro'
  ) THEN
    ALTER TABLE public.casamentos_registros
      ADD CONSTRAINT fk_casamentos_registros_cadastro
      FOREIGN KEY (cadastro_id)
      REFERENCES public.casamentos_cadastros(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.casamentos_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "casamentos_registros_ministry_select"
  ON public.casamentos_registros FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "casamentos_registros_ministry_insert"
  ON public.casamentos_registros FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "casamentos_registros_ministry_update"
  ON public.casamentos_registros FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "casamentos_registros_ministry_delete"
  ON public.casamentos_registros FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

COMMIT;
