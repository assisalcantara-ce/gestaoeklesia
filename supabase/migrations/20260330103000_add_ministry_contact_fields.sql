-- Add contact and address fields for ministries
ALTER TABLE public.ministries
  ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20),
  ADD COLUMN IF NOT EXISTS responsible_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_street VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS address_complement VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address_state VARCHAR(2),
  ADD COLUMN IF NOT EXISTS address_zip VARCHAR(20),
  ADD COLUMN IF NOT EXISTS quantity_temples INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quantity_members INTEGER DEFAULT 0;
