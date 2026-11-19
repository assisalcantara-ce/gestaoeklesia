-- Migration: Criar tabela para vínculos familiares (filhos / parentesco)
-- Data: 2026-11-19
-- Status: PENDENTE (NÃO APLICAR DIRETAMENTE EM PRODUÇÃO SEM AUTORIZAÇÃO)

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

-- Índices para buscas rápidas e isolamento por tenant
CREATE INDEX IF NOT EXISTS idx_family_relations_ministry_parent 
    ON public.member_family_relations(ministry_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_family_relations_ministry_child 
    ON public.member_family_relations(ministry_id, child_id);

-- RLS (Row Level Security)
ALTER TABLE public.member_family_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for member_family_relations"
    ON public.member_family_relations
    FOR ALL
    USING (
        ministry_id IN (
            SELECT ministry_id FROM public.ministry_users 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        ministry_id IN (
            SELECT ministry_id FROM public.ministry_users 
            WHERE user_id = auth.uid()
        )
    );
