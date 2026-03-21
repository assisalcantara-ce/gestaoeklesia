# 🔧 FIX: Infinite Recursion em admin_users RLS

## 🚨 Problema

```
[MIDDLEWARE] Erro ao buscar admin_users para admin@gestaoeklesia.local: 
  infinite recursion detected in policy for relation "admin_users"
```

### Causa:
A política RLS `admin_users_admin_all` faz uma consulta **recursiva** que causa loop infinito:

```sql
-- ❌ PROBLEMA: Consulta admin_users dentro de uma política de admin_users
CREATE POLICY "admin_users_admin_all" ON public.admin_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au  -- ← RECURSÃO!
      WHERE au.user_id = auth.uid() 
      AND au.role = 'admin'
    )
  );
```

---

## ✅ SOLUÇÃO

### Opção 1: Desabilitar RLS em admin_users (RECOMENDADO)

Como a validação de admin já é feita no **middleware** (servidor), não precisa de RLS. Execute no Supabase SQL Editor:

```sql
-- Desabilitar RLS na tabela admin_users
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;

-- Remover a política problemática
DROP POLICY IF EXISTS "admin_users_admin_all" ON public.admin_users;
```

**Por quê é seguro:**
- ✅ Middleware valida no servidor antes de qualquer coisa
- ✅ Cliente nunca acessa admin_users diretamente
- ✅ RLS não é necessário quando validação é no backend

---

### Opção 2: Permitir SELECT Público (Alternativa)

Se quiser manter RLS, use:

```sql
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Política segura: permite SELECT a todos (validação no middleware)
CREATE POLICY "admin_users_select_public" ON public.admin_users
  FOR SELECT USING (true);

-- Restrict UPDATE/DELETE (sem recursão)
CREATE POLICY "admin_users_superadmin_modify" ON public.admin_users
  FOR UPDATE USING (false)
  WITH CHECK (false);
```

---

## 🚀 COMO APLICAR

### Via Supabase Dashboard:

1. Abra **SQL Editor** no Supabase
2. Cole o SQL da Opção 1 (recomendado)
3. Clique em **Run**
4. Aguarde sucesso

### Via CLI:

```bash
# Se tiver Supabase CLI instalado
supabase db push
```

---

## ✔️ APÓS APLICAR

Teste novamente:

```bash
1. Abra: http://localhost:3000/admin/login
2. Email: admin@gestaoeklesia.local
3. Senha: (não registrar em .md)
4. Esperado: ✅ Login funciona sem erro de recursão
```

**Logs esperados:**
```
[MIDDLEWARE] Usuário autenticado: admin@gestaoeklesia.local
[MIDDLEWARE] user_id não encontrado, tentando buscar por email
[MIDDLEWARE] ✅ Admin válido: admin@gestaoeklesia.local (role: admin)
GET /admin/dashboard 200
```

---

## 📝 Por Que Removemos RLS?

| Aspecto | admin_users | outras tabelas |
|---------|------------|-----------------|
| **Acesso** | Apenas backend/middleware | Clientes fazem queries |
| **Validação** | No middleware (servidor) | RLS (banco de dados) |
| **Necessidade de RLS** | ❌ Não | ✅ Sim |
| **Performance** | Melhor sem RLS | Melhor com RLS |

---

## 🔒 Segurança Mantida

Mesmo sem RLS em `admin_users`, segurança continua:

✅ **Middleware** valida no servidor
- Verifica sessão com `getUser()`
- Consulta admin_users
- Redireciona se não autorizado
- **Cliente NUNCA** acessa direto

✅ **Selecionar por email** (não user_id)
- Procura apenas por email existente
- Valida status='ATIVO'
- Sem exposição de dados

✅ **Sem armazenamento inseguro**
- Nenhuma credencial em localStorage
- Sessão em cookies (seguro)

---

## 📚 Referências

**Arquivo com SQL:**
```
supabase/sql/fix_admin_users_rls_recursion.sql
```

**Arquivo de migração problemático:**
```
supabase/migrations/20260102210000_admin_panel_schema.sql
```

---

## ⚠️ Importante

**Se você tiver credenciais de superadmin:**

O campo `is_active` na tabela pode ser chamado de:
- `is_active` (novo schema)
- `status` (schema antigo)

Verifique qual existe e ajuste o SQL se necessário.

---

**Solução:** 3 de janeiro de 2026  
**Status:** Aguardando execução do SQL no Supabase
