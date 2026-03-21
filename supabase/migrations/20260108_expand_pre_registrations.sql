-- ============================================
-- EXPANSÃO DA TABELA PRE_REGISTRATIONS
-- Adicionar campos para capturar todas as informações do assinante
-- ============================================

ALTER TABLE public.pre_registrations 
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS website VARCHAR(255),
ADD COLUMN IF NOT EXISTS responsible_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS quantity_temples INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS quantity_members INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS address_street VARCHAR(255),
ADD COLUMN IF NOT EXISTS address_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS address_complement VARCHAR(255),
ADD COLUMN IF NOT EXISTS address_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS address_state VARCHAR(2),
ADD COLUMN IF NOT EXISTS address_zip VARCHAR(10),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'starter';

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_pre_registrations_plan ON public.pre_registrations(plan);
CREATE INDEX IF NOT EXISTS idx_pre_registrations_city ON public.pre_registrations(address_city);

-- Comentários para documentar os novos campos
COMMENT ON COLUMN public.pre_registrations.phone IS 'Telefone de contato do ministério';
COMMENT ON COLUMN public.pre_registrations.website IS 'Website/URL do ministério';
COMMENT ON COLUMN public.pre_registrations.responsible_name IS 'Nome do responsável/pastor';
COMMENT ON COLUMN public.pre_registrations.quantity_temples IS 'Quantidade de igrejas/templos';
COMMENT ON COLUMN public.pre_registrations.quantity_members IS 'Quantidade de membros';
COMMENT ON COLUMN public.pre_registrations.address_street IS 'Rua do endereço';
COMMENT ON COLUMN public.pre_registrations.address_number IS 'Número do endereço';
COMMENT ON COLUMN public.pre_registrations.address_complement IS 'Complemento do endereço';
COMMENT ON COLUMN public.pre_registrations.address_city IS 'Cidade';
COMMENT ON COLUMN public.pre_registrations.address_state IS 'Estado (UF)';
COMMENT ON COLUMN public.pre_registrations.address_zip IS 'CEP';
COMMENT ON COLUMN public.pre_registrations.description IS 'Descrição do ministério';
COMMENT ON COLUMN public.pre_registrations.plan IS 'Plano contratado (starter, professional, enterprise)';
