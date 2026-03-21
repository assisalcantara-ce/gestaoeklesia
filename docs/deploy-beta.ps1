# 🚀 Script Automático: Deploy Beta no Vercel (Windows)
# Data: 08 de Janeiro de 2026
# Uso: .\deploy-beta.ps1

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  🚀 GestãoEklesia - Deploy Beta" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Passo 1: Verificar se está na pasta certa
Write-Host "Passo 1: Verificando pasta do projeto..." -ForegroundColor Yellow
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erro: package.json não encontrado!" -ForegroundColor Red
    Write-Host "Execute este script da raiz do projeto GestãoEklesia"
    exit 1
}
Write-Host "✓ Pasta correta" -ForegroundColor Green
Write-Host ""

# Passo 2: Verificar git
Write-Host "Passo 2: Verificando Git..." -ForegroundColor Yellow
try {
    $gitVersion = git --version
    Write-Host "✓ Git instalado: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git não instalado!" -ForegroundColor Red
    Write-Host "Instale em: https://git-scm.com/download/win"
    exit 1
}
Write-Host ""

# Passo 3: Configurar git (se necessário)
Write-Host "Passo 3: Configurando Git..." -ForegroundColor Yellow

$userName = git config user.name
if (-not $userName) {
    $userName = Read-Host "Seu Nome"
    git config user.name $userName
    Write-Host "✓ Nome configurado: $userName" -ForegroundColor Green
} else {
    Write-Host "✓ Já configurado: $userName" -ForegroundColor Green
}

$userEmail = git config user.email
if (-not $userEmail) {
    $userEmail = Read-Host "Seu Email"
    git config user.email $userEmail
    Write-Host "✓ Email configurado: $userEmail" -ForegroundColor Green
} else {
    Write-Host "✓ Já configurado: $userEmail" -ForegroundColor Green
}
Write-Host ""

# Passo 4: Inicializar repositório
Write-Host "Passo 4: Inicializando Git..." -ForegroundColor Yellow
if (-not (Test-Path ".git")) {
    git init
    Write-Host "✓ Repositório git criado" -ForegroundColor Green
} else {
    Write-Host "✓ Repositório git já existe" -ForegroundColor Green
}
Write-Host ""

# Passo 5: Adicionar arquivos
Write-Host "Passo 5: Adicionando arquivos ao Git..." -ForegroundColor Yellow
git add .
Write-Host "✓ Arquivos adicionados" -ForegroundColor Green
Write-Host ""

# Passo 6: Primeiro commit
Write-Host "Passo 6: Fazendo primeiro commit..." -ForegroundColor Yellow
$commitResult = git commit -m "Initial commit: GestãoEklesia beta" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Commit criado" -ForegroundColor Green
} else {
    Write-Host "⚠ Commit já existe (ou nada a commitar)" -ForegroundColor Yellow
}
Write-Host ""

# Passo 7: Configurar branch main
Write-Host "Passo 7: Configurando branch principal..." -ForegroundColor Yellow
git branch -M main
Write-Host "✓ Branch 'main' configurado" -ForegroundColor Green
Write-Host ""

# Passo 8: Adicionar repositório remoto
Write-Host "Passo 8: Adicionando repositório remoto..." -ForegroundColor Yellow
Write-Host ""
Write-Host "IMPORTANTE: Você precisa do URL do GitHub!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para obter o URL:" -ForegroundColor Yellow
Write-Host "1. Acesse: https://github.com/new"
Write-Host "2. Crie um repositório chamado: gestaoeklesia"
Write-Host "3. Copie o URL (começa com: https://github.com/SEU_USER/...)"
Write-Host ""
$githubUrl = Read-Host "Cole o URL do GitHub (ou deixe em branco para pular)"

if (-not [string]::IsNullOrWhiteSpace($githubUrl)) {
    # Remover remote antigo se existir
    git remote remove origin 2>$null
    
    git remote add origin $githubUrl
    Write-Host "✓ Repositório remoto adicionado" -ForegroundColor Green
    Write-Host ""
    
    # Passo 9: Push para GitHub
    Write-Host "Passo 9: Enviando para GitHub..." -ForegroundColor Yellow
    Write-Host "Isso pode levar alguns segundos..." -ForegroundColor Gray
    Write-Host ""
    
    git push -u origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Código enviado para GitHub!" -ForegroundColor Green
        Write-Host ""
        Write-Host "=========================================" -ForegroundColor Cyan
        Write-Host "  ✅ Próximo passo: Conectar ao Vercel" -ForegroundColor Green
        Write-Host "=========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "1. Acesse: https://vercel.com" -ForegroundColor Yellow
        Write-Host "2. Sign up com GitHub"
        Write-Host "3. Clique em 'Add New...' → 'Project'"
        Write-Host "4. Selecione: gestaoeklesia"
        Write-Host "5. Adicione as 4 variáveis de ambiente:" -ForegroundColor Magenta
        Write-Host "   - NEXT_PUBLIC_SUPABASE_URL"
        Write-Host "   - NEXT_PUBLIC_SUPABASE_KEY (ou ANON_KEY)"
        Write-Host "   - SUPABASE_SERVICE_ROLE_KEY"
        Write-Host "   - NEXT_PUBLIC_APP_URL"
        Write-Host ""
        Write-Host "6. Clique em 'Deploy'"
        Write-Host ""
        Write-Host "Seu link beta será: https://gestaoeklesia.vercel.app"
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "❌ Erro ao enviar para GitHub" -ForegroundColor Red
        Write-Host "Verifique o URL do repositório"
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "⚠ Repositório remoto não configurado" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Para fazer isso depois:" -ForegroundColor Yellow
    Write-Host "1. Crie repositório em: https://github.com/new"
    Write-Host "2. Execute: git remote add origin https://github.com/SEU_USER/gestaoeklesia.git"
    Write-Host "3. Execute: git push -u origin main"
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  🎉 Script concluído!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Ofertar abrir no navegador
$openVercel = Read-Host "Deseja abrir Vercel.com no navegador? (s/n)"
if ($openVercel -eq "s" -or $openVercel -eq "S") {
    Start-Process "https://vercel.com"
}
