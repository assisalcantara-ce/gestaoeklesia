-- Sprint 5: Referência entre culto_registros e relatorio_espiritual_registros
-- Permite rastrear qual culto gerou qual registro espiritual e evitar duplicidade

ALTER TABLE public.relatorio_espiritual_registros
  ADD COLUMN IF NOT EXISTS culto_id UUID REFERENCES public.culto_registros(id) ON DELETE SET NULL;

-- Índice para busca de duplicidade e rastreabilidade
CREATE UNIQUE INDEX IF NOT EXISTS idx_relatorio_espiritual_culto_id
  ON public.relatorio_espiritual_registros(culto_id)
  WHERE culto_id IS NOT NULL;
