-- Add church profile data to configurations (multi-tenant)
ALTER TABLE public.configurations
  ADD COLUMN IF NOT EXISTS church_profile JSONB DEFAULT '{}'::jsonb;
