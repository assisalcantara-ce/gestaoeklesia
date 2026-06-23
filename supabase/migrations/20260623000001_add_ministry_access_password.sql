ALTER TABLE public.ministries ADD COLUMN IF NOT EXISTS access_password_encrypted TEXT NULL, ADD COLUMN IF NOT EXISTS access_password_updated_at TIMESTAMPTZ NULL;
