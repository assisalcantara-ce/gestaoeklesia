-- Modulo Achados e Perdidos

BEGIN;

CREATE TABLE IF NOT EXISTS public.achados_perdidos_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,

  -- Objeto
  descricao TEXT NOT NULL,
  categoria VARCHAR(80) NOT NULL DEFAULT 'outros',

  -- Local encontrado (texto livre + FK opcional)
  local_descricao TEXT,
  local_tipo VARCHAR(30) DEFAULT 'congregacao', -- 'congregacao' | 'campo' | 'outro'
  congregacao_id UUID,
  campo_id UUID,

  -- Datas e quem encontrou
  data_encontrado DATE,
  encontrador_nome VARCHAR(255),

  -- Reclamação
  status TEXT NOT NULL DEFAULT 'encontrado', -- 'encontrado' | 'reclamado' | 'doado' | 'descartado'
  reclamante_nome VARCHAR(255),
  reclamante_contato VARCHAR(100),
  data_reclamado DATE,

  observacoes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_achados_perdidos_ministry_id
  ON public.achados_perdidos_registros(ministry_id);
CREATE INDEX IF NOT EXISTS idx_achados_perdidos_status
  ON public.achados_perdidos_registros(status);
CREATE INDEX IF NOT EXISTS idx_achados_perdidos_data_encontrado
  ON public.achados_perdidos_registros(data_encontrado);

-- FKs opcionais
DO $$
BEGIN
  IF to_regclass('public.congregacoes') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_achados_perdidos_congregacao'
  ) THEN
    ALTER TABLE public.achados_perdidos_registros
      ADD CONSTRAINT fk_achados_perdidos_congregacao
      FOREIGN KEY (congregacao_id) REFERENCES public.congregacoes(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.campos') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_achados_perdidos_campo'
  ) THEN
    ALTER TABLE public.achados_perdidos_registros
      ADD CONSTRAINT fk_achados_perdidos_campo
      FOREIGN KEY (campo_id) REFERENCES public.campos(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.achados_perdidos_registros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS achados_perdidos_ministry_select ON public.achados_perdidos_registros;
DROP POLICY IF EXISTS achados_perdidos_ministry_insert ON public.achados_perdidos_registros;
DROP POLICY IF EXISTS achados_perdidos_ministry_update ON public.achados_perdidos_registros;
DROP POLICY IF EXISTS achados_perdidos_ministry_delete ON public.achados_perdidos_registros;

CREATE POLICY "achados_perdidos_ministry_select"
  ON public.achados_perdidos_registros FOR SELECT
  USING (ministry_id IN (SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()));

CREATE POLICY "achados_perdidos_ministry_insert"
  ON public.achados_perdidos_registros FOR INSERT
  WITH CHECK (ministry_id IN (SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()));

CREATE POLICY "achados_perdidos_ministry_update"
  ON public.achados_perdidos_registros FOR UPDATE
  USING (ministry_id IN (SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()));

CREATE POLICY "achados_perdidos_ministry_delete"
  ON public.achados_perdidos_registros FOR DELETE
  USING (ministry_id IN (SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()));

COMMIT;
