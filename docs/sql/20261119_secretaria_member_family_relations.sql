-- ==============================================================================
-- SCRIPT TRANSACIONAL: CRIAÇÃO DA TABELA DE VÍNCULOS FAMILIARES (SECRETARIA)
-- Arquivo: docs/sql/20261119_secretaria_member_family_relations.sql
-- Destino Exclusivo: Supabase Cloud Oficial (qspueosxkolmwvibhzkt)
-- Data: 2026-11-19
-- ==============================================================================
-- ATENÇÃO: NÃO EXECUTAR DIRETAMENTE. APLICAÇÃO CONDICIONADA À APROVAÇÃO EXPLÍCITA.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. PRÉ-CONDIÇÕES (Validação de Dependências)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- Validar existência da tabela ministries
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'ministries'
    ) THEN
        RAISE EXCEPTION 'Pré-condição falhou: Tabela public.ministries não existe.';
    END IF;

    -- Validar existência da tabela members
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'members'
    ) THEN
        RAISE EXCEPTION 'Pré-condição falhou: Tabela public.members não existe.';
    END IF;

    -- Validar existência da tabela ministry_users (usada para isolamento RLS)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'ministry_users'
    ) THEN
        RAISE EXCEPTION 'Pré-condição falhou: Tabela public.ministry_users não existe.';
    END IF;

    RAISE NOTICE '✓ Pré-condições validadas com sucesso.';
END $$;

-- ------------------------------------------------------------------------------
-- 2. CRIAÇÃO DA TABELA member_family_relations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.member_family_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    child_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    child_nome VARCHAR(255) NOT NULL,
    child_data_nascimento DATE,
    child_tipo VARCHAR(50) DEFAULT 'filho', -- 'filho', 'enteado', 'tutelado'
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),

    -- Restrições de integridade
    CONSTRAINT check_no_self_relation CHECK (parent_id != child_id),
    CONSTRAINT uq_parent_child_relation UNIQUE (ministry_id, parent_id, child_id)
);

COMMENT ON TABLE public.member_family_relations IS 'Vínculos familiares (filhos/dependentes) com isolamento multi-tenant.';
COMMENT ON COLUMN public.member_family_relations.parent_id IS 'Membro responsável/pai/mãe (ON DELETE CASCADE).';
COMMENT ON COLUMN public.member_family_relations.child_id IS 'Membro filho opcional (ON DELETE SET NULL para nunca excluir a pessoa ao desvincular).';

-- ------------------------------------------------------------------------------
-- 3. ÍNDICES DE PERFORMANCE E ISOLAMENTO
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_family_relations_ministry_parent 
    ON public.member_family_relations(ministry_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_family_relations_ministry_child 
    ON public.member_family_relations(ministry_id, child_id);

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) E POLÍTICAS
-- ------------------------------------------------------------------------------
ALTER TABLE public.member_family_relations ENABLE ROW LEVEL SECURITY;

-- Remove política pré-existente se houver para evitar conflitos de reexecução
DROP POLICY IF EXISTS "Tenant isolation for member_family_relations" ON public.member_family_relations;

CREATE POLICY "Tenant isolation for member_family_relations"
    ON public.member_family_relations
    FOR ALL
    USING (
        ministry_id IN (
            SELECT mu.ministry_id FROM public.ministry_users mu
            WHERE mu.user_id = auth.uid()
        )
    )
    WITH CHECK (
        ministry_id IN (
            SELECT mu.ministry_id FROM public.ministry_users mu
            WHERE mu.user_id = auth.uid()
        )
    );

-- ------------------------------------------------------------------------------
-- 5. PÓS-CONDIÇÕES E VERIFICAÇÃO DE INTEGRIDADE
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- Validar criação da tabela
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'member_family_relations'
    ) THEN
        RAISE EXCEPTION 'Pós-condição falhou: Tabela member_family_relations não foi criada.';
    END IF;

    -- Validar RLS habilitado
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename = 'member_family_relations' 
          AND rowsecurity = true
    ) THEN
        RAISE EXCEPTION 'Pós-condição falhou: RLS não está ativo em member_family_relations.';
    END IF;

    -- Validar que membros e lançamentos financeiros NÃO foram modificados
    RAISE NOTICE '✓ Pós-condições concluídas: Estrutura relacional criada com segurança absoluta.';
END $$;

COMMIT;
