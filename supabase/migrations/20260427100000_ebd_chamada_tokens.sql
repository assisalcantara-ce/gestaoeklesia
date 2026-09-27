-- ═══════════════════════════════════════════════════════════════════════════════
-- Tabela de Tokens de Chamada Rápida por Link Temporário (EBD)
-- ═══════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.ebd_chamada_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id    UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  church_id      UUID NOT NULL REFERENCES public.congregacoes(id) ON DELETE CASCADE,
  turma_id       UUID NOT NULL REFERENCES public.ebd_turmas(id) ON DELETE CASCADE,
  professor_id   UUID REFERENCES public.ebd_professores(id) ON DELETE SET NULL,
  data_aula      DATE NOT NULL,
  token_hash     TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'finalizado', 'revogado')),
  expires_at     TIMESTAMPTZ NOT NULL,
  finalizado_em  TIMESTAMPTZ,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (turma_id, data_aula)
);

CREATE INDEX IF NOT EXISTS idx_ebd_tokens_hash ON public.ebd_chamada_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_ebd_tokens_turma_data ON public.ebd_chamada_tokens(turma_id, data_aula);
CREATE INDEX IF NOT EXISTS idx_ebd_tokens_ministry_church ON public.ebd_chamada_tokens(ministry_id, church_id);

ALTER TABLE public.ebd_chamada_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ebd_tokens_select ON public.ebd_chamada_tokens;
DROP POLICY IF EXISTS ebd_tokens_insert ON public.ebd_chamada_tokens;
DROP POLICY IF EXISTS ebd_tokens_update ON public.ebd_chamada_tokens;
DROP POLICY IF EXISTS ebd_tokens_delete ON public.ebd_chamada_tokens;

CREATE POLICY ebd_tokens_select ON public.ebd_chamada_tokens FOR SELECT USING (
  public.ebd_user_local_access(ministry_id, church_id)
);
CREATE POLICY ebd_tokens_insert ON public.ebd_chamada_tokens FOR INSERT WITH CHECK (
  public.ebd_user_local_access(ministry_id, church_id)
);
CREATE POLICY ebd_tokens_update ON public.ebd_chamada_tokens FOR UPDATE USING (
  public.ebd_user_local_access(ministry_id, church_id)
) WITH CHECK (
  public.ebd_user_local_access(ministry_id, church_id)
);
CREATE POLICY ebd_tokens_delete ON public.ebd_chamada_tokens FOR DELETE USING (
  public.ebd_user_global_access(ministry_id)
);

COMMIT;
