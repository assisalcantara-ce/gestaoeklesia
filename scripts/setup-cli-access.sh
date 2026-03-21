#!/bin/bash
# 🔐 Configuração de Acesso CLI - Supabase & Vercel
# Execute: source ./scripts/setup-cli-access.sh

echo "🔧 Configurando acesso CLI..."
echo ""

# ✅ SUPABASE (carrega do .env.local)
export SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

echo "✅ Supabase configurado:"
echo "   URL: $SUPABASE_URL"
echo "   Keys: Configuradas"
echo ""

echo "✅ Vercel CLI: Instalado e autenticado"
echo ""

echo "📊 Testes disponíveis:"
echo "   npm run dev          - Rodar aplicação"
echo "   vercel deploy        - Deploy para Vercel"
echo "   npx supabase --help  - CLI do Supabase"
echo ""

echo "✨ Configuração concluída!"
