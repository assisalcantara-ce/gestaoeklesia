-- Tabela de eventos mínimos para endpoints públicos (rate limit, erros, sucesso)
-- Objetivo: reduzir abuso/spam e dar visibilidade operacional sem expor dados sensíveis.

CREATE TABLE IF NOT EXISTS public.public_api_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL,
  event_type text NOT NULL,
  ip_address inet,
  user_agent text,
  email_hash text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.public_api_events ENABLE ROW LEVEL SECURITY;

-- Sem policies: apenas service_role/postgres (bypass RLS) devem acessar.
REVOKE ALL ON TABLE public.public_api_events FROM PUBLIC;
REVOKE ALL ON TABLE public.public_api_events FROM anon;
REVOKE ALL ON TABLE public.public_api_events FROM authenticated;

GRANT ALL ON TABLE public.public_api_events TO service_role;
GRANT ALL ON TABLE public.public_api_events TO postgres;
