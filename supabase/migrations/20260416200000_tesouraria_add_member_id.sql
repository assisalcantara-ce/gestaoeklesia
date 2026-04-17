-- Adiciona FK member_id e coluna dizimista_nome em tesouraria_lancamentos
-- member_id: vínculo direto com o membro cadastrado
-- dizimista_nome: nome do contribuinte (membro ou avulso) para exibição nos relatórios

ALTER TABLE public.tesouraria_lancamentos
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE SET NULL;

ALTER TABLE public.tesouraria_lancamentos
  ADD COLUMN IF NOT EXISTS dizimista_nome VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_tesouraria_member
  ON public.tesouraria_lancamentos(member_id)
  WHERE member_id IS NOT NULL;
