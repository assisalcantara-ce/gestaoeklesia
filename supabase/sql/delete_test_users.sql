-- Script para deletar usuários de teste
-- Execute no SQL Editor do Supabase

-- Deletar de pre_registrations
DELETE FROM pre_registrations 
WHERE email IN (
  'comieadepa.pa@gmail.com',
  'creesereducacional@gmail.com',
  'assisalcantara.pa@gmail.com',
  'assisalcantara.ce@gmail.com'
);

-- Deletar do auth.users (se houver permissão)
-- Nota: Isso deve ser feito via Supabase Dashboard > Authentication > Users
-- ou via Admin API
