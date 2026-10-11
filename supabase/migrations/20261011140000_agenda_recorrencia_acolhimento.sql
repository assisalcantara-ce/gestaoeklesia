-- Migration: Agenda Recorrente e Integração com o Módulo de Cultos (Acolhimento)
-- Data: 2026-10-11
-- Observação: Não destrutiva, idempotente e preserva integridade histórica

BEGIN;

-- 1. Ampliar a tabela agenda_eventos com campos de parametrização de recorrência
ALTER TABLE public.agenda_eventos
  ADD COLUMN IF NOT EXISTS recorrencia_tipo VARCHAR(30) DEFAULT 'nenhuma',
  ADD COLUMN IF NOT EXISTS recorrencia_config JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recorrencia_pai_id UUID REFERENCES public.agenda_eventos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS excecao_datas JSONB DEFAULT '[]'::jsonb;

-- Índices para otimizar busca e filtragem por série recorrente
CREATE INDEX IF NOT EXISTS idx_agenda_eventos_recorrencia_pai
  ON public.agenda_eventos(recorrencia_pai_id);

CREATE INDEX IF NOT EXISTS idx_agenda_eventos_ministry_recorrencia
  ON public.agenda_eventos(ministry_id, recorrencia_tipo);

-- 2. Integrar a tabela culto_registros com a Agenda oficial
-- Permite vincular registros operacionais de culto ao evento programado na agenda
ALTER TABLE public.culto_registros
  ADD COLUMN IF NOT EXISTS agenda_evento_id UUID REFERENCES public.agenda_eventos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_culto_registros_agenda_evento
  ON public.culto_registros(agenda_evento_id);

CREATE INDEX IF NOT EXISTS idx_culto_registros_ministry_data
  ON public.culto_registros(ministry_id, congregacao_id, data_culto);

COMMIT;
