# 🔐 Patch RLS: Ministry Users

## 📋 O Problema

Havia **2 políticas conflitantes** que impediam membros de acessarem dados do ministério:

1. `ministry_users_owner_all` → Só donos
2. `ministry_users_select_self` → Só o próprio usuário

Resultado: **Bloqueio total para membros!**

---

## ✅ A Solução

Substituir por **4 políticas claras** com lógica correta:

### **SELECT** (Leitura)
```sql
user_id = auth.uid()  -- Vê seus próprios dados
OR
owner do ministry    -- Ou é dono do ministério
```

### **INSERT** (Criar)
Apenas se for dono do ministério

### **UPDATE** (Editar)
Apenas se for dono do ministério

### **DELETE** (Deletar)
Apenas se for dono do ministério

---

## 🚀 Como Aplicar

### 1. Abra Supabase SQL Editor

### 2. Copie todo o conteúdo de:
`docs/PATCH_RLS_MINISTRY_USERS.sql`

### 3. Cole e execute

### 4. Recarregue a aplicação:
```
http://localhost:3000/secretaria/funcionarios
```

---

## 🛡️ Segurança Mantida

✅ **Separação de tenant:** Cada ministério é isolado  
✅ **Donos controlam:** Apenas donos criam/editam membros  
✅ **Membros leem:** Membros veem apenas seus dados  
✅ **Sem bypass:** Impossível acessar outro ministério

---

## 📊 Resultado Esperado

**Antes:** ❌ Error "Usuário sem ministério"  
**Depois:** ✅ Carrega membros corretamente

---

## ⚠️ Importante

Se tiver queries antigas que dependem das políticas antigas, podem quebrar. Mas a aplicação atual usando `resolveMinistryId()` vai funcionar perfeitamente!

