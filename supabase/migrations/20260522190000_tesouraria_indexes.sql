-- =============================================================================
-- Índices compostos para a Tesouraria
-- Resolve gargalo de queries que filtram (ministry_id + data_lancamento)
-- sem índice composto, forçando seq scan + filter heap.
-- =============================================================================

BEGIN;

-- ─── Índice composto principal ────────────────────────────────────────────────
-- Cobre as queries:
--   carregarLancamentosMes  → WHERE ministry_id = ? AND data_lancamento >= ? AND < ?
--   carregarGrafico12Meses  → WHERE ministry_id = ? AND data_lancamento >= ?
--   handleFecharMes         → WHERE ministry_id = ? AND data_lancamento >= ? AND < ?
--   carregarRelatorio       → WHERE ministry_id = ? AND data_lancamento >= ? AND < ?
CREATE INDEX IF NOT EXISTS idx_tesouraria_ministry_data
  ON public.tesouraria_lancamentos(ministry_id, data_lancamento DESC);

-- ─── Índice composto com congregacao ─────────────────────────────────────────
-- Cobre queries de FINANCEIRO_LOCAL que sempre filtram pelos três campos:
--   WHERE ministry_id = ? AND congregacao_id = ? AND data_lancamento >= ? AND < ?
CREATE INDEX IF NOT EXISTS idx_tesouraria_ministry_cong_data
  ON public.tesouraria_lancamentos(ministry_id, congregacao_id, data_lancamento DESC);

-- ─── Índice composto para fechamentos ─────────────────────────────────────────
-- Cobre a query do trigger fn_bloquear_periodo_fechado e do load() de fechamentos:
--   WHERE ministry_id = ? AND mes_referencia = ?
CREATE INDEX IF NOT EXISTS idx_fechamentos_ministry_mes
  ON public.tesouraria_fechamentos(ministry_id, mes_referencia);

COMMIT;
