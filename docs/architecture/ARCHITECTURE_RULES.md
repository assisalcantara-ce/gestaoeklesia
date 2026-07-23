# Regras Arquiteturais e Padrões de Desenvolvimento — Gestão Eklésia

Este documento consolida as regras técnicas fundamentais e obrigatórias para o desenvolvimento e manutenção do projeto **Gestão Eklésia**.

---

# REGRA 01 — React Hooks

Todos os React Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, etc.) devem ser declarados estritamente no topo do componente.

É proibido declarar Hooks:
- após qualquer `return`;
- dentro de `if`;
- dentro de `switch`;
- dentro de loops (`for`, `while`);
- dentro de `map`;
- dentro de funções internas.

Todo `useMemo` deve possuir fallback seguro para dados ainda não carregados.

### Exemplo Incorreto ❌
```tsx
if (isLoading) return <LoadingSpinner />;

// ERRO REACT #310: Hook declarado após retorno condicional
const groupedInvoices = useMemo(() => {
  return invoices.map(...);
}, [invoices]);
```

### Exemplo Correto ✅
```tsx
// Declaração no topo com fallback seguro
const groupedInvoices = useMemo(() => {
  const list = invoices || [];
  if (!list.length) return [];
  // Lógica de agrupamento...
}, [invoices]);

// Retornos condicionais ocorrem APENAS APÓS a declaração de TODOS os Hooks
if (isLoading) return <LoadingSpinner />;
if (!isAuthenticated || !isAdmin) return null;
```

**Objetivo:**
Garantir conformidade com as *Rules of Hooks* do React e eliminar erros como React Error #310 (*Rendered more/fewer hooks than during the previous render*).

---

# REGRA 02 — Cards com Dropdowns

Nenhum Card principal poderá utilizar `overflow-hidden` quando existir a possibilidade de conter:
- Dropdowns;
- Menus (⋮);
- Popovers;
- Tooltips;
- Autocomplete;
- Context Menus.

### Estrutura Obrigatória

```tsx
<Card className="border border-gray-800 rounded-xl bg-gray-900/50 shadow-xl relative z-10 hover:z-20">
  {/* Cabeçalho do Card (Dropdowns embutidos podem extrapolar livremente) */}
  <Header />

  {/* Conteúdo interno expansível que exige recorte de cantos */}
  <ContentWrapper className="overflow-hidden rounded-b-xl border-t border-gray-800">
    <Table />
  </ContentWrapper>
</Card>
```

O container principal deve permanecer livre para que elementos flutuantes possam extrapolar seus limites visuais sem serem cortados por clipping.

Todos os Dropdowns devem utilizar:
- `position: absolute;`
- `z-index` padronizado (`z-50` ou superior).

Preferencialmente utilizar componentes renderizados em Portal ou wrappers sem interseção de overflow.

**Objetivo:**
Evitar *clipping* causado por `overflow-hidden` e manter a consistência visual e acabamento corporativo do Design System.

---

# REGRA 03 — Consultas ao Banco

Nunca consultar colunas que não pertençam ao schema oficial da tabela no banco de dados.

Antes de adicionar novos campos em consultas relacionais do Supabase:
- confirmar a existência prévia da coluna na tabela de destino;
- confirmar se a migration correspondente foi aplicada no ambiente;
- confirmar a atualização do schema cache no PostgREST/Supabase.

### Exemplo Incorreto ❌
```typescript
// ERRO PGRST200 / HTTP 400: responsavel_phone não existe na tabela ministries
const { data, error } = await supabase
  .from('platform_billing_invoices')
  .select(`
    id,
    ministries (
      name,
      phone,
      responsavel_phone
    )
  `);
```

### Exemplo Correto ✅
```typescript
// Apenas colunas verificadas no schema oficial da tabela ministries
const { data, error } = await supabase
  .from('platform_billing_invoices')
  .select(`
    id,
    ministries (
      name,
      phone
    )
  `);
```

**Objetivo:**
Evitar erros `PGRST200` (*Could not find column in schema cache*) e HTTP 400 Bad Request por buscas a colunas inexistentes.

---

# REGRA 04 — Requisições Administrativas

É proibido utilizar `fetch()` nativo diretamente em páginas ou componentes do painel administrativo.

Toda chamada de API administrativa no frontend deverá obrigatoriamente utilizar `authenticatedFetch()`.

### Exemplo Incorreto ❌
```typescript
// ERRO HTTP 401: fetch nativo não envia o token JWT no cabeçalho Authorization
const response = await fetch('/api/v1/admin/oportunidades');
```

### Exemplo Correto ✅
```typescript
import { authenticatedFetch } from '@/lib/api-client';

// Sucesso: authenticatedFetch injeta automaticamente Authorization: Bearer <JWT>
const response = await authenticatedFetch('/api/v1/admin/oportunidades');
```

**Objetivo:**
- Centralizar a camada de comunicação HTTP autenticada;
- Enviar o token JWT automaticamente em todas as requisições;
- Padronizar o tratamento global de renovação e erros de sessão;
- Eliminar o erro HTTP 401 Unauthorized por ausência de credencial no cabeçalho.
