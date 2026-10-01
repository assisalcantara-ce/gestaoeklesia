-- =============================================================================
-- Módulo Eventos: Tokens de Check-in Público
-- Tabela para gestão de links e tokens de acesso público ao check-in na portaria
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.eventos_checkin_tokens (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id      UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  evento_id        UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  token_hash       TEXT NOT NULL UNIQUE,
  status           VARCHAR(30) NOT NULL DEFAULT 'ativo'
                   CHECK (status IN ('ativo', 'expirado', 'revogado', 'inativado_encerramento')),
  expira_em        TIMESTAMPTZ NOT NULL,
  revogado_em      TIMESTAMPTZ,
  revogado_por     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ultimo_acesso_em TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eventos_checkin_tokens_hash ON public.eventos_checkin_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_eventos_checkin_tokens_evento ON public.eventos_checkin_tokens(evento_id, status);

ALTER TABLE public.eventos_checkin_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eventos_checkin_tokens_all ON public.eventos_checkin_tokens;
CREATE POLICY eventos_checkin_tokens_all ON public.eventos_checkin_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.ministry_id = eventos_checkin_tokens.ministry_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.ministry_id = eventos_checkin_tokens.ministry_id
    )
  );

COMMIT;
