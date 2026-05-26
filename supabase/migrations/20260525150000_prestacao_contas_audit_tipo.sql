-- ============================================================================
-- Módulo: Prestação de Contas Oficial — Extensão tipo_auditoria
-- Migration: 20260525150000
-- ============================================================================

BEGIN;

-- Extende o CHECK de tipo_auditoria para incluir 'prestacao_contas'
ALTER TABLE public.financial_audit_logs
  DROP CONSTRAINT audit_tipo_valido,
  ADD CONSTRAINT audit_tipo_valido CHECK (
    tipo_auditoria IN ('manual', 'automatico', 'prestacao_contas')
  );

COMMIT;
