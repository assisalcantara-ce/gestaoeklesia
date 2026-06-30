-- Migração: Tokens de Acesso Público para Recepção de Cultos
-- Cada token é vinculado a um culto específico e expira em 24h

CREATE TABLE IF NOT EXISTS public.culto_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id  UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  culto_id     UUID NOT NULL REFERENCES public.culto_registros(id) ON DELETE CASCADE,
  token        VARCHAR(100) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(20), 'hex'),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  expires_at   TIMESTAMP WITH TIME ZONE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,

  -- Um culto tem no máximo um token ativo por ministério
  CONSTRAINT unique_culto_token UNIQUE (culto_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_culto_tokens_token   ON public.culto_tokens(token);
CREATE INDEX IF NOT EXISTS idx_culto_tokens_culto   ON public.culto_tokens(culto_id);
CREATE INDEX IF NOT EXISTS idx_culto_tokens_ministry ON public.culto_tokens(ministry_id);

-- Row Level Security
ALTER TABLE public.culto_tokens ENABLE ROW LEVEL SECURITY;

-- Remove políticas anteriores (idempotente)
DROP POLICY IF EXISTS culto_tokens_select_anon   ON public.culto_tokens;
DROP POLICY IF EXISTS culto_tokens_all_admin     ON public.culto_tokens;

-- Leitura anônima: usada pelo formulário público para validar o token
CREATE POLICY culto_tokens_select_anon
  ON public.culto_tokens FOR SELECT
  USING (is_active = true);

-- Gestão completa por usuários autenticados do mesmo ministério
CREATE POLICY culto_tokens_all_admin
  ON public.culto_tokens FOR ALL
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

-- Permitir INSERT anônimo em culto_visitantes (formulário público)
-- O token é validado no código JS antes do insert.
DROP POLICY IF EXISTS culto_visitantes_insert_public ON public.culto_visitantes;

CREATE POLICY culto_visitantes_insert_public
  ON public.culto_visitantes FOR INSERT
  WITH CHECK (true);
