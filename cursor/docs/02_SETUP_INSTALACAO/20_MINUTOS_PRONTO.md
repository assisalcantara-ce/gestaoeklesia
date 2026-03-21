# 🚀 20 MINUTOS: DO ZERO AO CLOUD

**Seu projeto ID:** `<project-ref>`

---

## ⚡ 11 PASSOS RÁPIDOS

### 1️⃣ Service Role Key (2 min)

```
Dashboard: https://<project-ref>.supabase.co
→ Settings
→ API
→ Service role key
→ Clique no ícone "Reveal"
→ Copie (começa com eyJhbGc...)
```

### 2️⃣ .env.local (2 min)

Crie na raiz (`c:\BACKUP\DESENVOLVIMENTO\gestaoeklesia\.env.local`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://drzafeksddnoknrvzndd.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<NEXT_PUBLIC_SUPABASE_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (cole o que copiou)
```

### 3️⃣ CLI (2 min)

```bash
npm install -g supabase
```

### 4️⃣ Login (2 min)

```bash
supabase login
# Pressione Enter → Browser abrirá → Clique "Authorize"
```

### 5️⃣ Link (1 min)

```bash
cd c:\BACKUP\DESENVOLVIMENTO\gestaoeklesia

supabase link --project-ref <project-ref>
```

### 6️⃣ Migration (1 min)

```bash
supabase migration new initial_schema
```

### 7️⃣ SQL (2 min)

```
Abra: supabase/migrations/20240102120000_initial_schema.sql
Copie TUDO de: SUPABASE_SCHEMA_COMPLETO.sql
Cole no arquivo
Salve
```

### 8️⃣ Push (2 min)

```bash
supabase db push
```

✅ **Suas tabelas estão no Cloud agora!**

### 9️⃣ Tipos (1 min)

```bash
supabase gen types typescript --linked > src/types/supabase-generated.ts
```

### 🔟 Pacotes (1 min)

```bash
npm install @supabase/supabase-js @supabase/ssr
```

### 1️⃣1️⃣ Teste (1 min)

```bash
npm run dev
```

Outro terminal:
```bash
curl http://localhost:3000/api/v1/members
```

---

## ✅ PRONTO!

```
✅ Tabelas criadas no Cloud
✅ CLI linkado
✅ Tipos gerados
✅ API rodando
```

---

## 📞 PRÓXIMAS AÇÕES

1. Criar primeiro usuário (Dashboard → Auth)
2. Criar primeiro ministry (SQL INSERT)
3. Testar CRUD completo

---

**Tempo: ~20 minutos** ⏱️

