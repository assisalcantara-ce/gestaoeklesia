-- Align pre_registrations status values to trial/encerrado

BEGIN;

-- Map legacy statuses to new ones
UPDATE public.pre_registrations
SET status = 'trial'
WHERE status IN ('pending', 'active') OR status IS NULL;

UPDATE public.pre_registrations
SET status = 'encerrado'
WHERE status IN ('expired', 'converted');

-- Ensure no unexpected values remain
UPDATE public.pre_registrations
SET status = 'trial'
WHERE status NOT IN ('trial', 'encerrado');

-- Drop old CHECK constraint if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.pre_registrations'::regclass
      AND contype = 'c'
      AND conname = 'pre_registrations_status_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.pre_registrations DROP CONSTRAINT pre_registrations_status_check';
  END IF;
END $$;

-- Set new default and constraint
ALTER TABLE public.pre_registrations
  ALTER COLUMN status SET DEFAULT 'trial';

ALTER TABLE public.pre_registrations
  ADD CONSTRAINT pre_registrations_status_check
  CHECK (status IN ('trial', 'encerrado'));

COMMIT;
