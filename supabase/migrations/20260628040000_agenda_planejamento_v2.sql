-- Migração: Publicação do Planejamento v2
-- Adiciona campos de publicação em agenda_planejamentos e regra_posicionamento em agenda_eventos

BEGIN;

-- 1. Campos de publicação em agenda_planejamentos
ALTER TABLE public.agenda_planejamentos ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE public.agenda_planejamentos ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Regra de posicionamento em agenda_eventos
ALTER TABLE public.agenda_eventos ADD COLUMN IF NOT EXISTS regra_posicionamento TEXT;

COMMIT;
