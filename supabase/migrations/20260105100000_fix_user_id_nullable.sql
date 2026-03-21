-- Fix: Make user_id nullable in pre_registrations table
-- This allows storing contact requests without creating a user first

-- Drop the UNIQUE constraint on user_id to allow NULL values
ALTER TABLE public.pre_registrations 
DROP CONSTRAINT pre_registrations_user_id_key;

-- Alter the column to allow NULL
ALTER TABLE public.pre_registrations 
ALTER COLUMN user_id DROP NOT NULL;

-- Update the foreign key to allow ON DELETE CASCADE to work with NULL
ALTER TABLE public.pre_registrations 
ADD CONSTRAINT fk_pre_registrations_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster lookups (NULL values are included in indexes)
CREATE INDEX IF NOT EXISTS idx_pre_registrations_user_id_nullable ON public.pre_registrations(user_id);
