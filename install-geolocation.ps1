# Script para instalar o módulo de Geolocalização (Windows)
# Uso: .\install-geolocation.ps1

Write-Host "📍 Instalando Módulo de Geolocalização..." -ForegroundColor Cyan
Write-Host ""

# 1. Instalar dependência
Write-Host "📦 Instalando @googlemaps/js-api-loader..." -ForegroundColor Yellow
npm install @googlemaps/js-api-loader

# 2. Informações
Write-Host ""
Write-Host "✅ Instalação concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos passos:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Configure a variável de ambiente no .env.local:" -ForegroundColor White
Write-Host "   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=sua_chave_aqui" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Certifique-se de que sua tabela 'membros' tem:" -ForegroundColor White
Write-Host "   - latitude (TEXT ou NUMERIC)" -ForegroundColor Gray
Write-Host "   - longitude (TEXT ou NUMERIC)" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Acesse a página: http://localhost:3000/geolocalizacao" -ForegroundColor White
Write-Host ""
Write-Host "📚 Leia GEOLOCATION_MODULE.md para mais detalhes" -ForegroundColor Cyan
Write-Host ""
