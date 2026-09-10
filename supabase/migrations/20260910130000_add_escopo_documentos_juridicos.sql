-- ============================================================================
-- MIGRATION: Adicionar escopo (INDIVIDUAL | INSTITUCIONAL) em documentos_juridicos
-- Data: 2026-09-10
-- ============================================================================

ALTER TABLE public.documentos_juridicos
ADD COLUMN IF NOT EXISTS escopo VARCHAR(20) NOT NULL DEFAULT 'INDIVIDUAL'
CHECK (escopo IN ('INDIVIDUAL', 'INSTITUCIONAL'));

-- Atualizar registros existentes com base nas regras de negócio:
-- TERMOS_DE_USO e POLITICA_PRIVACIDADE -> INDIVIDUAL
-- CONTRATO_SERVICO e ADITIVO -> INSTITUCIONAL

UPDATE public.documentos_juridicos
SET escopo = 'INDIVIDUAL'
WHERE tipo IN ('TERMOS_DE_USO', 'POLITICA_PRIVACIDADE');

UPDATE public.documentos_juridicos
SET escopo = 'INSTITUCIONAL'
WHERE tipo IN ('CONTRATO_SERVICO', 'ADITIVO');

-- Índice para acelerar busca por escopo e status
CREATE INDEX IF NOT EXISTS idx_documentos_juridicos_escopo ON public.documentos_juridicos(escopo);
