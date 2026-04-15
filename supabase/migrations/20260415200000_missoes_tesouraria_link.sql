-- Vínculo entre missoes_arrecadacoes e tesouraria_lancamentos
-- Ao salvar uma arrecadação em Missões, um lançamento é gerado automaticamente na Tesouraria.
-- A coluna abaixo guarda a referência para sincronização (update/delete).

ALTER TABLE public.missoes_arrecadacoes
  ADD COLUMN IF NOT EXISTS tesouraria_lancamento_id UUID
    REFERENCES public.tesouraria_lancamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_missoes_arrecadacoes_lancamento
  ON public.missoes_arrecadacoes(tesouraria_lancamento_id);
