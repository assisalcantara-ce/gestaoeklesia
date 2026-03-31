-- Add orgao_emissor to members and backfill from legacy custom_fields values

BEGIN;

ALTER TABLE IF EXISTS public.members
  ADD COLUMN IF NOT EXISTS orgao_emissor TEXT;

UPDATE public.members
SET orgao_emissor = COALESCE(
  orgao_emissor,
  NULLIF(custom_fields->>'orgaoEmissor', ''),
  NULLIF(custom_fields->>'orgao_emissor', '')
)
WHERE orgao_emissor IS NULL;

COMMIT;
