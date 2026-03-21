-- Modulo Batismo: agendamentos, cadastros e registros

BEGIN;

-- ================================
-- AGENDAMENTOS
-- ================================

CREATE TABLE IF NOT EXISTS public.batismo_agendamentos (
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

CREATE INDEX IF NOT EXISTS idx_batismo_agendamentos_ministry_id
  ON public.batismo_agendamentos(ministry_id);
CREATE INDEX IF NOT EXISTS idx_batismo_agendamentos_data_evento
  ON public.batismo_agendamentos(data_evento);
CREATE INDEX IF NOT EXISTS idx_batismo_agendamentos_status
  ON public.batismo_agendamentos(status);

DO $$
BEGIN
  IF to_regclass('public.supervisoes') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_batismo_agendamentos_supervisao'
  ) THEN
    ALTER TABLE public.batismo_agendamentos
      ADD CONSTRAINT fk_batismo_agendamentos_supervisao
      FOREIGN KEY (supervisao_id)
      REFERENCES public.supervisoes(id)
      ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.campos') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_batismo_agendamentos_campo'
  ) THEN
    ALTER TABLE public.batismo_agendamentos
      ADD CONSTRAINT fk_batismo_agendamentos_campo
      FOREIGN KEY (campo_id)
      REFERENCES public.campos(id)
      ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.congregacoes') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_batismo_agendamentos_congregacao'
  ) THEN
    ALTER TABLE public.batismo_agendamentos
      ADD CONSTRAINT fk_batismo_agendamentos_congregacao
      FOREIGN KEY (congregacao_id)
      REFERENCES public.congregacoes(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.batismo_agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "batismo_agendamentos_ministry_select"
  ON public.batismo_agendamentos FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "batismo_agendamentos_ministry_insert"
  ON public.batismo_agendamentos FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "batismo_agendamentos_ministry_update"
  ON public.batismo_agendamentos FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "batismo_agendamentos_ministry_delete"
  ON public.batismo_agendamentos FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

-- ================================
-- CADASTROS (PESSOAS)
-- ================================

CREATE TABLE IF NOT EXISTS public.batismo_cadastros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  member_id UUID,

  pessoa_nome VARCHAR(255) NOT NULL,
  data_nascimento DATE,
  sexo VARCHAR(20),
  telefone VARCHAR(50),
  observacoes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_batismo_cadastros_ministry_id
  ON public.batismo_cadastros(ministry_id);
CREATE INDEX IF NOT EXISTS idx_batismo_cadastros_nome
  ON public.batismo_cadastros(pessoa_nome);
CREATE INDEX IF NOT EXISTS idx_batismo_cadastros_member_id
  ON public.batismo_cadastros(member_id);

DO $$
BEGIN
  IF to_regclass('public.members') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_batismo_cadastros_member'
  ) THEN
    ALTER TABLE public.batismo_cadastros
      ADD CONSTRAINT fk_batismo_cadastros_member
      FOREIGN KEY (member_id)
      REFERENCES public.members(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.batismo_cadastros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "batismo_cadastros_ministry_select"
  ON public.batismo_cadastros FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "batismo_cadastros_ministry_insert"
  ON public.batismo_cadastros FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "batismo_cadastros_ministry_update"
  ON public.batismo_cadastros FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "batismo_cadastros_ministry_delete"
  ON public.batismo_cadastros FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

-- ================================
-- REGISTROS (BATISMOS)
-- ================================

CREATE TABLE IF NOT EXISTS public.batismo_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  agendamento_id UUID,
  cadastro_id UUID,

  data_batismo DATE,
  local_texto TEXT,
  status TEXT NOT NULL DEFAULT 'agendado',
  observacoes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_batismo_registros_ministry_id
  ON public.batismo_registros(ministry_id);
CREATE INDEX IF NOT EXISTS idx_batismo_registros_agendamento_id
  ON public.batismo_registros(agendamento_id);
CREATE INDEX IF NOT EXISTS idx_batismo_registros_cadastro_id
  ON public.batismo_registros(cadastro_id);
CREATE INDEX IF NOT EXISTS idx_batismo_registros_data
  ON public.batismo_registros(data_batismo);
CREATE INDEX IF NOT EXISTS idx_batismo_registros_status
  ON public.batismo_registros(status);

DO $$
BEGIN
  IF to_regclass('public.batismo_agendamentos') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_batismo_registros_agendamento'
  ) THEN
    ALTER TABLE public.batismo_registros
      ADD CONSTRAINT fk_batismo_registros_agendamento
      FOREIGN KEY (agendamento_id)
      REFERENCES public.batismo_agendamentos(id)
      ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.batismo_cadastros') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_batismo_registros_cadastro'
  ) THEN
    ALTER TABLE public.batismo_registros
      ADD CONSTRAINT fk_batismo_registros_cadastro
      FOREIGN KEY (cadastro_id)
      REFERENCES public.batismo_cadastros(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.batismo_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "batismo_registros_ministry_select"
  ON public.batismo_registros FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "batismo_registros_ministry_insert"
  ON public.batismo_registros FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "batismo_registros_ministry_update"
  ON public.batismo_registros FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "batismo_registros_ministry_delete"
  ON public.batismo_registros FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

COMMIT;
