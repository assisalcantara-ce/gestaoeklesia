-- Migração: Criação da tabela de categorias de cultos customizadas por ministério
CREATE TABLE IF NOT EXISTS public.culto_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Evitar duplicados por ministério
  CONSTRAINT unique_nome_por_ministry UNIQUE (ministry_id, nome)
);

-- Habilitar RLS
ALTER TABLE public.culto_categorias ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS culto_categorias_select ON public.culto_categorias;
DROP POLICY IF EXISTS culto_categorias_insert ON public.culto_categorias;
DROP POLICY IF EXISTS culto_categorias_delete ON public.culto_categorias;

CREATE POLICY culto_categorias_select ON public.culto_categorias
  FOR SELECT USING (true); -- Visível para leitura geral

CREATE POLICY culto_categorias_insert ON public.culto_categorias
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL); -- Permitido para usuários autenticados

CREATE POLICY culto_categorias_delete ON public.culto_categorias
  FOR DELETE USING (auth.uid() IS NOT NULL);
