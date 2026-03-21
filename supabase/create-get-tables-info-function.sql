-- Criar função para obter informações de todas as tabelas do schema public
CREATE OR REPLACE FUNCTION get_tables_info()
RETURNS TABLE (
  table_name text,
  row_count bigint,
  table_size bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::text as table_name,
    (SELECT count(*) FROM (SELECT 1 FROM public.__table_name LIMIT 1000000) x)::bigint as row_count,
    pg_total_relation_size(quote_ident(t.tablename))::bigint as table_size
  FROM pg_tables t
  WHERE t.schemaname = 'public'
  ORDER BY pg_total_relation_size(quote_ident(t.tablename)) DESC;
END;
$$ LANGUAGE plpgsql;

-- Alternativa mais rápida que usa informações do catálogo
CREATE OR REPLACE FUNCTION get_tables_info()
RETURNS TABLE (
  table_name text,
  row_count bigint,
  table_size bigint
) AS $$
SELECT
  t.tablename::text,
  (SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = t.tablename)::bigint,
  pg_total_relation_size(quote_ident(t.tablename))::bigint
FROM pg_tables t
WHERE t.schemaname = 'public'
ORDER BY pg_total_relation_size(quote_ident(t.tablename)) DESC;
$$ LANGUAGE sql;
