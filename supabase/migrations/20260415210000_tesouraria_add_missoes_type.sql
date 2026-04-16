-- 1. Adiciona 'missoes' e 'outros' ao CHECK constraint de tipo_recebimento
ALTER TABLE public.tesouraria_lancamentos
  DROP CONSTRAINT IF EXISTS tesouraria_tipo_valido;

ALTER TABLE public.tesouraria_lancamentos
  ADD CONSTRAINT tesouraria_tipo_valido CHECK (
    tipo_recebimento IN ('oferta','dizimo','evento','campanha','contribuicao','outros','missoes')
  );

-- 2. Corrige RLS INSERT para incluir o dono do ministério (owner fallback)
--    sem esse fallback o insert vindo do módulo Missões falhava silenciosamente
DROP POLICY IF EXISTS tesouraria_insert ON public.tesouraria_lancamentos;
CREATE POLICY "tesouraria_insert"
  ON public.tesouraria_lancamentos FOR INSERT
  WITH CHECK (
    -- Dono do ministério sempre pode inserir
    EXISTS (
      SELECT 1 FROM public.ministries
      WHERE id = tesouraria_lancamentos.ministry_id
        AND user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id     = auth.uid()
        AND mu.ministry_id = tesouraria_lancamentos.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR (
            mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb
            AND tesouraria_lancamentos.congregacao_id = mu.congregacao_id
          )
        )
    )
  );

-- 3. Mesma correção para UPDATE
DROP POLICY IF EXISTS tesouraria_update ON public.tesouraria_lancamentos;
CREATE POLICY "tesouraria_update"
  ON public.tesouraria_lancamentos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministries
      WHERE id = tesouraria_lancamentos.ministry_id
        AND user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id     = auth.uid()
        AND mu.ministry_id = tesouraria_lancamentos.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR (
            mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb
            AND tesouraria_lancamentos.congregacao_id = mu.congregacao_id
          )
        )
    )
  );

-- 4. Mesma correção para DELETE
DROP POLICY IF EXISTS tesouraria_delete ON public.tesouraria_lancamentos;
CREATE POLICY "tesouraria_delete"
  ON public.tesouraria_lancamentos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministries
      WHERE id = tesouraria_lancamentos.ministry_id
        AND user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id     = auth.uid()
        AND mu.ministry_id = tesouraria_lancamentos.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
        )
    )
  );

-- 5. Mesma correção para SELECT
DROP POLICY IF EXISTS tesouraria_select ON public.tesouraria_lancamentos;
CREATE POLICY "tesouraria_select"
  ON public.tesouraria_lancamentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ministries
      WHERE id = tesouraria_lancamentos.ministry_id
        AND user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id     = auth.uid()
        AND mu.ministry_id = tesouraria_lancamentos.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR (
            mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb
            AND tesouraria_lancamentos.congregacao_id = mu.congregacao_id
          )
        )
    )
  );
