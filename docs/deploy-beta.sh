#!/bin/bash

# 🚀 Script Automático: Deploy Beta no Vercel
# Data: 08 de Janeiro de 2026
# Uso: ./deploy-beta.sh

echo "========================================="
echo "  🚀 GestãoEklesia - Deploy Beta"
echo "========================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Passo 1: Verificar se está na pasta certa
echo -e "${YELLOW}Passo 1: Verificando pasta do projeto...${NC}"
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erro: package.json não encontrado!${NC}"
    echo "Execute este script da raiz do projeto GestãoEklesia"
    exit 1
fi
echo -e "${GREEN}✓ Pasta correta${NC}"
echo ""

# Passo 2: Verificar git
echo -e "${YELLOW}Passo 2: Verificando Git...${NC}"
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git não instalado!${NC}"
    echo "Instale em: https://git-scm.com/download/win"
    exit 1
fi
echo -e "${GREEN}✓ Git instalado${NC}"
echo ""

# Passo 3: Configurar git (se necessário)
echo -e "${YELLOW}Passo 3: Configurando Git...${NC}"

# Verificar se já tem config
if ! git config user.name > /dev/null 2>&1; then
    echo "Seu Nome:"
    read USER_NAME
    git config user.name "$USER_NAME"
    echo -e "${GREEN}✓ Nome configurado: $USER_NAME${NC}"
else
    USER_NAME=$(git config user.name)
    echo -e "${GREEN}✓ Já configurado: $USER_NAME${NC}"
fi

if ! git config user.email > /dev/null 2>&1; then
    echo "Seu Email:"
    read USER_EMAIL
    git config user.email "$USER_EMAIL"
    echo -e "${GREEN}✓ Email configurado: $USER_EMAIL${NC}"
else
    USER_EMAIL=$(git config user.email)
    echo -e "${GREEN}✓ Já configurado: $USER_EMAIL${NC}"
fi
echo ""

# Passo 4: Inicializar repositório
echo -e "${YELLOW}Passo 4: Inicializando Git...${NC}"
if [ ! -d ".git" ]; then
    git init
    echo -e "${GREEN}✓ Repositório git criado${NC}"
else
    echo -e "${GREEN}✓ Repositório git já existe${NC}"
fi
echo ""

# Passo 5: Adicionar arquivos
echo -e "${YELLOW}Passo 5: Adicionando arquivos ao Git...${NC}"
git add .
echo -e "${GREEN}✓ Arquivos adicionados${NC}"
echo ""

# Passo 6: Primeiro commit
echo -e "${YELLOW}Passo 6: Fazendo primeiro commit...${NC}"
if git commit -m "Initial commit: GestãoEklesia beta" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Commit criado${NC}"
else
    echo -e "${YELLOW}⚠ Commit já existe (ou nada a commitar)${NC}"
fi
echo ""

# Passo 7: Configurar branch main
echo -e "${YELLOW}Passo 7: Configurando branch principal...${NC}"
git branch -M main
echo -e "${GREEN}✓ Branch 'main' configurado${NC}"
echo ""

# Passo 8: Adicionar repositório remoto
echo -e "${YELLOW}Passo 8: Adicionando repositório remoto...${NC}"
echo ""
echo "IMPORTANTE: Você precisa do URL do GitHub!"
echo ""
echo "Para obter o URL:"
echo "1. Acesse: https://github.com/new"
echo "2. Crie um repositório chamado: gestaoeklesia"
echo "3. Copie o URL (começa com: https://github.com/SEU_USER/...)"
echo ""
echo "Cole o URL do GitHub (ou deixe em branco para pular):"
read GITHUB_URL

if [ -n "$GITHUB_URL" ]; then
    # Remover remote antigo se existir
    git remote remove origin 2>/dev/null || true
    
    git remote add origin "$GITHUB_URL"
    echo -e "${GREEN}✓ Repositório remoto adicionado${NC}"
    echo ""
    
    # Passo 9: Push para GitHub
    echo -e "${YELLOW}Passo 9: Enviando para GitHub...${NC}"
    echo "Isso pode levar alguns segundos..."
    echo ""
    
    if git push -u origin main; then
        echo ""
        echo -e "${GREEN}✓ Código enviado para GitHub!${NC}"
        echo ""
        echo "========================================="
        echo -e "${GREEN}  ✅ Próximo passo: Conectar ao Vercel${NC}"
        echo "========================================="
        echo ""
        echo "1. Acesse: https://vercel.com"
        echo "2. Sign up com GitHub"
        echo "3. Clique em 'Add New...' → 'Project'"
        echo "4. Selecione: gestaoeklesia"
        echo "5. Adicione as 4 variáveis de ambiente:"
        echo "   - NEXT_PUBLIC_SUPABASE_URL"
        echo "   - NEXT_PUBLIC_SUPABASE_KEY (ou ANON_KEY)"
        echo "   - SUPABASE_SERVICE_ROLE_KEY"
        echo "   - NEXT_PUBLIC_APP_URL"
        echo "6. Clique em 'Deploy'"
        echo ""
        echo "Seu link beta será: https://gestaoeklesia.vercel.app"
        echo ""
    else
        echo -e "${RED}❌ Erro ao enviar para GitHub${NC}"
        echo "Verifique o URL do repositório"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ Repositório remoto não configurado${NC}"
    echo ""
    echo "Para fazer isso depois:"
    echo "1. Crie repositório em: https://github.com/new"
    echo "2. Execute: git remote add origin https://github.com/SEU_USER/gestaoeklesia.git"
    echo "3. Execute: git push -u origin main"
fi

echo ""
echo "========================================="
echo -e "${GREEN}  🎉 Script concluído!${NC}"
echo "========================================="
