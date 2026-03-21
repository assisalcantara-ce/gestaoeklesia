# 🎯 CLI NA PRÁTICA: Seu Projeto Gestão Eklesia

## FASE 1: Setup (5 min)

### 1. Instalar

```bash
npm install -g supabase
```

### 2. Login

```bash
supabase login
```

Browser abrirá → Generate token → Cole no terminal

### 3. Verificar

```bash
supabase projects list
```

Mostra seus projetos!

---

## FASE 2: Inicializar Projeto Local (5 min)

```bash
cd c:\BACKUP\DESENVOLVIMENTO\gestaoeklesia

supabase init
```

Cria pasta `supabase/` com:
```
supabase/
├── config.toml
├── migrations/
└── seed.sql
```

---

## FASE 3: Subir Banco Local (2 min)

```bash
supabase start
```

Saída:
```
supabase local development started

API URL: http://localhost:54321
DB URL: postgresql://postgres:postgres@127.0.0.1:5432/postgres
Studio URL: http://localhost:54321

Press 'q' to stop the local development server.
```

### Copiar para `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc... (copie do output)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (copie do output)
```

---

## FASE 4: Criar Primeira Migration (10 min)

### 1. Criar arquivo

```bash
supabase migration new create_ministries_table
```

Cria:
```
supabase/migrations/20240102120000_create_ministries_table.sql
```

### 2. Editar arquivo

Abra e adicione seu SQL:

```sql
-- supabase/migrations/20240102120000_create_ministries_table.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.ministries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  email_admin VARCHAR(255) UNIQUE NOT NULL,
  plan VARCHAR(50) NOT NULL DEFAULT 'starter',
  subscription_status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ministries_user_id ON public.ministries(user_id);

ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own ministry"
  ON public.ministries FOR SELECT
  USING (user_id = auth.uid());
```

### 3. Aplicar migration

```bash
supabase db push
```

Sucesso:
```
Applying migration 20240102120000_create_ministries_table.sql
✓ Migration complete!
```

### 4. Verificar

```bash
supabase migration list
```

Mostra:
```
Local migrations:
  20240102120000_create_ministries_table.sql
```

---

## FASE 5: Criar Mais Tabelas (15 min)

### Membros

```bash
supabase migration new create_members_table
```

Edite:
```sql
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  cpf VARCHAR(20),
  phone VARCHAR(20),
  birth_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(ministry_id, cpf),
  UNIQUE(ministry_id, email)
);

CREATE INDEX idx_members_ministry_id ON public.members(ministry_id);
CREATE INDEX idx_members_status ON public.members(status);

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members isolated by ministry"
  ON public.members FOR SELECT
  USING (
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );
```

Push:
```bash
supabase db push
```

### Faça o mesmo para outras tabelas!

```bash
supabase migration new create_cartoes_templates_table
supabase migration new create_audit_logs_table
# ... etc
```

---

## FASE 6: Gerar Tipos TypeScript (5 min)

Após criar todas as tabelas:

```bash
supabase gen types typescript --linked > src/types/supabase-generated.ts
```

Cria arquivo com TODOS os tipos:

```typescript
// src/types/supabase-generated.ts

export interface Tables {
  ministries: {
    Row: {
      id: string
      user_id: string
      name: string
      slug: string
      created_at: string
      updated_at: string
    }
    Insert: { ... }
    Update: { ... }
  }
  members: {
    Row: { ... }
    Insert: { ... }
    Update: { ... }
  }
  // ... todas as tabelas!
}
```

Use nos seus tipos:

```typescript
// src/types/supabase.ts
import { Tables } from './supabase-generated'

export type Ministry = Tables['ministries']['Row']
export type Member = Tables['members']['Row']
export type CreateMember = Tables['members']['Insert']
export type UpdateMember = Tables['members']['Update']
```

---

## FASE 7: Testar Localmente (10 min)

### 1. Servidor rodando

```bash
npm run dev
```

### 2. Testar API

```bash
curl -X GET http://localhost:54321/rest/v1/ministries \
  -H "apikey: copie-a-anon-key"
```

### 3. Usar hook

```typescript
import { useMembers } from '@/hooks/useMembers'

export default function Page() {
  const { members, createMember } = useMembers()
  
  // Usar seus dados!
}
```

---

## FASE 8: Sincronizar com Produção (Depois)

### Link ao projeto remoto

```bash
supabase link --project-ref seu-project-id
```

### Ver diferenças

```bash
supabase db pull
```

### Enviar migrations

```bash
supabase db push
```

### Backup antes

```bash
supabase db backup
```

---

## 🚀 WORKFLOW DIÁRIO

```bash
# Começar dia
supabase start

# Trabalhar, criar migrations
supabase migration new nova_feature
# Editar SQL...
supabase db push

# Gerar tipos
supabase gen types typescript --linked > src/types/supabase-generated.ts

# Testar
npm run dev

# Terminar dia
supabase stop
```

---

## 📊 ANTES vs DEPOIS

### SEM CLI (Antes)
```
❌ Dashboard Supabase
❌ Copiar/colar SQL
❌ Atualizar tipos manualmente
❌ Migração complexa
```

### COM CLI (Agora)
```
✅ Terminal
✅ Migrations versionadas
✅ Tipos auto-gerados
✅ Tudo sincronizado
```

---

## ✅ CHECKLIST

- [ ] CLI instalado
- [ ] Login feito
- [ ] Projeto inicializado
- [ ] Banco local rodando
- [ ] Primeira migration criada
- [ ] Tabelas criadas
- [ ] Tipos gerados
- [ ] Tudo rodando localmente

---

## 💡 PRO TIPS

### Zerar tudo

```bash
supabase db reset
```

### Ver logs

```bash
supabase status
```

### Parar sem cleanup

```bash
supabase stop --no-backup
```

### Reiniciar

```bash
supabase restart
```

---

**Com o CLI, você tem controle total e reprodutibilidade!** 🎊

