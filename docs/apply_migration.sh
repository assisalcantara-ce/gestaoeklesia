#!/bin/bash
# Script para aplicar a migração no Supabase
# IMPORTANTE: Execute isso apenas uma vez!

echo "================================================"
echo "Aplicando Migração: Expansão de pre_registrations"
echo "================================================"

# Verificar se supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não encontrado"
    echo "Instale com: npm install -g supabase"
    exit 1
fi

echo "✓ Supabase CLI encontrado"

# Aplicar migração
echo "Aplicando migração..."
supabase migration up --db-url postgresql://<user>:<password>@<host>:<port>/<database>

if [ $? -eq 0 ]; then
    echo "✅ Migração aplicada com sucesso!"
    echo ""
    echo "Novos campos adicionados:"
    echo "  - phone"
    echo "  - website"
    echo "  - responsible_name"
    echo "  - quantity_temples"
    echo "  - quantity_members"
    echo "  - address_street"
    echo "  - address_number"
    echo "  - address_complement"
    echo "  - address_city"
    echo "  - address_state"
    echo "  - address_zip"
    echo "  - description"
    echo "  - plan"
else
    echo "❌ Erro ao aplicar migração"
    exit 1
fi
