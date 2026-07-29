# 🏛️ Guia Oficial de Arquitetura 2.0 — Fundação da Componentização

Este documento estabelece as convenções oficiais, padrões de organização de pastas e o fluxo de desenvolvimento em camadas limpas para todas as telas do **Gestão Eklésia**.

---

## 📂 1. Estrutura Padrão de Diretórios

A aplicação adota o padrão de **Separação de Responsabilidades por Camadas**:

```
src/
├── app/                      <-- Camada de Roteamento (App Router)
│   └── [modulo]/
│       └── page.tsx          <-- Apenas orquestração limpa (< 200 linhas)
├── components/
│   ├── shared/               <-- Componentes UI universais genéricos (sem regra de negócio)
│   │   ├── PageHeader.tsx
│   │   ├── CrudToolbar.tsx
│   │   ├── CrudTable.tsx
│   │   ├── CrudModal.tsx
│   │   ├── CrudDrawer.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── LoadingState.tsx
│   │   └── EmptyState.tsx
│   └── [modulo]/             <-- Componentes UI específicos do domínio
│       ├── [Modulo]Table.tsx
│       ├── [Modulo]FormModal.tsx
│       └── [Modulo]Filters.tsx
├── hooks/
│   ├── shared/               <-- Hooks utilitários universais (useModalState, useDebounce)
│   └── [modulo]/             <-- Hooks de estado do módulo (use[Modulo]List, use[Modulo]Form)
├── services/
│   ├── shared/               <-- BaseService e wrappers HTTP
│   └── [modulo]Service.ts    <-- Lógica de comunicação com endpoints REST (/api/v1/[modulo])
├── repositories/
│   ├── shared/               <-- BaseRepository (Supabase Client-Side)
│   └── [modulo]Repository.ts <-- Consultas direta a tabelas quando aplicável
├── types/
│   ├── shared.ts             <-- Tipos utilitários globais (Pagination, TableColumn, TableAction)
│   └── [modulo].ts           <-- Interfaces TypeScript do domínio
└── constants/
    ├── shared.ts             <-- Constantes globais (PAGE_SIZE, HTTP_STATUS)
    └── [modulo].ts           <-- Enums e opções fixas do módulo
```

---

## 🎯 2. Responsabilidades por Camada

| Camada | Responsabilidade Permitida | O que É PROIBIDO |
|---|---|---|
| **Página (`page.tsx`)** | Apenas orquestrar o Hook do módulo e passar props para os componentes do layout. | ❌ Fazer chamadas `fetch` diretas.<br>❌ Declarar > 10 `useState`.<br>❌ Renderizar modais ou tabelas inline. |
| **Componentes (`components/`)** | Exibir UI pura recebendo dados e callbacks via `props`. | ❌ Fazer chamadas de API.<br>❌ Conter lógicas complexas de validação ou cálculo de regras de negócio. |
| **Hooks (`hooks/`)** | Gerenciar o ciclo de vida do React (`useState`, `useEffect`, busca, paginação, filtros, toggles). | ❌ Renderizar JSX ou HTML.<br>❌ Tratar detalhes de layout CSS. |
| **Serviços (`services/`)** | Encapsular chamadas HTTP via `authenticatedFetch` ou `BaseService`. | ❌ Manipular estados React.<br>❌ Usar Hooks (`useState`, `useEffect`). |
| **Repositórios (`repositories/`)** | Consultas diretas ao cliente Supabase (`from('tabela')`). | ❌ Manipular componentes de UI. |

---

## 🔄 3. Fluxo Recomendado para Refatoração de Módulos

Ao refatorar uma página monolítica para a **Arquitetura 2.0**, siga estes passos em ordem:

1. **Passo 1: Tipos e Constantes**
   - Crie `src/types/[modulo].ts` com as interfaces dos objetos e dados do módulo.
   - Crie `src/constants/[modulo].ts` com enums e opções de filtros.
2. **Passo 2: Camada de Serviço**
   - Crie `src/services/[modulo]Service.ts` herdando de `BaseService` para centralizar todos os `authenticatedFetch`.
3. **Passo 3: Hook de Estado e Regra de Negócio**
   - Crie `src/hooks/[modulo]/use[Modulo]List.ts` e `use[Modulo]Form.ts` para isolar os `useState` e `useEffect`.
4. **Passo 4: Componentização da UI**
   - Extraia a tabela para `components/[modulo]/[Modulo]Table.tsx` utilizando o `<CrudTable />` como base.
   - Extraia a toolbar/filtros para `components/[modulo]/[Modulo]Filters.tsx` utilizando `<CrudToolbar />`.
   - Extraia os modais para `components/[modulo]/[Modulo]FormModal.tsx` utilizando `<CrudModal />` ou `<CrudDrawer />`.
5. **Passo 5: Limpeza da Página (`page.tsx`)**
   - Reduza `page.tsx` para poucas linhas conectando o Hook de estado com os componentes.

---

## ✅ 4. Checklist de Qualidade Arquitetural

- [ ] A página `page.tsx` possui menos de 200 linhas de código.
- [ ] Nenhuma chamada de API (`authenticatedFetch` ou `fetch`) está escrita diretamente dentro de um componente de UI.
- [ ] Não existem mais de 5 chamadas de `useState` em uma mesma página.
- [ ] Modais utilizam o componente padrão `<CrudModal />` ou `<CrudDrawer />`.
- [ ] Exclusão de registros utiliza `<ConfirmDialog />`.
