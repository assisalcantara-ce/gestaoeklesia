-- ============================================================================
-- Módulo: Auditoria Financeira — Log de Execuções
-- Migration: 20260524210000
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id     UUID        NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  executado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo_auditoria  VARCHAR(50) NOT NULL DEFAULT 'manual',
  -- 'manual' | 'automatico'
  resultado       VARCHAR(20) NOT NULL DEFAULT 'concluido',
  -- 'concluido' | 'erro'
  total_alertas   INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT audit_tipo_valido CHECK (tipo_auditoria IN ('manual', 'automatico')),
  CONSTRAINT audit_resultado_valido CHECK (resultado IN ('concluido', 'erro'))
);

CREATE INDEX IF NOT EXISTS idx_fal_ministry    ON public.financial_audit_logs(ministry_id);
CREATE INDEX IF NOT EXISTS idx_fal_executado   ON public.financial_audit_logs(executado_em DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fal_select ON public.financial_audit_logs;
DROP POLICY IF EXISTS fal_insert ON public.financial_audit_logs;

-- SELECT: ADMINISTRADOR, FINANCEIRO ou dono do ministério
CREATE POLICY "fal_select" ON public.financial_audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = financial_audit_logs.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = financial_audit_logs.ministry_id AND m.user_id = auth.uid()
    )
  );

-- INSERT: ADMINISTRADOR, FINANCEIRO ou dono do ministério
CREATE POLICY "fal_insert" ON public.financial_audit_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = financial_audit_logs.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = financial_audit_logs.ministry_id AND m.user_id = auth.uid()
    )
  );

COMMIT;
