-- =============================================================================
-- Módulo Eventos: Hospedagem + Programação
-- Adiciona suporte a hospedagem por evento e por inscrição,
-- além de campo de programação (schedule) do evento.
-- =============================================================================

BEGIN;

-- ─── 1. Campos de hospedagem e programação na tabela eventos ─────────────────
ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS inclui_hospedagem     BOOLEAN    NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vagas_hospedagem      INTEGER,                    -- NULL = sem limite
  ADD COLUMN IF NOT EXISTS descricao_hospedagem  TEXT,
  ADD COLUMN IF NOT EXISTS programacao           TEXT;                       -- cronograma/pauta livre

-- ─── 2. Campos de hospedagem na tabela eventos_inscricoes ────────────────────
ALTER TABLE public.eventos_inscricoes
  ADD COLUMN IF NOT EXISTS com_hospedagem     BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS status_hospedagem  VARCHAR(20) NOT NULL DEFAULT 'nao_aplicavel';

ALTER TABLE public.eventos_inscricoes
  DROP CONSTRAINT IF EXISTS hospedagem_status_valido;

ALTER TABLE public.eventos_inscricoes
  ADD CONSTRAINT hospedagem_status_valido CHECK (
    status_hospedagem IN ('nao_aplicavel','solicitada','confirmada','lista_espera','cancelada')
  );

-- ─── 3. Índice para consultas de hospedagem por evento ───────────────────────
CREATE INDEX IF NOT EXISTS idx_inscricoes_hospedagem
  ON public.eventos_inscricoes(evento_id, com_hospedagem)
  WHERE com_hospedagem = TRUE;

COMMIT;
