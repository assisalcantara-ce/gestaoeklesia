-- Migração: Planejamento Ministerial v1
-- Cria a tabela agenda_planejamentos e evolui a tabela agenda_eventos

BEGIN;

-- 1. Criar tabela agenda_planejamentos
CREATE TABLE IF NOT EXISTS public.agenda_planejamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  ano SMALLINT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (ministry_id, ano),
  CONSTRAINT agenda_planejamentos_status CHECK (status IN ('rascunho', 'publicado', 'arquivado'))
);

CREATE INDEX IF NOT EXISTS idx_agenda_planejamentos_ministry ON public.agenda_planejamentos(ministry_id);
CREATE INDEX IF NOT EXISTS idx_agenda_planejamentos_ano ON public.agenda_planejamentos(ano);

-- RLS para agenda_planejamentos
ALTER TABLE public.agenda_planejamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agenda_planejamentos_select ON public.agenda_planejamentos;
DROP POLICY IF EXISTS agenda_planejamentos_insert ON public.agenda_planejamentos;
DROP POLICY IF EXISTS agenda_planejamentos_update ON public.agenda_planejamentos;
DROP POLICY IF EXISTS agenda_planejamentos_delete ON public.agenda_planejamentos;

CREATE POLICY "agenda_planejamentos_select" ON public.agenda_planejamentos FOR SELECT USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "agenda_planejamentos_insert" ON public.agenda_planejamentos FOR INSERT WITH CHECK (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "agenda_planejamentos_update" ON public.agenda_planejamentos FOR UPDATE USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "agenda_planejamentos_delete" ON public.agenda_planejamentos FOR DELETE USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
  )
);

-- 2. Evoluir a tabela agenda_eventos
ALTER TABLE public.agenda_eventos ADD COLUMN IF NOT EXISTS planejamento_id UUID REFERENCES public.agenda_planejamentos(id) ON DELETE SET NULL;
ALTER TABLE public.agenda_eventos ADD COLUMN IF NOT EXISTS escopo TEXT CHECK (escopo IN ('organizacao', 'divisao1', 'divisao2', 'divisao3')) DEFAULT 'divisao1';
ALTER TABLE public.agenda_eventos ADD COLUMN IF NOT EXISTS prioridade SMALLINT DEFAULT 4;
ALTER TABLE public.agenda_eventos ADD COLUMN IF NOT EXISTS calendario_oficial BOOLEAN DEFAULT false;
ALTER TABLE public.agenda_eventos ADD COLUMN IF NOT EXISTS gera_bloqueio BOOLEAN DEFAULT false;
ALTER TABLE public.agenda_eventos ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT false;
ALTER TABLE public.agenda_eventos ADD COLUMN IF NOT EXISTS origem_tipo TEXT;
ALTER TABLE public.agenda_eventos ADD COLUMN IF NOT EXISTS origem_id UUID;

CREATE INDEX IF NOT EXISTS idx_agenda_eventos_planejamento ON public.agenda_eventos(planejamento_id);
CREATE INDEX IF NOT EXISTS idx_agenda_eventos_escopo ON public.agenda_eventos(escopo);

-- 3. Migração de dados automáticos
DO $$
DECLARE
  r RECORD;
  v_plan_id UUID;
  v_ano SMALLINT;
BEGIN
  -- Para cada evento existente, cria o planejamento correspondente caso não exista
  FOR r IN SELECT DISTINCT ministry_id, EXTRACT(YEAR FROM data_inicio)::SMALLINT AS ano FROM public.agenda_eventos LOOP
    v_ano := r.ano;
    
    -- Insere planejamento do ano se não existir
    INSERT INTO public.agenda_planejamentos (ministry_id, ano, nome, status)
    VALUES (r.ministry_id, v_ano, 'Planejamento Anual ' || v_ano, 'rascunho')
    ON CONFLICT (ministry_id, ano) DO NOTHING;

    -- Obtém o ID do planejamento
    SELECT id INTO v_plan_id FROM public.agenda_planejamentos WHERE ministry_id = r.ministry_id AND ano = v_ano LIMIT 1;

    -- Vincula os eventos ao planejamento
    IF v_plan_id IS NOT NULL THEN
      UPDATE public.agenda_eventos 
      SET planejamento_id = v_plan_id 
      WHERE ministry_id = r.ministry_id 
        AND EXTRACT(YEAR FROM data_inicio)::SMALLINT = v_ano 
        AND planejamento_id IS NULL;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
