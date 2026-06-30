-- Migração: Criação da Recepção de Visitantes no Módulo de Cultos
CREATE TABLE IF NOT EXISTS public.culto_visitantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  culto_id UUID NOT NULL REFERENCES public.culto_registros(id) ON DELETE CASCADE,
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id UUID NOT NULL REFERENCES public.congregacoes(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(30),
  cidade VARCHAR(100),
  bairro VARCHAR(100),
  igreja_origem VARCHAR(255),
  primeira_visita BOOLEAN NOT NULL DEFAULT true,
  is_ministro BOOLEAN NOT NULL DEFAULT false,
  cargo_ministerial VARCHAR(100), -- Pastor, Evangelista, Presbítero, Diácono, Missionário, Outro
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Ativar RLS
ALTER TABLE public.culto_visitantes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Permitir leitura por tenant" ON public.culto_visitantes
  FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    ) OR 
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Permitir inserção por tenant" ON public.culto_visitantes
  FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    ) OR 
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Permitir atualização por tenant" ON public.culto_visitantes
  FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    ) OR 
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Permitir deleção por tenant" ON public.culto_visitantes
  FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    ) OR 
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );
