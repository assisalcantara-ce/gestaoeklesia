# 🚀 PASSO A PASSO VISUAL - Admin Dashboard Fix

## 📌 O Que Causou o Problema?

```
User fez login ✅
   ↓
Passou na autenticação Supabase ✅
   ↓
Tentou verificar se é admin ❌
   ↓
API /admin/verify retornou 403
   ↓
Motivo: Usuário não foi criado no banco (INSERT falhou)
   ↓
Motivo da falha: Colunas inexistentes (can_manage_*, etc)
   ↓
Resultado: Sessão foi cancelada, redirecionou para login
```

---

## 🔧 Solução: 5 Minutos

### PASSO 1: Abrir SQL Editor (2 minutos)

1. Abra: https://supabase.com/dashboard
2. Clique no seu projeto
3. No lado esquerdo, clique em: **SQL Editor**
4. Clique em: **New Query** (botão azul no topo)

**Resultado esperado:**
```
┌─ SQL Editor
│  ├─ New Query (botão)
│  └─ Editor em branco pronto para code
```

---

### PASSO 2: Copiar SQL (1 minuto)

1. Abra este arquivo em seu editor:
   ```
   docs/SUPORTE_ADMIN_DASHBOARD_FIX_COMPLETO.sql
   ```

2. Selecione TUDO o SQL (Ctrl+A)

3. Copie (Ctrl+C)

---

### PASSO 3: Colar no Supabase (30 segundos)

1. Clique no editor em branco do Supabase
2. Cole (Ctrl+V)
3. Veja o SQL ficar colorido (syntax highlighting)

**Resultado esperado:**
```sql
ALTER TABLE admin_users
ADD COLUMN IF NOT EXISTS can_manage_ministries BOOLEAN DEFAULT false,
...
```

---

### PASSO 4: Executar (30 segundos)

1. **Clique no botão `▶ RUN`** (canto superior direito do editor)
2. OU pressione **Ctrl+Enter**
3. Aguarde 2-5 segundos

**Resultado esperado:**
```
✅ Successfully executed
```

---

### PASSO 5: Criar Novo Usuário (1 minuto)

1. Vá para: **Authentication** (lado esquerdo)
2. Vá para: **Users** (no menu)
3. Clique em: **Add User** (botão azul)

**Preencha:**
| Campo | Valor |
|-------|-------|
| Email | `suporte@gestaoeklesia.com.br` |
| Password | Use "Auto generate" ou defina sua |
| Auto Confirm | Deixe desmarcado é OK |

4. Clique em: **Create User**
5. Copie a senha gerada (se Auto generate)

**Resultado esperado:**
```
✅ User created
Email: suporte@gestaoeklesia.com.br
```

---

### PASSO 6: Testar Login (1 minuto)

1. Abra: https://www.gestaoeklesia.com.br/admin/login
2. Preencha:
   - Email: `suporte@gestaoeklesia.com.br`
   - Senha: a que você gerou/definiu
3. Clique em: **Entrar**

**Resultado esperado:**
```
✅ Dashboard abre
✅ Permanece aberto (não fecha!)
✅ URL muda para: /admin/dashboard
✅ Vê o painel administrativo
```

---

## 🆘 Se Ainda Não Funcionar?

Abra SQL Editor novamente e rode:

```sql
SELECT 
  email,
  role,
  status,
  can_manage_support,
  can_manage_ministries,
  can_manage_payments,
  can_manage_plans
FROM admin_users
WHERE email = 'suporte@gestaoeklesia.com.br'
LIMIT 1;
```

**O resultado deve ter:**
- ✅ `status`: ATIVO
- ✅ `role`: suporte  
- ✅ `can_manage_support`: true (ou 't')
- ✅ Outras colunas: false (ou 'f')

Se algum status estiver INATIVO ou a coluna estiver faltando, report ao desenvolvedor com o resultado dessa query.

---

## 📚 Referências Técnicas

**Arquivos Corrigidos:**
- [src/lib/admin-users-service.ts](../../src/lib/admin-users-service.ts) - Código TypeScript
- [migrations/007_add_admin_permissions_columns.sql](../../migrations/007_add_admin_permissions_columns.sql) - Migração

**Documentação:**
- [FIX_ADMIN_DASHBOARD_SESSION_ISSUE.md](./FIX_ADMIN_DASHBOARD_SESSION_ISSUE.md) - Documentação Técnica Completa

---

## ⏱️ Tempo Total: 5-7 minutos

✅ Dashboard deve funcionar perfeitamente após isso!
