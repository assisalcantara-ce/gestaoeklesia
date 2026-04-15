# ✅ Setup: Associar admin@gestaoeklesia.com.br ao Ministério

## 📋 Situação Atual

O usuário `admin@gestaoeklesia.com.br` não está associado a nenhum ministério.

**Arquivo SQL:** `docs/SETUP_ADMIN_MINISTERIO.sql`

---

## 🚀 Passo-a-Passo

### 1️⃣ Abra o Supabase SQL Editor
- Vá para https://app.supabase.com
- Projeto: `gestaoeklesia`
- Menu: **SQL Editor** → **New Query**

### 2️⃣ Execute o PASSO 1
Copie e execute:
```sql
SELECT id as user_id, email FROM auth.users 
WHERE email = 'admin@gestaoeklesia.com.br';
```

**O que esperar:**
Verá um resultado como:
```
user_id                              | email
--------------------------------------+----------------------------
550e8400-e29b-41d4-a716-446655440000 | admin@gestaoeklesia.com.br
```

**Copie o `user_id` que apareceu** - você precisará dele depois!

---

### 3️⃣ Escolha a Opção (A ou B)

#### **OPÇÃO A: Criar um novo ministério para esse usuário** ✨
*Escolha isso se el ainda não tem nenhum ministério*

Descomente e execute:
```sql
INSERT INTO public.ministries (name, user_id, status)
VALUES (
  'Gestão Eklesia Admin',
  (SELECT id FROM auth.users WHERE email = 'admin@gestaoeklesia.com.br'),
  'ATIVO'
)
ON CONFLICT DO NOTHING;
```

**Resultado esperado:**
```
INSERT 0 1   -- Sucesso!
```

---

#### **OPÇÃO B: Associar a um ministério existente** 🔗
*Escolha isso se já existe um ministério que você quer usar*

**Primeiro, liste os ministérios disponíveis:**
```sql
SELECT id as ministry_id, name, user_id 
FROM public.ministries 
LIMIT 10;
```

Veja qual `ministry_id` você quer usar.

**Depois, associe o usuário:**
```sql
INSERT INTO public.ministry_users (user_id, ministry_id, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@gestaoeklesia.com.br'),
  'MINISTRY_ID_UUID',  -- ← SUBSTITUA PELO ID QUE VOCÊ COPIOU
  'admin'
)
ON CONFLICT (user_id, ministry_id) DO NOTHING;
```

**Resultado esperado:**
```
INSERT 0 1   -- Sucesso!
```

---

### 4️⃣ Verifique o Resultado

Execute para confirmar que está tudo funcionando:
```sql
SELECT 
  u.id as user_id,
  u.email,
  COALESCE(m.id, m2.id) as ministry_id,
  COALESCE(m.name, m2.name) as ministry_name,
  'proprietário' as tipo
FROM auth.users u
LEFT JOIN public.ministries m ON u.id = m.user_id
LEFT JOIN public.ministry_users mu ON u.id = mu.user_id
LEFT JOIN public.ministries m2 ON mu.ministry_id = m2.id
WHERE u.email = 'admin@gestaoeklesia.com.br';
```

**O que esperar:**
```
user_id                              | email                          | ministry_id                          | ministry_name             | tipo
--------------------------------------+--------------------------------+--------------------------------------+--------------------------+-----------
550e8400-e29b-41d4-a716-446655440000 | admin@gestaoeklesia.com.br     | 660e8400-e29b-41d4-a716-446655440000 | Gestão Eklesia Admin      | proprietário
```

Se `ministry_id` e `ministry_name` não forem NULL, **tudo OK!** ✅

---

## 🔄 Agora Teste a Aplicação

### 1. Faça login novamente
- Vá para: `http://localhost:3000/login`
- Email: `admin@gestaoeklesia.com.br`
- Senha: Sua senha

### 2. Acesse Funcionários
- URL: `http://localhost:3000/secretaria/funcionarios`
- Deve carregar os membros sem erro!

---

## 🛠️ Se Ainda Tiver Problema

### ❌ Erro: "Usuário sem ministério associado"
Significa que o PASSO 3 não funcionou. Verifique:
1. O `user_id` está correto?
2. O `ministry_id` existe?
3. Não há conflito nas constraints?

**Tente executar PASSO 3 novamente**

### ✅ Tudo OK?
Se conseguir carregar a página sem erros, a migração está funcionando! 🎉

---

## 📝 Resumo do que foi feito

| Item | Ação |
|------|------|
| User | `admin@gestaoeklesia.com.br` |
| Ação | Associado a um ministério |
| Permissão | `admin` |
| Resultado | Pode acessar `/secretaria/funcionarios` |

---

**Pronto! Execute os passos acima e deixe-me saber se funcionou!** 🚀
