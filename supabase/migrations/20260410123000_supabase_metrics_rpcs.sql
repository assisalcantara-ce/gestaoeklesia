-- ============================================================
-- SUPABASE METRICS RPCS HARDENING (ABR/2026)
-- Objetivo:
-- 1) Garantir RPC get_database_size_bytes()
-- 2) Garantir RPC get_tables_info()
-- 3) Conceder EXECUTE para service_role (API admin)
-- ============================================================

-- Retorna tamanho total do banco atual em bytes
CREATE OR REPLACE FUNCTION public.get_database_size_bytes()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT pg_database_size(current_database())::bigint;
$$;

-- Retorna info das tabelas do schema public para fallback de métricas
CREATE OR REPLACE FUNCTION public.get_tables_info()
RETURNS TABLE (
  table_name TEXT,
  row_count BIGINT,
  table_size BIGINT,
  total_size BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    c.relname::text AS table_name,
    COALESCE(s.n_live_tup, 0)::bigint AS row_count,
    pg_relation_size(c.oid)::bigint AS table_size,
    pg_total_relation_size(c.oid)::bigint AS total_size
  FROM pg_class c
  JOIN pg_namespace n
    ON n.oid = c.relnamespace
  LEFT JOIN pg_stat_user_tables s
    ON s.relid = c.oid
  WHERE c.relkind = 'r'
    AND n.nspname = 'public'
  ORDER BY pg_total_relation_size(c.oid) DESC;
$$;

REVOKE ALL ON FUNCTION public.get_database_size_bytes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_tables_info() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_database_size_bytes() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_tables_info() TO service_role;

-- Opcional para consultas internas via postgres
GRANT EXECUTE ON FUNCTION public.get_database_size_bytes() TO postgres;
GRANT EXECUTE ON FUNCTION public.get_tables_info() TO postgres;
