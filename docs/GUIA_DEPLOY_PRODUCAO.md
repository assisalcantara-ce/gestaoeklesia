# 🚀 GUIA: Deploy do GestãoEklesia para Produção

**Data:** 08 de Janeiro de 2026

---

## 📊 Análise do Projeto

### Stack Atual:
- **Frontend:** Next.js 16.0.5 (React 19, TypeScript)
- **Backend:** Next.js API Routes
- **Banco de Dados:** Supabase PostgreSQL (já na nuvem)
- **Autenticação:** Supabase Auth
- **Styling:** Tailwind CSS
- **Runtime:** Node.js

### Requisitos para Deploy:
- ✅ NEXT_PUBLIC_SUPABASE_URL (público)
- ✅ NEXT_PUBLIC_SUPABASE_KEY (público)
- 🔐 SUPABASE_SERVICE_ROLE_KEY (secreto)
- 🔐 NEXT_PUBLIC_APP_URL (para URLs de callback)

---

## 🏆 RECOMENDAÇÕES (Top 3)

### 1️⃣ **VERCEL** ⭐ MELHOR ESCOLHA

**Por quê?**
- Feito pela mesma empresa que criou Next.js
- Integração perfeita (zero configuração)
- Deploy automático do GitHub
- Muito rápido (~1-2 minutos)
- Suporte a variáveis secretas
- Preview deployments
- Logs em tempo real
- SSL automático

**Plano:**
- **Gratuito:** Até 10GB/mês, perfeito para começar
- **Pro:** $20/mês se crescer muito

**Como fazer:**
```bash
1. Ir para: https://vercel.com
2. Sign up com GitHub
3. Conectar repositório
4. Adicionar variáveis de ambiente
5. Deploy automático ✅
```

**Pros:**
- ✅ Melhor performance possível
- ✅ CDN global
- ✅ Sem configuração
- ✅ Deploy em segundos
- ✅ Suporta tudo que seu app precisa

**Contras:**
- Precisa do repositório no GitHub/GitLab

---

### 2️⃣ **RAILWAY** ⭐ BOA ALTERNATIVA

**Por quê?**
- Interface bem simples
- Suporta Next.js nativamente
- Gratuito para começar ($5/mês depois)
- Integração GitHub fácil
- Melhor custo-benefício

**Plano:**
- **Gratuito:** Primeiros $5
- **Depois:** Paga conforme usa (bem barato)

**Como fazer:**
```bash
1. Ir para: https://railway.app
2. Sign up com GitHub
3. Conectar repositório
4. Configurar variáveis
5. Deploy automático ✅
```

**Pros:**
- ✅ Muito barato
- ✅ Fácil de usar
- ✅ Suporte 24/7
- ✅ Preview deployments
- ✅ Bom para startups

**Contras:**
- Não é tão rápido quanto Vercel globalmente

---

### 3️⃣ **RENDER** ⭐ SIMPLISTA

**Por quê?**
- Muito direto
- Bom para Next.js
- Gratuito para começar
- Integração GitHub simples

**Plano:**
- **Gratuito:** Ilimitado (com limitações)
- **Starter:** $7/mês para melhor performance

**Como fazer:**
```bash
1. Ir para: https://render.com
2. Sign up com GitHub
3. Criar novo Web Service
4. Apontar repositório
5. Deploy automático ✅
```

**Pros:**
- ✅ Gratuito para experimentar
- ✅ Fácil demais
- ✅ Documentação clara

**Contras:**
- Servidor gratuito é lento
- Performance reduzida

---

## ⚡ COMPARAÇÃO RÁPIDA

| Critério | Vercel | Railway | Render |
|----------|--------|---------|--------|
| **Setup** | 2 min | 3 min | 3 min |
| **Performance** | 🔥🔥🔥 Melhor | 🔥🔥 Boa | 🔥 OK |
| **Preço (início)** | Gratuito | Gratuito | Gratuito |
| **Scaling** | Excelente | Bom | Regular |
| **CDN Global** | ✅ Sim | ⚠️ Parcial | ❌ Não |
| **Recomendado** | ✅ SIM | ✅ SIM | ⚠️ Teste |

---

## 🎯 MEU RECOMENDADO

### Para GestãoEklesia:

**Use: VERCEL** (produção)

**Motivos:**
1. Melhor performance para usuários espalhados pelo Brasil
2. Next.js funciona perfeito (feito pela Vercel)
3. Sem configuração necessária
4. Suporte a Supabase é nativo
5. Deploy em segundos
6. Gratuito para começar
7. Escalável quando crescer

**Backup:** Railway (se Vercel não funcionar por algum motivo)

---

## 📋 PASSO A PASSO: DEPLOY NO VERCEL

### Pré-requisitos:
```
✅ Projeto no GitHub (público ou privado)
✅ Variáveis de ambiente definidas
✅ Supabase já configurado
```

### Passo 1: Preparar o Projeto

**Verificar package.json:**
```json
{
  "scripts": {
    "build": "next build",
    "start": "next start",
    "dev": "next dev"
  }
}
```

**Arquivo .env.local (não commitar!):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<NEXT_PUBLIC_SUPABASE_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
NEXT_PUBLIC_APP_URL=https://seuapp.vercel.app
```

### Passo 2: Enviar para GitHub

```bash
# Criar repositório (se não tiver)
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/seuemail/gestaoeklesia.git
git push -u origin main
```

### Passo 3: Conectar ao Vercel

1. **Acessar:** https://vercel.com
2. **Clicar:** "Add New..." → "Project"
3. **Selecionar:** Seu repositório
4. **Configurar:**
   - Framework Preset: `Next.js`
   - Build Command: `next build` (padrão)
   - Start Command: `next start` (padrão)
   - Root Directory: `.` (padrão)

### Passo 4: Adicionar Variáveis de Ambiente

```
No Vercel Dashboard → Settings → Environment Variables

Adicionar:
- NEXT_PUBLIC_SUPABASE_URL: seu_url
- NEXT_PUBLIC_SUPABASE_KEY: sua_key_publica
- SUPABASE_SERVICE_ROLE_KEY: sua_service_role_key
- NEXT_PUBLIC_APP_URL: https://seu-dominio.vercel.app
```

### Passo 5: Deploy

1. Clique em "Deploy"
2. Aguarde ~1-2 minutos
3. ✅ Seu site estará em: https://seu-projeto.vercel.app

---

## 🔗 PRÓXIMAS ETAPAS

### 1. Domínio Próprio (opcional)

**Vercel permite:**
```
seu-projeto.vercel.app (gratuito)
OU
seu-dominio.com.br (seu próprio)
```

**Como adicionar domínio:**
- Comprar em: Godaddy, UOL, Registro.br, etc.
- No Vercel: Settings → Domains → Add Domain
- Configurar DNS (Vercel guia passo a passo)

### 2. SSL (HTTPS)

✅ **Automático no Vercel!** (não precisa fazer nada)

### 3. Monitoramento

No Vercel Dashboard você vê:
- Logs em tempo real
- Performance (Core Web Vitals)
- Erros
- Deployments anteriores

### 4. Rollback Instantâneo

Se quebrar algo:
1. Vá ao Vercel Dashboard
2. Clique em deployment anterior
3. Clique "Promote to Production"
4. ✅ Volta para versão anterior em segundos

---

## 💡 CONSIDERAÇÕES IMPORTANTES

### Variáveis Secretas

**IMPORTANTE:** 
- `SUPABASE_SERVICE_ROLE_KEY` NUNCA deve ir no GitHub
- Adicionar no `.gitignore`:
```
.env.local
.env
```

**Variáveis públicas (OK enviar):**
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_KEY

### Banco de Dados (Supabase)

**Já está na nuvem, então:**
- ✅ Não precisa fazer backup de banco
- ✅ Acesso do Vercel funciona automaticamente
- ✅ RLS continua funcionando
- ✅ Logs continuam funcionando

### Performance

**Vercel + Next.js + Supabase = ⚡ RÁPIDO**

Expected:
- Homepage: <200ms
- API routes: <100ms
- Dashboard: <500ms

---

## 🚨 CHECKLIST PRÉ-DEPLOY

Antes de fazer deploy, verifique:

### Código
- [x] Sem console.log de dados sensíveis
- [x] Sem variáveis hardcoded
- [x] Senha gerada aleatoriamente
- [x] RLS funcionando
- [x] Validações no backend

### Banco de Dados
- [x] Supabase em produção (não local)
- [x] RLS ativado em tabelas sensíveis
- [x] Backups configurados
- [x] Migrations aplicadas

### Segurança
- [x] Service role key apenas em variáveis secretas
- [x] CORS configurado corretamente
- [x] Email confirmado para sign-up
- [x] Rate limiting configurado

### Ambiente
- [x] NEXT_PUBLIC_APP_URL correto
- [x] Sem erros de compilação
- [x] npm run build funciona localmente

---

## 📞 SUPORTE

Se tiver problemas:

**Vercel Docs:** https://vercel.com/docs
**Next.js Docs:** https://nextjs.org/docs
**Supabase Docs:** https://supabase.com/docs

---

## 🎉 RESUMO

| Ação | Tempo | Dificuldade |
|------|-------|------------|
| Criar conta Vercel | 2 min | Muito fácil |
| Conectar GitHub | 2 min | Muito fácil |
| Adicionar variáveis | 5 min | Fácil |
| Deploy | 1-2 min | Automático |
| **Total** | **~10 minutos** | **Muito fácil** |

**Resultado:** Seu app em produção! 🚀

---

**Recomendação Final:**
- ✅ **Use Vercel** (melhor escolha)
- ✅ **Custo:** Gratuito ou muito barato
- ✅ **Setup:** Ultra simples
- ✅ **Performance:** Excelente
- ✅ **Escalável:** Cresce com você

**Quando estiver pronto, posso ajudar com o deploy! 🚀**

---

**Preparado em:** 08 de Janeiro de 2026  
**Status:** Pronto para deploy  
**Próximo passo:** Enviar para GitHub e depois Vercel
