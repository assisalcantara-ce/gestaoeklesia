-- Módulo Agenda Core
-- Estrutura multi-tenant (ministry_id) e multi-church (church_id)

BEGIN;

CREATE TABLE IF NOT EXISTS public.agenda_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  church_id UUID REFERENCES public.congregacoes(id) ON DELETE CASCADE,
  
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'manual',
  
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ,
  local TEXT,
  visibilidade TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'agendado',
  recorrente BOOLEAN DEFAULT false,
  
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT agenda_eventos_tipo CHECK (tipo IN ('culto', 'reuniao', 'aula', 'evento', 'tarefa', 'outro')),
  CONSTRAINT agenda_eventos_origem CHECK (origem IN ('manual')),
  CONSTRAINT agenda_eventos_visibilidade CHECK (visibilidade IN ('privado', 'lideranca', 'igreja', 'ministerio', 'publico')),
  CONSTRAINT agenda_eventos_status CHECK (status IN ('agendado', 'cancelado', 'concluido'))
);

CREATE INDEX IF NOT EXISTS idx_agenda_eventos_ministry ON public.agenda_eventos(ministry_id);
CREATE INDEX IF NOT EXISTS idx_agenda_eventos_church ON public.agenda_eventos(church_id);
CREATE INDEX IF NOT EXISTS idx_agenda_eventos_datas ON public.agenda_eventos(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_agenda_eventos_status ON public.agenda_eventos(status);

ALTER TABLE public.agenda_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agenda_eventos_select ON public.agenda_eventos;
DROP POLICY IF EXISTS agenda_eventos_insert ON public.agenda_eventos;
DROP POLICY IF EXISTS agenda_eventos_update ON public.agenda_eventos;
DROP POLICY IF EXISTS agenda_eventos_delete ON public.agenda_eventos;

CREATE POLICY "agenda_eventos_select" ON public.agenda_eventos FOR SELECT USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "agenda_eventos_insert" ON public.agenda_eventos FOR INSERT WITH CHECK (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "agenda_eventos_update" ON public.agenda_eventos FOR UPDATE USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "agenda_eventos_delete" ON public.agenda_eventos FOR DELETE USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
  )
);

COMMIT;
