# 🔐 IA - Multi-tenant, Segurança e Escalabilidade (Essencial)

## Decisões (canônicas)

### Tenant
- **Campo canônico:** `ministry_id`.
- **Regra:** toda tabela de negócio deve ter `ministry_id` e todas as queries devem filtrar por ele (direto ou via RLS).

### Supabase clients (padrão)
- **Frontend (anon + RLS):** `src/lib/supabase-client.ts`.
- **Server com JWT do usuário (RLS):** `src/lib/supabase-rls.ts`.
- **Server service role (ignora RLS):** `src/lib/supabase-server.ts`.

**Nunca** use service role no browser.

### Admin
- Rotas `/admin/*` são protegidas por `src/proxy.ts`.
- `admin_users` é tabela sensível: evitar depender de RLS nela para autenticação (risco de recursion/policies frágeis).

---

## Checklist de implementação (antes de criar feature)

### Ao criar uma nova tabela
- [ ] Tem `ministry_id` (UUID) + índice?
- [ ] RLS habilitada?
- [ ] Policies por `ministry_id` revisadas?

### Ao criar uma nova API route
- [ ] A rota valida o usuário/tenant (não confia em querystring)?
- [ ] Usa o client certo (browser vs server JWT vs service role)?
- [ ] Retorna `meta` (paginação) quando lista dados?

### Ao criar uma nova página
- [ ] Evita carregar “tudo” sem paginação?
- [ ] Evita dependências de dados sensíveis no client?

---

## Prioridades recomendadas

### P0 (hoje)
- Remover segredos de docs e padronizar `.env.local.template`.
- Garantir que nenhuma rota admin fique fora do middleware.

### P1 (1–2 dias)
- Unificar nomenclatura do tenant em código/docs (`ministry_id`).
- Centralizar resolução do tenant (pegar `ministry_id` do usuário) em um helper único.

### P2 (3–7 dias)
- Índices nas colunas de filtro (`ministry_id`, `status`, `created_at`, `cidade`).
- Paginação server-side e contratos de API consistentes.
