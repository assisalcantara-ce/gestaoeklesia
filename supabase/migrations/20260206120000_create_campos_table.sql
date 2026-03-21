-- ============================================
-- DIVISÃO 02 (ex: CAMPO/SETOR/GRUPO)
-- Cada item pode pertencer a uma Supervisão (Divisão 01), quando existir.
-- ============================================

CREATE TABLE IF NOT EXISTS public.campos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,

  -- Divisão 01 (opcional quando não existir)
  supervisao_id UUID REFERENCES public.supervisoes(id) ON DELETE SET NULL,

  nome VARCHAR(255) NOT NULL,

  -- Campo sede da supervisão selecionada
  is_sede BOOLEAN NOT NULL DEFAULT false,

  -- Pastor do campo (opcional)
  pastor_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  pastor_nome VARCHAR(255),
  pastor_data_posse DATE,

  -- Endereço resumido
  cep VARCHAR(20),
  municipio VARCHAR(100),
  uf VARCHAR(2),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(ministry_id, supervisao_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_campos_ministry_id ON public.campos(ministry_id);
CREATE INDEX IF NOT EXISTS idx_campos_supervisao_id ON public.campos(supervisao_id);
CREATE INDEX IF NOT EXISTS idx_campos_is_active ON public.campos(is_active);
CREATE INDEX IF NOT EXISTS idx_campos_nome ON public.campos USING GIN (nome gin_trgm_ops);

-- Apenas 1 campo sede por supervisão (quando supervisao_id existir)
CREATE UNIQUE INDEX IF NOT EXISTS idx_campos_sede_unique_per_supervisao
  ON public.campos(ministry_id, supervisao_id)
  WHERE (is_sede = true AND supervisao_id IS NOT NULL);

ALTER TABLE public.campos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campos_ministry_select"
  ON public.campos FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "campos_ministry_insert"
  ON public.campos FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "campos_ministry_update"
  ON public.campos FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "campos_ministry_delete"
  ON public.campos FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );
