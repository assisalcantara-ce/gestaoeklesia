# ⚡ Quick Reference - Cheat Sheet

**Para consulta rápida durante desenvolvimento.**

Copie e adapte exemplos diretamente!

---

## 🔐 Security Pattern (SEMPRE USAR)

```typescript
// ✅ Correto - Backend com validação
const ministry = await getUserMinistry(session.user.id); // Validar
const { data } = await supabase
  .from('members')
  .select()
  .eq('ministry_id', ministry); // ← Isolamento garantido!

// ❌ Errado - Nunca faça isto:
const { data } = await supabase
  .from('members')
  .select()
  .eq('ministry_id', req.body.ministryId); // Cliente envia? Inseguro!
```

---

## 📝 TypeScript Pattern

```typescript
// Response pattern
type ApiResponse<T> = 
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: { code: string; message: string } }

// Uso
const response: ApiResponse<Member[]> = await fetchMembers();
if (response.success) {
  console.log(response.data); // ✅ TypeScript sabe que é Member[]
}
```

---

## 🧩 Novo Componente (Template)

```tsx
// 1. Tipo
interface MyComponentProps {
  title: string;
  onClose: () => void;
}

// 2. Componente
export function MyComponent({ title, onClose }: MyComponentProps) {
  const [state, setState] = useState('');
  
  return (
    <div className={`${SPACING.containerPadding} bg-white`}>
      <h1 style={{ color: COLORS.darkBlue }}>{title}</h1>
      <button onClick={onClose}>Fechar</button>
    </div>
  );
}

// 3. Export
export default MyComponent;
```

---

## 🗄️ Query Database Pattern

```typescript
// ✅ Listar com filtro
const { data, error } = await supabase
  .from('members')
  .select('*')
  .eq('ministry_id', ministryId)   // ← RLS + segurança
  .eq('status', 'active')
  .order('name', { ascending: true });

// ✅ Criar novo
const { data, error } = await supabase
  .from('members')
  .insert({
    ministry_id: ministryId,  // ← Nunca esqueça!
    name: 'João',
    email: 'joao@email.com'
  });

// ✅ Atualizar
const { data, error } = await supabase
  .from('members')
  .update({ status: 'inactive' })
  .eq('id', memberId)
  .eq('ministry_id', ministryId);  // ← Validação extra

// ✅ Deletar
const { data, error } = await supabase
  .from('members')
  .delete()
  .eq('id', memberId)
  .eq('ministry_id', ministryId);  // ← Nunca esqueça!
```

---

## 🌐 API Call Pattern (Frontend)

```typescript
// GET
const response = await fetch('/api/v1/members', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const json = await response.json();

// POST
const response = await fetch('/api/v1/members', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'João',
    email: 'joao@email.com'
  })
});

// PUT
const response = await fetch('/api/v1/members/member-id', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ status: 'inactive' })
});
```

---

## ⚛️ Hook Pattern

```typescript
// Custom hook
export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('members')
        .select()
        .eq('ministry_id', ministryId);
      setMembers(data || []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  return { members, loading, error, fetchMembers };
}
```

---

## 🎨 Design System Usage

```tsx
import { SPACING, COLORS, COMPONENTS } from '@/config/design-system';

// Spacing
<div className={`${SPACING.containerPadding} mt-4`}>

// Colors
<div style={{ color: COLORS.darkBlue, backgroundColor: COLORS.lightBg }}>

// Components
<button className={COMPONENTS.button.primary}>Clique</button>
```

---

## 📊 Novo Módulo (Pastas)

```
src/app/meu-modulo/
├── page.tsx              # Página principal
├── layout.tsx            # Layout (opcional)
├── README.md             # Documentação
├── index.ts              # Exports públicos
├── types.ts              # TypeScript types
├── constants.ts          # Constantes
├── utils/                # Funções auxiliares
├── hooks/                # Custom hooks
├── components/           # Componentes React
└── __tests__/            # Testes
```

---

## 🚀 Novo Endpoint (API Route)

```typescript
// src/app/api/v1/members/route.ts

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // 1. Autenticar
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    // 2. Validar ministry
    const ministry = await getUserMinistry(session.user.id);
    if (!ministry) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    
    // 3. Query banco
    const { data, error } = await supabase
      .from('members')
      .select()
      .eq('ministry_id', ministry);
    
    // 4. Response
    return NextResponse.json({
      success: !error,
      data: data || [],
      error: error?.message || null
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const ministry = await getUserMinistry(session.user.id);
  if (!ministry) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabase
    .from('members')
    .insert({
      ...body,
      ministry_id: ministry  // ← Segurança!
    });

  return NextResponse.json({
    success: !error,
    data: data?.[0] || null,
    error: error?.message || null
  }, { status: error ? 400 : 201 });
}
```

---

## 🔍 Validação Pattern

```typescript
// Validação inline
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone: string): boolean {
  return /^\(\d{2}\)\s?\d{4,5}-\d{4}$/.test(phone);
}

function validateCPF(cpf: string): boolean {
  return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cpf);
}

// Error response
if (!validateEmail(email)) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Email inválido',
        details: { email: 'Formato inválido' }
      }
    },
    { status: 400 }
  );
}
```

---

## 🎯 Configuration Usage

```typescript
// Buscar valores customizados
const { getValue } = useConfigurations();

// Pegar enum de status
const statuses = getValue('member_status_values');
// ["Ativo", "Inativo", "Falecido", "Transferido"]

// Usar em select/dropdown
<select>
  {statuses.map(s => <option key={s}>{s}</option>)}
</select>
```

---

## 📱 Responsive Pattern

```tsx
// Mobile first
<div className={`
  px-4 py-6           // Mobile: pequeno padding
  md:px-8 md:py-12    // Tablet: médio padding
  lg:px-12 lg:py-16   // Desktop: grande padding
  grid
  md:grid-cols-2      // Tablet: 2 colunas
  lg:grid-cols-3      // Desktop: 3 colunas
`}>
```

---

## 🔔 Notificação Pattern

```tsx
const { addNotification } = useNotification();

// Exibir notificação
addNotification({
  type: 'create',
  title: 'Sucesso',
  message: 'Membro criado com sucesso'
});

// Tipos: 'create', 'update', 'delete', 'export'
```

---

## 🧪 Testing Pattern

```typescript
// Simple test
import { render, screen } from '@testing-library/react';

describe('MyComponent', () => {
  it('deve renderizar título', () => {
    render(<MyComponent title="Test" onClose={() => {}} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

---

## 📚 Documentação Files

| Arquivo | Usar Para |
|---------|-----------|
| **README.md** | Entender propósito pasta rules/ |
| **INDEX_RULES.md** | Navegar qual arquivo ler |
| **ARCHITECTURE.md** | Entender arquitetura |
| **DATABASE_SCHEMA.md** | Entender banco de dados |
| **API_ENDPOINTS.md** | Entender API endpoints |
| **CODE_STYLE.md** | Padrões de código |
| **MODULE_PATTERNS.md** | Estrutura de módulos |
| **REACT_COMPONENTS.md** | Componentes e hooks |
| **Este arquivo** | Copiar/colar durante dev |

---

## ⚡ Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| "401 Unauthorized" | Verificar token JWT em Authorization header |
| "403 Forbidden" | Validar ministry_id do usuário |
| "404 Not Found" | Verificar endpoint URL e verb HTTP |
| "Erro RLS" | Garantir eq('ministry_id', validatedId) em query |
| "Type error" | Verificar interface e adicionar tipos ausentes |
| "Componente não renderiza" | Verificar props e estado inicial |
| "Estilo quebrado" | Usar classes do design-system.ts |

---

## 🚀 Deploy Checklist (Antes de Produção)

- [ ] Variáveis de ambiente (.env.production)
- [ ] RLS ativado em todas as tabelas
- [ ] Validação manual de ministry_id em APIs
- [ ] Testes unitários passando
- [ ] Testes e2e passando
- [ ] Sem console.log ou debugger no código
- [ ] Performance otimizada
- [ ] HTTPS/SSL ativado
- [ ] Backup do banco configurado
- [ ] Monitoramento ativo

---

**Última atualização:** 2 de janeiro de 2026  
**Versão:** 1.0

