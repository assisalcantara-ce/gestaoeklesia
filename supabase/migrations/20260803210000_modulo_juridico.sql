-- ============================================================================
-- MIGRATION: Módulo Jurídico (Documentos, Aceites e Contratos)
-- Data: 2026-08-03
-- Tabelas:
--   1. documentos_juridicos (Termos de Uso, Políticas de Privacidade, Contratos Padrão, Aditivos)
--   2. tenant_aceites (Registro imutável de aceite de termos/documentos por usuários/tenants)
--   3. tenant_contratos (Gestão de vigência, assinatura e customização de contratos do tenant)
-- ============================================================================

-- 1. TABELA: documentos_juridicos
CREATE TABLE IF NOT EXISTS public.documentos_juridicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_raiz_id UUID,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('TERMOS_DE_USO', 'POLITICA_PRIVACIDADE', 'CONTRATO_SERVICO', 'ADITIVO', 'OUTRO')),
    titulo VARCHAR(255) NOT NULL,
    versao VARCHAR(20) NOT NULL,
    conteudo_md TEXT NOT NULL,
    conteudo_html TEXT,
    hash_sha256 VARCHAR(64),
    status VARCHAR(20) NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'PUBLICADO', 'ARQUIVADO')),
    obrigatorio BOOLEAN NOT NULL DEFAULT true,
    ativo BOOLEAN NOT NULL DEFAULT true,
    publicado_em TIMESTAMPTZ,
    criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_documentos_juridicos_tipo_versao UNIQUE (tipo, versao)
);

-- Trigger para definir documento_raiz_id por padrão igual ao próprio id se for nulo na inserção
CREATE OR REPLACE FUNCTION set_documentos_juridicos_raiz_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.documento_raiz_id IS NULL THEN
        NEW.documento_raiz_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_documentos_juridicos_raiz_id ON public.documentos_juridicos;
CREATE TRIGGER trg_set_documentos_juridicos_raiz_id
    BEFORE INSERT ON public.documentos_juridicos
    FOR EACH ROW EXECUTE FUNCTION set_documentos_juridicos_raiz_id();

-- Índices documentos_juridicos
CREATE INDEX IF NOT EXISTS idx_documentos_juridicos_raiz_id ON public.documentos_juridicos(documento_raiz_id);
CREATE INDEX IF NOT EXISTS idx_documentos_juridicos_tipo_ativo ON public.documentos_juridicos(tipo, ativo);
CREATE INDEX IF NOT EXISTS idx_documentos_juridicos_status ON public.documentos_juridicos(status);
CREATE INDEX IF NOT EXISTS idx_documentos_juridicos_publicado_em ON public.documentos_juridicos(publicado_em DESC);

-- Trigger de updated_at para documentos_juridicos
CREATE OR REPLACE FUNCTION update_documentos_juridicos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_documentos_juridicos_updated_at ON public.documentos_juridicos;
CREATE TRIGGER trg_update_documentos_juridicos_updated_at
    BEFORE UPDATE ON public.documentos_juridicos
    FOR EACH ROW EXECUTE FUNCTION update_documentos_juridicos_updated_at();

-- RLS documentos_juridicos
ALTER TABLE public.documentos_juridicos ENABLE ROW LEVEL SECURITY;

-- Leitura pública / autenticada de documentos publicados e ativos
CREATE POLICY "Permitir leitura de documentos jurídicos publicados"
    ON public.documentos_juridicos
    FOR SELECT
    USING (ativo = true AND status = 'PUBLICADO');

-- Apenas Super Admins / Admins de Plataforma podem gerenciar documentos jurídicos
CREATE POLICY "Permitir gestão de documentos para super_admin"
    ON public.documentos_juridicos
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.ministry_users mu
            WHERE mu.user_id = auth.uid()
            AND mu.role IN ('super_admin', 'admin')
        )
    );

-- ----------------------------------------------------------------------------

-- 2. TABELA: tenant_aceites
CREATE TABLE IF NOT EXISTS public.tenant_aceites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    documento_id UUID NOT NULL REFERENCES public.documentos_juridicos(id) ON DELETE RESTRICT,
    versao_aceita VARCHAR(20) NOT NULL,
    hash_documento VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    payload_aceite JSONB DEFAULT '{}'::jsonb,
    aceito_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_tenant_aceite_user_documento_versao UNIQUE (ministry_id, user_id, documento_id, versao_aceita)
);

-- Índices tenant_aceites
CREATE INDEX IF NOT EXISTS idx_tenant_aceites_ministry_id ON public.tenant_aceites(ministry_id);
CREATE INDEX IF NOT EXISTS idx_tenant_aceites_user_id ON public.tenant_aceites(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_aceites_documento_id ON public.tenant_aceites(documento_id);
CREATE INDEX IF NOT EXISTS idx_tenant_aceites_aceito_em ON public.tenant_aceites(aceito_em DESC);

-- RLS tenant_aceites
ALTER TABLE public.tenant_aceites ENABLE ROW LEVEL SECURITY;

-- Usuários podem visualizar aceites do próprio ministério
CREATE POLICY "Permitir leitura de aceites do próprio tenant"
    ON public.tenant_aceites
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.ministry_users mu
            WHERE mu.user_id = auth.uid()
            AND mu.ministry_id = tenant_aceites.ministry_id
        )
    );

-- Usuários podem inserir seus próprios aceites
CREATE POLICY "Permitir inserção de aceites do próprio usuário"
    ON public.tenant_aceites
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
    );

-- ----------------------------------------------------------------------------

-- 3. TABELA: tenant_contratos
CREATE TABLE IF NOT EXISTS public.tenant_contratos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
    documento_base_id UUID REFERENCES public.documentos_juridicos(id) ON DELETE SET NULL,
    documento_raiz_id UUID,
    versao_documento VARCHAR(20),
    hash_documento VARCHAR(64),
    plano_contratado VARCHAR(50),
    numero_contrato VARCHAR(50),
    status VARCHAR(30) NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'AGUARDANDO_ASSINATURA', 'ATIVO', 'CANCELADO', 'EXPIRADO', 'RESCINDIDO')),
    conteudo_customizado TEXT,
    valor_mensal NUMERIC(10,2),
    data_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_fim TIMESTAMPTZ,
    assinado_em TIMESTAMPTZ,
    assinado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices tenant_contratos
CREATE INDEX IF NOT EXISTS idx_tenant_contratos_ministry_id ON public.tenant_contratos(ministry_id);
CREATE INDEX IF NOT EXISTS idx_tenant_contratos_status ON public.tenant_contratos(status);
CREATE INDEX IF NOT EXISTS idx_tenant_contratos_data_inicio ON public.tenant_contratos(data_inicio);

-- Trigger de updated_at para tenant_contratos
CREATE OR REPLACE FUNCTION update_tenant_contratos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_tenant_contratos_updated_at ON public.tenant_contratos;
CREATE TRIGGER trg_update_tenant_contratos_updated_at
    BEFORE UPDATE ON public.tenant_contratos
    FOR EACH ROW EXECUTE FUNCTION update_tenant_contratos_updated_at();

-- RLS tenant_contratos
ALTER TABLE public.tenant_contratos ENABLE ROW LEVEL SECURITY;

-- Integrantes do ministério podem visualizar o contrato do tenant
CREATE POLICY "Permitir leitura dos contratos do próprio tenant"
    ON public.tenant_contratos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.ministry_users mu
            WHERE mu.user_id = auth.uid()
            AND mu.ministry_id = tenant_contratos.ministry_id
        )
    );

-- Apenas administradores do sistema ou super admins podem gerenciar contratos
CREATE POLICY "Permitir gestão de contratos para super_admin"
    ON public.tenant_contratos
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.ministry_users mu
            WHERE mu.user_id = auth.uid()
            AND mu.role IN ('super_admin', 'admin')
        )
    );
