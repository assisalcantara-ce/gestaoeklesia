# Padrões de Interface do Usuário (UI Patterns)

## 📌 1. Toolbar Executiva Unificada

Todas as páginas administrativas (como Clientes, Suporte e Financeiro) devem adotar o padrão visual de **Barra Única Horizontal**:

- **Pesquisa em Tempo Real:** Campo de busca com ícone integrado `🔍` operando sem acentos e case-insensitive em memória via `useMemo`.
- **Filtros por Dropdown Select:** Selects limpos com estilo dark corporativo (`bg-gray-800 border-gray-700`).
- **Ações Primárias à Direita:** Botões de ação como "+ Novo Registro" ou "Importar CSV" fixados à direita.

---

## 🔍 2. Filtragem Cumulativa em Memória

Para garantir performance e evitar rajadas desnecessárias de requisições ao banco de dados:

1. A lista completa de registros é carregada uma única vez via API.
2. A filtragem ocorre em memória via `useMemo` combinando múltiplos critérios simultaneamente (Pesquisa + Status + Plano + Trial + Categoria).
3. Utilizar normalização de string para pesquisas sem acento:

```typescript
const normalizeText = (text: string | null | undefined): string => {
  if (!text) return ''
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
```

---

## 📭 3. Dashboard Empty States

Quando uma pesquisa ou filtro resultar em zero itens, utilize o componente padronizado `DashboardEmptyState` em vez de mensagens genéricas em texto puro:

```tsx
<DashboardEmptyState
  icon={Inbox}
  title="Nenhum registro encontrado"
  description="Não foram encontrados itens que correspondam aos filtros aplicados."
  action={{
    label: "+ Novo Registro",
    onClick: handleCreateNew,
  }}
/>
```
