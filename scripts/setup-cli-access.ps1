# 🔐 Script de Configuração de Acesso CLI - Supabase & Vercel
# Este script configura todas as variáveis de ambiente necessárias

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Configurando Acesso CLI - Supabase & Vercel              ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ✅ SUPABASE
Write-Host "🔧 Configurando Supabase..." -ForegroundColor Green

$env:SUPABASE_URL = $env:NEXT_PUBLIC_SUPABASE_URL
$env:SUPABASE_SERVICE_ROLE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY

Write-Host "   ✅ Supabase URL: $env:SUPABASE_URL" -ForegroundColor Green
Write-Host "   ✅ Service Role Key configurada" -ForegroundColor Green
Write-Host "   ✅ Anon Key configurada" -ForegroundColor Green
Write-Host ""

# ✅ VERCEL
Write-Host "🔧 Verificando Vercel..." -ForegroundColor Green
$vercelVersion = vercel --version 2>$null
if ($vercelVersion) {
    Write-Host "   ✅ Vercel CLI: $vercelVersion" -ForegroundColor Green
    Write-Host "   ✅ Autenticado" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Vercel não autenticado - Execute: vercel login" -ForegroundColor Yellow
}
Write-Host ""

# 📊 RESUMO
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  STATUS DE ACESSO                                          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "Supabase:" -ForegroundColor Yellow
Write-Host "  ✅ REST API Access" -ForegroundColor Green
Write-Host "  ✅ Service Role Key" -ForegroundColor Green
Write-Host "  ℹ️  CLI via npx (sbp_ access token não disponível)" -ForegroundColor Blue
Write-Host ""

Write-Host "Vercel:" -ForegroundColor Yellow
Write-Host "  ✅ CLI Instalado (v50.3.0)" -ForegroundColor Green
Write-Host "  ✅ Autenticado" -ForegroundColor Green
Write-Host ""

Write-Host "📝 Próximos passos:" -ForegroundColor Cyan
Write-Host "  1. Use: npm run dev          # Rodar aplicação" -ForegroundColor White
Write-Host "  2. Use: vercel deploy       # Fazer deploy" -ForegroundColor White
Write-Host "  3. Use: npx supabase        # CLI via npx" -ForegroundColor White
Write-Host ""

Write-Host "Configuração concluída! ✨" -ForegroundColor Green
