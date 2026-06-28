-- Migração: Workflow de Exceções v4
-- Cria a tabela agenda_solicitacoes com RLS

BEGIN;

CREATE TABLE IF NOT EXISTS public.agenda_solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  planejamento_id UUID REFERENCES public.agenda_planejamentos(id) ON DELETE SET NULL,
  evento_id UUID REFERENCES public.agenda_eventos(id) ON DELETE SET NULL,
  solicitante_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo_solicitacao TEXT CHECK (tipo_solicitacao IN ('conflito_data', 'alteracao_data', 'alteracao_escopo', 'coexistencia', 'criacao_evento')) DEFAULT 'conflito_data',
  escopo TEXT CHECK (escopo IN ('organizacao', 'divisao1', 'divisao2', 'divisao3')),
  titulo TEXT NOT NULL,
  justificativa TEXT NOT NULL,
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ,
  conflito_id UUID REFERENCES public.agenda_eventos(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'cancelado')) DEFAULT 'pendente',
  tipo_decisao TEXT CHECK (tipo_decisao IN ('aprovar', 'rejeitar', 'aprovar_com_restricao')),
  numero_decisao TEXT,
  vigencia_tipo TEXT CHECK (vigencia_tipo IN ('unica', 'temporaria', 'permanente')) DEFAULT 'unica',
  vigencia_inicio TIMESTAMPTZ,
  vigencia_fim TIMESTAMPTZ,
  efeito TEXT CHECK (efeito IN ('autorizar_evento', 'permitir_coexistencia', 'alterar_escopo', 'alterar_data', 'outro')),
  analisado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  analisado_em TIMESTAMPTZ,
  parecer TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_solicitacoes_ministry ON public.agenda_solicitacoes(ministry_id);
CREATE INDEX IF NOT EXISTS idx_agenda_solicitacoes_status ON public.agenda_solicitacoes(status);

ALTER TABLE public.agenda_solicitacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agenda_solicitacoes_select ON public.agenda_solicitacoes;
DROP POLICY IF EXISTS agenda_solicitacoes_insert ON public.agenda_solicitacoes;
DROP POLICY IF EXISTS agenda_solicitacoes_update ON public.agenda_solicitacoes;
DROP POLICY IF EXISTS agenda_solicitacoes_delete ON public.agenda_solicitacoes;

CREATE POLICY "agenda_solicitacoes_select" ON public.agenda_solicitacoes FOR SELECT USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "agenda_solicitacoes_insert" ON public.agenda_solicitacoes FOR INSERT WITH CHECK (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "agenda_solicitacoes_update" ON public.agenda_solicitacoes FOR UPDATE USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "agenda_solicitacoes_delete" ON public.agenda_solicitacoes FOR DELETE USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
  )
);

COMMIT;
