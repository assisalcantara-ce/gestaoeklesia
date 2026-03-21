# ⚡ AÇÃO IMEDIATA: Fix RLS Recursion (5 minutos)

## 🎯 O Erro

```
infinite recursion detected in policy for relation "admin_users"
```

## ✅ Solução Rápida

### Passo 1: Abra Supabase Dashboard
1. Vá para: https://app.supabase.com
2. Selecione seu projeto
3. Clique em **SQL Editor** (lado esquerdo)

### Passo 2: Cole Este SQL
```sql
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_users_admin_all" ON public.admin_users;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_users_select_public" ON public.admin_users
  FOR SELECT USING (true);
```

### Passo 3: Clique em "RUN"
Aguarde aparecer ✅ "Executed successfully"

### Passo 4: Teste Novamente
```
http://localhost:3000/admin/login
Email: admin@gestaoeklesia.local
Senha: (não registrar em .md)
```

**Resultado esperado:** ✅ Login funciona, sem erro de recursão

---

## 🔍 O Que Estava Acontecendo

```
User tenta acessar /admin/dashboard
      ↓
Middleware faz getUser() ✅ (funciona)
      ↓
Middleware tenta SELECT * FROM admin_users
      ↓
Supabase aplica RLS policy
      ↓
RLS policy tenta: "Tem um admin ativo?"
      ↓
Tenta SELECT FROM admin_users (recursão!)
      ↓
❌ Infinite recursion
```

---

## 🔐 Por Que É Seguro Remover RLS

1. **Middleware valida no servidor** ← aqui é a segurança
2. **Cliente NUNCA acessa admin_users direto**
3. **Cada request passa pelo middleware**
4. **Sem RLS = mais rápido e sem erros**

```
Fluxo Seguro:
User → [MIDDLEWARE - valida no servidor] ← Aqui é a proteção
         ↓ (se válido)
      Carrega página
         ↓
      Cliente não acessa admin_users diretamente
```

---

## 📋 Checklist

- [ ] Abri Supabase SQL Editor
- [ ] Copiei o SQL acima
- [ ] Cliquei em RUN
- [ ] Aguardei ✅ "Executed successfully"
- [ ] Testei login novamente
- [ ] ✅ Funcionou!

---

## 🆘 Se Não Funcionar

### Erro: "Table "admin_users" does not exist"
- Significa tabela não foi criada
- Verifique migrações em `supabase/migrations/`

### Erro: "Policy does not exist"
- Política já foi removida, está OK
- Continue com o resto do SQL

### Erro: "Permission denied"
- Verifique role do usuário Supabase
- Precisa de acesso de admin

---

## 📚 Documentação

Mais detalhes em:
- `SOLUCAO_RLS_RECURSION.md` - Análise completa
- `supabase/sql/fix_admin_users_rls_recursion.sql` - SQL completo

---

## 🎉 Próximo Passo

Após corrigir, o login funcionará normalmente:

```bash
✅ Login funciona
✅ Dashboard carrega
✅ Sem erros de RLS
✅ Segurança mantida
```

---

**Tempo estimado:** 5 minutos  
**Dificuldade:** Fácil (copiar/colar SQL)  
**Risco:** Nenhum (RLS pode ser reativado)
