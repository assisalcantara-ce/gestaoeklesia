-- =============================================================================
-- Migration: 20261030110000_fix_eventos_inscricoes_rls_secretaria.sql
-- Objetivo: Atualizar as políticas de RLS de eventos e eventos_inscricoes
--           para permitir que usuários dos perfis da Secretaria (SECRETARIO_GERAL,
--           AUXILIAR_SECRETARIA, SECRETARIA_LOCAL, ADMIN_LOCAL, etc.) possam
--           criar, editar e gerenciar eventos e inscrições no módulo de eventos.
--           Preserva o isolamento estrito multi-tenant (ministry_id).
-- =============================================================================

BEGIN;

-- ─── 1. Atualizar RLS de public.eventos_inscricoes ─────────────────────────────

DROP POLICY IF EXISTS "inscricoes_select" ON public.eventos_inscricoes;
DROP POLICY IF EXISTS "inscricoes_insert" ON public.eventos_inscricoes;
DROP POLICY IF EXISTS "inscricoes_update" ON public.eventos_inscricoes;
DROP POLICY IF EXISTS "inscricoes_delete" ON public.eventos_inscricoes;

-- SELECT: qualquer usuário autenticado vinculado ao ministério ou dono do ministério
CREATE POLICY "inscricoes_select"
  ON public.eventos_inscricoes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = eventos_inscricoes.ministry_id
        AND mu.is_active = TRUE
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = eventos_inscricoes.ministry_id
        AND m.user_id = auth.uid()
    )
  );

-- INSERT: Administradores e perfis da Secretaria / Gestores autorizados
CREATE POLICY "inscricoes_insert"
  ON public.eventos_inscricoes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = eventos_inscricoes.ministry_id
        AND mu.is_active = TRUE
        AND (
          lower(coalesce(mu.role, '')) IN ('admin', 'administrador', 'manager', 'gestor')
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["ADMINISTRADOR"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["SECRETARIO"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["SECRETARIO_GERAL"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["AUXILIAR_SECRETARIA"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["SECRETARIA_LOCAL"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["ADMIN_LOCAL"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["FINANCEIRO"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["TESOUREIRO_GERAL"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["PRESIDENCIA"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = eventos_inscricoes.ministry_id
        AND m.user_id = auth.uid()
    )
  );

-- UPDATE: Administradores e perfis da Secretaria / Gestores autorizados
CREATE POLICY "inscricoes_update"
  ON public.eventos_inscricoes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = eventos_inscricoes.ministry_id
        AND mu.is_active = TRUE
        AND (
          lower(coalesce(mu.role, '')) IN ('admin', 'administrador', 'manager', 'gestor')
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["ADMINISTRADOR"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["SECRETARIO"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["SECRETARIO_GERAL"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["AUXILIAR_SECRETARIA"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["SECRETARIA_LOCAL"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["ADMIN_LOCAL"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["FINANCEIRO"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["TESOUREIRO_GERAL"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["PRESIDENCIA"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = eventos_inscricoes.ministry_id
        AND m.user_id = auth.uid()
    )
  );

-- DELETE: Administradores e Secretaria Geral / Gestores autorizados
CREATE POLICY "inscricoes_delete"
  ON public.eventos_inscricoes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = eventos_inscricoes.ministry_id
        AND mu.is_active = TRUE
        AND (
          lower(coalesce(mu.role, '')) IN ('admin', 'administrador', 'manager', 'gestor')
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["ADMINISTRADOR"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["SECRETARIO"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["SECRETARIO_GERAL"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["AUXILIAR_SECRETARIA"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["SECRETARIA_LOCAL"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["ADMIN_LOCAL"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["PRESIDENCIA"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = eventos_inscricoes.ministry_id
        AND m.user_id = auth.uid()
    )
  );


-- ─── 2. Atualizar RLS de public.eventos ────────────────────────────────────────

DROP POLICY IF EXISTS "eventos_select" ON public.eventos;
DROP POLICY IF EXISTS "eventos_insert" ON public.eventos;
DROP POLICY IF EXISTS "eventos_update" ON public.eventos;
DROP POLICY IF EXISTS "eventos_delete" ON public.eventos;

-- SELECT: qualquer usuário autenticado vinculado ao ministério ou dono do ministério
CREATE POLICY "eventos_select"
  ON public.eventos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = eventos.ministry_id
        AND mu.is_active = TRUE
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = eventos.ministry_id
        AND m.user_id = auth.uid()
    )
  );

-- INSERT: Administradores e Secretaria
CREATE POLICY "eventos_insert"
  ON public.eventos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = eventos.ministry_id
        AND mu.is_active = TRUE
        AND (
          lower(coalesce(mu.role, '')) IN ('admin', 'administrador', 'manager', 'gestor')
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["ADMINISTRADOR"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["SECRETARIO"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["SECRETARIO_GERAL"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["AUXILIAR_SECRETARIA"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["SECRETARIA_LOCAL"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["ADMIN_LOCAL"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["PRESIDENCIA"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = eventos.ministry_id
        AND m.user_id = auth.uid()
    )
  );

-- UPDATE: Administradores e Secretaria
CREATE POLICY "eventos_update"
  ON public.eventos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = eventos.ministry_id
        AND mu.is_active = TRUE
        AND (
          lower(coalesce(mu.role, '')) IN ('admin', 'administrador', 'manager', 'gestor')
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["ADMINISTRADOR"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["SECRETARIO"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["SECRETARIO_GERAL"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["AUXILIAR_SECRETARIA"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["SECRETARIA_LOCAL"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["ADMIN_LOCAL"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["PRESIDENCIA"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = eventos.ministry_id
        AND m.user_id = auth.uid()
    )
  );

-- DELETE: Administradores e Presidência
CREATE POLICY "eventos_delete"
  ON public.eventos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = eventos.ministry_id
        AND mu.is_active = TRUE
        AND (
          lower(coalesce(mu.role, '')) IN ('admin', 'administrador')
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["ADMINISTRADOR"]'::jsonb
          OR coalesce(mu.permissions, '[]'::jsonb) @> '["PRESIDENCIA"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = eventos.ministry_id
        AND m.user_id = auth.uid()
    )
  );

COMMIT;
