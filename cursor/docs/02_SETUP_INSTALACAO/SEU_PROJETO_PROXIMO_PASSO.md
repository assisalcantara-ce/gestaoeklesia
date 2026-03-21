# 🚀 SEU PROJETO PRONTO: Próximos Passos

Você tem:
- ✅ Project URL: `https://<project-ref>.supabase.co`
- ✅ Publishable API Key (Anon Key): `<NEXT_PUBLIC_SUPABASE_ANON_KEY>`
- ✅ Service Role Key: `<SUPABASE_SERVICE_ROLE_KEY>`

---

## ✅ PASSO 1: Você Já Tem As 3 Chaves!

**✅ Todas as credenciais estão prontas!** Vá direto para o Passo 2.

---

## ✅ PASSO 2: Preencher `.env.local`

Na raiz do seu projeto, crie ou edite `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<NEXT_PUBLIC_SUPABASE_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
```

---

## ✅ PASSO 3: Instalar CLI (2 min)

```bash
npm install -g supabase
```

Verifique:
```bash
supabase --version
```

---

## ✅ PASSO 4: Login

```bash
supabase login
```

Pressione **Enter** → browser abrirá → **"Authorize"**

---

## ✅ PASSO 5: Linkar Seu Projeto

```bash
cd c:\BACKUP\DESENVOLVIMENTO\gestaoeklesia

supabase link --project-ref drzafeksbddnoknvznnd
```

Saída esperada:
```
✓ Linked project drzafeksbddnoknvznnd
```

---

## ✅ PASSO 6: Criar Migration

```bash
supabase migration new initial_schema
```

Cria arquivo em:
```
supabase/migrations/20240102120000_initial_schema.sql
```

---

## ✅ PASSO 7: Adicionar SQL Schema

Abra o arquivo e **cole tudo** de:
```
SUPABASE_SCHEMA_COMPLETO.sql
```

(Você já tem esse arquivo no seu projeto!)

---

## ✅ PASSO 8: Push para Cloud

```bash
supabase db push
```

Saída esperada:
```
Pushing migration 20240102120000_initial_schema.sql
✓ Migration complete!
```

**✅ Suas 9 tabelas foram criadas no Cloud!**

---

## ✅ PASSO 9: Gerar Tipos TypeScript

```bash
supabase gen types typescript --linked > src/types/supabase-generated.ts
```

Cria arquivo com tipos auto-gerados do seu schema.

---

## ✅ PASSO 10: Instalar Supabase JS

```bash
npm install @supabase/supabase-js @supabase/ssr
```

---

## ✅ PASSO 11: Testar Tudo

```bash
npm run dev
```

Teste:
```bash
curl http://localhost:3000/api/v1/members
```

---

## 📋 CHECKLIST FINAL

- [ ] Service Role Key copiado do dashboard
- [ ] `.env.local` preenchido com 3 chaves
- [ ] CLI instalado
- [ ] Login feito
- [ ] Projeto linkado (`supabase link`)
- [ ] Migration criada
- [ ] SQL importado
- [ ] `supabase db push` executado
- [ ] Tipos gerados
- [ ] `npm install @supabase/supabase-js` rodou
- [ ] `npm run dev` funcionando
- [ ] Curl testado com sucesso

---

## 🎯 Próximas Ações (Depois que tudo acima estiver pronto)

### 1. Criar Primeiro Usuário
```bash
# No dashboard: https://drzafeksbddnoknvznnd.supabase.co
# Auth → Users → "+ Add user"
# Email + Password
```

### 2. Criar Primeiro Ministry
```bash
# Via SQL direto no dashboard
INSERT INTO public.ministries (
  user_id,
  name,
  slug,
  email_admin,
  plan
) VALUES (
  'UUID-DO-USUARIO-QUE-CRIOU-ACIMA',
  'Meu Ministério',
  'meu-ministerio',
  'seu-email@exemplo.com',
  'starter'
);
```

### 3. Testar API
```bash
curl -X GET http://localhost:3000/api/v1/members
```

### 4. Conectar Frontend
```typescript
import { useMembers } from '@/hooks/useMembers'

export default function Page() {
  const { members, createMember } = useMembers()
  // Seu código aqui
}
```

---

## ⏱️ TIMELINE

```
Agora (5 min)       → Service Role Key + .env.local
Próximos 10 min     → CLI setup
Próximos 5 min      → Link ao projeto
Próximos 3 min      → Migration + push
Próximo 1 min       → Tipos gerados
Total               → ~24 minutos pronto!
```

---

## 🚨 IMPORTANTE

```
⚠️  NUNCA compartilhe:
    - Service Role Key
    - Database password

✅ Seguro compartilhar:
    - Project URL
    - Anon Key (Publishable API Key)
```

---

## 💡 Se Algo der Erro

### "command not found: supabase"
```bash
npm install -g supabase
```

### "Not linked to a project"
```bash
supabase link --project-ref drzafeksddnoknrvzndd
```

### "Migration failed"
Verifique se o SQL está correto em:
```
supabase/migrations/seu-arquivo.sql
```

---

## 🎉 Quando Terminar Tudo

1. Você terá 9 tabelas no Cloud
2. CLI linkado ao projeto
3. Tipos TypeScript auto-gerados
4. API rodando localmente
5. Pronto para criar usuários e ministries

---

**Tempo estimado para estar 100% pronto: ~1 hora total** ⏱️

Quer que eu ajude em algum passo específico?

