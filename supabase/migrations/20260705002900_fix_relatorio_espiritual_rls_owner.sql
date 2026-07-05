-- Migração: Correção da RLS de relatorio_espiritual_registros
-- Adiciona fallback de owner (ministries.user_id) em todas as políticas
-- para garantir que o proprietário do ministério possa sempre inserir/editar registros espirituais.
-- Sem esse fallback, proprietários que não estão em ministry_users ficam bloqueados.

DROP POLICY IF EXISTS relatorio_espiritual_select ON public.relatorio_espiritual_registros;
DROP POLICY IF EXISTS relatorio_espiritual_insert ON public.relatorio_espiritual_registros;
DROP POLICY IF EXISTS relatorio_espiritual_update ON public.relatorio_espiritual_registros;
DROP POLICY IF EXISTS relatorio_espiritual_delete ON public.relatorio_espiritual_registros;

-- SELECT: acesso por membro da equipe OU owner do ministério
CREATE POLICY relatorio_espiritual_select
  ON public.relatorio_espiritual_registros FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
    OR
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

-- INSERT: inserção por membro da equipe OU owner do ministério
CREATE POLICY relatorio_espiritual_insert
  ON public.relatorio_espiritual_registros FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
    OR
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

-- UPDATE: edição por membro da equipe OU owner do ministério
CREATE POLICY relatorio_espiritual_update
  ON public.relatorio_espiritual_registros FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
    OR
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

-- DELETE: exclusão por membro da equipe OU owner do ministério
CREATE POLICY relatorio_espiritual_delete
  ON public.relatorio_espiritual_registros FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
    OR
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

-- Recarregar schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
