-- Migração: Fundação do Módulo de Relatório Espiritual
CREATE TABLE IF NOT EXISTS public.relatorio_espiritual_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  data_atividade DATE NOT NULL,
  tipo_atividade VARCHAR(50) NOT NULL, -- Culto, Santa Ceia, Visita, Evangelismo, Outro
  
  -- Métricas
  cultos_realizados INTEGER NOT NULL DEFAULT 0,
  visitas_realizadas INTEGER NOT NULL DEFAULT 0,
  almas_alcancadas INTEGER NOT NULL DEFAULT 0,
  biblias_doadas INTEGER NOT NULL DEFAULT 0,
  literaturas_entregues INTEGER NOT NULL DEFAULT 0,
  
  -- Condicionais
  membros_cearam INTEGER DEFAULT 0, -- Condicional: Santa Ceia
  visitantes_presentes INTEGER DEFAULT 0, -- Condicional: Culto
  
  -- Administrativos
  observacoes TEXT,
  usuario_responsavel UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Rascunho', -- Rascunho, Enviado, Revisado
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para performance e otimização de filtros RLS
CREATE INDEX IF NOT EXISTS idx_relatorio_espiritual_ministry_id ON public.relatorio_espiritual_registros(ministry_id);
CREATE INDEX IF NOT EXISTS idx_relatorio_espiritual_congregacao_id ON public.relatorio_espiritual_registros(congregacao_id);
CREATE INDEX IF NOT EXISTS idx_relatorio_espiritual_data_atividade ON public.relatorio_espiritual_registros(data_atividade);

-- Habilitar RLS
ALTER TABLE public.relatorio_espiritual_registros ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS relatorio_espiritual_select ON public.relatorio_espiritual_registros;
DROP POLICY IF EXISTS relatorio_espiritual_insert ON public.relatorio_espiritual_registros;
DROP POLICY IF EXISTS relatorio_espiritual_update ON public.relatorio_espiritual_registros;
DROP POLICY IF EXISTS relatorio_espiritual_delete ON public.relatorio_espiritual_registros;

CREATE POLICY relatorio_espiritual_select
  ON public.relatorio_espiritual_registros FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY relatorio_espiritual_insert
  ON public.relatorio_espiritual_registros FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY relatorio_espiritual_update
  ON public.relatorio_espiritual_registros FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY relatorio_espiritual_delete
  ON public.relatorio_espiritual_registros FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );
