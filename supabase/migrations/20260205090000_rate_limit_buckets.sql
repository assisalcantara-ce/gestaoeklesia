-- Rate limiting persistente (Postgres)
-- Motivo: in-memory rate limit não funciona bem em serverless/múltiplas instâncias.

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket_key text PRIMARY KEY,
  count integer NOT NULL,
  reset_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- Sem policies: acesso apenas por service_role/postgres.
REVOKE ALL ON TABLE public.rate_limit_buckets FROM PUBLIC;
REVOKE ALL ON TABLE public.rate_limit_buckets FROM anon;
REVOKE ALL ON TABLE public.rate_limit_buckets FROM authenticated;
GRANT ALL ON TABLE public.rate_limit_buckets TO service_role;
GRANT ALL ON TABLE public.rate_limit_buckets TO postgres;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE (
  allowed boolean,
  remaining integer,
  reset_at timestamptz,
  retry_after_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts timestamptz := now();
  row public.rate_limit_buckets;
  next_reset timestamptz;
  next_remaining integer;
BEGIN
  IF p_limit IS NULL OR p_limit <= 0 THEN
    allowed := true;
    remaining := 0;
    reset_at := now_ts;
    retry_after_seconds := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_window_seconds IS NULL OR p_window_seconds <= 0 THEN
    p_window_seconds := 600;
  END IF;

  -- Serializa concorrência por bucket
  PERFORM pg_advisory_xact_lock(hashtext(bucket_key));

  SELECT * INTO row
  FROM public.rate_limit_buckets r
  WHERE r.bucket_key = consume_rate_limit.bucket_key;

  IF NOT FOUND OR row.reset_at <= now_ts THEN
    next_reset := now_ts + make_interval(secs => p_window_seconds);
    INSERT INTO public.rate_limit_buckets(bucket_key, count, reset_at, updated_at)
    VALUES (consume_rate_limit.bucket_key, 1, next_reset, now_ts)
    ON CONFLICT (bucket_key)
    DO UPDATE SET count = 1, reset_at = EXCLUDED.reset_at, updated_at = EXCLUDED.updated_at;

    allowed := true;
    remaining := GREATEST(p_limit - 1, 0);
    reset_at := next_reset;
    retry_after_seconds := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  IF row.count >= p_limit THEN
    allowed := false;
    remaining := 0;
    reset_at := row.reset_at;
    retry_after_seconds := GREATEST(CEIL(EXTRACT(EPOCH FROM (row.reset_at - now_ts)))::int, 1);
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.rate_limit_buckets
  SET count = row.count + 1,
      updated_at = now_ts
  WHERE bucket_key = consume_rate_limit.bucket_key;

  next_remaining := GREATEST(p_limit - (row.count + 1), 0);

  allowed := true;
  remaining := next_remaining;
  reset_at := row.reset_at;
  retry_after_seconds := 0;
  RETURN NEXT;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO postgres;
