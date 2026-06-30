-- Migração: Permitir inserção anônima na recepção de cultos via token válido
-- Resolve a violação de RLS que impedia o cadastro de visitantes sem login

DROP POLICY IF EXISTS "Permitir inserção anônima via token" ON public.culto_visitantes;

CREATE POLICY "Permitir inserção anônima via token" ON public.culto_visitantes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.culto_tokens
      WHERE culto_tokens.culto_id = culto_visitantes.culto_id
        AND culto_tokens.is_active = true
        AND (culto_tokens.expires_at IS NULL OR culto_tokens.expires_at > now())
    )
  );
