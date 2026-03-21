-- Retorna o tamanho TOTAL do banco (todos os schemas)
-- Usado no painel /admin/configuracoes/supabase para acompanhar capacidade do plano.

CREATE OR REPLACE FUNCTION public.get_database_size_bytes()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_database_size(current_database())::bigint;
$$;

REVOKE ALL ON FUNCTION public.get_database_size_bytes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_database_size_bytes() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_database_size_bytes() TO postgres;
