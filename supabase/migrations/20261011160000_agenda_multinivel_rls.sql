-- ==============================================================================
-- Migration: 20261011160000_agenda_multinivel_rls.sql
-- Descrição: Políticas RLS e validações de integridade multinível para Agenda
-- Contexto: Diferenciação de Secretário-Geral / Administrador vs Secretário Local,
--           impedindo gravações indevidas de eventos ministeriais ou bloqueios oficiais
--           por perfis restritos à congregação local via acesso direto ao Supabase.
-- Status: Preparada para aplicação manual (NÃO APLICAR DIRETAMENTE PELO AGENTE).
-- ==============================================================================

BEGIN;

-- 1. Helper function para verificar se o usuário é Administrador, Dono ou Secretário-Geral
-- Usa SECURITY DEFINER com search_path = public restrito para evitar recursão e injeção.
CREATE OR REPLACE FUNCTION public.is_agenda_admin_or_geral(p_ministry_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Dono direto do ministério (tabela ministries)
    SELECT 1 
    FROM public.ministries m
    WHERE m.id = p_ministry_id 
      AND m.user_id = auth.uid()

    UNION ALL

    -- Usuário ativo com papel administrativo ou secretário geral
    SELECT 1 
    FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid()
      AND mu.ministry_id = p_ministry_id
      AND COALESCE(mu.is_active, true) = true
      AND (
        mu.role IN ('admin', 'super_admin')
        OR mu.permissions @> '["ADMINISTRADOR"]'::jsonb
        OR mu.permissions @> '["PRESIDENCIA"]'::jsonb
        OR mu.permissions @> '["SECRETARIO_GERAL"]'::jsonb
        OR (mu.congregacao_id IS NULL AND mu.role IN ('admin', 'manager'))
      )
  );
$$;

-- 2. Helper function para verificar se a congregação pertence ao vínculo ativo do usuário
-- Evita LIMIT 1 arbitrário e valida estritamente a congregação autorizada para aquele tenant.
CREATE OR REPLACE FUNCTION public.is_user_authorized_church(p_ministry_id UUID, p_church_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid()
      AND mu.ministry_id = p_ministry_id
      AND COALESCE(mu.is_active, true) = true
      AND mu.congregacao_id IS NOT NULL
      AND mu.congregacao_id = p_church_id
  );
$$;

-- 3. Restrição de execução das funções SECURITY DEFINER aos papéis necessários
-- Revoga privilégios públicos e de usuários anônimos; concede a authenticated e service_role
REVOKE EXECUTE ON FUNCTION public.is_agenda_admin_or_geral(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_agenda_admin_or_geral(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_agenda_admin_or_geral(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_user_authorized_church(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_user_authorized_church(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_user_authorized_church(UUID, UUID) TO authenticated, service_role;

-- 4. Atualização das Políticas RLS em agenda_eventos

-- SELECT: Permite consulta de qualquer evento do próprio ministério
-- Garante visão unificada/consolidada da sede, congregações e agenda geral sem cruzar tenants.
DROP POLICY IF EXISTS "agenda_eventos_select" ON public.agenda_eventos;
CREATE POLICY "agenda_eventos_select" ON public.agenda_eventos
FOR SELECT
USING (
  ministry_id IN (
    SELECT mu.ministry_id 
    FROM public.ministry_users mu 
    WHERE mu.user_id = auth.uid() 
      AND COALESCE(mu.is_active, true) = true
    UNION
    SELECT m.id 
    FROM public.ministries m 
    WHERE m.user_id = auth.uid()
  )
);

-- INSERT:
-- - Admin/Secretário-Geral/Owner: grava eventos gerais e em qualquer congregação, com ou sem bloqueio.
-- - Secretário Local: restrito à congregação autorizada, NUNCA evento geral (church_id NOT NULL),
--                     NUNCA gera_bloqueio = true e NUNCA escopo = 'organizacao'.
DROP POLICY IF EXISTS "agenda_eventos_insert" ON public.agenda_eventos;
CREATE POLICY "agenda_eventos_insert" ON public.agenda_eventos
FOR INSERT
WITH CHECK (
  (
    ministry_id IN (
      SELECT mu.ministry_id 
      FROM public.ministry_users mu 
      WHERE mu.user_id = auth.uid() 
        AND COALESCE(mu.is_active, true) = true
      UNION
      SELECT m.id 
      FROM public.ministries m 
      WHERE m.user_id = auth.uid()
    )
  )
  AND (
    public.is_agenda_admin_or_geral(ministry_id)
    OR
    (
      church_id IS NOT NULL
      AND public.is_user_authorized_church(ministry_id, church_id)
      AND COALESCE(gera_bloqueio, false) = false
      AND COALESCE(escopo, 'divisao1') <> 'organizacao'
    )
  )
);

-- UPDATE:
-- - USING: impede que secretário local selecione para alteração eventos com gera_bloqueio = true,
--          escopo = 'organizacao', church_id nulo ou pertencentes a outras congregações.
-- - WITH CHECK: impede que o secretário local converta o evento para bloqueio, altere o escopo para organização,
--               ou transfira o evento para outra congregação / geral.
DROP POLICY IF EXISTS "agenda_eventos_update" ON public.agenda_eventos;
CREATE POLICY "agenda_eventos_update" ON public.agenda_eventos
FOR UPDATE
USING (
  (
    ministry_id IN (
      SELECT mu.ministry_id 
      FROM public.ministry_users mu 
      WHERE mu.user_id = auth.uid() 
        AND COALESCE(mu.is_active, true) = true
      UNION
      SELECT m.id 
      FROM public.ministries m 
      WHERE m.user_id = auth.uid()
    )
  )
  AND (
    public.is_agenda_admin_or_geral(ministry_id)
    OR
    (
      church_id IS NOT NULL
      AND public.is_user_authorized_church(ministry_id, church_id)
      AND COALESCE(gera_bloqueio, false) = false
      AND COALESCE(escopo, 'divisao1') <> 'organizacao'
    )
  )
)
WITH CHECK (
  (
    ministry_id IN (
      SELECT mu.ministry_id 
      FROM public.ministry_users mu 
      WHERE mu.user_id = auth.uid() 
        AND COALESCE(mu.is_active, true) = true
      UNION
      SELECT m.id 
      FROM public.ministries m 
      WHERE m.user_id = auth.uid()
    )
  )
  AND (
    public.is_agenda_admin_or_geral(ministry_id)
    OR
    (
      church_id IS NOT NULL
      AND public.is_user_authorized_church(ministry_id, church_id)
      AND COALESCE(gera_bloqueio, false) = false
      AND COALESCE(escopo, 'divisao1') <> 'organizacao'
    )
  )
);

-- DELETE:
-- - Admin/Secretário-Geral/Owner: pode excluir qualquer evento do ministério.
-- - Secretário Local: só pode excluir eventos vinculados à sua própria congregação autorizada,
--                     e NUNCA eventos com gera_bloqueio = true ou escopo = 'organizacao'.
DROP POLICY IF EXISTS "agenda_eventos_delete" ON public.agenda_eventos;
CREATE POLICY "agenda_eventos_delete" ON public.agenda_eventos
FOR DELETE
USING (
  (
    ministry_id IN (
      SELECT mu.ministry_id 
      FROM public.ministry_users mu 
      WHERE mu.user_id = auth.uid() 
        AND COALESCE(mu.is_active, true) = true
      UNION
      SELECT m.id 
      FROM public.ministries m 
      WHERE m.user_id = auth.uid()
    )
  )
  AND (
    public.is_agenda_admin_or_geral(ministry_id)
    OR
    (
      church_id IS NOT NULL
      AND public.is_user_authorized_church(ministry_id, church_id)
      AND COALESCE(gera_bloqueio, false) = false
      AND COALESCE(escopo, 'divisao1') <> 'organizacao'
    )
  )
);

COMMIT;
