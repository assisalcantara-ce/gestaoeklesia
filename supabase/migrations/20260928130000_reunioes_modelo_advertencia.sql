-- ============================================================
-- MÓDULO REUNIÕES — MODELO OFICIAL DE CARTA DE ADVERTÊNCIA POR TENANT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reunioes_modelos_advertencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
    nome_arquivo_original TEXT NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'cartas-templates',
    storage_path TEXT NOT NULL,
    tamanho_bytes BIGINT,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    ativo BOOLEAN NOT NULL DEFAULT true,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_reunioes_modelos_advertencia_ministry UNIQUE (ministry_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_reunioes_modelos_adv_ministry ON public.reunioes_modelos_advertencia (ministry_id);

-- RLS
ALTER TABLE public.reunioes_modelos_advertencia ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "reunioes_modelos_advertencia_select_tenant" ON public.reunioes_modelos_advertencia;
CREATE POLICY "reunioes_modelos_advertencia_select_tenant"
    ON public.reunioes_modelos_advertencia
    FOR SELECT
    USING (
        ministry_id IN (
            SELECT ministry_id FROM public.users WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "reunioes_modelos_advertencia_all_tenant" ON public.reunioes_modelos_advertencia;
CREATE POLICY "reunioes_modelos_advertencia_all_tenant"
    ON public.reunioes_modelos_advertencia
    FOR ALL
    USING (
        ministry_id IN (
            SELECT ministry_id FROM public.users WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        ministry_id IN (
            SELECT ministry_id FROM public.users WHERE id = auth.uid()
        )
    );
