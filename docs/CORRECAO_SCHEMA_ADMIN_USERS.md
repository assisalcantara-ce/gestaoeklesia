# 🔧 CORREÇÃO - Schema admin_users Incompatível

**Data:** 3 de janeiro de 2026  
**Status:** ✅ CORRIGIDO

---

## 🔍 PROBLEMA ENCONTRADO

### Erro no Log:
```
[MIDDLEWARE] Acesso negado para admin@gestaoeklesia.local - não é admin válido
```

### Causa Raiz:
A tabela `admin_users` foi criada com um schema **diferente** do que o novo middleware esperava:

#### ❌ O que o novo código esperava:
```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),  -- Campo esperado
  email VARCHAR NOT NULL,
  nome VARCHAR NOT NULL,
  role VARCHAR NOT NULL,
  ativo BOOLEAN NOT NULL,
  ...
);
```

#### ✅ O que realmente existe:
```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,  -- Campo disponível
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,  -- 'ATIVO' em vez de booleano
  ...
);
```

**Conclusão:** A tabela `admin_users` **não tinha campo `user_id`** e usava `status` em vez de `ativo`.

---

## ✅ SOLUÇÃO IMPLEMENTADA

Atualizei o código para **fazer fallback automático** entre os dois modelos de schema:

### 1. Proxy (ex-Middleware) (`src/proxy.ts`)
```typescript
// Primeiro tenta modelo novo (com user_id)
let adminUser = await supabase
  .from('admin_users')
  .select('id, email, role, ativo')
  .eq('user_id', user.id)
  .eq('ativo', true)
  .single()

// Se não encontrou, tenta modelo antigo (com email e status)
if (!adminUser && user.email) {
  adminUser = await supabase
    .from('admin_users')
    .select('id, email, role, status')
    .eq('email', user.email)
    .eq('status', 'ATIVO')
    .single()
}
```

### 2. AdminAuthProvider (`src/providers/AdminAuthProvider.tsx`)
Mesma lógica de fallback.

### 3. Login Page (`src/app/admin/page.tsx`)
Mesma lógica de fallback.

---

## 🎯 Novo Fluxo de Autenticação

```
User faz login: admin@gestaoeklesia.local / (senha não registrada em .md)
         ↓
Supabase Auth valida credenciais
         ↓
Usuário autenticado (user.id, user.email)
         ↓
Busca na admin_users por user_id
  ├─ Encontrou? → ✅ Admin válido
  └─ Não encontrou?
      ↓
      Busca na admin_users por email
        ├─ Encontrou com status='ATIVO'? → ✅ Admin válido (schema antigo)
        └─ Não encontrou? → ❌ Acesso negado
```

---

## 🔄 Compatibilidade de Schemas

Agora o código suporta **ambos os schemas**:

| Campo | Novo Schema | Schema Antigo | Suportado |
|-------|------------|-----------------|-----------|
| `id` | UUID PK | UUID PK | ✅ |
| `user_id` | UUID FK | ❌ | ⚠️ Fallback |
| `email` | VARCHAR | VARCHAR | ✅ |
| `role` | VARCHAR | VARCHAR | ✅ |
| `ativo` | BOOLEAN | ❌ | ⚠️ Usa `status` |
| `status` | ❌ | VARCHAR | ⚠️ Fallback |
| `nome` | VARCHAR | VARCHAR | ✅ |

---

## ✅ O QUE FOI CORRIGIDO

1. ✅ **Middleware** agora faz fallback de `user_id` → `email`
2. ✅ **AdminAuthProvider** agora faz fallback
3. ✅ **Login page** agora faz fallback
4. ✅ Aviso do Supabase removido (usando `getUser()` seguro)
5. ✅ Melhor logging para debug

---

## 🧪 COMO TESTAR

1. **Abra navegação privada**
2. **Acesse:** `http://localhost:3000/admin/login`
3. **Faça login com:**
   - Email: `admin@gestaoeklesia.local`
  - Senha: (não registrar em .md)
4. **Esperado:** 
   - ✅ Login funciona
   - ✅ Redireciona para dashboard
   - ✅ Logs mostram `[MIDDLEWARE] ✅ Admin válido`

---

## 📋 Logs Esperados

### Antes (ERRO):
```
[MIDDLEWARE] Usuário autenticado: admin@gestaoeklesia.local
[MIDDLEWARE] Acesso negado - não é admin válido
GET /admin/login 200
```

### Depois (SUCESSO):
```
[MIDDLEWARE] Usuário autenticado: admin@gestaoeklesia.local
[MIDDLEWARE] user_id não encontrado, tentando buscar por email
[MIDDLEWARE] ✅ Admin válido: admin@gestaoeklesia.local (role: admin)
GET /admin/dashboard 200
```

---

## 🚀 PRÓXIMAS MELHORIAS RECOMENDADAS

1. **Migração de Schema** (Opcional)
   ```sql
   -- Adicionar user_id ao schema antigo
   ALTER TABLE admin_users ADD COLUMN user_id UUID REFERENCES auth.users(id);
   UPDATE admin_users SET user_id = (SELECT id FROM auth.users WHERE email = admin_users.email);
   ALTER TABLE admin_users ADD CONSTRAINT unique_user_id UNIQUE(user_id);
   ALTER TABLE admin_users DROP COLUMN password_hash; -- Usar Supabase Auth
   ALTER TABLE admin_users RENAME COLUMN status TO ativo;
   ALTER TABLE admin_users ALTER COLUMN ativo TYPE BOOLEAN USING (ativo = 'ATIVO');
   ```

2. **RLS Policies** para `admin_users`
   ```sql
   CREATE POLICY "admin_users_self"
     ON admin_users
     FOR SELECT
     USING (auth.uid() = user_id);
   ```

3. **Índices Adicionais**
   ```sql
   CREATE INDEX idx_admin_users_status ON admin_users(status);
   ```

---

## 📚 Referência

**Tabela admin_users atual:**
```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(14) UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'ATIVO',
  ...
);
```

**Credenciais de Teste:**
- Email: `admin@gestaoeklesia.local`
- Senha: (não registrar em .md)
- Status: `ATIVO`

---

**Correção implementada:** 3 de janeiro de 2026  
**Compatibilidade:** Suporta schema antigo + novo  
**Segurança:** Middleware usa `getUser()` (servidor)
