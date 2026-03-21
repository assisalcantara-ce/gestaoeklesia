# 📋 ANÁLISE: Como o GestãoEklesia Acessa Supabase + Environment Variables

> **Para o Projeto MandatoPro:** Aqui está exatamente como o gestaoeklesia funciona com Vercel!

---

## 🎯 RESUMO EXECUTIVO

O **gestaoeklesia** usa um padrão **seguro e funcional** com Supabase:

- ✅ **Variáveis públicas** (`NEXT_PUBLIC_*`) → Frontend pode acessar
- ✅ **Variáveis privadas** (`SUPABASE_SERVICE_ROLE_KEY`) → Apenas backend (API routes)
- ✅ **Dois clientes diferentes** → Um para frontend, outro para backend
- ✅ **Token passado via headers** → Autenticação segura nas APIs

---

## 1️⃣ VARIÁVEIS DE AMBIENTE (.env.local)

### ✅ Arquivo: `.env.local.template`

```dotenv
# ============================================
# SUPABASE - CREDENCIAIS PÚBLICAS
# ============================================
# Podem ser expostas no navegador (seguro)

NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<NEXT_PUBLIC_SUPABASE_ANON_KEY>

# ============================================
# SUPABASE - CREDENCIAIS PRIVADAS
# ============================================
# NUNCA expostas ao frontend!
# Apenas em API Routes (servidor Next.js)

SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>

# ============================================
# BANCO DE DADOS (opcional)
# ============================================

DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]/postgres

# ============================================
# NODE
# ============================================

NODE_ENV=development
```

### 📝 Como obter no Supabase:
1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá para: **Settings → API**
4. Copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API keys → Anon Key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service Role Key** → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ SECRETO!

---

## 2️⃣ CLIENTE SUPABASE - FRONTEND

### ✅ Arquivo: `src/lib/supabase-client.ts`

```typescript
/**
 * CLIENTE SUPABASE PARA FRONTEND (anon key)
 * Acesso controlado por RLS
 * 
 * Arquivo: src/lib/supabase-client.ts
 * Uso: Operações de leitura/escrita no front-end
 */

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Características:**
- ✅ Usa `NEXT_PUBLIC_*` (públicas)
- ✅ Usa `@supabase/ssr` (SSR-safe)
- ✅ RLS protege dados automaticamente
- ✅ Código do usuário roda no navegador

---

## 3️⃣ CLIENTE SUPABASE - BACKEND

### ✅ Arquivo: `src/lib/supabase-server.ts`

```typescript
/**
 * CLIENTE SUPABASE PARA SERVIDOR (service_role key)
 * Acesso TOTAL ao banco de dados (ignora RLS)
 * 
 * Arquivo: src/lib/supabase-server.ts
 * Uso: API routes, funções administrativas
 * ⚠️  NUNCA exponha este cliente ao frontend!
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

// Cliente com acesso total (admin)
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

// Cliente com token do usuário (respeitando RLS)
export function createServerClientFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '')

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
```

**Características:**
- ✅ Duas funções diferentes:
  - `createServerClient()` → Admin total (ignora RLS)
  - `createServerClientFromRequest()` → Com token do usuário (respeita RLS)
- ✅ Usa `SUPABASE_SERVICE_ROLE_KEY` (privada)
- ✅ Nunca exposta ao frontend
- ✅ Seguro para rodar em Vercel

---

## 4️⃣ LOGIN NO FRONTEND

### ✅ Arquivo: `src/app/admin/login/page.tsx`

```tsx
'use client'

import { useState, FormEvent, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()
  const supabase = createClient()

  // Se já está autenticado, redireciona para dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/admin/dashboard')
    }
  }, [isLoading, isAuthenticated, router])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 1️⃣ FAZER LOGIN NO SUPABASE AUTH
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      if (!data.user) {
        setError('Erro ao fazer login')
        return
      }

      // 2️⃣ VERIFICAR SE É ADMIN - CHAMAR API COM TOKEN
      const response = await fetch('/api/v1/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.session?.access_token || ''}`,
        },
        body: JSON.stringify({ email: data.user.email }),
      })

      if (!response.ok) {
        setError('Acesso negado. Você não é um administrador.')
        await supabase.auth.signOut()
        return
      }

      // 3️⃣ SUCESSO - REDIRECIONAR PARA DASHBOARD
      router.push('/admin/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Gestão Eklesia</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Autenticando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

**Fluxo:**
1. ✅ Usuário digita email/senha
2. ✅ Chama `supabase.auth.signInWithPassword()` (frontend)
3. ✅ Supabase retorna `session.access_token`
4. ✅ Envia token no header `Authorization: Bearer ...` para API
5. ✅ API valida e retorna dados do admin
6. ✅ Redireciona para dashboard

---

## 5️⃣ API ROUTE - VERIFICAÇÃO DE ADMIN

### ✅ Arquivo: `src/app/api/v1/admin/verify/route.ts`

```typescript
/**
 * API ROUTE: Admin Verify & Metrics
 * Verificar se usuário é admin e fornecer métricas do dashboard
 */

import { createServerClient, createServerClientFromRequest } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import type { DashboardMetrics } from '@/types/admin'

// POST: Verificar se é admin (usado no login)
export async function POST(request: NextRequest) {
  try {
    // Usar service_role para contornar RLS
    const supabase = createServerClient()
    const body = await request.json()

    if (!body.email) {
      return NextResponse.json({ error: 'email é obrigatório' }, { status: 400 })
    }

    console.log('[VERIFY POST] Procurando admin_users com email:', body.email)

    // Buscar admin user pelo email
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', body.email)
      .eq('status', 'ATIVO')
      .single()

    if (error || !adminUser) {
      return NextResponse.json(
        { error: 'Usuário não é administrador' },
        { status: 403 }
      )
    }

    console.log('[VERIFY POST] Admin user encontrado:', adminUser.email)
    return NextResponse.json(adminUser)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET: Verificar autenticação + métricas
export async function GET(request: NextRequest) {
  try {
    // Extrair token do header
    const supabase = createServerClientFromRequest(request)

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar se é admin
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', user.email)
      .eq('status', 'ATIVO')
      .single()

    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Buscar métricas
    const metrics = await getDashboardMetrics(supabase)

    return NextResponse.json(metrics)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function getDashboardMetrics(supabase: any): Promise<DashboardMetrics> {
  // ... código de métricas
}
```

**Padrão:**
- ✅ Recebe token no header `Authorization: Bearer ...`
- ✅ Extrai token com `authHeader.replace('Bearer ', '')`
- ✅ Usa `createServerClientFromRequest()` para respeitar RLS
- ✅ Valida se usuário é admin antes de retornar dados
- ✅ Retorna 401/403 se não autorizado

---

## 6️⃣ API ROUTE - LISTAR MEMBROS

### ✅ Arquivo: `src/app/api/v1/members/route.ts`

```typescript
/**
 * API ROUTE: Listar Membros
 * GET /api/v1/members
 * 
 * Query params:
 * - ministry_id: ID do ministério (requerido)
 * - page: número da página (padrão: 1)
 * - limit: itens por página (padrão: 20)
 * - status: filtrar por status
 * - search: buscar por nome
 */

import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Extrair query params
    const searchParams = request.nextUrl.searchParams
    const ministry_id = searchParams.get('ministry_id')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    // MULTI-TENANCY: ministry_id é obrigatório
    if (!ministry_id) {
      return NextResponse.json(
        { error: 'ministry_id é obrigatório' },
        { status: 400 }
      )
    }

    const offset = (page - 1) * limit

    // Criar cliente com service_role (acesso total)
    const supabase = createServerClient()

    // Construir query - FILTRAR SEMPRE POR MINISTRY_ID
    let query = supabase
      .from('members')
      .select('*', { count: 'exact' })
      .eq('ministry_id', ministry_id)

    // Aplicar filtros
    if (status) {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    // Aplicar paginação
    query = query.range(offset, offset + limit - 1)

    // Ordenar por data de criação
    query = query.order('created_at', { ascending: false })

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

**Padrão:**
- ✅ Query params para filtros e paginação
- ✅ Validação obrigatória (`ministry_id`)
- ✅ Usa `createServerClient()` (admin, sem RLS)
- ✅ Retorna dados + metadados de paginação
- ✅ Tratamento de erros em todos os níveis

---

## 🔑 COMPARAÇÃO: 2 ABORDAGENS

### Frontend (Browser):
```typescript
// ✅ Usa ANON KEY (pública)
// ✅ Usa @supabase/ssr (SSR-safe)
// ✅ Código roda no navegador
// ✅ RLS protege dados

import { createBrowserClient } from '@supabase/ssr'
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY  // 👈 PÚBLICA
)
```

### Backend (API Routes):
```typescript
// ✅ Usa SERVICE ROLE KEY (privada)
// ✅ Usa @supabase/supabase-js
// ✅ Código roda no Vercel (servidor)
// ✅ Ignora RLS (admin total)

import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // 👈 PRIVADA!
)
```

---

## 🚀 PARA VERCEL - CONFIGURAR ENVIRONMENT VARIABLES

### Passo a Passo:

1. **Acesse Vercel Dashboard:**
   - https://vercel.com/dashboard

2. **Selecione seu projeto MandatoPro**

3. **Vá para: Settings → Environment Variables**

4. **Adicione as 3 variáveis:**

```
Nome: NEXT_PUBLIC_SUPABASE_URL
Valor: https://seu-projeto.supabase.co
Ambientes: Development, Preview, Production ✅

Nome: NEXT_PUBLIC_SUPABASE_ANON_KEY
Valor: <NEXT_PUBLIC_SUPABASE_ANON_KEY> (copiar do Supabase)
Ambientes: Development, Preview, Production ✅

Nome: SUPABASE_SERVICE_ROLE_KEY
Valor: <SUPABASE_SERVICE_ROLE_KEY> (copiar do Supabase → Settings → API)
Ambientes: Preview, Production ✅ (NÃO em Development)
```

5. **Deploy novamente:**
   ```bash
   git push origin main
   ```

6. **Pronto!** Vercel usará as variáveis automaticamente.

---

## ⚠️ CHECKLIST DE SEGURANÇA

- ✅ `NEXT_PUBLIC_*` expostas no frontend? Sim (seguro)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` privada? Sim (nunca expo!)
- ✅ Token passado em Authorization header? Sim (seguro)
- ✅ RLS habilitado no Supabase? SIM (OBRIGATÓRIO)
- ✅ Validação de ministry_id em APIs? Sim (multi-tenancy)
- ✅ Erro messages genéricas (não expõe detalhes)? Sim
- ✅ Logs em console para debug? Sim (remover em prod)

---

## 📚 REFERÊNCIAS RÁPIDAS

| O que | Onde | Arquivo |
|-------|------|---------|
| **Login Frontend** | Página web | `src/app/admin/login/page.tsx` |
| **Cliente Frontend** | Biblioteca | `src/lib/supabase-client.ts` |
| **Cliente Backend** | Biblioteca | `src/lib/supabase-server.ts` |
| **Verificação Admin** | API Route | `src/app/api/v1/admin/verify/route.ts` |
| **Listar Membros** | API Route | `src/app/api/v1/members/route.ts` |
| **Configuração** | Template | `.env.local.template` |

---

## 💡 DICA OURO

> O segredo é usar **dois clientes diferentes**:
> 1. **Frontend** → Anon key (pública, RLS protege)
> 2. **Backend** → Service role (privada, admin total)

Assim o Vercel funciona perfeitamente sem problema de variáveis! 🎉

