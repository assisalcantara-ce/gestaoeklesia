-- 1. Remover constraint/índice atual members_ministry_email_unique se existir.
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_ministry_email_unique;
DROP INDEX IF EXISTS public.members_ministry_email_unique;

-- 2. Criar índice único parcial:
-- UNIQUE (ministry_id, lower(email))
-- WHERE email IS NOT NULL AND trim(email) <> ''
CREATE UNIQUE INDEX IF NOT EXISTS members_ministry_email_partial_idx 
ON public.members (ministry_id, lower(email)) 
WHERE email IS NOT NULL AND trim(email) <> '';
