-- Modulo Consagracao: registros de processos ministeriais

BEGIN;

CREATE TABLE IF NOT EXISTS public.consagracao_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  member_id UUID,

  tipo_registro TEXT NOT NULL DEFAULT 'novo',
  regiao TEXT,

  numero_processo TEXT,
  data_processo DATE,

  cpf TEXT,
  nome TEXT NOT NULL,
  data_nascimento DATE,
  sexo TEXT,
  rg TEXT,
  orgao_emissor TEXT,
  estado_civil TEXT,
  nacionalidade TEXT,
  naturalidade TEXT,
  uf TEXT,
  email TEXT,
  telefone TEXT,
  nome_pai TEXT,
  nome_mae TEXT,
  nome_conjuge TEXT,
  matricula TEXT,

  supervisao_id UUID,
  campo_id UUID,
  congregacao_id UUID,

  cargo_ocupa TEXT,
  cargo_pretendido TEXT,
  pastor_solicitante TEXT,
  data_autorizacao DATE,

  status_processo TEXT NOT NULL DEFAULT 'em_processo',
  observacoes TEXT,
  foto_url TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_consagracao_registros_ministry_id
  ON public.consagracao_registros(ministry_id);
CREATE INDEX IF NOT EXISTS idx_consagracao_registros_status
  ON public.consagracao_registros(status_processo);
CREATE INDEX IF NOT EXISTS idx_consagracao_registros_numero
  ON public.consagracao_registros(numero_processo);
CREATE INDEX IF NOT EXISTS idx_consagracao_registros_cpf
  ON public.consagracao_registros(cpf);
CREATE INDEX IF NOT EXISTS idx_consagracao_registros_member_id
  ON public.consagracao_registros(member_id);

DO $$
BEGIN
  IF to_regclass('public.members') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_consagracao_registros_member'
  ) THEN
    ALTER TABLE public.consagracao_registros
      ADD CONSTRAINT fk_consagracao_registros_member
      FOREIGN KEY (member_id)
      REFERENCES public.members(id)
      ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.supervisoes') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_consagracao_registros_supervisao'
  ) THEN
    ALTER TABLE public.consagracao_registros
      ADD CONSTRAINT fk_consagracao_registros_supervisao
      FOREIGN KEY (supervisao_id)
      REFERENCES public.supervisoes(id)
      ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.campos') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_consagracao_registros_campo'
  ) THEN
    ALTER TABLE public.consagracao_registros
      ADD CONSTRAINT fk_consagracao_registros_campo
      FOREIGN KEY (campo_id)
      REFERENCES public.campos(id)
      ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.congregacoes') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_consagracao_registros_congregacao'
  ) THEN
    ALTER TABLE public.consagracao_registros
      ADD CONSTRAINT fk_consagracao_registros_congregacao
      FOREIGN KEY (congregacao_id)
      REFERENCES public.congregacoes(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.consagracao_registros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consagracao_registros_ministry_select ON public.consagracao_registros;
DROP POLICY IF EXISTS consagracao_registros_ministry_insert ON public.consagracao_registros;
DROP POLICY IF EXISTS consagracao_registros_ministry_update ON public.consagracao_registros;
DROP POLICY IF EXISTS consagracao_registros_ministry_delete ON public.consagracao_registros;

CREATE POLICY "consagracao_registros_ministry_select"
  ON public.consagracao_registros FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "consagracao_registros_ministry_insert"
  ON public.consagracao_registros FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "consagracao_registros_ministry_update"
  ON public.consagracao_registros FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "consagracao_registros_ministry_delete"
  ON public.consagracao_registros FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

COMMIT;
