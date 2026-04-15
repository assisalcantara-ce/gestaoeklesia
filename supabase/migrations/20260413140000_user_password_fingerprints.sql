-- Track password fingerprints to prevent reuse across users
CREATE TABLE IF NOT EXISTS public.user_password_fingerprints (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_password_fingerprints_fingerprint
  ON public.user_password_fingerprints(fingerprint);

ALTER TABLE public.user_password_fingerprints ENABLE ROW LEVEL SECURITY;
