# ⚡ DEPLOY BETA: Checklist Rápido

**Data:** 08 de Janeiro de 2026

---

## 🎯 Seu objetivo AGORA:

Colocar seu projeto online no Vercel em **15 minutos**

---

## ✅ O que você tem pronto:

- [x] Código no local
- [x] .gitignore criado (não envia secrets)
- [x] .env.local com variáveis
- [x] package.json pronto
- [x] Supabase configurado
- [x] Projeto funciona localmente

---

## 📋 Checklist: 5 Passos Rápidos

### PASSO 1: GitHub (5 min)
```
[ ] Ir para: https://github.com/new
[ ] Criar repositório: "gestaoeklesia"
[ ] Visibilidade: Private (apenas você)
[ ] Copiar URL exibido (https://github.com/SEU_USER/gestaoeklesia.git)
```

### PASSO 2: Enviar código (5 min)
```powershell
cd c:\BACKUP\DESENVOLVIMENTO\gestaoeklesia

# Copie e execute estas 6 linhas:
git init
git add .
git commit -m "Initial commit: GestãoEklesia beta"
git branch -M main
git remote add origin https://github.com/SEU_USER/gestaoeklesia.git
git push -u origin main

# Aguarde... (vai pedir seu login GitHub)
```

**Resultado:** ✓ Seu código está no GitHub

---

### PASSO 3: Vercel (2 min)
```
[ ] Ir para: https://vercel.com
[ ] Sign up com GitHub
[ ] Clique em: "Add New..." → "Project"
[ ] Selecionar seu repositório: gestaoeklesia
[ ] Clique em: "Import"
```

**Resultado:** ✓ Vercel está lendo seu repositório

---

### PASSO 4: Variáveis de Ambiente (3 min)

Na tela de importação do Vercel, adicione:

```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://<project-ref>.supabase.co
[Add]

Name: NEXT_PUBLIC_SUPABASE_KEY
Value: <NEXT_PUBLIC_SUPABASE_ANON_KEY>
[Add]

Name: SUPABASE_SERVICE_ROLE_KEY
Value: <SUPABASE_SERVICE_ROLE_KEY>
[Add]

Name: NEXT_PUBLIC_APP_URL
Value: https://gestaoeklesia.vercel.app
[Add]
```

**Pegar valores em:** https://app.supabase.com → Settings → API

**Resultado:** ✓ Variáveis configuradas

---

### PASSO 5: Deploy (1 min)
```
[ ] Clique em: "Deploy"
[ ] Aguarde 1-2 minutos (página mostra progresso)
[ ] Veja: "✓ Deployment complete!"
```

**Resultado:** ✓ Seu app está ONLINE!

---

## 🎉 Resultado Final

```
URL Beta: https://gestaoeklesia.vercel.app
Acesso: Qualquer um com o link
Testes: Com amigos/beta testers
```

---

## 📱 Próximos Deployments (Super fácil)

Depois que estiver online, para fazer atualizações:

```powershell
# 1. Editar código localmente
# 2. Fazer commit
git add .
git commit -m "Feature: descrição"
git push origin main

# 3. Vercel atualiza AUTOMATICAMENTE em ~1 min
# 4. Beta testers veem versão nova no link
```

---

## 🤖 Alternativa: Usar Script Automático

Se não quer fazer manualmente, execute:

```powershell
# Abrir PowerShell na pasta do projeto
cd c:\BACKUP\DESENVOLVIMENTO\gestaoeklesia

# Executar script
.\deploy-beta.ps1

# Ele faz tudo automaticamente (pede apenas GitHub URL)
```

---

## 🔐 IMPORTANTE: Segurança

✅ **Seu `.gitignore` protege:**
- `.env.local` (não vai para GitHub)
- `SUPABASE_SERVICE_ROLE_KEY` (segredo no Vercel)
- Ninguém consegue ver suas chaves no GitHub

---

## 📞 Problemas?

**Deploy falhou?**
- Vercel Dashboard → Deployments → Click no vermelho
- Ver log completo do erro
- Procurar por "Error:"

**Página em branco?**
- F12 (DevTools) → Console
- Ver mensagens de erro
- Variável faltando? Adicionar no Vercel

**Login não funciona?**
- Variáveis de Supabase corretas?
- Email e senha de teste criados?
- Network tab (F12) mostra erro?

---

## ⏱️ Timeline

```
Agora (hoje):      Deploy beta online
Próximos 7 dias:   Feedback de beta testers
Depois de 1 semana: Deploy em produção oficial
```

---

## 🚀 Comece AGORA!

**Tempo estimado:** 15 minutos

**Seu link beta será:**
```
https://gestaoeklesia.vercel.app
```

**Compartilhe com:**
- 2-3 amigos para testes
- Colha feedback
- Faça melhorias contínuas

---

## 📚 Arquivos que criei para você:

- `DEPLOY_BETA_PASSO_A_PASSO.md` - Guia super detalhado
- `deploy-beta.ps1` - Script automático (Windows)
- `deploy-beta.sh` - Script automático (Linux/Mac)
- `.gitignore` - Protege seus secrets
- `DEPLOY_BETA_CHECKLIST.md` - Este arquivo

---

## ✨ Bora lá!

Qualquer dúvida durante o processo, só me chamar! 💬

**Próximo passo:** PASSO 1 (GitHub)

---

**Criado em:** 08 de Janeiro de 2026  
**Status:** Pronto para deploy  
**Tempo:** ~15 minutos
