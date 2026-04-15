-- Adiciona coluna modulos (array de texto) em subscription_plans
-- Permite registrar livremente quais módulos cada plano inclui.

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS modulos TEXT[] NOT NULL DEFAULT '{}';

-- Popula com os módulos conforme definido na landing page
UPDATE public.subscription_plans SET
  modulos = ARRAY['Secretaria Geral', 'Achados e Perdidos', 'Patrimônio', 'Geolocalização', 'Auditoria'],
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'basic';

UPDATE public.subscription_plans SET
  modulos = ARRAY['Secretaria Geral', 'Achados e Perdidos', 'Patrimônio', 'Geolocalização', 'Auditoria', 'Tesouraria', 'Missões', 'Chat Interno', 'EBD'],
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'starter';

UPDATE public.subscription_plans SET
  modulos = ARRAY['Secretaria Geral', 'Achados e Perdidos', 'Patrimônio', 'Geolocalização', 'Auditoria', 'Tesouraria', 'Missões', 'Chat Interno', 'EBD', 'Funcionários', 'Comissão', 'Kids', 'Reuniões'],
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'intermediario';

UPDATE public.subscription_plans SET
  modulos = ARRAY['Secretaria Geral', 'Achados e Perdidos', 'Patrimônio', 'Geolocalização', 'Auditoria', 'Tesouraria', 'Missões', 'Chat Interno', 'EBD', 'Funcionários', 'Comissão', 'Kids', 'Reuniões', 'Eventos', 'Financeiro Avançado', 'Presidência'],
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'profissional';

UPDATE public.subscription_plans SET
  modulos = ARRAY['Secretaria Geral', 'Achados e Perdidos', 'Patrimônio', 'Geolocalização', 'Auditoria', 'Tesouraria', 'Missões', 'Chat Interno', 'EBD', 'Funcionários', 'Comissão', 'Kids', 'Reuniões', 'Eventos', 'Financeiro Avançado', 'Presidência'],
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'expert';
