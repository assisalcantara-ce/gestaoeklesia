-- =============================================================================
-- Migration: 20261029170500_fix_ebd_professores_rls_secretario_geral.sql
-- Objetivo: Permitir que usuários com perfil/permissão SECRETARIO_GERAL,
--           PRESIDENCIA e COORDENADOR_EBD tenham permissão para gerenciar
--           professores da EBD nas congregações do próprio ministério.
--           Preserva estritamente o isolamento multi-tenant (ministry_id) e
--           mantém o escopo restrito da Secretaria Local à sua própria congregação.
-- =============================================================================

BEGIN;

-- 1. Atualizar ebd_user_global_access para reconhecer SECRETARIO_GERAL, PRESIDENCIA e COORDENADOR_EBD
CREATE OR REPLACE FUNCTION public.ebd_user_global_access(p_ministry_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ministries m
    WHERE m.id = p_ministry_id
      AND m.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid()
      AND mu.ministry_id = p_ministry_id
      AND (
        lower(coalesce(mu.role, '')) IN (
          'admin', 'administrador', 'manager', 'coordenador', 'coordinator', 
          'secretario_geral', 'presidencia', 'coordenador_ebd'
        )
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["ADMINISTRADOR"]'::jsonb
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["EBD"]'::jsonb
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["COORDENADOR"]'::jsonb
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["COORDENADOR_EBD"]'::jsonb
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["SECRETARIO_GERAL"]'::jsonb
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["PRESIDENCIA"]'::jsonb
      )
  );
$$;

-- 2. Atualizar ebd_user_local_access para compatibilidade adicional de papéis locais da EBD
CREATE OR REPLACE FUNCTION public.ebd_user_local_access(p_ministry_id uuid, p_church_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.ebd_user_global_access(p_ministry_id)
  OR EXISTS (
    SELECT 1
    FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid()
      AND mu.ministry_id = p_ministry_id
      AND mu.congregacao_id = p_church_id
      AND (
        lower(coalesce(mu.role, '')) IN ('superintendente', 'superintendent', 'superintendente_ebd')
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["SUPERINTENDENTE"]'::jsonb
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["SUPERINTENDENTE_EBD"]'::jsonb
      )
  );
$$;

-- 3. Atualizar ebd_user_any_access para compatibilidade
CREATE OR REPLACE FUNCTION public.ebd_user_any_access(p_ministry_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.ebd_user_global_access(p_ministry_id)
  OR EXISTS (
    SELECT 1
    FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid()
      AND mu.ministry_id = p_ministry_id
      AND (
        lower(coalesce(mu.role, '')) IN (
          'superintendente', 'superintendent', 'superintendente_ebd', 
          'coordenador', 'coordinator', 'coordenador_ebd'
        )
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["SUPERINTENDENTE"]'::jsonb
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["SUPERINTENDENTE_EBD"]'::jsonb
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["COORDENADOR"]'::jsonb
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["COORDENADOR_EBD"]'::jsonb
      )
  );
$$;

-- 4. Garantir permissões de execução
REVOKE EXECUTE ON FUNCTION public.ebd_user_global_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ebd_user_global_access(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ebd_user_local_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ebd_user_local_access(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ebd_user_any_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ebd_user_any_access(uuid) TO authenticated, service_role;

COMMIT;
