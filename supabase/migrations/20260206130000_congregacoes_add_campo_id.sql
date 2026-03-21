-- ============================================
-- CONGREGAÇÕES: adicionar vínculo com a Divisão 02 (CAMPO)
-- (Executa após a criação da tabela public.campos)
-- ============================================

ALTER TABLE public.congregacoes
ADD COLUMN IF NOT EXISTS campo_id UUID REFERENCES public.campos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_congregacoes_campo_id ON public.congregacoes(campo_id);
