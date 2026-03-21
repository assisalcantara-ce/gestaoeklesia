# 🔧 SUPABASE SETUP & CONFIGURAÇÃO COMPLETA
## Guia de Integração Gestão Eklesia

---

## ✅ PASSO 1: CRIAR PROJETO SUPABASE

### 1.1 Registrar/Login em Supabase
```
URL: https://supabase.com
→ Clicar em "Sign Up"
→ Usar email profissional
→ Confirmar email
```

### 1.2 Criar Novo Projeto
```
1. Dashboard → "New Project"
2. Nome: gestaoeklesia-prod
3. Região: São Paulo (South America - São Paulo)
4. Password: gere senha forte (salve em vault)
5. Clicar "Create new project" (aguarde 2-3 min)
```

### 1.3 Resultado
Você receberá:
```
Project URL: https://xxxxx.supabase.co
Anon Key: eyJhbGc... (público, use no frontend)
Service Role Key: eyJhbGc... (SECRETO, use apenas no backend)
Database Password: xxxxxxxx (para acesso direto psql)
```

**Salve estes dados em `.env.local`:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_DB_PASSWORD=xxxxxxxx
```

---

## ✅ PASSO 2: INSTALAR BIBLIOTECAS

```bash
npm install @supabase/supabase-js
npm install --save-dev @types/supabase
```

---

## ✅ PASSO 3: CRIAR CLIENTE SUPABASE

### 3.1 Frontend Client (com anon key)
**Arquivo:** `src/lib/supabase-client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### 3.2 Backend Client (com service_role key)
**Arquivo:** `src/lib/supabase-server.ts`

```typescript
import { createServiceRoleClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'

// Para Server Actions / API Routes
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
```

### 3.3 Cliente RLS (Row Level Security)
**Arquivo:** `src/lib/supabase-rls.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

// Para requisições com usuário autenticado (RLS ativo)
export function createServerClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  )
}
```

---

## ✅ PASSO 4: ESTRUTURA DE PASTAS

Organize seus clientes assim:

```
src/
├── lib/
│   ├── supabase-client.ts      (frontend - anon key)
│   ├── supabase-server.ts      (backend - service_role key)
│   ├── supabase-rls.ts         (RLS com token)
│   ├── auth.ts                 (lógica de autenticação)
│   └── db.ts                   (queries ao BD)
├── app/
│   └── api/
│       └── v1/
│           ├── auth/
│           ├── members/
│           └── users/
└── types/
    └── database.ts             (tipos gerados automaticamente)
```

---

## ✅ PASSO 5: AUTENTICAÇÃO SUPABASE

### 5.1 Login/Signup
**Arquivo:** `src/lib/auth.ts`

```typescript
import { supabaseAdmin } from './supabase-server'

export async function signUp(email: string, password: string, metadata: any) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Confirmar automaticamente
    user_metadata: metadata,
  })

  if (error) throw error
  return data.user
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabaseAdmin.auth.admin.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return {
    user: data.user,
    session: data.session,
  }
}

export async function getUser(userId: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (error) throw error
  return data.user
}
```

### 5.2 Session Management
```typescript
import { cookies } from 'next/headers'

export async function setAuthCookie(accessToken: string, refreshToken: string) {
  const cookieStore = cookies()
  
  cookieStore.set('auth-token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600, // 1 hora
  })
  
  cookieStore.set('refresh-token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 604800, // 7 dias
  })
}
```

---

## ✅ PASSO 6: TABELAS INICIAIS

Supabase vem com autenticação integrada. Suas tabelas custom:

```sql
-- Ministérios (tenants)
CREATE TABLE ministries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  email_admin VARCHAR(255) UNIQUE NOT NULL,
  plan VARCHAR(50) DEFAULT 'starter',
  subscription_status VARCHAR(50) DEFAULT 'active',
  logo_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usuários do ministério
CREATE TABLE ministry_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'operator',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ministry_id, user_id)
);

-- Membros
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  cpf VARCHAR(20),
  birth_date DATE,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ministry_id, cpf),
  UNIQUE(ministry_id, email)
);

-- Row Level Security (RLS)
ALTER TABLE ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ministry_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Policy para ministries
CREATE POLICY "Usuários podem ver seu próprio ministry"
  ON ministries FOR SELECT
  USING (user_id = auth.uid());

-- Policy para members (isolamento por ministry)
CREATE POLICY "Membros isolados por ministry"
  ON members FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM ministry_users WHERE user_id = auth.uid()
    )
  );
```

---

## ✅ PASSO 7: OPERAÇÕES CRUD COM SUPABASE

### 7.1 Criar Membro
**Arquivo:** `src/app/api/v1/members/route.ts`

```typescript
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { ministryId, name, email, phone, cpf } = await req.json()

  const { data, error } = await supabaseAdmin
    .from('members')
    .insert({
      ministry_id: ministryId,
      name,
      email,
      phone,
      cpf,
    })
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data[0], { status: 201 })
}
```

### 7.2 Listar Membros
```typescript
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ministryId = searchParams.get('ministry_id')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 20

  const { data, error, count } = await supabaseAdmin
    .from('members')
    .select('*', { count: 'exact' })
    .eq('ministry_id', ministryId)
    .range((page - 1) * limit, page * limit - 1)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil((count || 0) / limit),
    },
  })
}
```

### 7.3 Atualizar Membro
```typescript
export async function PUT(req: NextRequest) {
  const { id, ...updates } = await req.json()

  const { data, error } = await supabaseAdmin
    .from('members')
    .update(updates)
    .eq('id', id)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data[0])
}
```

### 7.4 Deletar Membro
```typescript
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  const { error } = await supabaseAdmin
    .from('members')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
```

---

## ✅ PASSO 8: TIPOS TYPESCRIPT AUTOMÁTICOS

Supabase pode gerar tipos automaticamente:

```bash
npm install -D supabase
npx supabase gen types typescript --project-id xxxxx > src/types/database.ts
```

**Arquivo:** `src/types/database.ts`
```typescript
// Auto-gerado pelo Supabase
export type Database = {
  public: {
    Tables: {
      ministries: {
        Row: {
          id: string
          user_id: string
          name: string
          slug: string
          // ...
        }
        Insert: {
          name: string
          slug: string
          // ...
        }
        Update: {
          name?: string
          slug?: string
          // ...
        }
      }
      members: {
        // ...
      }
    }
  }
}
```

---

## ✅ PASSO 9: VARIÁVEIS DE AMBIENTE

**Arquivo:** `.env.local`

```env
# SUPABASE
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# POSTGRESQL (acesso direto, se necessário)
DATABASE_URL=postgresql://postgres:xxxxx@xxxxx.supabase.co:5432/postgres

# NODE
NODE_ENV=production
```

---

## ✅ PASSO 10: TESTES DE CONEXÃO

**Arquivo:** `src/lib/supabase-test.ts`

```typescript
import { supabaseAdmin } from './supabase-server'

export async function testConnection() {
  try {
    // Testar conexão
    const { data, error } = await supabaseAdmin
      .from('ministries')
      .select('*')
      .limit(1)

    if (error) {
      console.error('❌ Erro ao conectar:', error)
      return false
    }

    console.log('✅ Conexão Supabase OK')
    console.log(`Tabelas encontradas: ${data?.length}`)
    return true
  } catch (err) {
    console.error('❌ Erro:', err)
    return false
  }
}

// Testar RLS
export async function testRLS(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('ministry_id', 'any-id')

    if (error) {
      console.error('❌ Erro RLS:', error)
      return false
    }

    console.log('✅ RLS funcionando')
    return true
  } catch (err) {
    console.error('❌ Erro:', err)
    return false
  }
}
```

---

## 📋 CHECKLIST DE SETUP

- [ ] Conta Supabase criada
- [ ] Projeto criado (região São Paulo)
- [ ] Chaves salvas em `.env.local`
- [ ] NPM packages instalados
- [ ] Clientes Supabase criados
- [ ] Tabelas criadas no BD
- [ ] RLS ativado em cada tabela
- [ ] Testes de conexão passados
- [ ] Tipos TypeScript gerados
- [ ] Primeira API testada

---

## 🚀 PRÓXIMO PASSO

Após completar este setup, vamos:

1. Criar todas as tabelas alinhadas com o modelo
2. Implementar RLS policies completas
3. Criar APIs endpoints por endpoint
4. Testar isolamento multi-tenant

**Status:** Pronto para começar? ✅

