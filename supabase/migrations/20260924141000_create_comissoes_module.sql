-- Migration: 20260924141000_create_comissoes_module.sql
-- Módulo: Gestão de Comissões e Integrantes (Ministros)
-- Descrição: Estrutura de persistência, constraints multi-tenant rígidas, trigger de validação e RLS com idempotência e owner fallback.

-- 1. Criar tabela public.comissoes
CREATE TABLE IF NOT EXISTS public.comissoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'inativa')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_comissoes_id_ministry UNIQUE (id, ministry_id)
);

-- Índices para public.comissoes
CREATE INDEX IF NOT EXISTS idx_comissoes_ministry_id ON public.comissoes(ministry_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_status ON public.comissoes(status);
CREATE INDEX IF NOT EXISTS idx_comissoes_nome ON public.comissoes(nome);

-- 2. Criar tabela public.comissao_integrantes
CREATE TABLE IF NOT EXISTS public.comissao_integrantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
    comissao_id UUID NOT NULL,
    member_id UUID NOT NULL,
    cargo TEXT NOT NULL DEFAULT 'Membro',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Chave de unicidade: 1 ministro por comissão (permite o ministro em várias comissões distintas)
    CONSTRAINT uq_comissao_integrante UNIQUE (comissao_id, member_id),
    -- FK Composta para comissao: garante que a comissão pertence ao mesmo ministry_id
    CONSTRAINT fk_comissao_integrante_comissao 
        FOREIGN KEY (comissao_id, ministry_id) 
        REFERENCES public.comissoes(id, ministry_id) 
        ON DELETE CASCADE,
    -- FK para members
    CONSTRAINT fk_comissao_integrante_member 
        FOREIGN KEY (member_id) 
        REFERENCES public.members(id) 
        ON DELETE CASCADE
);

-- Índices para public.comissao_integrantes
CREATE INDEX IF NOT EXISTS idx_comissao_integrantes_ministry_id ON public.comissao_integrantes(ministry_id);
CREATE INDEX IF NOT EXISTS idx_comissao_integrantes_comissao_id ON public.comissao_integrantes(comissao_id);
CREATE INDEX IF NOT EXISTS idx_comissao_integrantes_member_id ON public.comissao_integrantes(member_id);

-- 3. Função e Trigger para validação estrita de Integridade Multi-Tenant no Banco
-- Garante no nível de banco de dados (DML) que o member_id pertence exatamente ao mesmo ministry_id
CREATE OR REPLACE FUNCTION public.check_comissao_integrante_tenant_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_member_ministry_id UUID;
    v_member_tipo TEXT;
BEGIN
    -- Validar se o member pertence ao mesmo ministério
    SELECT ministry_id, tipo_cadastro INTO v_member_ministry_id, v_member_tipo
    FROM public.members
    WHERE id = NEW.member_id;

    IF v_member_ministry_id IS NULL THEN
        RAISE EXCEPTION 'Membro/Ministro informado não existe.';
    END IF;

    IF v_member_ministry_id <> NEW.ministry_id THEN
        RAISE EXCEPTION 'Violação de integridade multi-tenant: o membro informado pertence a outro ministério.';
    END IF;

    IF LOWER(COALESCE(v_member_tipo, '')) <> 'ministro' THEN
        RAISE EXCEPTION 'Apenas membros com tipo_cadastro = ministro podem ser adicionados a comissões.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_comissao_integrante_tenant_integrity ON public.comissao_integrantes;
CREATE TRIGGER trg_comissao_integrante_tenant_integrity
BEFORE INSERT OR UPDATE ON public.comissao_integrantes
FOR EACH ROW
EXECUTE FUNCTION public.check_comissao_integrante_tenant_integrity();

-- 4. Configurar RLS (Row Level Security)

-- Habilitar RLS nas tabelas
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissao_integrantes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Políticas RLS para public.comissoes (com Idempotência e Fallback do Proprietário)
-- ============================================================================

DROP POLICY IF EXISTS "Permitir SELECT para usuarios do mesmo ministerio em comissoes" ON public.comissoes;
CREATE POLICY "Permitir SELECT para usuarios do mesmo ministerio em comissoes"
ON public.comissoes
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM public.ministry_users mu 
        WHERE mu.user_id = auth.uid() 
          AND mu.ministry_id = public.comissoes.ministry_id
    )
    OR EXISTS (
        SELECT 1 
        FROM public.ministries m 
        WHERE m.id = public.comissoes.ministry_id 
          AND m.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Permitir INSERT para usuarios do mesmo ministerio em comissoes" ON public.comissoes;
CREATE POLICY "Permitir INSERT para usuarios do mesmo ministerio em comissoes"
ON public.comissoes
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM public.ministry_users mu 
        WHERE mu.user_id = auth.uid() 
          AND mu.ministry_id = public.comissoes.ministry_id
    )
    OR EXISTS (
        SELECT 1 
        FROM public.ministries m 
        WHERE m.id = public.comissoes.ministry_id 
          AND m.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Permitir UPDATE para usuarios do mesmo ministerio em comissoes" ON public.comissoes;
CREATE POLICY "Permitir UPDATE para usuarios do mesmo ministerio em comissoes"
ON public.comissoes
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM public.ministry_users mu 
        WHERE mu.user_id = auth.uid() 
          AND mu.ministry_id = public.comissoes.ministry_id
    )
    OR EXISTS (
        SELECT 1 
        FROM public.ministries m 
        WHERE m.id = public.comissoes.ministry_id 
          AND m.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM public.ministry_users mu 
        WHERE mu.user_id = auth.uid() 
          AND mu.ministry_id = public.comissoes.ministry_id
    )
    OR EXISTS (
        SELECT 1 
        FROM public.ministries m 
        WHERE m.id = public.comissoes.ministry_id 
          AND m.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Permitir DELETE para usuarios do mesmo ministerio em comissoes" ON public.comissoes;
CREATE POLICY "Permitir DELETE para usuarios do mesmo ministerio em comissoes"
ON public.comissoes
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM public.ministry_users mu 
        WHERE mu.user_id = auth.uid() 
          AND mu.ministry_id = public.comissoes.ministry_id
    )
    OR EXISTS (
        SELECT 1 
        FROM public.ministries m 
        WHERE m.id = public.comissoes.ministry_id 
          AND m.user_id = auth.uid()
    )
);

-- =======================================================================================
-- Políticas RLS para public.comissao_integrantes (com Idempotência e Fallback do Proprietário)
-- =======================================================================================

DROP POLICY IF EXISTS "Permitir SELECT para usuarios do mesmo ministerio em comissao_integrantes" ON public.comissao_integrantes;
CREATE POLICY "Permitir SELECT para usuarios do mesmo ministerio em comissao_integrantes"
ON public.comissao_integrantes
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM public.ministry_users mu 
        WHERE mu.user_id = auth.uid() 
          AND mu.ministry_id = public.comissao_integrantes.ministry_id
    )
    OR EXISTS (
        SELECT 1 
        FROM public.ministries m 
        WHERE m.id = public.comissao_integrantes.ministry_id 
          AND m.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Permitir INSERT para usuarios do mesmo ministerio em comissao_integrantes" ON public.comissao_integrantes;
CREATE POLICY "Permitir INSERT para usuarios do mesmo ministerio em comissao_integrantes"
ON public.comissao_integrantes
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM public.ministry_users mu 
        WHERE mu.user_id = auth.uid() 
          AND mu.ministry_id = public.comissao_integrantes.ministry_id
    )
    OR EXISTS (
        SELECT 1 
        FROM public.ministries m 
        WHERE m.id = public.comissao_integrantes.ministry_id 
          AND m.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Permitir UPDATE para usuarios do mesmo ministerio em comissao_integrantes" ON public.comissao_integrantes;
CREATE POLICY "Permitir UPDATE para usuarios do mesmo ministerio em comissao_integrantes"
ON public.comissao_integrantes
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM public.ministry_users mu 
        WHERE mu.user_id = auth.uid() 
          AND mu.ministry_id = public.comissao_integrantes.ministry_id
    )
    OR EXISTS (
        SELECT 1 
        FROM public.ministries m 
        WHERE m.id = public.comissao_integrantes.ministry_id 
          AND m.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM public.ministry_users mu 
        WHERE mu.user_id = auth.uid() 
          AND mu.ministry_id = public.comissao_integrantes.ministry_id
    )
    OR EXISTS (
        SELECT 1 
        FROM public.ministries m 
        WHERE m.id = public.comissao_integrantes.ministry_id 
          AND m.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Permitir DELETE para usuarios do mesmo ministerio em comissao_integrantes" ON public.comissao_integrantes;
CREATE POLICY "Permitir DELETE para usuarios do mesmo ministerio em comissao_integrantes"
ON public.comissao_integrantes
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM public.ministry_users mu 
        WHERE mu.user_id = auth.uid() 
          AND mu.ministry_id = public.comissao_integrantes.ministry_id
    )
    OR EXISTS (
        SELECT 1 
        FROM public.ministries m 
        WHERE m.id = public.comissao_integrantes.ministry_id 
          AND m.user_id = auth.uid()
    )
);
