# 🔧 RESOLUÇÃO: Dashboard Admin Fecha e Retorna para Login

## Problema Identificado

O usuário de suporte foi criado com sucesso, mas quando tenta acessar o dashboard, recebe erro 403 (Forbidden) e é redirecionado para login. 

**Causa raiz:** A tabela `admin_users` estava com colunas de permissões faltando (`can_manage_*`), o que causava falha na inserção do registro.

## Solução em 3 Passos

### ✅ PASSO 1: Aplicar Migração SQL

Vá para: **https://supabase.com/dashboard**
1. Clique em seu projeto
2. Vá para: **SQL Editor** (lado esquerdo)
3. Clique em: **New Query**
4. **Copie o SQL abaixo e cole no editor:**

```sql
-- Adicionar colunas de permissões à tabela admin_users
ALTER TABLE admin_users
ADD COLUMN IF NOT EXISTS can_manage_ministries BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_payments BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_plans BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_support BOOLEAN DEFAULT false;

-- Atualizar admins existentes para ter todas as permissões
UPDATE admin_users
SET 
  can_manage_ministries = true,
  can_manage_payments = true,
  can_manage_plans = true,
  can_manage_support = true
WHERE role IN ('admin', 'super_admin');

-- Atualizar usuários de suporte
UPDATE admin_users
SET can_manage_support = true
WHERE role = 'suporte';

-- Atualizar usuários financeiros
UPDATE admin_users
SET can_manage_payments = true
WHERE role = 'financeiro';
```

5. Clique em **RUN** (ou Ctrl+Enter)
6. Aguarde a execução ✅

---

### ✅ PASSO 2: Deletar Usuário de Suporte Anterior (se existir)

Se o usuário "suporte" já foi criado mas não funciona:

```sql
-- Deletar do admin_users
DELETE FROM admin_users 
WHERE email = 'suporte@gestaoeklesia.com.br' OR email = 'seu-email@suporte.com';

-- Deletar da autenticação Supabase (execute separadamente ou via dashboard)
-- Vá para: Authentication → Users → Busque o email → Delete
```

---

### ✅ PASSO 3: Recriar o Usuário de Suporte

**Opção A: Via Dashboard Supabase (Recomendado)**

1. Vá para: **Authentication** → **Users**
2. Clique em: **Add User**
3. Preencha:
   - Email: `suporte@gestaoeklesia.com.br`
   - Password: sua senha segura
   - [x] Auto generate password (ou defina sua)
4. Clique em: **Create User**
5. Anote a senha gerada

**Opção B: Via SQL (manual)**

```sql
-- Cria usuário no Supabase Auth
-- (Use o painel de autenticação para criar)

-- Depois execute para criar em admin_users:
INSERT INTO admin_users (
  email,
  password_hash,
  role,
  nome,
  status,
  data_admissao,
  can_manage_ministries,
  can_manage_payments,
  can_manage_plans,
  can_manage_support
) VALUES (
  'suporte@gestaoeklesia.com.br',
  '$2a$10$HASH_BCRYPT_AQUI', -- Será sobrescrito pelo Supabase Auth
  'suporte',
  'Usuário de Suporte',
  'ATIVO',
  CURRENT_DATE,
  false,
  false,
  false,
  true
);
```

---

### ✅ PASSO 4: Testar Login

1. Abra: **https://www.gestaoeklesia.com.br/admin/login**
2. Faça login com:
   - Email: `suporte@gestaoeklesia.com.br`
   - Senha: a senha que criou
3. Clique em **Entrar**
4. Você deve ser redirecionado para: **https://www.gestaoeklesia.com.br/admin/dashboard**
5. ✅ Dashboard deve abrir e **permanecer aberto**

---

## Verificação Técnica

Se ainda houver problemas, execute esta query para debugar:

```sql
-- Verificar se usuário foi criado corretamente
SELECT 
  id,
  email,
  role,
  status,
  can_manage_ministries,
  can_manage_payments,
  can_manage_plans,
  can_manage_support,
  criado_em
FROM admin_users
WHERE email = 'suporte@gestaoeklesia.com.br'
LIMIT 1;
```

**O resultado deve mostrar:**
- ✅ `status` = 'ATIVO'
- ✅ `role` = 'suporte'
- ✅ `can_manage_support` = true
- ✅ Outras columns existem (mesmo que false)

---

## Alterações no Código

Os seguintes arquivos foram corrigidos:

1. **[src/lib/admin-users-service.ts](../../src/lib/admin-users-service.ts)** - Removido `user_id` e adicionado `criado_por`
2. **[migrations/007_add_admin_permissions_columns.sql](../../migrations/007_add_admin_permissions_columns.sql)** - Nova migração criada

---

## ⏱️ Tempo Estimado: 5 minutos

✅ Dashboard agora deve funcionar perfeitamente!
