-- ==============================================================================
-- MIGRATION: GERAÇÃO ATÔMICA E PROTEÇÃO DE MATRÍCULAS DE MEMBROS (MULTI-TENANT)
-- ==============================================================================
-- Arquivo: supabase/migrations/20261010230000_members_matricula_atomic_generation.sql
--
-- Descrição:
-- 1. Cria a tabela de controle de sequência por ministério: `members_sequencias_matricula`.
-- 2. Cria a função RPC atômica `public.alocar_proxima_matricula_membro(p_ministry_id UUID)`.
--    - Utiliza bloqueio exclusivo a nível de linha (row-level lock / FOR UPDATE) no tenant.
--    - Sincroniza e garante o maior valor entre o histórico de `members` e a sequência.
--    - Retorna o próximo número sequencial formatado com LPAD de no mínimo 3 dígitos (ex: '001', '010', '501').
-- 3. Segurança & Permissões:
--    - SECURITY DEFINER com search_path restrito.
--    - REVOKE EXECUTE de PUBLIC / anon.
--    - Concede execução apenas a authenticated e service_role.
--    - No contexto autenticado, valida se o auth.uid() pertence ao ministério solicitado
--      (ou se é chamada interna via service_role/backend).
-- 4. Unicidade & Concorrência:
--    - NOTA SOBRE ÍNDICE ÚNICO:
--      A auditoria identificou que já existem 18 matrículas duplicadas registradas no passado
--      no ministério bcab307a-f769-4980-91b8-39d566991fd8 (ex: '003', '005').
--      Portanto, um CREATE UNIQUE INDEX direto falharia na migração!
--      A migration cria um índice de performance (B-TREE) para acelerar a busca e ordenação,
--      deixando o script de criação do UNIQUE INDEX preparado para ser aplicado APÓS a
--      regularização das duplicidades históricas.
--
-- ATENÇÃO: NÃO APLICAR DIRETAMENTE VIA AUTOMATIZAÇÃO.
-- ESTE ARQUIVO É PREPARADO PARA REVISÃO E APLICAÇÃO MANUAL NO DASHBOARD DO SUPABASE.
-- ==============================================================================

BEGIN;

-- 1. Tabela de controle de sequência de matrículas por ministério
CREATE TABLE IF NOT EXISTS public.members_sequencias_matricula (
    ministry_id UUID PRIMARY KEY REFERENCES public.ministries(id) ON DELETE CASCADE,
    ultima_matricula INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS na tabela de sequências (apenas backend/service_role manipula)
ALTER TABLE public.members_sequencias_matricula ENABLE ROW LEVEL SECURITY;

-- 2. Função de Alocação Atômica de Matrícula (segura contra concorrência com row lock)
CREATE OR REPLACE FUNCTION public.alocar_proxima_matricula_membro(
    p_ministry_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_calling_user UUID;
    v_has_access BOOLEAN;
    v_max_tabela INTEGER := 0;
    v_novo_numero INTEGER;
BEGIN
    IF p_ministry_id IS NULL THEN
        RAISE EXCEPTION 'Parâmetro p_ministry_id é obrigatório';
    END IF;

    -- Validação de segurança multi-tenant:
    -- Se a chamada for feita com sessão autenticada de usuário (authenticated),
    -- garante que o usuário pertence ao ministério solicitado.
    -- Se for service_role (backend/API pública), auth.uid() é nulo e a chamada é autorizada.
    v_calling_user := auth.uid();
    IF v_calling_user IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.ministry_users
            WHERE user_id = v_calling_user
              AND ministry_id = p_ministry_id
        ) INTO v_has_access;

        IF NOT v_has_access THEN
            RAISE EXCEPTION 'Acesso negado: o usuário não tem permissão para alocar matrículas neste ministério';
        END IF;
    END IF;

    -- Garante que a linha de sequência exista para o tenant (idempotente)
    INSERT INTO public.members_sequencias_matricula (ministry_id, ultima_matricula)
    VALUES (p_ministry_id, 0)
    ON CONFLICT (ministry_id) DO NOTHING;

    -- Bloqueia a linha da sequência exclusivamente (row-level lock) para este tenant.
    -- Nenhum outro cadastro do mesmo ministério avança até o encerramento desta transação.
    PERFORM 1
    FROM public.members_sequencias_matricula
    WHERE ministry_id = p_ministry_id
    FOR UPDATE;

    -- Localiza a maior matrícula numérica efetivamente gravada na tabela de membros deste ministério
    SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(matricula, '\D', '', 'g'), '') AS INTEGER)), 0)
    INTO v_max_tabela
    FROM public.members
    WHERE ministry_id = p_ministry_id
      AND matricula IS NOT NULL
      AND trim(matricula) <> '';

    -- Atualiza e incrementa a sequência sincronizando com o maior valor real já registrado
    UPDATE public.members_sequencias_matricula
    SET ultima_matricula = GREATEST(ultima_matricula, v_max_tabela) + 1,
        updated_at = timezone('utc'::text, now())
    WHERE ministry_id = p_ministry_id
    RETURNING ultima_matricula INTO v_novo_numero;

    -- Retorna formatado com no mínimo 3 dígitos (ex: '001', '010', '100', '501')
    RETURN LPAD(v_novo_numero::TEXT, 3, '0');
END;
$$;

-- Restrição de privilégios de execução:
-- Revoga privilégios públicos para impedir chamadas anônimas diretas ao RPC
REVOKE EXECUTE ON FUNCTION public.alocar_proxima_matricula_membro(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.alocar_proxima_matricula_membro(UUID) FROM anon;

-- Concede privilégios restritos a authenticated e service_role
GRANT EXECUTE ON FUNCTION public.alocar_proxima_matricula_membro(UUID) TO authenticated, service_role;

-- 3. Índice de performance por ministério e matrícula
-- Permite buscas ultra rápidas de matrícula no escopo do tenant
CREATE INDEX IF NOT EXISTS idx_members_ministry_matricula
ON public.members (ministry_id, matricula)
WHERE matricula IS NOT NULL AND trim(matricula) <> '';

COMMIT;

-- ==============================================================================
-- COMANDO PREPARADO PARA REGULARIZAÇÃO FUTURA (APÓS ELIMINAR DUPLICIDADES HISTÓRICAS)
-- ==============================================================================
-- Quando as 18 duplicidades históricas forem saneadas na regularização,
-- o responsável poderá aplicar este índice único:
--
-- CREATE UNIQUE INDEX idx_members_ministry_matricula_unique
-- ON public.members (ministry_id, matricula)
-- WHERE matricula IS NOT NULL AND trim(matricula) <> '';
-- ==============================================================================
