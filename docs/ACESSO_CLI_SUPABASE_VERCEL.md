# 🔐 Acesso CLI - Supabase & Vercel

**Data:** 14 de janeiro de 2026  
**Status:** ✅ Acesso Confirmado e Funcional

---

## 📊 Status de Acesso

| Ferramenta | Status | Tipo de Acesso | Autenticação |
|-----------|--------|----------------|--------------|
| **Supabase** | ✅ Funcional | REST API + npx | Service Role Key |
| **Vercel** | ✅ Funcional | CLI Completa | Token OAuth |

---

## 🔐 Credenciais Supabase

```
URL: https://<project-ref>.supabase.co
Publishable Key (Anon Key): <NEXT_PUBLIC_SUPABASE_ANON_KEY>
Service Role Key: <SUPABASE_SERVICE_ROLE_KEY>
JWT Key (Current): <JWT_SECRET>
```

---

## ✅ O Que Você Pode Fazer

### 1️⃣ Supabase REST API (100% Funcional)

Acessar qualquer tabela com:
```powershell
$headers = @{
  "apikey" = "<SUPABASE_SERVICE_ROLE_KEY>"
  "Content-Type" = "application/json"
}

Invoke-RestMethod `
  -Uri "https://drzafeksbddnoknvznnd.supabase.co/rest/v1/admin_users?select=*" `
  -Headers $headers
```

### 2️⃣ Supabase CLI via npx (100% Funcional)

```bash
# Versão: 2.72.7

# Ver comandos disponíveis
npx supabase --help

# Comandos úteis (requerem sbp_ token - não disponível)
npx supabase db pull          # Puxa schema do banco
npx supabase migration list   # Lista migrações
npx supabase functions list   # Lista functions PostgreSQL
```

**⚠️ Limitação:** Alguns comandos requerem um **Access Token** no formato `sbp_...` que não foi fornecido. Mas você pode:
- ✅ Usar REST API diretamente
- ✅ Usar Supabase Dashboard (web)
- ✅ Usar o SDK JavaScript (@supabase/supabase-js)

### 3️⃣ Vercel CLI (100% Funcional)

```bash
# Versão: 50.3.0
# Status: Autenticado

# Deploy para Vercel
vercel deploy

# Deploy de produção
vercel deploy --prod

# Ver projetos
vercel projects list

# Variáveis de ambiente
vercel env list
vercel env add SECRET_KEY
```

---

## 🚀 Comandos Úteis

### Testar Supabase REST API

```powershell
# Listar usuários admin
$headers = @{
  "apikey" = "<SUPABASE_SERVICE_ROLE_KEY>"
  "Content-Type" = "application/json"
}

Invoke-RestMethod `
  -Uri "https://<project-ref>.supabase.co/rest/v1/admin_users" `
  -Headers $headers | ConvertTo-Json
```

### Fazer Deploy no Vercel

```bash
npm run build
vercel deploy --prod
```

### Usar Supabase SDK no Código

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://<project-ref>.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '<SUPABASE_SERVICE_ROLE_KEY>'
);

// Fazer queries
const { data } = await supabase.from('admin_users').select();
```

---

## 🎯 Próximas Ações

### Se Você Precisa De:

**CLI Supabase Completa (db pull, migrations, etc)**
- Solicite um **Access Token** (`sbp_...`) no Supabase Dashboard
- Settings → API Tokens → Create new token (Manage all)
- Depois: `export SUPABASE_ACCESS_TOKEN=sbp_...`

**Deploy em Produção**
- ✅ Já pode usar: `vercel deploy --prod`
- Apenas execute em um branch pronto

**Banco de Dados Local**
- ✅ Pode usar: `npx supabase start` (requer Docker)
- Cria banco local para desenvolvimento

**Monitorar Aplicação**
- ✅ Vercel Dashboard: https://vercel.com
- ✅ Supabase Dashboard: https://app.supabase.com

---

## 📝 Resumo de Acesso

```
✅ Supabase REST API       - TOTAL
✅ Supabase SDK            - TOTAL
✅ Supabase CLI (npx)      - PARCIAL (requer sbp_ token para alguns comandos)
✅ Vercel CLI              - TOTAL
✅ Ambiente de Produção    - PRONTO
✅ Banco de Dados          - ACESSÍVEL
```

---

**Tudo configurado e pronto para usar!** 🚀
