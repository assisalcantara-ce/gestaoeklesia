-- Popular coluna modulos usando slug e/ou id direto (IDs do screenshot do banco)
-- Execute no SQL Editor do Supabase

UPDATE public.subscription_plans SET
  modulos = ARRAY[
    'Secretaria Geral',
    'Achados e Perdidos',
    'Patrimônio',
    'Geolocalização',
    'Auditoria'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'basic'
   OR id = '187a57b1-b4cb-4f40-8517-6527df1d10c4';

UPDATE public.subscription_plans SET
  modulos = ARRAY[
    'Secretaria Geral',
    'Achados e Perdidos',
    'Patrimônio',
    'Geolocalização',
    'Auditoria',
    'Tesouraria',
    'Missões',
    'Chat Interno',
    'EBD'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'starter'
   OR id = '503104e9-d532-433f-98b5-c7345152e275';

UPDATE public.subscription_plans SET
  modulos = ARRAY[
    'Secretaria Geral',
    'Achados e Perdidos',
    'Patrimônio',
    'Geolocalização',
    'Auditoria',
    'Tesouraria',
    'Missões',
    'Chat Interno',
    'EBD',
    'Funcionários',
    'Comissão',
    'Kids',
    'Reuniões'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'intermediario'
   OR id = '39c12fb2-dd08-4327-9411-f8bf4c0a226d';

UPDATE public.subscription_plans SET
  modulos = ARRAY[
    'Secretaria Geral',
    'Achados e Perdidos',
    'Patrimônio',
    'Geolocalização',
    'Auditoria',
    'Tesouraria',
    'Missões',
    'Chat Interno',
    'EBD',
    'Funcionários',
    'Comissão',
    'Kids',
    'Reuniões',
    'Eventos',
    'Financeiro Avançado',
    'Presidência'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'profissional'
   OR id = '3eed6a7e-f5dc-42e7-a976-de79fd397f3c';

UPDATE public.subscription_plans SET
  modulos = ARRAY[
    'Secretaria Geral',
    'Achados e Perdidos',
    'Patrimônio',
    'Geolocalização',
    'Auditoria',
    'Tesouraria',
    'Missões',
    'Chat Interno',
    'EBD',
    'Funcionários',
    'Comissão',
    'Kids',
    'Reuniões',
    'Eventos',
    'Financeiro Avançado',
    'Presidência'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'expert'
   OR id = 'b3e52578-f079-4fe7-9d8b-184a1136ea76';

-- Confirmação: mostra o resultado
SELECT id, name, slug, modulos FROM public.subscription_plans ORDER BY display_order;
