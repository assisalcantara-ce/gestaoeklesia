# 🗺️ IA - Mapa do Projeto (Essencial)

## Visão em 1 linha
SaaS multi-tenant para gestão de igrejas/ministérios, com Supabase (Auth + Postgres + RLS) e Next.js.

---

## Módulos principais (onde fica o código)

### 1) Admin (core)
- Rotas: `/admin/*`
- Proteção: `src/proxy.ts`
- Autenticação: Supabase Auth + verificação em `admin_users`

### 2) Secretaria / Estrutura hierárquica (multi-tenant)
- Página principal: `src/app/secretaria/congregacoes/page.tsx`
- Tabelas esperadas (pelo uso no código/docs): `ministries`, `ministry_users`, `supervisoes`, `congregacoes`
- Regra: sempre filtrar por `ministry_id`.

### 3) Painel de Atendimento v2
- UI: `src/app/admin/atendimento/page.tsx`
- Widget de trials (aprovação/focus): `src/components/TrialSignupsWidget.tsx`
- APIs (v2): `src/app/api/v1/admin/attendance/*` e `src/app/api/v1/admin/pre-registrations/route.ts`
- Doc: `docs/INDICE_DOCUMENTACAO_V2.md`

### 4) Geolocalização
- Página: `src/app/geolocalizacao/page.tsx`
- Mapa: `src/components/MapaGeolizacao.tsx`
- Serviços: `src/lib/geolocation-utils.ts`
- Doc: `docs/INDICE_GEOLOCALIZACAO.md`

### 5) Suporte / Tickets
- Página: `src/app/suporte/page.tsx`
- API (criar/verificar tabela): `src/app/api/v1/create-tickets-table/route.ts`
- Painel dev migração: `src/components/MigrationPanel.tsx`
- Doc: `docs/STATUS_SISTEMA_SUPORTE.md`

---

## Pastas importantes
- Banco/migrações: `supabase/migrations/`
- Tipos Supabase: `src/types/supabase*.ts`
- Configs: `next.config.js`, `tailwind.config.js`, `tsconfig.json`
