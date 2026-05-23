# IA - Multi-tenant, Seguranca e Escalabilidade (Essencial)

## Decisoes canonicas

### Tenant
- Campo canonico: `ministry_id`.
- Regra: toda tabela de negocio deve ter `ministry_id` e todas as queries devem filtrar por ele, diretamente ou via RLS.

### Supabase clients
- Frontend anon + RLS: `src/lib/supabase-client.ts`.
- Server com JWT do usuario + RLS: `src/lib/supabase-rls.ts`.
- Server service role, ignora RLS: `src/lib/supabase-server.ts`.

Nunca use service role no browser.

### Admin
- Rotas `/admin/*` sao protegidas por `src/proxy.ts`.
- `admin_users` e tabela sensivel: evitar depender de RLS nela para autenticacao, porque policies podem gerar recursao ou regras frageis.

---

## Checklist de implementacao

### Ao criar uma nova tabela
- [ ] Tem `ministry_id` UUID + indice?
- [ ] RLS habilitada?
- [ ] Policies por `ministry_id` revisadas?

### Ao criar uma nova API route
- [ ] A rota valida usuario e tenant no servidor, sem confiar em querystring?
- [ ] Usa o client certo: browser, server JWT ou service role?
- [ ] Se usa service role, a rota foi classificada conforme a secao abaixo?
- [ ] Retorna `meta` de paginacao quando lista dados?

### Ao criar uma nova pagina
- [ ] Evita carregar tudo sem paginacao?
- [ ] Evita dependencias de dados sensiveis no client?
- [ ] Usa `useRequireModulo` quando a pagina pertence a um modulo restrito?

---

## Classificacao de rotas com service_role

Use esta classificacao antes de criar ou alterar uma API que importe `createServerClient()` ou leia `SUPABASE_SERVICE_ROLE_KEY`.

### Tenant autenticado
- Deve chamar `resolveTenantAuth(request)` antes de qualquer operacao privilegiada.
- Toda leitura/escrita precisa filtrar por `ministry_id` resolvido no servidor.
- Quando usar service role para Storage ou tabelas sem RLS suficiente, validar tenant e escopo antes da operacao.
- Exemplos auditados: `members`, `employees`, `audit-logs`, uploads de `cartas` e `igreja-foto`.

### Admin SaaS
- Deve usar `requireAdmin()` ou helper equivalente do painel SaaS.
- Nao reutilizar contexto de usuario de ministerio para rotas do painel `/admin`.
- Exemplos auditados: `plans`, `contracts`, `attendance`, `ministries`, `admin usuarios`.

### Publica
- Deve ter validacao forte de entrada, rate limit e log de auditoria publica quando aplicavel.
- Service role so pode ser usado para checagens/limpeza controladas no servidor.
- Exemplos auditados: `contact`, `signup`.

### Webhook
- Deve validar token ou assinatura antes de abrir client service role.
- Deve registrar evento e garantir idempotencia por identificador externo.
- Exemplo auditado: `asaas/webhook`.

### Pre-cadastro / trial
- Usuario autenticado ainda pode nao ter `ministry_id`.
- Nao usar `resolveTenantAuth()` antes da criacao do tenant; validar JWT do usuario e limitar a operacao ao proprio usuario.
- Exemplos auditados: `trial/status`, `trial/checkout`.

---

## Rotas tenant legadas sob `/api/v1/admin`

As rotas abaixo sao tenant autenticado, apesar do caminho legado conter `/admin`:

- `/api/v1/admin/payments-list`
- `/api/v1/admin/payments-boleto`

Regra atual: manter compatibilidade com o frontend existente e proteger com `resolveTenantAuth(request)`.

Rotas canonicas atuais:

- `/api/v1/payments`
- `/api/v1/payments/boleto`

Proximo ajuste recomendado: remover ou depreciar os caminhos legados depois de validar que nao existem clientes externos usando esses endpoints antigos.

---

## EBD: escopo local no banco

As telas da EBD acessam Supabase diretamente pelo client, entao a barreira principal de backend e RLS.

Regras canonicas:

- Administrador, permissao `EBD` e coordenador: escopo global do ministerio.
- Superintendente: escopo restrito a `ministry_users.congregacao_id`.
- Tabelas globais como classes, revistas e trimestres podem ser lidas por usuarios EBD, mas escrita fica restrita ao escopo global.
- Tabelas locais ou derivadas de turma/aula/aluno devem validar `church_id` direto ou indireto.

Migration de hardening:

- `supabase/migrations/20260425130000_ebd_rls_local_scope.sql`

Ao criar nova tabela EBD, inclua `ministry_id`; se houver dado local, inclua `church_id` ou uma FK que permita resolver o `church_id` via turma/aula/pedido.

---

## Prioridades recomendadas

### P0
- Remover segredos de docs e padronizar `.env.local.template`.
- Garantir que nenhuma rota admin fique fora do middleware.
- Manter helpers canonicos de tenant, roles e erros de auth em uma fonte unica.

### P1
- Unificar nomenclatura do tenant em codigo/docs (`ministry_id`).
- Centralizar resolucao do tenant em `src/lib/tenant-auth.ts`.
- Usar `src/lib/access-control.ts` para niveis e permissoes.

### P2
- Indices nas colunas de filtro (`ministry_id`, `status`, `created_at`, `cidade`).
- Paginacao server-side e contratos de API consistentes.
- Migrar rotas tenant legadas de `/api/v1/admin/*` para caminhos sem ambiguidade.
