-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Vínculo Oficial Idempotente entre Agenda Ministerial e Reuniões
-- Data: 2026-11-16
-- Observação: Não destrutiva, idempotente e estritamente estrutural.
--             Preserva integralmente registros legados sem associação retroativa automática.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Adicionar coluna agenda_evento_id à tabela reunioes
ALTER TABLE public.reunioes
  ADD COLUMN IF NOT EXISTS agenda_evento_id UUID REFERENCES public.agenda_eventos(id) ON DELETE SET NULL;

-- 2. Índice para consultas de performance por evento de agenda
CREATE INDEX IF NOT EXISTS idx_reunioes_agenda_evento
  ON public.reunioes(agenda_evento_id);

-- 3. Unicidade parcial: um evento da agenda só pode gerar no máximo uma reunião ministerial por ministério
CREATE UNIQUE INDEX IF NOT EXISTS idx_reunioes_ministry_agenda_evento_uniq
  ON public.reunioes(ministry_id, agenda_evento_id)
  WHERE agenda_evento_id IS NOT NULL;

COMMIT;
