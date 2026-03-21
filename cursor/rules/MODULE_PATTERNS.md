# 🧩 Padrões de Módulos

Como estruturar, documentar e referenciar módulos no projeto para consulta eficiente por IA.

## 1. Anatomia de um Módulo

Cada módulo deve seguir esta estrutura:

```
MODULE_NAME/
├── README.md              # Documentação do módulo
├── index.ts               # Exports públicos
├── types.ts               # Tipos TypeScript
├── constants.ts           # Constantes
├── utils/                 # Funções auxiliares
├── services/              # Lógica de negócio
├── hooks/                 # Custom React hooks
└── components/            # Componentes React
```

---

## 2. Template de Documentação de Módulo

Crie um `README.md` em cada módulo com:

```markdown
# Módulo: {Nome}

## Descrição
Uma linha descrevendo o propósito do módulo.

## Responsabilidade
- O que faz
- O que NÃO faz
- Dependências externas

## Referências Rápidas

**Arquivo Principal:** `src/...`
**Tipo de Dados:** `Member` | Interface/Type usado
**Tabelas:** `members`, `audit_logs`
**Hooks:** `useMembers()`, ...
**Componentes:** `FichaMembro`, ...

## Estrutura de Dados

```typescript
// Tipo principal
interface Member {
  id: string
  ministry_id: string
  name: string
  // ...
}
```

## APIs e Endpoints

### GET /api/v1/members
- Descrição: Listar membros
- Query params: page, limit, search, status
- Response: `Member[]`

### POST /api/v1/members
- Descrição: Criar novo membro
- Body: `CreateMemberInput`
- Response: `Member`

## Hooks

### useMembers()
```typescript
const {
  members,      // Member[] - lista carregada
  loading,      // boolean
  error,        // Error | null
  createMember, // (data) => Promise<Member>
  updateMember, // (id, data) => Promise<Member>
  deleteMember  // (id) => Promise<void>
} = useMembers()
```

## Componentes

### FichaMembro
Props: `{ memberId: string, onSave?: callback }`

## Exemplo de Uso

\`\`\`typescript
import { useMembers } from '@/hooks/useMembers'
import { FichaMembro } from '@/components/FichaMembro'

function App() {
  const { members } = useMembers()
  return <FichaMembro memberId={members[0].id} />
}
\`\`\`

## Validações

- Email deve ser único por ministry
- CPF deve ser único por ministry
- Status só pode ser: active, inactive, deceased, transferred

## RLS Policies

\`\`\`sql
-- Selecionar membros (apenas do seu ministry)
CREATE POLICY "Membros isolados por ministry"
  ON public.members FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users 
      WHERE user_id = auth.uid()
    )
  );
\`\`\`

## Padrões Adotados

- Soft delete (status='inactive') não DELETE físico
- Auditoria automática em audit_logs
- Timestamps em UTC
- Validação de ministry_id no backend

## TODOs

- [ ] Adicionar busca full-text por nome
- [ ] Filtrar por data de admissão
- [ ] Exportar para CSV

## Histórico de Mudanças

| Data | Mudança |
|------|---------|
| 2026-01-02 | Criação inicial |
```

---

## 3. Tag de Referência em Código

Adicione no início de cada arquivo principal:

```typescript
/**
 * MODULE: Members Management
 * 
 * Responsible for CRUD operations on church members.
 * Part of the multi-tenant system with RLS isolation by ministry_id.
 * 
 * @see MODULES_INDEX.md#gerenciamento-de-membros
 * @see cursor/rules/ARCHITECTURE.md
 * @see src/app/api/v1/members/route.ts (API endpoints)
 * @see src/hooks/useMembers.ts (React hook)
 * @see src/components/FichaMembro.tsx (UI component)
 * 
 * Key files:
 * - API: src/app/api/v1/members/route.ts
 * - Hook: src/hooks/useMembers.ts
 * - UI: src/components/FichaMembro.tsx
 * 
 * Database:
 * - Table: public.members
 * - Audit: public.audit_logs
 * 
 * RLS: Isolado por ministry_id via ministry_users
 */

import { NextRequest, NextResponse } from 'next/server'
// ... resto do código
```

---

## 4. Exemplo Real: Módulo Members

### Estrutura

```
src/
├── app/api/v1/members/
│   ├── route.ts              # GET (list) + POST (create)
│   └── [id]/route.ts         # GET + PUT + DELETE
├── components/
│   ├── FichaMembro.tsx       # Form para criar/editar
│   └── CartaoBatchPrinter.tsx # Impressão em lote
├── hooks/
│   └── useMembers.ts         # Hook CRUD
└── types/
    └── supabase.ts           # Tipo Member (auto-gerado)
```

### Arquivo: src/app/api/v1/members/route.ts

```typescript
/**
 * MODULE: Members Management - List & Create
 * 
 * @see MODULES_INDEX.md#gerenciamento-de-membros
 * @see cursor/rules/ARCHITECTURE.md
 * @see src/hooks/useMembers.ts
 * 
 * Endpoints:
 * - GET /api/v1/members (list com paginação)
 * - POST /api/v1/members (criar novo)
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // ...
}

export async function POST(request: NextRequest) {
  // ...
}
```

---

## 5. Índice de Módulos (MODULES_INDEX.md)

Este arquivo deve ser SEMPRE atualizado quando adicionar um novo módulo:

```markdown
## {Nova Funcionalidade}

**Módulo:** {Nome}
- **Arquivo Principal:** `src/...`
- **Descrição:** Breve descrição
- **Tabelas:** Quais tabelas usa
- **RLS:** Isolado por quê?
- **Endpoints:** (se API)
- **Hooks:** (se React)
- **Componentes:** (se UI)

@see cursor/docs/{MODULO_README.md} para detalhes
```

---

## 6. Referência Cruzada (Linking)

Quando módulos dependem um do outro:

```typescript
// ✅ BOM - Documentação clara de dependências
/**
 * Depende do módulo: Members Management
 * @see MODULES_INDEX.md#gerenciamento-de-membros
 * @see src/hooks/useMembers.ts
 */
import { useMembers } from '@/hooks/useMembers'
```

---

## 7. Checklist para Novo Módulo

Quando adicionar uma nova funcionalidade:

- [ ] Crie tabela SQL (ou modifique existente)
- [ ] Adicione RLS policies
- [ ] Crie arquivo README.md no módulo
- [ ] Adicione tag de referência em código
- [ ] Crie hook React (se necessário)
- [ ] Crie API endpoints (se necessário)
- [ ] Crie componente UI (se necessário)
- [ ] Atualize `MODULES_INDEX.md`
- [ ] Adicione validação
- [ ] Adicione testes
- [ ] Documente em `cursor/docs/`

---

## 8. Consulta por IA: Exemplo

**Pergunta:** Preciso adicionar campo de telefone ao membro

**Passo 1:** Consulte o índice
```
> Abra MODULES_INDEX.md
> Procure "Gerenciamento de Membros"
> Encontre: src/app/api/v1/members/route.ts
```

**Passo 2:** Consulte o módulo
```
> Abra cursor/docs/MEMBERS.md (se existir)
> Veja a estrutura de Member
> Veja quais tabelas e RLS policies
```

**Passo 3:** Faça a mudança
```
1. Adicione coluna em schema SQL
2. Atualize tipo em supabase-generated.ts
3. Atualize componente FichaMembro.tsx
4. Atualize API se necessário
```

**Passo 4:** Documente
```
> Atualize cursor/docs/MEMBERS.md com novo campo
> Atualize MODULES_INDEX.md com referência
```

---

## 9. Exemplo: Criando Novo Módulo "Cartões"

### 1. README.md (cursor/docs/CARTOES.md)

```markdown
# Módulo: Cartões de Membro

Gerencia templates e geração de cartões.

**Arquivo Principal:** `src/lib/card-templates.ts`
**Componentes:** `CartãoMembro.tsx`, `CartaoBatchPrinter.tsx`
**Tabelas:** `cartoes_templates`, `cartoes_gerados`

[resto da documentação]
```

### 2. Tag no Código (src/lib/card-templates.ts)

```typescript
/**
 * MODULE: Card Templates
 * 
 * @see MODULES_INDEX.md#cartões-de-membro
 * @see cursor/docs/CARTOES.md
 */

export const DEFAULT_TEMPLATE = { ... }
```

### 3. Atualizar MODULES_INDEX.md

```markdown
## 🎨 Cartões de Membro

**Módulo:** Card Templates & Generation
- **Arquivo:** `src/lib/card-templates.ts`
- **Componentes:** `CartãoMembro.tsx`, `CartaoBatchPrinter.tsx`
- **Tabelas:** `cartoes_templates`, `cartoes_gerados`

@see cursor/docs/CARTOES.md para detalhes
```

---

## Resumo de Boas Práticas

1. **Sempre use MODULES_INDEX.md** para navegar
2. **Adicione tags @see** em arquivos principais
3. **Crie README.md** para cada módulo importante
4. **Mantenha referências cruzadas** entre módulos
5. **Documente dependencies** claramente
6. **Atualize índices** quando adicionar features
7. **Use comentários** para explicar decisões
8. **Exemplos de uso** em cada documentação

---

**Versão:** 1.0  
**Data:** 2 jan 2026  
**Mantém:** Padrão de documentação e referência de módulos
