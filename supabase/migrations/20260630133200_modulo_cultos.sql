-- Migração: Criação do Módulo de Cultos
CREATE TABLE IF NOT EXISTS public.culto_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id UUID NOT NULL REFERENCES public.congregacoes(id) ON DELETE CASCADE,
  data_culto DATE NOT NULL,
  horario_culto TIME NOT NULL,
  tipo_culto VARCHAR(100) NOT NULL,
  dirigente VARCHAR(255) NOT NULL,
  pregador VARCHAR(255),
  observacoes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'Aberto', -- Aberto, Encerrado, Consolidado
  usuario_responsavel UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Ativar RLS
ALTER TABLE public.culto_registros ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Permitir leitura por tenant" ON public.culto_registros
  FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    ) OR 
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Permitir inserção por tenant" ON public.culto_registros
  FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    ) OR 
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Permitir atualização por tenant" ON public.culto_registros
  FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    ) OR 
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Permitir deleção por tenant" ON public.culto_registros
  FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    ) OR 
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );
