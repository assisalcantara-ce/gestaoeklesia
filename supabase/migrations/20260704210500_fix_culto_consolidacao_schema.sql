-- Migração: Garantir colunas de consolidação e relacionamento de cultos
-- Adicionar culto_id na tabela relatorio_espiritual_registros
ALTER TABLE public.relatorio_espiritual_registros
  ADD COLUMN IF NOT EXISTS culto_id UUID REFERENCES public.culto_registros(id) ON DELETE SET NULL;

-- Criar índice exclusivo parcial para evitar duplicidade de consolidações
CREATE UNIQUE INDEX IF NOT EXISTS idx_relatorio_espiritual_culto_id
  ON public.relatorio_espiritual_registros(culto_id)
  WHERE culto_id IS NOT NULL;

-- Adicionar relatorio_espiritual_id na tabela culto_registros para rastreabilidade bidirecional se necessário
ALTER TABLE public.culto_registros
  ADD COLUMN IF NOT EXISTS relatorio_espiritual_id UUID REFERENCES public.relatorio_espiritual_registros(id) ON DELETE SET NULL;

-- Forçar o reload do schema cache do PostgREST do Supabase remoto
NOTIFY pgrst, 'reload schema';
