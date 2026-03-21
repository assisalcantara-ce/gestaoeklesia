-- Modulo Apresentacao de Criancas: agendamentos, registros e templates de certificados

BEGIN;

-- ================================
-- AGENDAMENTOS
-- ================================

CREATE TABLE IF NOT EXISTS public.apresentacao_criancas_agendamentos (
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

CREATE INDEX IF NOT EXISTS idx_apresentacao_agendamentos_ministry_id
  ON public.apresentacao_criancas_agendamentos(ministry_id);
CREATE INDEX IF NOT EXISTS idx_apresentacao_agendamentos_data_evento
  ON public.apresentacao_criancas_agendamentos(data_evento);
CREATE INDEX IF NOT EXISTS idx_apresentacao_agendamentos_status
  ON public.apresentacao_criancas_agendamentos(status);

-- FKs condicionais (evita erro se tabelas ainda nao existirem)
DO $$
BEGIN
  IF to_regclass('public.supervisoes') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_apresentacao_agendamentos_supervisao'
  ) THEN
    ALTER TABLE public.apresentacao_criancas_agendamentos
      ADD CONSTRAINT fk_apresentacao_agendamentos_supervisao
      FOREIGN KEY (supervisao_id)
      REFERENCES public.supervisoes(id)
      ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.campos') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_apresentacao_agendamentos_campo'
  ) THEN
    ALTER TABLE public.apresentacao_criancas_agendamentos
      ADD CONSTRAINT fk_apresentacao_agendamentos_campo
      FOREIGN KEY (campo_id)
      REFERENCES public.campos(id)
      ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.congregacoes') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_apresentacao_agendamentos_congregacao'
  ) THEN
    ALTER TABLE public.apresentacao_criancas_agendamentos
      ADD CONSTRAINT fk_apresentacao_agendamentos_congregacao
      FOREIGN KEY (congregacao_id)
      REFERENCES public.congregacoes(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.apresentacao_criancas_agendamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS apresentacao_agendamentos_ministry_select ON public.apresentacao_criancas_agendamentos;
DROP POLICY IF EXISTS apresentacao_agendamentos_ministry_insert ON public.apresentacao_criancas_agendamentos;
DROP POLICY IF EXISTS apresentacao_agendamentos_ministry_update ON public.apresentacao_criancas_agendamentos;
DROP POLICY IF EXISTS apresentacao_agendamentos_ministry_delete ON public.apresentacao_criancas_agendamentos;

CREATE POLICY "apresentacao_agendamentos_ministry_select"
  ON public.apresentacao_criancas_agendamentos FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "apresentacao_agendamentos_ministry_insert"
  ON public.apresentacao_criancas_agendamentos FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "apresentacao_agendamentos_ministry_update"
  ON public.apresentacao_criancas_agendamentos FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "apresentacao_agendamentos_ministry_delete"
  ON public.apresentacao_criancas_agendamentos FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

-- ================================
-- REGISTROS (CRIANCAS)
-- ================================

CREATE TABLE IF NOT EXISTS public.apresentacao_criancas_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  agendamento_id UUID,

  crianca_nome VARCHAR(255) NOT NULL,
  crianca_data_nascimento DATE,
  crianca_sexo VARCHAR(20),

  pai_nome VARCHAR(255),
  mae_nome VARCHAR(255),
  responsavel_nome VARCHAR(255),
  responsavel_telefone VARCHAR(50),

  data_apresentacao DATE,
  local_apresentacao TEXT,
  status TEXT NOT NULL DEFAULT 'agendado',
  observacoes TEXT,

  certificado_template_key TEXT,
  certificado_emitido_em TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_apresentacao_registros_ministry_id
  ON public.apresentacao_criancas_registros(ministry_id);
CREATE INDEX IF NOT EXISTS idx_apresentacao_registros_agendamento_id
  ON public.apresentacao_criancas_registros(agendamento_id);
CREATE INDEX IF NOT EXISTS idx_apresentacao_registros_data
  ON public.apresentacao_criancas_registros(data_apresentacao);
CREATE INDEX IF NOT EXISTS idx_apresentacao_registros_status
  ON public.apresentacao_criancas_registros(status);

DO $$
BEGIN
  IF to_regclass('public.apresentacao_criancas_agendamentos') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_apresentacao_registros_agendamento'
  ) THEN
    ALTER TABLE public.apresentacao_criancas_registros
      ADD CONSTRAINT fk_apresentacao_registros_agendamento
      FOREIGN KEY (agendamento_id)
      REFERENCES public.apresentacao_criancas_agendamentos(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.apresentacao_criancas_registros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS apresentacao_registros_ministry_select ON public.apresentacao_criancas_registros;
DROP POLICY IF EXISTS apresentacao_registros_ministry_insert ON public.apresentacao_criancas_registros;
DROP POLICY IF EXISTS apresentacao_registros_ministry_update ON public.apresentacao_criancas_registros;
DROP POLICY IF EXISTS apresentacao_registros_ministry_delete ON public.apresentacao_criancas_registros;

CREATE POLICY "apresentacao_registros_ministry_select"
  ON public.apresentacao_criancas_registros FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "apresentacao_registros_ministry_insert"
  ON public.apresentacao_criancas_registros FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "apresentacao_registros_ministry_update"
  ON public.apresentacao_criancas_registros FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "apresentacao_registros_ministry_delete"
  ON public.apresentacao_criancas_registros FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

-- ================================
-- CERTIFICADOS: TEMPLATES
-- ================================

CREATE TABLE IF NOT EXISTS public.certificados_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,

  template_key TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL,
  preview_url VARCHAR(500),

  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT false,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'certificados_templates_unique_key_per_ministry'
  ) THEN
    ALTER TABLE public.certificados_templates
      ADD CONSTRAINT certificados_templates_unique_key_per_ministry
      UNIQUE (ministry_id, template_key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_certificados_templates_ministry_id
  ON public.certificados_templates(ministry_id);
CREATE INDEX IF NOT EXISTS idx_certificados_templates_active
  ON public.certificados_templates(ministry_id)
  WHERE is_active;

ALTER TABLE public.certificados_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS certificados_templates_ministry_select ON public.certificados_templates;
DROP POLICY IF EXISTS certificados_templates_ministry_insert ON public.certificados_templates;
DROP POLICY IF EXISTS certificados_templates_ministry_update ON public.certificados_templates;
DROP POLICY IF EXISTS certificados_templates_ministry_delete ON public.certificados_templates;

CREATE POLICY "certificados_templates_ministry_select"
  ON public.certificados_templates FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "certificados_templates_ministry_insert"
  ON public.certificados_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = certificados_templates.ministry_id
        AND mu.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "certificados_templates_ministry_update"
  ON public.certificados_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = certificados_templates.ministry_id
        AND mu.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = certificados_templates.ministry_id
        AND mu.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "certificados_templates_ministry_delete"
  ON public.certificados_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = certificados_templates.ministry_id
        AND mu.role IN ('admin', 'manager')
    )
  );

COMMIT;
