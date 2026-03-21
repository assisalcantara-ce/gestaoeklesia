# ⚡ RÁPIDO: Seu Setup Exato

## 1️⃣ Supabase Cloud: Novo Projeto (5 min)

```
https://supabase.com/dashboard
→ "+ New Project"
→ Name: gestaoeklesia
→ Password: algo-forte
→ Region: South America - São Paulo
→ Create
```

Copie:
- **Project ID** (antes do .supabase.co)
- **Anon Key**
- **Service Role Key**

---

## 2️⃣ Instalar CLI (2 min)

```bash
npm install -g supabase
```

---

## 3️⃣ Login (1 min)

```bash
supabase login
# Pressione Enter → browser abrirá → Authorize
```

---

## 4️⃣ Linkar Projeto (1 min)

```bash
cd c:\BACKUP\DESENVOLVIMENTO\gestaoeklesia

supabase link --project-ref seu-project-id
```

---

## 5️⃣ .env.local (2 min)

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

---

## 6️⃣ Criar e Push Migration (3 min)

```bash
supabase migration new initial_schema
```

Abra o arquivo criado, copie tudo de `SUPABASE_SCHEMA_COMPLETO.sql`

---

## 7️⃣ Fazer Push (2 min)

```bash
supabase db push
```

✅ **Suas tabelas estão no Cloud agora!**

---

## 8️⃣ Gerar Tipos (1 min)

```bash
supabase gen types typescript --linked > src/types/supabase-generated.ts
```

---

## 9️⃣ Testar (2 min)

```bash
npm run dev
```

Pronto! 🚀

---

**Tempo total: ~18 minutos**

