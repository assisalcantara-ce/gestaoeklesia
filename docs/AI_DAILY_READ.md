# 🤖 IA - Leitura Diária (Essencial)

**Objetivo:** em 3–5 minutos, alinhar contexto, segurança e multi-tenant antes de codar.

---

## 1) Regras do projeto (não quebre)

- **Tenant canônico:** use `ministry_id` para isolamento multi-tenant.
- **Admin panel (/admin):** acesso é validado no servidor (middleware). Não crie rotas admin sem checar auth.
- **Segredos:** não colocar chaves/senhas em `.md`. Use `.env.local` e templates.
- **Service role:** só em server-side (API/middleware). Nunca no frontend.

---

## 2) Checklist rápido (2 min)

1. `git status` e `git pull` (se aplicável)
2. Verificar `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - (se usar mapas) `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
3. Subir dev server: `npm run dev`

---

## 3) Onde mexer com segurança

- Proteção de rotas admin: `src/proxy.ts`.
- Client Supabase (browser, com RLS): `src/lib/supabase-client.ts`.
- Client Supabase (server, service role): `src/lib/supabase-server.ts`.
- Client Supabase (server, JWT do usuário/RLS): `src/lib/supabase-rls.ts`.

Geolocalização (quando mexer):
- Leitura/queries do mapa (client-side, autenticado): `src/lib/geolocation-utils.ts`
- Tela do mapa: `src/app/geolocalizacao/page.tsx`
- Observação: status UI (`ativo/inativo`) precisa bater com DB (`active/inactive`).

---

## 4) Mapa rápido dos módulos

Leia (quando for mexer no módulo):
- Mapa do projeto: **AI_PROJECT_MAP.md**
- Multi-tenant & segurança: **AI_MULTI_TENANT_SECURITY.md**

Referências por módulo (quando necessário):
- Painel Atendimento v2: `docs/INDICE_DOCUMENTACAO_V2.md`
- Geolocalização: `docs/INDICE_GEOLOCALIZACAO.md`
- Suporte/Tickets: `docs/STATUS_SISTEMA_SUPORTE.md`

Notas rápidas (geolocalização):
- Coordenadas preferenciais: colunas `members.latitude` / `members.longitude` (com fallback em `custom_fields`).

---

## 5) Se algo deu errado

- Loop/login/admin: `docs/SESSION_03_JANEIRO_2026.md`
- RLS recursion em `admin_users`: `docs/ACAO_IMEDIATA_FIX_RLS.md`
- Deploy: `docs/GUIA_DEPLOY_PRODUCAO.md`

---

## 6) Planejamento Asaas (31/03/2026)

- Gerar 12 cobrancas para contrato anual no Asaas.
- Persistir parcelas na tabela `payments` (asaas_payment_id, status, due_date).
- Admin/Pagamentos: listar parcelas e permitir baixa manual (recebimento em maos).
- Webhook Asaas: atualizar automaticamente status de pagamento.

Checklist detalhado para iniciar:
- Definir modelo: 12 cobrancas avulsas x assinatura nativa Asaas.
- Criar cliente server-side do Asaas (lib/asaas.ts).
- Endpoint: criar cobrancas (admin/contrato anual).
- Webhook: validar assinatura e mapear eventos (PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE).
- UI admin/pagamentos: filtros + acao "Baixa manual".
