-- Migration: Adicionar campos de governança de integridade jurídica em tenant_contratos

ALTER TABLE tenant_contratos
  ADD COLUMN IF NOT EXISTS snapshot_status VARCHAR(50) DEFAULT 'INTEGRO_IMUTAVEL',
  ADD COLUMN IF NOT EXISTS origem_snapshot VARCHAR(50) DEFAULT 'CELEBRACAO_ORIGINAL',
  ADD COLUMN IF NOT EXISTS integridade_verificada BOOLEAN DEFAULT TRUE;

-- Adicionar constraints de validação de domínios
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tenant_contratos_snapshot_status'
  ) THEN
    ALTER TABLE tenant_contratos
      ADD CONSTRAINT chk_tenant_contratos_snapshot_status
      CHECK (snapshot_status IN ('INTEGRO_IMUTAVEL', 'RECONSTRUIDO_HISTORICO', 'HERDADO_MATRIZ', 'REQUER_REGULARIZACAO'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tenant_contratos_origem_snapshot'
  ) THEN
    ALTER TABLE tenant_contratos
      ADD CONSTRAINT chk_tenant_contratos_origem_snapshot
      CHECK (origem_snapshot IN ('CELEBRACAO_ORIGINAL', 'MIGRATION_SANEAMENTO', 'MODELO_BASE'));
  END IF;
END $$;
