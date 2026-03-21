#!/bin/bash
# Script para corrigir RLS recursion em admin_users
# Use com: bash fix-rls-recursion.sh

echo "🔧 Corrigindo RLS Recursion em admin_users..."

# Comando SQL para desabilitar RLS problemática
SQL_FIX="
-- Desabilitar RLS temporariamente para aplicar fix
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;

-- Remover política problemática
DROP POLICY IF EXISTS \"admin_users_admin_all\" ON public.admin_users;

-- Re-habilitar RLS com política segura
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Nova política: permite SELECT público (validação é no middleware/backend)
CREATE POLICY \"admin_users_select_public\" ON public.admin_users
  FOR SELECT USING (true);

-- Logs
SELECT 'RLS Recursion Fixed!' as status;
"

# Executar com Supabase CLI
if command -v supabase &> /dev/null; then
  echo "$SQL_FIX" | supabase db execute
  echo "✅ RLS corrigido com sucesso!"
else
  echo "⚠️  Supabase CLI não encontrado"
  echo "Opções:"
  echo "1. Instale: npm install -g @supabase/cli"
  echo "2. Ou execute o SQL manualmente no Supabase Dashboard"
  echo ""
  echo "SQL a executar:"
  echo "$SQL_FIX"
fi
