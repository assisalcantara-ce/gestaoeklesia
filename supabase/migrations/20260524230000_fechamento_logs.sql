-- FASE C — ENTREGA 2 — Log de Fechamentos por Congregação
-- Rastreia ações de fechamento, reabertura e revisão por congregação.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tesouraria_fechamento_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id   UUID        NOT NULL REFERENCES public.tesouraria_fechamentos(id) ON DELETE CASCADE,
  congregacao_id  UUID        REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  usuario_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  acao            VARCHAR(30) NOT NULL DEFAULT 'fechamento',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tesouraria_flog_acao_check
    CHECK (acao IN ('fechamento', 'reabertura', 'revisao'))
);

CREATE INDEX IF NOT EXISTS idx_flog_fechamento  ON public.tesouraria_fechamento_logs (fechamento_id);
CREATE INDEX IF NOT EXISTS idx_flog_congregacao ON public.tesouraria_fechamento_logs (congregacao_id);
CREATE INDEX IF NOT EXISTS idx_flog_usuario     ON public.tesouraria_fechamento_logs (usuario_id);
CREATE INDEX IF NOT EXISTS idx_flog_created_at  ON public.tesouraria_fechamento_logs (created_at DESC);

ALTER TABLE public.tesouraria_fechamento_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: ADMINISTRADOR, FINANCEIRO ou dono do ministério
DROP POLICY IF EXISTS "tesouraria_flog_select" ON public.tesouraria_fechamento_logs;
CREATE POLICY "tesouraria_flog_select"
  ON public.tesouraria_fechamento_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.tesouraria_fechamentos tf
      JOIN   public.ministry_users mu ON mu.ministry_id = tf.ministry_id
      WHERE  tf.id = tesouraria_fechamento_logs.fechamento_id
        AND  mu.user_id = auth.uid()
        AND  (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1
      FROM   public.tesouraria_fechamentos tf
      JOIN   public.ministries m ON m.id = tf.ministry_id
      WHERE  tf.id = tesouraria_fechamento_logs.fechamento_id
        AND  m.user_id = auth.uid()
    )
  );

-- INSERT: mesmos critérios do SELECT
DROP POLICY IF EXISTS "tesouraria_flog_insert" ON public.tesouraria_fechamento_logs;
CREATE POLICY "tesouraria_flog_insert"
  ON public.tesouraria_fechamento_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.tesouraria_fechamentos tf
      JOIN   public.ministry_users mu ON mu.ministry_id = tf.ministry_id
      WHERE  tf.id = tesouraria_fechamento_logs.fechamento_id
        AND  mu.user_id = auth.uid()
        AND  (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
        )
    )
    OR EXISTS (
      SELECT 1
      FROM   public.tesouraria_fechamentos tf
      JOIN   public.ministries m ON m.id = tf.ministry_id
      WHERE  tf.id = tesouraria_fechamento_logs.fechamento_id
        AND  m.user_id = auth.uid()
    )
  );

COMMIT;
