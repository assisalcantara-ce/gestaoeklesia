# ✅ VALIDAÇÃO: Credenciais Definitivas com Supabase

**Data:** 08 de Janeiro de 2026  
**Assunto:** Alinhamento de credenciais definitivas com Supabase

---

## 🎯 Problema Identificado

O painel estava gerando credenciais com `is_permanent: true`, mas o endpoint estava ignorando esse parâmetro e criando apenas credenciais de **teste** (7 dias).

---

## ✅ Solução Implementada

### 1️⃣ Endpoint Atualizado
**Arquivo:** `/api/v1/admin/test-credentials/route.ts`

#### Antes ❌
- Sempre criava credenciais de teste (7 dias)
- Ignorava parâmetro `is_permanent`
- Criava ministério com prefixo "TESTE -"
- Armazenava em `test_credentials` (temporário)

#### Depois ✅
- **Recebe parâmetro `is_permanent`**
- **Se `is_permanent: true`:**
  - ✅ Cria usuário com email real (não temporário)
  - ✅ Cria ministério **permanente** (sem TESTE -)
  - ✅ Plano: `professional` (não `trial`)
  - ✅ Sem data de expiração (null)
  - ✅ Máximo 50 usuários (não 5)
  - ✅ Armazenamento: 5GB (não 1GB)
  - ✅ Atualiza pre_registration status para `converted`
- **Se `is_permanent: false` ou trial:**
  - ✅ Cria usuário com email temporário
  - ✅ Cria ministério com prefixo "TESTE -"
  - ✅ Plano: `trial`
  - ✅ Data de expiração: 7 dias
  - ✅ Máximo 5 usuários
  - ✅ Armazenamento: 1GB
  - ✅ Armazena em `test_credentials`

---

## 🔄 Fluxo Completo Agora

### Admin clica "🔐 Gerar Credenciais Definitivas"

```
1. Painel (atendimento/page.tsx)
   └─ handleGenerateCredentials()
      └─ POST /api/v1/admin/test-credentials
         ├─ pre_registration_id: UUID
         ├─ email: "contato@igleja.com"
         ├─ is_permanent: true ← CHAVE
         └─ trial_days: null

2. Endpoint (test-credentials/route.ts)
   └─ POST Handler
      ├─ Valida pré-registro ✅
      ├─ Cria usuário Auth
      │  └─ email: "contato@igleja.com" (real!)
      │  └─ user_metadata.is_permanent: true
      ├─ Cria ministério permanente
      │  ├─ name: "Igreja Central" (SEM "TESTE -")
      │  ├─ plan: "professional"
      │  ├─ subscription_end_date: null (SEM EXPIRAÇÃO!)
      │  ├─ max_users: 50
      │  └─ is_trial: false
      ├─ Adiciona usuário como admin
      │  └─ ministry_users(ministry_id, user_id, role='admin')
      ├─ Atualiza pre_registration
      │  └─ status: 'converted'
      └─ Retorna credenciais

3. Painel mostra sucesso
   └─ "✅ Credenciais DEFINITIVAS geradas com sucesso!"
   └─ Email: contato@igleja.com
   └─ Senha: [senha_gerada]

4. Ministério agora pode acessar
   └─ URL: https://sistema/auth/login
   └─ Email: contato@igleja.com
   └─ Senha: [senha_gerada]
   └─ ✅ Acesso PERMANENTE (sem expiração)
```

---

## 📊 Comparação: Trial vs Permanent

### Trial (7 dias) 🔄

```typescript
is_permanent: false

// Usuário Auth
email: "test_1234567890@test.local"
user_metadata.is_permanent: false
user_metadata.created_as: "trial"

// Ministério
name: "TESTE - Igreja Central"
plan: "trial"
subscription_end_date: "2026-01-15T10:00:00Z" (7 dias)
max_users: 5
is_trial: true

// Armazenamento
test_credentials {
  username: "test_1234567890"
  expires_at: "2026-01-15T10:00:00Z"
  is_active: true
}

// Acesso
✅ Funciona por 7 dias
❌ Depois expira
```

### Permanent (Definitivo) ✅

```typescript
is_permanent: true

// Usuário Auth
email: "contato@igleja.com" (REAL!)
user_metadata.is_permanent: true
user_metadata.created_as: "definitive"

// Ministério
name: "Igreja Central" (SEM TESTE -)
plan: "professional"
subscription_end_date: null (NENHUMA EXPIRAÇÃO!)
max_users: 50
is_trial: false

// Armazenamento
test_credentials: NÃO criado
pre_registrations.status: "converted"

// Acesso
✅ Funciona permanentemente
✅ Sem limite de dias
✅ Usuário real no Supabase
```

---

## 🔐 Mudanças no Código

### Antes ❌
```typescript
const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
  email: `${username}@test.local`,  // ← SEMPRE temporário
  password: password,
  email_confirm: true,
});
```

### Depois ✅
```typescript
const isPermanent = is_permanent === true;
const userEmail = isPermanent 
  ? email                          // ← EMAIL REAL para definitivo
  : `${suffix}@test.local`;        // ← Email temporário para trial

const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
  email: userEmail,                // ← FLEXÍVEL
  password: password,
  email_confirm: true,
  user_metadata: {
    is_permanent: isPermanent,
    created_as: isPermanent ? 'definitive' : 'trial',
  },
});
```

---

## ✅ Validação de Alinhamento com Supabase

### 1️⃣ Supabase Auth ✅
```
✅ Cria usuário com email real (contato@igleja.com)
✅ Confirma email automaticamente (email_confirm: true)
✅ Senha segura gerada
✅ user_metadata armazena flag is_permanent
✅ Usuário pode fazer login imediatamente
```

### 2️⃣ Tabela `ministries` ✅
```
✅ Cria registro com:
   - user_id: do usuário criado
   - name: sem prefixo "TESTE -"
   - plan: "professional" (não trial)
   - subscription_end_date: null (sem expiração)
   - is_trial: false
   - max_users: 50
```

### 3️⃣ Tabela `ministry_users` ✅
```
✅ Adiciona relação:
   - ministry_id: do ministério criado
   - user_id: do usuário criado
   - role: "admin"
   - is_active: true
```

### 4️⃣ Tabela `pre_registrations` ✅
```
✅ Atualiza status:
   - status: 'converted' (foi aprovado)
   - updated_at: agora
```

### 5️⃣ RLS (Row Level Security) ✅
```
✅ Usuário pode acessar:
   - ministry_users: sua própria ministry
   - members: apenas de sua ministry
   - Todas as tabelas vinculadas ao ministry
```

---

## 🚀 Fluxo de Acesso

### Quando ministério faz login:

```
1. Usuario digita email/senha em /auth/login
2. Supabase valida credenciais
3. JWT é gerado com user_id
4. Sistema busca ministry_users para esse user_id
5. RLS permite acesso apenas aos dados dessa ministry
6. Dashboard abre normalmente
7. ✅ ACESSO PERMANENTE (indefinido, sem expiração)
```

---

## 📋 Checklist de Validação

### Código
- [x] Endpoint recebe parâmetro `is_permanent`
- [x] Lógica separa trial vs permanent
- [x] Usuário Auth criado com email correto
- [x] Ministério criado sem prefixo "TESTE -"
- [x] Plano definido corretamente
- [x] Data de expiração nula para permanent
- [x] ministry_users adicionado corretamente
- [x] pre_registrations atualizado para converted
- [x] test_credentials NÃO criado para permanent
- [x] Compilação sem erros

### Supabase
- [x] Tabela `ministries` tem coluna `is_trial`
- [x] Tabela `ministry_users` permite role='admin'
- [x] Tabela `pre_registrations` tem status 'converted'
- [x] RLS permite acesso do usuário seu próprio ministry
- [x] Auth users podem fazer login com email real

### Segurança
- [x] Senha gerada aleatoriamente (12 caracteres)
- [x] Email confirmado automaticamente
- [x] user_metadata marca tipo de credencial
- [x] Acesso restrito ao próprio ministry (RLS)
- [x] Sem tokens hardcoded
- [x] Service role key só no backend

---

## 🎯 Resultado Final

### Antes ❌
```
Gerar credenciais → Cria trial de 7 dias
                  → Não funciona permanentemente
                  → Email temporário (@test.local)
                  → Impraticável para produção
```

### Depois ✅
```
Gerar credenciais permanentes → Acesso real no sistema
                              → Email real (contato@igleja.com)
                              → Sem expiração
                              → Ministério pode usar indefinidamente
                              → ✅ Alinhado com Supabase
```

---

## 📝 Exemplos Práticos

### Exemplo 1: Gerar Trial (7 dias)
```bash
POST /api/v1/admin/test-credentials
{
  "pre_registration_id": "uuid-123",
  "email": "contato@igleja.com",
  "is_permanent": false,
  "trial_days": 7
}

Response:
{
  "success": true,
  "data": {
    "username": "test_1234567890",
    "password": "a1b2c3d4e5f6",
    "email": "test_1234567890@test.local",
    "ministry_id": "uuid-456",
    "expires_at": "2026-01-15T10:00:00Z"
  },
  "message": "✅ Credenciais de teste geradas com sucesso! Válidas por 7 dias."
}
```

### Exemplo 2: Gerar Permanent (Indefinido)
```bash
POST /api/v1/admin/test-credentials
{
  "pre_registration_id": "uuid-123",
  "email": "contato@igleja.com",
  "is_permanent": true,
  "trial_days": null
}

Response:
{
  "success": true,
  "data": {
    "username": "contato",
    "password": "f1e2d3c4b5a6",
    "email": "contato@igleja.com",         ← EMAIL REAL!
    "ministry_id": "uuid-456",
    "expires_at": null,                    ← SEM EXPIRAÇÃO!
    "is_permanent": true
  },
  "message": "✅ Credenciais DEFINITIVAS geradas com sucesso! Acesso permanente ativado."
}
```

---

## 🔗 Links Relacionados

- Endpoint: `/src/app/api/v1/admin/test-credentials/route.ts`
- Painel: `/src/app/admin/atendimento/page.tsx` (função `handleGenerateCredentials`)
- Schema: `/supabase/migrations/20260102200944_initial_schema.sql`

---

## 🎉 Status Final

✅ **Alinhamento com Supabase: COMPLETO**

O sistema agora gera credenciais definitivas que:
- ✅ Criam usuário REAL no Supabase Auth
- ✅ Com email real (não temporário)
- ✅ Ministério permanente (sem expiração)
- ✅ Plano professional (não trial)
- ✅ Acesso indefinido ao sistema
- ✅ Totalmente alinhado com RLS

**Resultado:** Quando admin gera credenciais definitivas, o ministério recebe acesso **REAL E PERMANENTE** ao sistema! 🚀

---

**Implementado em:** 08 de Janeiro de 2026  
**Status:** ✅ Verificado e Validado  
**Pronto para:** Produção
