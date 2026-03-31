-- Campos de origem para filiação de ministros já consagrados em outra instituição
-- Compatível com bancos legados

BEGIN;

ALTER TABLE IF EXISTS public.consagracao_registros
  ADD COLUMN IF NOT EXISTS origem_instituicao TEXT,
  ADD COLUMN IF NOT EXISTS origem_cidade TEXT,
  ADD COLUMN IF NOT EXISTS origem_uf TEXT,
  ADD COLUMN IF NOT EXISTS origem_data_consagracao DATE;

COMMIT;
