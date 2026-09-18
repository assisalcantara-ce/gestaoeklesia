-- Migration: Adicionar congregacao_id aos registros de Atos Eclesiasticos
-- Tabelas: apresentacao_criancas_registros, batismo_aguas_registros, casamento_registros

BEGIN;

-- 1. Apresentacao de Criancas Registros
ALTER TABLE public.apresentacao_criancas_registros
  ADD COLUMN IF NOT EXISTS congregacao_id UUID;

DO $$
BEGIN
  IF to_regclass('public.congregacoes') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_apresentacao_registros_congregacao'
  ) THEN
    ALTER TABLE public.apresentacao_criancas_registros
      ADD CONSTRAINT fk_apresentacao_registros_congregacao
      FOREIGN KEY (congregacao_id)
      REFERENCES public.congregacoes(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_apresentacao_registros_congregacao_id
  ON public.apresentacao_criancas_registros(congregacao_id);

-- 2. Batismo nas Aguas Registros
ALTER TABLE public.batismo_aguas_registros
  ADD COLUMN IF NOT EXISTS congregacao_id UUID;

DO $$
BEGIN
  IF to_regclass('public.congregacoes') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_batismo_aguas_congregacao'
  ) THEN
    ALTER TABLE public.batismo_aguas_registros
      ADD CONSTRAINT fk_batismo_aguas_congregacao
      FOREIGN KEY (congregacao_id)
      REFERENCES public.congregacoes(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_batismo_aguas_congregacao_id
  ON public.batismo_aguas_registros(congregacao_id);

-- 3. Casamento Registros
ALTER TABLE public.casamento_registros
  ADD COLUMN IF NOT EXISTS congregacao_id UUID;

DO $$
BEGIN
  IF to_regclass('public.congregacoes') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_casamento_registros_congregacao'
  ) THEN
    ALTER TABLE public.casamento_registros
      ADD CONSTRAINT fk_casamento_registros_congregacao
      FOREIGN KEY (congregacao_id)
      REFERENCES public.congregacoes(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_casamento_congregacao_id
  ON public.casamento_registros(congregacao_id);

COMMIT;
