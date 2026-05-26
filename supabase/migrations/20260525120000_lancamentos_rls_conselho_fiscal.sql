-- Migration: adicionar PRESIDENCIA e CONSELHO_FISCAL ao SELECT policy de tesouraria_lancamentos
-- Bug: esses papéis não conseguiam visualizar lançamentos no modal do Conselho Fiscal Digital,
-- tornando os alertas de auditoria (lançamentos sem categoria) inoperantes para eles.

BEGIN;

DROP POLICY IF EXISTS "tesouraria_select" ON public.tesouraria_lancamentos;

-- SELECT:
--   ADMINISTRADOR, FINANCEIRO, PRESIDENCIA ou CONSELHO_FISCAL → todos os lançamentos do ministério
--   FINANCEIRO_LOCAL → apenas lançamentos da sua congregação (read-only)
CREATE POLICY "tesouraria_select"
  ON public.tesouraria_lancamentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_lancamentos.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR mu.permissions @> '["PRESIDENCIA"]'::jsonb
          OR mu.permissions @> '["CONSELHO_FISCAL"]'::jsonb
          OR (
            mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb
            AND tesouraria_lancamentos.congregacao_id = mu.congregacao_id
          )
        )
    )
  );

COMMIT;
