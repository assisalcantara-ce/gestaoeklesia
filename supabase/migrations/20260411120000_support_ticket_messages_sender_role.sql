-- Add sender_role to support_ticket_messages for reliable author identification
ALTER TABLE public.support_ticket_messages
  ADD COLUMN IF NOT EXISTS sender_role VARCHAR(20);

UPDATE public.support_ticket_messages m
SET sender_role = CASE
  WHEN EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = m.user_id
  ) THEN 'support'
  ELSE 'user'
END
WHERE sender_role IS NULL;

ALTER TABLE public.support_ticket_messages
  ALTER COLUMN sender_role SET DEFAULT 'user';

ALTER TABLE public.support_ticket_messages
  ALTER COLUMN sender_role SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.support_ticket_messages'::regclass
      AND conname = 'support_ticket_messages_sender_role_check'
  ) THEN
    ALTER TABLE public.support_ticket_messages
      ADD CONSTRAINT support_ticket_messages_sender_role_check
      CHECK (sender_role IN ('support', 'user'));
  END IF;
END $$;
