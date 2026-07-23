# Padrões de Desenvolvimento — Gestão Eklésia

Consulte a documentação completa da arquitetura:

- 📄 **[Regras Arquiteturais Fundamentais (ARCHITECTURE_RULES.md)](./ARCHITECTURE_RULES.md)**
- 📚 **[Índice Geral de Arquitetura (README.md)](./README.md)**

---

## 🎯 Resumo Rápido das 4 Regras Principais

### 1. REGRA 01 — React Hooks
- **Onde:** Todos no topo do componente, antes de qualquer `return`.
- **Fallbacks:** `useMemo` com fallback seguro `[]` para dados nulos.
- **Objetivo:** Eliminar React Error #310.

### 2. REGRA 02 — Cards com Dropdowns
- **Arquitetura:** Card sem `overflow-hidden`. Utilizar `ContentWrapper` interno com `overflow-hidden rounded-b-xl`.
- **Dropdowns:** `position: absolute` e `z-50`.
- **Objetivo:** Eliminar corte de menus e popovers.

### 3. REGRA 03 — Consultas ao Banco
- **Schema:** Nunca consultar colunas que não existam na tabela do Supabase.
- **Objetivo:** Eliminar erros PGRST200 e HTTP 400 Bad Request.

### 4. REGRA 04 — Requisições Administrativas
- **Autenticação:** Usar `authenticatedFetch()` obrigatoriamente no frontend.
- **Objetivo:** Injetar JWT e eliminar HTTP 401 Unauthorized.
