-- Expand status values for pre_registrations
ALTER TABLE public.pre_registrations
  DROP CONSTRAINT IF EXISTS pre_registrations_status_check;

ALTER TABLE public.pre_registrations
  ADD CONSTRAINT pre_registrations_status_check
  CHECK (status IN ('trial', 'encerrado', 'efetivado', 'converted'));
