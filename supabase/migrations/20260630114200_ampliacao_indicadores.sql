-- Migração: Ampliação de Indicadores do Relatório Espiritual
ALTER TABLE public.relatorio_espiritual_registros
  ADD COLUMN IF NOT EXISTS batismos_espirito_santo INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS curas_divinas INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evangelismos_realizados INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reconciliacoes INT NOT NULL DEFAULT 0;
