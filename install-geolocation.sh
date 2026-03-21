#!/bin/bash

# Script para instalar o módulo de Geolocalização
# Uso: chmod +x install-geolocation.sh && ./install-geolocation.sh

echo "📍 Instalando Módulo de Geolocalização..."
echo ""

# 1. Instalar dependência
echo "📦 Instalando @googlemaps/js-api-loader..."
npm install @googlemaps/js-api-loader

# 2. Informações
echo ""
echo "✅ Instalação concluída!"
echo ""
echo "📋 Próximos passos:"
echo ""
echo "1. Configure a variável de ambiente no .env.local:"
echo "   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=sua_chave_aqui"
echo ""
echo "2. Certifique-se de que sua tabela 'membros' tem:"
echo "   - latitude (TEXT ou NUMERIC)"
echo "   - longitude (TEXT ou NUMERIC)"
echo ""
echo "3. Acesse a página: http://localhost:3000/geolocalizacao"
echo ""
echo "📚 Leia GEOLOCATION_MODULE.md para mais detalhes"
echo ""
