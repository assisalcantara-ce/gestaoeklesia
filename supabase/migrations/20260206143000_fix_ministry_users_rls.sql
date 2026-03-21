-- Corrige RLS de ministry_users: a policy anterior fazia subquery na própria tabela
-- (padrão que costuma causar recursão/negação de acesso), impedindo resolver o ministry_id.

ALTER TABLE public.ministry_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários só veem seus ministry_users" ON public.ministry_users;
DROP POLICY IF EXISTS "ministry_users_select_self" ON public.ministry_users;

CREATE POLICY "ministry_users_select_self"
  ON public.ministry_users
  FOR SELECT
  USING (user_id = auth.uid());
