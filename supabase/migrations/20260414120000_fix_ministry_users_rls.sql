-- Corrige recursao infinita nas policies de ministry_users

BEGIN;

DROP POLICY IF EXISTS "Usuários só veem seus ministry_users" ON public.ministry_users;

CREATE POLICY "Usuários só veem seus ministry_users"
  ON public.ministry_users FOR SELECT
  USING (
    user_id = auth.uid()
    OR ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

COMMIT;
