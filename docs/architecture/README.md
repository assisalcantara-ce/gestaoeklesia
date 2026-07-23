# Arquitetura e Padrões de Desenvolvimento — Gestão Eklésia

Este diretório contém os guias arquiteturais, padrões de código e regras técnicas obrigatórias adotadas no projeto **Gestão Eklésia**.

---

## 📚 Índice de Documentos

| Documento | Descrição |
| :--- | :--- |
| 📄 [ARCHITECTURE_RULES.md](./ARCHITECTURE_RULES.md) | **Consolidado de Regras Críticas** (Regras 01 a 04) |
| 🎣 [01-React-Hooks.md](./01-React-Hooks.md) | **REGRA 01**: Declaração incondicional de Hooks e prevenções para React Error #310 |
| 🎨 [02-Design-System.md](./02-Design-System.md) | **REGRA 02**: Arquitetura de Cards, Dropdowns e isolamento de `overflow-hidden` |
| 🔐 [03-Permissions.md](./03-Permissions.md) | Controle de acesso, RBAC e permissões por perfil (`admin`, `financeiro`, `suporte`) |
| 🗄️ [04-Database.md](./04-Database.md) | **REGRA 03**: Consultas ao Supabase/PostgREST e prevenção de erros `PGRST200` |
| 📡 [05-APIs.md](./05-APIs.md) | **REGRA 04**: Requisições administrativas obrigatórias com `authenticatedFetch()` |
| 🧩 [06-UI-Patterns.md](./06-UI-Patterns.md) | Padrões de Toolbars, filtros cumulativos em memória e responsividade |
| 🛠️ [07-Coding-Standards.md](./07-Coding-Standards.md) | Boas práticas de código, TypeScript, auditoria e resiliência |

---

## 🎯 Regras Principais em Resumo

1. **Hooks no Topo (REGRA 01):** Todos os React Hooks devem ser declarados incondicionalmente antes de qualquer `return` antecipado.
2. **Cards sem Clipping (REGRA 02):** NUNCA colocar `overflow-hidden` no card pai se houver dropdowns ou menus flutuantes.
3. **Validação de Schema (REGRA 03):** NUNCA consultar colunas no Supabase sem verificar a existência prévia no schema oficial.
4. **Fetch Autenticado (REGRA 04):** TODA requisição administrativa no frontend DEVE utilizar `authenticatedFetch()`.
