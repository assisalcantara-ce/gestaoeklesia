# 📝 Padrões de Código

Guia de estilo, convenções e padrões de código para o projeto.

## 1. TypeScript

### Tipos Genéricos

```typescript
// ✅ BOM - Type-safe
interface Member {
  id: string
  ministry_id: string
  name: string
  email: string | null
  status: 'active' | 'inactive' | 'deceased' | 'transferred'
  created_at: string
}

// ❌ RUIM - any
interface Member {
  [key: string]: any
}
```

### Discriminated Unions para Responses

```typescript
// ✅ BOM - Type-safe success/error
type ApiResponse<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: { code: string; message: string } }

// Uso
const response: ApiResponse<Member[]> = ...
if (response.success) {
  response.data // TypeScript sabe que é Member[]
}
```

### Strictness

```typescript
// tsconfig.json DEVE ter:
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

---

## 2. Componentes React

### Nomenclatura

```typescript
// ✅ BOM - PascalCase, arquivo = componente
// Arquivo: src/components/FichaMembro.tsx
export function FichaMembro() { ... }

// ❌ RUIM - camelCase para componente
export function fichaMembro() { ... }
```

### Estrutura

```typescript
// ✅ BOM - Ordem clara
import { useState } from 'react'
import type { Member } from '@/types/supabase'
import { useMembers } from '@/hooks/useMembers'
import { Button } from '@/components/Button'

interface FichaMomembroProps {
  memberId: string
  onSave?: (member: Member) => void
}

export function FichaMembro({ memberId, onSave }: FichaMomembroProps) {
  const [loading, setLoading] = useState(false)
  const { members, updateMember } = useMembers()

  const handleSave = async () => { ... }

  return (
    <div>
      {/* JSX */}
    </div>
  )
}
```

### Props Interface

```typescript
// ✅ BOM - Tipado
interface ButtonProps {
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
  children: React.ReactNode
}

// ❌ RUIM - Sem tipos
function Button(props) { ... }
```

### Custom Hooks

```typescript
// ✅ BOM - Arquivo: src/hooks/useMembers.ts
export function useMembers() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getMembers()
      setMembers(data)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  return { members, loading, error, fetchMembers }
}

// Uso no componente
function MyComponent() {
  const { members, loading } = useMembers()
  return <>{loading ? 'Carregando...' : members.length}</>
}
```

---

## 3. API Routes (Next.js)

### Estrutura

```typescript
// ✅ BOM - src/app/api/v1/members/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface GetMembersQuery {
  page?: number
  limit?: number
  search?: string
  status?: string
}

export async function GET(request: NextRequest) {
  try {
    // 1. Autenticação
    const token = request.headers.get('authorization')?.split(' ')[1]
    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED' } },
        { status: 401 }
      )
    }

    // 2. Verificar permissão
    const user = await verifyToken(token)
    const ministries = await getUserMinistries(user.id)

    // 3. Buscar dados
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const members = await supabase
      .from('members')
      .select('*')
      .in('ministry_id', ministries.map(m => m.id))
      .range((page - 1) * limit, page * limit - 1)

    // 4. Registrar auditoria
    await auditLog({
      user_id: user.id,
      action: 'READ',
      resource_type: 'members'
    })

    // 5. Retornar resposta padrão
    return NextResponse.json({
      success: true,
      data: members,
      meta: { page, limit, total: members.length }
    })

  } catch (error) {
    console.error('GET /api/v1/members error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR' } },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validação
    if (!body.name || !body.email) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST' } },
        { status: 400 }
      )
    }

    // ... resto da lógica

    return NextResponse.json({ success: true, data: newMember }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR' } },
      { status: 500 }
    )
  }
}
```

### Response Padrão

```typescript
// ✅ SEMPRE use este formato
{
  success: true,
  data: { ... } | null,
  meta?: { page: number; limit: number; total: number },
  error: null | { code: string; message: string }
}
```

---

## 4. Nomeação de Variáveis

### Convenções

```typescript
// ✅ BOM - Claro e descritivo
const isLoading = true
const hasPermission = false
const memberList = [...]
const currentPage = 1
const maxRetries = 3

// ❌ RUIM - Vago ou muito curto
const load = true
const perm = false
const list = [...]
const p = 1
const m = 3

// BOOLEANOS - sempre use is/has/can
const isActive = true
const hasEmail = false
const canEdit = true
```

### Constantes

```typescript
// ✅ BOM - SCREAMING_SNAKE_CASE
const MAX_MEMBERS_PER_MINISTRY = 1000
const DEFAULT_PAGE_SIZE = 20
const ROLES = ['admin', 'manager', 'operator', 'viewer'] as const

// ❌ RUIM - camelCase para constante
const maxMembers = 1000
```

---

## 5. Funções

### Tamanho & Responsabilidade

```typescript
// ✅ BOM - Função pequena, uma responsabilidade
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ❌ RUIM - Função faz tudo
function processUser(data: any): any {
  // 50 linhas de validação
  // 30 linhas de transformação
  // 40 linhas de salvamento
}
```

### Parâmetros

```typescript
// ✅ BOM - Máximo 3 parâmetros
function createMember(
  ministryId: string,
  name: string,
  email: string
) { ... }

// ✅ BOM - Acima de 3, use objeto
interface CreateMemberParams {
  ministryId: string
  name: string
  email: string
  phone?: string
  cpf?: string
}

function createMember(params: CreateMemberParams) { ... }

// ❌ RUIM - Muitos parâmetros posicionais
function createMember(
  ministryId,
  name,
  email,
  phone,
  cpf,
  address,
  city,
  state,
  zipcode
) { ... }
```

---

## 6. Async/Await

```typescript
// ✅ BOM - Try/catch
async function fetchMember(id: string) {
  try {
    const response = await api.get(`/members/${id}`)
    return response.data
  } catch (error) {
    console.error('Failed to fetch member:', error)
    throw new Error('Falha ao carregar membro')
  }
}

// ❌ RUIM - .then() chains
fetchMember(id)
  .then(data => setMember(data))
  .catch(error => console.error(error))
  .finally(() => setLoading(false))
```

---

## 7. Comentários

```typescript
// ✅ BOM - Comentário explica o POR QUE
// Se ministry for deletado, cascade deleta membros
// isso é intencional para manter integridade referencial
const members = await supabase.from('members')
  .select('*')
  .eq('ministry_id', ministryId)

// ✅ BOM - Comentário sobre decisão
// Usamos soft-delete (status='inactive') ao invés de DELETE físico
// para manter dados para auditoria e compliance
const deactivateMember = (id: string) => {
  return supabase.from('members')
    .update({ status: 'inactive' })
    .eq('id', id)
}

// ❌ RUIM - Comentário óbvio
// Incrementa x
x++

// ❌ RUIM - Comentário desatualizado
// TODO: Refatorar isso em 2025
// (estamos em 2026 e ainda está assim)
```

---

## 8. Imports

```typescript
// ✅ BOM - Organizados
import { useState } from 'react'
import type { Member } from '@/types/supabase'
import { Button } from '@/components/Button'
import { useMembers } from '@/hooks/useMembers'

// ❌ RUIM - Desordenado
import { useMembers } from '@/hooks/useMembers'
import type { Member } from '@/types/supabase'
import { Button } from '@/components/Button'
import { useState } from 'react'

// Ordem correta:
// 1. React/Node imports
// 2. Type imports
// 3. Components
// 4. Hooks
// 5. Utils/Services
```

---

## 9. Null/Undefined Handling

```typescript
// ✅ BOM - Explicit checks
function getMemberName(member: Member | null): string {
  return member?.name ?? 'Sem nome'
}

// ✅ BOM - Type guard
function processMember(member: Member | null) {
  if (!member) {
    return 'Nenhum membro'
  }
  return `${member.name} - ${member.email}`
}

// ❌ RUIM - Assumptions
function getMemberName(member) {
  return member.name // Pode dar erro se member for null
}
```

---

## 10. Testing

```typescript
// ✅ BOM - Testes para funções críticas
describe('validateEmail', () => {
  it('should validate correct email', () => {
    expect(validateEmail('user@example.com')).toBe(true)
  })

  it('should reject invalid email', () => {
    expect(validateEmail('invalid-email')).toBe(false)
  })
})

// ✅ BOM - Testes para permissões
describe('getUserMinistries', () => {
  it('should return only ministries for the user', async () => {
    const ministries = await getUserMinistries(userId)
    expect(ministries.every(m => m.user_id === userId)).toBe(true)
  })
})
```

---

## Checklist de Code Review

- [ ] TypeScript strict mode passa sem erros
- [ ] Nomes são descritivos
- [ ] Funções têm uma responsabilidade
- [ ] Tratamento de erros adequado
- [ ] Tipos definidos (não use `any`)
- [ ] Comments explicam o WHY, não o WHAT
- [ ] Sem código morto
- [ ] Sem console.log em produção
- [ ] Imports organizados
- [ ] Testes para lógica crítica

---

**Versão:** 1.0  
**Data:** 2 jan 2026  
**Mantém:** Padrões de código TypeScript/React
