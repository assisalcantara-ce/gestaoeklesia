-- Add/refresh trial expiration function and optional cron job

BEGIN;

CREATE OR REPLACE FUNCTION public.check_trial_expiration()
RETURNS void AS $$
BEGIN
  UPDATE public.pre_registrations
  SET status = 'encerrado'
  WHERE trial_expires_at <= NOW()
    AND status = 'trial';
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron if available (runs hourly)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('trial-expiration');
    PERFORM cron.schedule('trial-expiration', '0 * * * *', 'SELECT public.check_trial_expiration();');
  END IF;
END $$;

COMMIT;
