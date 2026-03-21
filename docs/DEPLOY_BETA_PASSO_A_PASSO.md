# 🚀 GUIA PRÁTICO: Deploy Beta em 15 Minutos

**Data:** 08 de Janeiro de 2026  
**Objetivo:** Colocar seu projeto online no Vercel com GitHub

---

## ⚡ ROTEIRO (15 minutos)

```
Passo 1: Git config (2 min)
Passo 2: GitHub (2 min)
Passo 3: Vercel (2 min)
Passo 4: Variáveis (5 min)
Passo 5: Deploy (2 min)
Passo 6: Teste (2 min)
```

---

## 🔧 PASSO 1: Configurar Git Localmente (2 min)

### Se ainda não tem Git instalado:
Download em: https://git-scm.com/download/win

### Configurar identidade:
```powershell
# Abrir PowerShell no projeto
cd c:\BACKUP\DESENVOLVIMENTO\gestaoeklesia

# Configurar seu nome e email
git config user.name "Seu Nome"
git config user.email "seu.email@gmail.com"

# Confirmar
git config --list | grep user
```

---

## 📁 PASSO 2: Criar Repositório no GitHub (2 min)

### 2.1: Criar conta GitHub (se não tiver)
```
Ir para: https://github.com
Clicar: "Sign up"
Email: seu.email@gmail.com
Senha: [criar uma forte]
Username: algo simples (ex: seuuser)
```

### 2.2: Criar novo repositório
```
1. Ir para: https://github.com/new
2. Repository name: "gestaoeklesia"
3. Description: "Sistema de gestão para iglesias"
4. Visibilidade: ⚫ Private (apenas você vê)
5. NÃO marque "Initialize with README"
6. Clicar: "Create repository"
```

### 2.3: Resultado
Você verá uma tela dizendo:
```
...or push an existing repository from the command line

git remote add origin https://github.com/SEU_USER/gestaoeklesia.git
git branch -M main
git push -u origin main
```

**Copie essas 3 linhas** (vai usar no próximo passo)

---

## 📤 PASSO 3: Enviar Projeto para GitHub (2 min)

### No PowerShell (na pasta do projeto):

```powershell
# 1. Inicializar git (se não tiver)
git init

# 2. Adicionar todos os arquivos
git add .

# 3. Fazer primeiro commit
git commit -m "Initial commit: GestãoEklesia beta"

# 4. Configurar branch principal
git branch -M main

# 5. Adicionar repositório remoto (COPIAR AS 3 LINHAS DO GITHUB)
git remote add origin https://github.com/SEU_USER/gestaoeklesia.git

# 6. Enviar para GitHub
git push -u origin main

# Esperar uns 10 segundos...
# Resultado esperado:
# ✓ Criando branches...
# ✓ Enviando arquivos...
# ✓ Done
```

### ✅ Confirmação
Ir em https://github.com/SEU_USER/gestaoeklesia

Você deve ver seus arquivos lá! ✨

---

## 🎯 PASSO 4: Conectar ao Vercel (2 min)

### 4.1: Criar conta Vercel
```
Ir para: https://vercel.com
Clicar: "Sign up"
Escolher: "Continue with GitHub"
Autorizar Vercel a acessar GitHub
```

### 4.2: Importar projeto
```
1. No Vercel, clicar: "Add New..." → "Project"
2. Encontrar "gestaoeklesia" (seu repositório)
3. Clicar: "Import"
```

### 4.3: Configurar projeto
```
Framework Preset: Next.js (automático)
Build Command: next build (padrão)
Output Directory: .next (padrão)
Root Directory: ./ (padrão)

Tudo ok? Clicar em: "Continue"
```

---

## 🔐 PASSO 5: Adicionar Variáveis Secretas (5 min)

### 5.1: Pegar valores do Supabase

Abrir seu projeto no Supabase (https://app.supabase.com)

**Procurar por:**

1. **NEXT_PUBLIC_SUPABASE_URL**
   - Settings → API → Project URL
   - Ex: `https://abc123.supabase.co`

2. **NEXT_PUBLIC_SUPABASE_KEY**
   - Settings → API → Anon Key
   - Ex: `eyJhbGciOiJIUzI1NiIs...`

3. **SUPABASE_SERVICE_ROLE_KEY** 🔐 SECRETO
   - Settings → API → Service Role Key
   - Ex: `eyJhbGciOiJIUzI1NiIs...` (começa igual mas é diferente)

### 5.2: Adicionar no Vercel

Na tela de importação do projeto:

```
Environment Variables

Nome: NEXT_PUBLIC_SUPABASE_URL
Valor: https://abc123.supabase.co
[Add]

Nome: NEXT_PUBLIC_SUPABASE_KEY
Valor: eyJhbGciOiJIUzI1NiIs...
[Add]

Nome: SUPABASE_SERVICE_ROLE_KEY
Valor: eyJhbGciOiJIUzI1NiIs... (service role, NÃO anon)
[Add]

Nome: NEXT_PUBLIC_APP_URL
Valor: https://gestaoeklesia.vercel.app (seu domínio Vercel)
[Add]
```

### ✅ Verificar:
```
☑ NEXT_PUBLIC_SUPABASE_URL
☑ NEXT_PUBLIC_SUPABASE_KEY
☑ SUPABASE_SERVICE_ROLE_KEY
☑ NEXT_PUBLIC_APP_URL
```

---

## 🚀 PASSO 6: Deploy (2 min)

### 6.1: Iniciar deploy
```
Vercel page ainda aberta?
Clicar: "Deploy"

Aguardar... (~1-2 minutos)
```

### 6.2: Acompanhar progresso
```
Você verá:
- "Building..."
- "Testing..."
- "Deploying..."
- "✓ Deployment complete!"
```

### 6.3: Acessar seu projeto
```
Clique em: "Visit"

OU manualmente vá para:
https://gestaoeklesia.vercel.app

(ou o domínio que Vercel atribuir)
```

---

## ✅ PASSO 7: Testar Beta (2 min)

### 7.1: Acessar a aplicação
```
URL: https://gestaoeklesia.vercel.app
```

### 7.2: Testar login
```
1. Tentar fazer login
2. Gerar credenciais de teste
3. Verificar se dashboard abre
4. Testar listagem de atendimentos
```

### 7.3: Se tudo funcionou ✅
```
PARABÉNS! Seu app está ONLINE! 🎉

Seu link beta é:
https://gestaoeklesia.vercel.app

Compartilhe com 2-3 pessoas para feedback!
```

---

## 🐛 TROUBLESHOOTING: O que fazer se não funcionar

### ❌ Erro: "Build failed"

**Solução:**
```
1. Vercel Dashboard → Deployments
2. Ver log do erro
3. Geralmente é variável faltando
4. Adicionar variável correta
5. Deploy novamente (automático)
```

### ❌ "Cannot find module"

**Solução:**
```
1. Na pasta local, rodar: npm install
2. Fazer commit e push para GitHub
3. Vercel faz deploy automático
```

### ❌ Página fica em branco

**Solução:**
```
1. Abrir DevTools (F12)
2. Ver console para erros
3. Variável faltando? Adicionar no Vercel
4. Deploy novo (automático)
```

---

## 🔄 APÓS DEPLOY: Futuras atualizações

### Fluxo automático:

```
1. Você edita código localmente
2. git add .
3. git commit -m "Feature nova"
4. git push origin main
5. Vercel detecta novo push
6. Deploy automático em ~1 min
7. Site atualiza
```

**Você NUNCA mais precisa manualmente fazer deploy!** ✨

---

## 📊 CHECKLIST FINAL

Antes de compartilhar com beta testers:

- [ ] GitHub conta criada
- [ ] Repositório criado
- [ ] Código enviado para GitHub
- [ ] Vercel conta criada
- [ ] Projeto importado no Vercel
- [ ] 4 variáveis adicionadas corretamente
- [ ] Deploy completo (verde ✓)
- [ ] Site abrindo sem erros
- [ ] Login funcionando
- [ ] Painel abrindo

---

## 🎯 PRÓXIMO PASSO

### Quando tudo funciona:

```
1. Copie seu link: https://gestaoeklesia.vercel.app
2. Compartilhe com 2-3 pessoas
3. Peça feedback (bugs, sugestões)
4. Você corrige bugs localmente
5. git push → Vercel atualiza automático
6. Beta testers veem versão nova em 1 min
```

---

## 📞 PRECISA DE AJUDA?

### Durante deploy:
- Vercel Docs: https://vercel.com/docs
- GitHub Docs: https://docs.github.com

### Problemas específicos do projeto:
- Vercel Dashboard → Deployments → Click no deploy
- Ver log completo do erro
- Procure pela linha com "Error:"

---

## ⏱️ TEMPO TOTAL

```
Passo 1 (Git):          2 min
Passo 2 (GitHub):       2 min
Passo 3 (Push):         2 min
Passo 4 (Vercel):       2 min
Passo 5 (Variáveis):    5 min
Passo 6 (Deploy):       2 min
Passo 7 (Teste):        2 min

TOTAL:                  15 MINUTOS ⏱️
```

---

## 🎉 APÓS ISSO

Seu app está **ONLINE** e **PRONTO** para:
- ✅ Beta testers acessarem
- ✅ Feedback em tempo real
- ✅ Deployments automáticos
- ✅ Versionamento no Git

**Parabéns! Você é um developer agora!** 🚀

---

**Pronto para começar? Comece pelo Passo 1!**

Se tiver dúvidas em qualquer passo, me chama! 💬

---

**Data:** 08 de Janeiro de 2026  
**Status:** Pronto para deploy beta  
**Tempo esperado:** 15 minutos
