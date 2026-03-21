-- Garante colunas de geolocalização na tabela public.members.
-- Motivo: o módulo /geolocalizacao e formulários podem persistir lat/lng.

DO $$
BEGIN
  IF to_regclass('public.members') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='members' AND column_name='latitude'
  ) THEN
    ALTER TABLE public.members ADD COLUMN latitude double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='members' AND column_name='longitude'
  ) THEN
    ALTER TABLE public.members ADD COLUMN longitude double precision;
  END IF;

  -- Índice (best-effort) para consultas do mapa
  BEGIN
    CREATE INDEX IF NOT EXISTS idx_members_latitude_longitude
      ON public.members(latitude, longitude);
  EXCEPTION WHEN OTHERS THEN
    -- ignora erro de permissão/duplicidade em ambientes restritos
    NULL;
  END;
END
$$;
