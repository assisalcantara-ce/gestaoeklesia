# REGRA 04 — Requisições Administrativas & Autenticação HTTP

## 📌 Diretrizes Principais

1. **Uso Obrigatório de `authenticatedFetch()`:** É estritamente proibido utilizar a função global `fetch()` nativa diretamente no frontend em rotas administrativas (`/admin/...`). Toda chamada HTTP para a API deve utilizar a helper `authenticatedFetch()` (`@/lib/api-client`).
2. **Injeção Automática de JWT:** A helper `authenticatedFetch()` extrai o token JWT da sessão ativa do Supabase e injeta o cabeçalho HTTP:
   `Authorization: Bearer <token>`
3. **Prevenção de HTTP 401:** O uso do `fetch()` desautenticado faz com que o middleware ou a rota backend rejeitem a requisição por falta de token, gerando falhas `401 Unauthorized`.

---

## 💻 Padrão de Invocação de APIs no Frontend

```typescript
import { authenticatedFetch } from '@/lib/api-client'

// Invocação GET Autenticada
const response = await authenticatedFetch('/api/v1/admin/billing-invoices')
if (!response.ok) {
  throw new Error('Erro ao carregar faturas')
}
const data = await response.json()

// Invocação POST Autenticada
const response = await authenticatedFetch('/api/v1/admin/billing/create-invoice', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})
```

---

## 🛡️ Camada de Guard no Backend (`requireAdmin`)

Toda rota de API administrativa sob `/api/v1/admin/...` deve validar o token recebido no cabeçalho utilizando `requireAdmin`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredModule: 'pagamentos' })
    if (!result.ok) return result.response
    
    const { supabaseAdmin: supabase, user, adminUser } = result.ctx
    // Lógica da rota...
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```
