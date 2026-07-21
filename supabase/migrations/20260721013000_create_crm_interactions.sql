-- Migration: criar tabela crm_interactions
CREATE TABLE IF NOT EXISTS public.crm_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ministry_id UUID NULL,
    tipo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    proxima_acao TEXT NULL,
    data_proxima_acao TIMESTAMPTZ NULL,
    created_by TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_crm_interactions_ministry_id ON public.crm_interactions(ministry_id);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_created_at ON public.crm_interactions(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS permissivas para o serviço admin/service_role
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'crm_interactions' AND policyname = 'Allow service_role full access on crm_interactions'
    ) THEN
        CREATE POLICY "Allow service_role full access on crm_interactions"
            ON public.crm_interactions
            FOR ALL
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
