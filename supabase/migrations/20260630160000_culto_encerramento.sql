-- Sprint 4: Campos de Encerramento Oficial do Culto
-- Adiciona dados de participação, resultados espirituais e auditoria de encerramento

ALTER TABLE public.culto_registros
  ADD COLUMN IF NOT EXISTS membros_presentes       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visitantes_presentes    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS almas_alcancadas        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reconciliacoes          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS batismos_espirito_santo INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS curas_divinas           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS biblias_doadas          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS literaturas_entregues   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS membros_cearam          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacoes_encerramento TEXT,
  ADD COLUMN IF NOT EXISTS encerrado_em            TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS encerrado_por           UUID REFERENCES auth.users(id);
