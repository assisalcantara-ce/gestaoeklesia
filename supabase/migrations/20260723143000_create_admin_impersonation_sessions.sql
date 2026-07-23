-- Migration: 20260723143000_create_admin_impersonation_sessions.sql
-- Descrição: Tabela dedicada para auditoria especializada e controle de sessões de Admin Impersonation

CREATE TABLE IF NOT EXISTS admin_impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admin_users(id),
  tenant_id UUID NOT NULL REFERENCES ministries(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  ended_by VARCHAR(50) CHECK (ended_by IN ('user_action', 'timeout', 'security_revocation')),
  reason TEXT NOT NULL,
  read_only BOOLEAN NOT NULL DEFAULT FALSE,
  ip VARCHAR(45) NOT NULL,
  user_agent TEXT NOT NULL,
  jwt_id VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'completed', 'expired', 'revoked')) DEFAULT 'active'
);

-- Índices de alta performance
CREATE INDEX IF NOT EXISTS idx_impersonation_admin_status ON admin_impersonation_sessions(admin_id, status);
CREATE INDEX IF NOT EXISTS idx_impersonation_tenant ON admin_impersonation_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_jwt ON admin_impersonation_sessions(jwt_id);
