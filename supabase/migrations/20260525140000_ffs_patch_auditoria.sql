-- Fase C — Entrega 4 — Patch de Auditoria (pós-validação técnica)
-- Corrige 5 falhas identificadas na auditoria:
-- 1. Remove PRESIDENCIA da política ffs_insert
-- 2. Adiciona UPDATE policy para revogar assinaturas (sem DELETE físico)
-- 3. Adiciona coluna revogado_em para manter histórico completo
-- 4. Constraint UNIQUE parcial: mesmo usuário não pode assinar duas vezes o mesmo parecer ativo
-- 5. Adiciona 'finalizacao_parecer' às ações permitidas no log

BEGIN;

-- ── 1. Coluna revogado_em: mantém histórico de assinaturas revogadas ──────────
-- Reabertura de parecer agora revoga (soft-delete) as assinaturas,
-- preservando trilha de auditoria completa.

ALTER TABLE public.financial_fiscal_signatures
  ADD COLUMN IF NOT EXISTS revogado_em TIMESTAMPTZ;

-- ── 2. Constraint de assinatura única ativa por usuário por parecer ───────────
-- Impede que o mesmo usuário (não-nulo) assine duas vezes o mesmo parecer ativo.
-- Assinaturas revogadas (revogado_em IS NOT NULL) não participam da restrição,
-- permitindo nova assinatura após reabertura.

CREATE UNIQUE INDEX IF NOT EXISTS uq_ffs_review_usuario_ativo
  ON public.financial_fiscal_signatures (review_id, usuario_id)
  WHERE usuario_id IS NOT NULL AND revogado_em IS NULL;

-- ── 3. Adiciona 'finalizacao_parecer' às ações de log ────────────────────────

ALTER TABLE public.tesouraria_fechamento_logs
  DROP CONSTRAINT IF EXISTS tesouraria_flog_acao_check;

ALTER TABLE public.tesouraria_fechamento_logs
  ADD CONSTRAINT tesouraria_flog_acao_check CHECK (
    acao IN (
      'fechamento', 'reabertura', 'revisao',
      'emissao_parecer', 'assinatura', 'revogacao',
      'reabertura_parecer', 'finalizacao_parecer'
    )
  );

-- ── 4. Corrige ffs_insert: remove PRESIDENCIA ─────────────────────────────────
-- Requisito: PRESIDENCIA visualiza mas NÃO assina pareceres.
-- Apenas ADMINISTRADOR, CONSELHO_FISCAL e dono do ministério podem assinar.

DROP POLICY IF EXISTS ffs_insert ON public.financial_fiscal_signatures;

CREATE POLICY "ffs_insert" ON public.financial_fiscal_signatures FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = financial_fiscal_signatures.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["CONSELHO_FISCAL"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = financial_fiscal_signatures.ministry_id AND m.user_id = auth.uid()
    )
  );

-- ── 5. Política UPDATE para revogar assinaturas ───────────────────────────────
-- Permite que ADMINISTRADOR e dono do ministério marquem revogado_em.
-- Usado pela operação de reabertura de parecer (em substituição ao DELETE).

DROP POLICY IF EXISTS ffs_update ON public.financial_fiscal_signatures;

CREATE POLICY "ffs_update" ON public.financial_fiscal_signatures FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = financial_fiscal_signatures.ministry_id
        AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = financial_fiscal_signatures.ministry_id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = financial_fiscal_signatures.ministry_id
        AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = financial_fiscal_signatures.ministry_id AND m.user_id = auth.uid()
    )
  );

COMMIT;
