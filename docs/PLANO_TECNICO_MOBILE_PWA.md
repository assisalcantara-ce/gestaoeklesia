# AUDITORIA E PLANO TÉCNICO — MÓDULO MOBILE / PWA GESTÃO EKLÉSIA

> **Data:** 25/05/2026 | **Sistema:** GestãoEklesia Next.js 16 + Supabase | **Status:** Planejamento — sem implementação

---

## 1. ARQUITETURA ATUAL DO PROJETO NEXT.JS

### 1.1 Stack Tecnológica

| Camada | Tecnologia | Observações |
|---|---|---|
| Framework | Next.js 16.1 (App Router) | `export const dynamic = 'force-dynamic'` em todas as pages/routes |
| Auth | Supabase Auth + `@supabase/ssr` | Sessão JWT via cookies HTTP-only |
| Banco | Supabase (PostgreSQL + RLS) | Row Level Security em todas as tabelas |
| UI | React 19 + Tailwind CSS v4 | Sem design system mobile dedicado |
| Estado | Context API (Auth, Usuario, AppDialog) | Sem Redux/Zustand |
| QR Code | `qrcode`, `qrcode.react` | Já disponível para carteirinha |
| PDF | `jspdf` + `html2canvas` | Já disponível para certificados |
| Gráficos | `recharts` | Já disponível para dashboards |

### 1.2 Estrutura de Providers (Hierarquia)

```
RootLayout
  └── AuthProvider          ← sessão Supabase (onAuthStateChange)
        └── UsuarioProvider ← ministry_users: nivel, congregacaoId, ministryId
              └── AppDialogProvider ← modais globais
                    └── TrialGuard  ← bloqueia se trial expirado
                          └── {page}
```

> **Problema crítico para mobile:** `UsuarioProvider` resolve `ministry_users`, que são os usuários *administrativos* da plataforma. Membros da igreja **não têm** vínculo com `auth.users`. Não há coluna `auth_user_id` na tabela `members`.

### 1.3 Sistema de Autenticação Atual

```typescript
// Clientes Supabase existentes:
supabase-client.ts  → ANON_KEY (browser, RLS aplicada)
supabase-server.ts  → SERVICE_ROLE (server-side, RLS ignorada)
supabase-rls.ts     → JWT do usuário (RLS segura)

// Auth flow atual:
/login → Supabase Auth (email+senha) → ministry_users → NivelAcesso → Módulos permitidos
```

### 1.4 Sistema de Permissões (RBAC)

| Nível | Módulos principais |
|---|---|
| `administrador` | Tudo |
| `financeiro` | financeiro, tesouraria, presidencia, consolidado, conselho_fiscal |
| `supervisor` | secretaria, comissao |
| `admin_local` | dashboard, secretaria_local, configuracoes |
| `financeiro_local` | financeiro, tesouraria |
| `presidencia` | dashboard, presidencia, consolidado_financeiro, conselho_fiscal |
| `conselho_fiscal` | presidencia, consolidado_financeiro, conselho_fiscal |
| `operador` | secretaria, secretaria_local |

> **Gap:** não existe nível `membro` — o app mobile exige um novo nível de acesso ortogonal ao sistema atual.

### 1.5 PWA / Mobile — Estado Atual

| Critério | Status | Observações |
|---|---|---|
| `manifest.json` | ❌ Não existe | Necessário para PWA |
| Service Worker | ❌ Não existe | Necessário para offline e push |
| `next-pwa` | ❌ Não instalado | Biblioteca a adicionar |
| Viewport meta | ❌ Não declarado | `<meta name="viewport">` ausente no `<head>` do `layout.tsx` |
| Tailwind mobile classes | ⚠️ Parcial | Usa `sm:`, `md:` mas layout não é mobile-first |
| Sidebar | ❌ Desktop-only | `Sidebar.tsx` sem comportamento responsive adequado |
| Touch targets | ❌ Não otimizado | Botões < 44px em várias telas |

### 1.6 Layout Hierárquico Atual

O layout atual pressupõe sidebar desktop fixa de ~240px — **incompatível com mobile sem refatoração**. A solução é criar um prefixo `/app/*` com layout completamente separado.

---

## 2. ANÁLISE DE REUSO DE MÓDULOS EXISTENTES

| Módulo | Tabela(s) | API existente | Reutilizável no mobile? |
|---|---|---|---|
| Membros | `members` | `GET /api/v1/members/[id]` | ✅ Sim, com novo guard de membro |
| Pré-cadastro | `pre_registrations` | `POST /api/v1/signup` | ✅ Adaptável ao fluxo de membro |
| Tesouraria/Arrecadação | `fin_payment_destinations`, `fin_payment_charges` | `POST /api/v1/payments` | ✅ Sim |
| Eventos | `eventos`, `eventos_inscricoes`, `eventos_pagamentos` | `GET /api/v1/eventos/publico/[slug]` | ✅ Parcialmente público |
| Certificados | `certificados_templates` | Sem API REST ainda | ⚠️ Necessita nova API |
| Dashboard presidência | `tesouraria_fechamentos`, `tesouraria_lancamentos` | Via client-side direto | ⚠️ Necessita nova API |
| Conselho fiscal | `tesouraria_fechamentos.status_conselho_fiscal` | Sem API REST | ⚠️ Necessita nova API |
| Carteirinha | `members` (foto_url, cargo, matricula) | Sem endpoint dedicado | ⚠️ Necessita nova API |
| Comunicados | Não existe | — | ❌ Necessita nova tabela |
| Solicitações | Flows (`flow_instances`) | `GET /api/flows/instances` | ⚠️ Adaptável |

---

## 3. LACUNA CRÍTICA — VÍNCULO MEMBRO ↔ AUTH.USERS

**Este é o problema arquitetural mais importante de toda a análise.**

A tabela `members` **não possui** `auth_user_id`. Os membros são registros administrativos — não têm conta de acesso ao sistema. Para que um membro possa fazer login no app, é necessário:

```sql
-- Migration necessária (Fase 1)
ALTER TABLE public.members
  ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_members_auth_user_id
  ON public.members(auth_user_id)
  WHERE auth_user_id IS NOT NULL;
```

**Dois fluxos de auth para o membro:**
1. **Magic Link via e-mail** — mais simples, Supabase nativo
2. **CPF + data de nascimento → OTP** — mais acessível para membros sem e-mail ativo

---

## 4. ROTAS MOBILE SUGERIDAS

```
src/app/app/                       ← prefixo isolado para a PWA mobile
├── layout.tsx                     ← layout mobile (sem sidebar desktop, bottom-nav)
├── page.tsx                       ← redirect → /app/login ou /app/inicio
├── login/page.tsx                 ← login membro (magic link ou CPF+nascimento)
├── cadastro/page.tsx              ← auto-cadastro + pré-cadastro integrado
├── inicio/page.tsx                ← home do membro (comunicados, atalhos)
├── perfil/page.tsx                ← ver + atualizar dados cadastrais
├── carteirinha/page.tsx           ← cartão digital com QR Code e foto
├── contribuir/
│   ├── page.tsx                   ← listar destinos de arrecadação disponíveis
│   └── [destinoId]/
│       ├── page.tsx               ← escolher valor
│       └── pix/page.tsx           ← QR Code PIX + status polling
├── eventos/
│   ├── page.tsx                   ← lista de eventos ativos/futuros
│   └── [slug]/
│       ├── page.tsx               ← detalhe do evento
│       └── inscricao/page.tsx     ← formulário + pagamento
├── certificados/page.tsx          ← meus certificados emitidos
├── solicitacoes/page.tsx          ← flows abertos pelo membro
├── comunicados/page.tsx           ← avisos e comunicados da congregação
└── presidencia/                   ← auth via ministry_users existente
    ├── layout.tsx
    ├── page.tsx                   ← dashboard executivo mobile
    ├── membros/page.tsx           ← total de membros por congregação
    ├── financeiro/page.tsx        ← entradas/saídas/saldo consolidado
    ├── congregacoes/page.tsx      ← ranking e arrecadação por congregação
    ├── alertas/page.tsx           ← fechamentos pendentes + alertas
    └── conselho-fiscal/page.tsx   ← pareceres pendentes
```

### 4.1 Layout Mobile

O `src/app/app/layout.tsx` será completamente separado do painel administrativo:
- **Sem** `Sidebar.tsx` desktop
- **Com** `MobileBottomNav` (5 ícones: Início, Contribuir, Eventos, Carteirinha, Perfil)
- **Com** `MobileHeader` (título da tela + menu hamburger)
- Viewport: `100dvh`, `env(safe-area-inset-bottom)` para iOS notch

---

## 5. PERFIS DE ACESSO (Mobile)

| Perfil | Auth via | Dados acessíveis | Ações |
|---|---|---|---|
| `membro` | `auth_user_id` em `members` | Próprio cadastro, carteirinha, eventos, contribuições, certificados | Atualizar perfil, gerar PIX, inscrever em evento |
| `pastor_local` | `ministry_users` (admin_local/operador) | Membros da sua congregação, eventos locais | Aprovar solicitações |
| `financeiro_local` | `ministry_users` (financeiro_local) | Lançamentos locais, arrecadação | Consultar extratos |
| `presidencia` | `ministry_users` (presidencia) | Consolidado total, ranking, alertas | Consultar, aprovar pareceres |
| `conselho_fiscal` | `ministry_users` (conselho_fiscal) | Fechamentos, prestações | Emitir pareceres |

---

## 6. DADOS NECESSÁRIOS POR TELA

### App do Membro

| Tela | Tabelas | Campos principais |
|---|---|---|
| **Login** | `auth.users`, `members` | email, cpf, data_nascimento, auth_user_id |
| **Cadastro/Pré-cadastro** | `pre_registrations` ou `members` | name, email, phone, congregacao_id, ministry_id |
| **Perfil** | `members` | name, foto_url, email, phone, celular, cpf, endereço, cargo_ministerial |
| **Carteirinha** | `members`, `congregacoes`, `ministries` | name, matricula, foto_url, cargo_ministerial, data_batismo_aguas, congregação, logo |
| **Contribuir** | `fin_payment_destinations`, `fin_payment_charges`, `ministry_payment_gateways` | label, tipo_recebimento, QR Code PIX |
| **Eventos** | `eventos`, `eventos_inscricoes`, `eventos_pagamentos` | titulo, data_inicio, local_nome, valor_inscricao, aceita_inscricao, status |
| **Certificados** | `certificados_templates` + nova `member_certificados` | template_key, preview_url, data_emissao, member_id |
| **Solicitações** | `flow_instances`, `flow_templates` | tipo, status, data_criacao |
| **Comunicados** | Nova tabela `comunicados` | titulo, conteudo, congregacao_id, publicado_em |

### App da Presidência (mobile)

| Tela | Tabelas | Campos |
|---|---|---|
| **Dashboard** | `members`, `tesouraria_lancamentos`, `tesouraria_fechamentos` | count membros, total entradas/saídas mês atual |
| **Total Membros** | `members` GROUP BY `congregacao_id` | count por status e congregação |
| **Financeiro** | `tesouraria_lancamentos`, `tesouraria_fechamentos` | saldo_final, total_entradas, total_saidas, mes_referencia |
| **Congregações** | `congregacoes`, `tesouraria_lancamentos` | nome, total arrecadado, ranking |
| **Alertas** | `tesouraria_fechamentos` WHERE `status='aberto'` | fechamentos pendentes, mais de X dias |
| **Conselho Fiscal** | `tesouraria_fechamentos` WHERE `status_conselho_fiscal IN ('pendente','em_analise')` | observações, datas, status |

---

## 7. AVALIAÇÃO — PWA NO NEXT.JS vs REACT NATIVE

### Opção A — PWA no Next.js atual ✅ Recomendada

**Vantagens:**
- Zero duplicação de backend (mesmo Supabase, mesmo RBAC, mesmas APIs)
- Sem novo repositório, sem novo deploy, sem CI/CD adicional
- `next-pwa` — setup em ~1 dia
- QR Code e PDF já disponíveis (`qrcode.react`, `jspdf`)
- Rotas `/app/*` isoladas — sem risco de quebrar o painel admin
- Funciona em iOS Safari e Android Chrome com "Adicionar à Tela Inicial"
- Supabase Auth nativo (magic link, OTP)
- Custo zero de infraestrutura adicional

**Desvantagens:**
- Sem acesso a câmera nativa (apenas `<input type="file" capture>`)
- Push notifications em iOS parcialmente suportadas (iOS 16.4+)
- Sem biometria nativa (Face ID/Touch ID)
- Performance inferior a app nativo para animações pesadas

### Opção B — React Native / Expo

**Vantagens:**
- App nativo na App Store e Google Play
- Push notifications completas (FCM + APNs)
- Biometria, câmera, storage local nativo
- Performance superior

**Desvantagens:**
- Novo repositório, nova build pipeline
- Duplicação de lógica de auth, permissões e API calls
- Custo Apple ($99/ano) + Google ($25 único)
- Prazo de revisão App Store (1–7 dias)
- Manutenção separada de duas codebases

### ✅ Decisão Recomendada — Híbrido Progressivo

```
Fases 1–4  →  PWA no Next.js atual (velocidade + reuso total)
Fase 5+    →  React Native/Expo SE necessário
```

**Triggers para React Native:**
- > 30% da base em iOS < 16.4 (sem Web Push nativo)
- Biometria obrigatória por política de segurança
- Feedback de UX indicando PWA insatisfatório

---

## 8. MVP MOBILE EM FASES

### Fase 1 — PWA Membro Básico
**Objetivo:** Membro consegue logar e ver seus dados.

```
Duração estimada: 2–3 semanas
Rotas: /app/login, /app/inicio, /app/perfil, /app/carteirinha
```

Entregas técnicas:
- Migration: `members.auth_user_id` + RLS de membro
- Layout mobile (`/app/layout.tsx`) com bottom navigation
- `next-pwa` + `manifest.json` + viewport meta
- Fluxo de auth: Magic Link → vincula `auth_user_id` ao membro
- Nova API: `GET /api/v1/app/me` — dados do membro autenticado
- Nova API: `PUT /api/v1/app/me` — atualizar dados pessoais
- Nova API: `GET /api/v1/app/me/carteirinha` — carteirinha completa
- Carteirinha digital com QR Code (`qrcode.react`)

### Fase 2 — Dízimos/Ofertas + Eventos
**Objetivo:** Membro consegue contribuir e se inscrever em eventos.

```
Duração estimada: 2–3 semanas
Rotas: /app/contribuir, /app/eventos, /app/eventos/[slug]
```

Entregas técnicas:
- Reutilizar gateway EFI/ASAAS existente
- Nova API: `GET /api/v1/app/contribuir/destinos`
- Nova API: `POST /api/v1/app/contribuir/pix` — cria charge, retorna QR Code
- Nova API: `GET /api/v1/app/contribuir/pix/[txid]/status` — polling
- Reutilizar `GET /api/v1/eventos/publico/[slug]`
- Nova API: `POST /api/v1/app/eventos/[slug]/inscricao`
- RLS: `fin_payment_charges` — membro vê apenas as próprias cobranças

### Fase 3 — Certificados, Comunicados e Solicitações
**Objetivo:** Membro acessa documentos digitais.

```
Duração estimada: 2 semanas
Rotas: /app/certificados, /app/solicitacoes, /app/comunicados
```

Entregas técnicas:
- Nova tabela: `member_certificados`
- Nova API: `GET /api/v1/app/me/certificados`
- Nova API: `GET /api/v1/app/me/certificados/[id]/pdf` — gerar PDF on-demand
- Nova tabela: `comunicados`
- Nova API: `GET /api/v1/app/comunicados`
- Reutilizar `flow_instances` para solicitações

### Fase 4 — Dashboard Presidência Mobile
**Objetivo:** Presidência acessa KPIs no celular.

```
Duração estimada: 1–2 semanas
Rotas: /app/presidencia/* (auth via ministry_users existente)
```

Entregas técnicas:
- Nova API: `GET /api/v1/app/presidencia/dashboard`
- Nova API: `GET /api/v1/app/presidencia/membros`
- Nova API: `GET /api/v1/app/presidencia/financeiro`
- Nova API: `GET /api/v1/app/presidencia/alertas`
- Guard: `nivel IN ('presidencia', 'conselho_fiscal', 'financeiro', 'administrador')`

### Fase 5 — Push Notifications
**Objetivo:** Notificações proativas para membros e liderança.

```
Duração estimada: 1–2 semanas
```

Entregas técnicas:
- `next-pwa` com Web Push API (VAPID keys)
- Nova tabela: `member_push_tokens`
- Nova API: `POST /api/v1/app/push/subscribe`
- Trigger Supabase/cron: notificar membro ao PIX confirmar, evento próximo, novo comunicado
- Fallback: Android Chrome funciona plenamente; iOS 16.4+ com manifest + HTTPS

### Fase 6 — App Nativo Expo (condicional)
**Avaliação:** Iniciar apenas se triggers acionados (ver seção 7).

---

## 9. RISCOS

| Risco | Impacto | Probabilidade | Mitigação |
|---|---|---|---|
| **Membro sem e-mail cadastrado** | Alto | Alta | Suporte a CPF + data nascimento como login alternativo (OTP via SMS/WhatsApp) |
| **Dados financeiros expostos (RLS insuficiente)** | Crítico | Média | RLS nova: membro vê SOMENTE suas cobranças (`auth_user_id`) |
| **Exposição de dados de outros membros** | Crítico | Média | APIs `/app/*` filtram sempre por `auth_user_id` — nunca aceitam `member_id` do request body |
| **LGPD — dados sensíveis** | Alto | Alta | Tela de perfil com exclusão de conta; política de privacidade no cadastro; audit log de acessos do membro |
| **Performance mobile** | Médio | Média | Lazy loading, image otimização Next.js, bundle splitting por rota `/app/*` |
| **Offline** | Médio | Baixa | Service worker cacheia carteirinha e último estado — apenas leitura offline |
| **Push iOS < 16.4** | Médio | Média | Fase 5 avalia; fallback: Expo se % iOS < 16.4 > 30% da base |
| **Login simplificado inseguro** | Alto | Média | CPF+nascimento não é autenticação forte — complementar com OTP obrigatório |
| **Trial expirado** | Baixo | Baixa | `TrialGuard` atual já bloqueia; verificar trial também na API `/app/me` |
| **Membro com dados incompletos** | Alto | Alta | Fluxo de auto-vinculação: membro fornece CPF/e-mail → admin confirma |
| **Dois perfis no mesmo e-mail** | Médio | Baixa | `UNIQUE INDEX` em `members.auth_user_id` + validação no cadastro |

---

## 10. MIGRATIONS NECESSÁRIAS

```sql
-- ============================================================
-- M1 — Fase 1 (OBRIGATÓRIA — bloqueante para auth de membro)
-- ============================================================
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_auth_user_id
  ON public.members(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- RLS: membro lê e edita somente seus próprios dados
CREATE POLICY "members_self_read"
  ON public.members FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "members_self_update"
  ON public.members FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- ============================================================
-- M2 — Fase 3 (comunicados)
-- ============================================================
CREATE TABLE public.comunicados (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id    UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  titulo         VARCHAR(255) NOT NULL,
  conteudo       TEXT NOT NULL,
  autor_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  publicado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_em      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.comunicados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comunicados_member_read"
  ON public.comunicados FOR SELECT
  TO authenticated
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.members WHERE auth_user_id = auth.uid()
    )
    AND (
      congregacao_id IS NULL
      OR congregacao_id IN (
        SELECT congregacao_id FROM public.members WHERE auth_user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- M3 — Fase 3 (certificados emitidos por membro)
-- ============================================================
CREATE TABLE public.member_certificados (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id  UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  member_id    UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  template_key VARCHAR(255) NOT NULL,
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  url_pdf      TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.member_certificados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_certificados_self_read"
  ON public.member_certificados FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM public.members WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- M4 — Fase 5 (push tokens)
-- ============================================================
CREATE TABLE public.member_push_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, endpoint)
);
ALTER TABLE public.member_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_tokens_self_all"
  ON public.member_push_tokens FOR ALL
  USING (
    member_id IN (
      SELECT id FROM public.members WHERE auth_user_id = auth.uid()
    )
  );
```

---

## 11. NOVAS API ROUTES NECESSÁRIAS

```
# Auth de membro
POST /api/v1/app/auth/link-member         → vincula auth.uid() a um member via CPF+nascimento

# Perfil
GET  /api/v1/app/me                        → dados do membro autenticado
PUT  /api/v1/app/me                        → atualizar perfil (campos permitidos)
GET  /api/v1/app/me/carteirinha            → dados carteirinha (nome, foto, cargo, QR)

# Certificados
GET  /api/v1/app/me/certificados           → lista de certificados do membro
GET  /api/v1/app/me/certificados/[id]/pdf  → gerar PDF on-demand

# Arrecadação Digital
GET  /api/v1/app/contribuir/destinos       → destinos disponíveis do ministério
POST /api/v1/app/contribuir/pix            → gerar cobrança PIX para membro
GET  /api/v1/app/contribuir/pix/[txid]     → polling de status do PIX

# Eventos
GET  /api/v1/app/eventos                   → eventos ativos do ministério/congregação
POST /api/v1/app/eventos/[slug]/inscricao  → inscrever membro com pagamento

# Comunicados
GET  /api/v1/app/comunicados               → comunicados da congregação do membro

# Solicitações
GET  /api/v1/app/solicitacoes              → flows abertos pelo membro

# Push Notifications (Fase 5)
POST   /api/v1/app/push/subscribe          → registrar push token
DELETE /api/v1/app/push/unsubscribe        → remover push token

# Dashboard Presidência (auth: ministry_users)
GET  /api/v1/app/presidencia/dashboard     → KPIs executivos consolidados
GET  /api/v1/app/presidencia/membros       → total por congregação
GET  /api/v1/app/presidencia/financeiro    → consolidado financeiro simplificado
GET  /api/v1/app/presidencia/alertas       → fechamentos pendentes
```

---

## 12. DEPENDÊNCIAS A ADICIONAR

| Pacote | Versão | Uso | Fase |
|---|---|---|---|
| `@ducanh2912/next-pwa` | latest | Service worker + manifest + offline cache | 1 |
| `web-push` | latest | VAPID keys, envio de push notifications | 5 |
| `@types/web-push` | latest | TypeScript para web-push | 5 |

> `qrcode.react`, `jspdf` e `html2canvas` já estão instalados — sem novos pacotes para carteirinha e certificados.

---

## 13. ARQUITETURA RECOMENDADA — VISÃO GERAL

```
┌─────────────────────────────────────────────────────────────────┐
│                   GESTÃO EKLESIA — MONOREPO                     │
│                      (Next.js 16, App Router)                   │
│                                                                 │
│  /dashboard, /secretaria, /financeiro, ...                      │
│  └── Painel Administrativo (ministry_users auth)                │
│                                                                 │
│  /app/*  ←  PWA Mobile (prefixo isolado)                       │
│  ├── /app/layout.tsx  ← MobileLayout (bottom nav, sem sidebar)  │
│  ├── Auth: magic link e-mail OU CPF + nascimento + OTP          │
│  ├── Perfil membro: members.auth_user_id = auth.uid()           │
│  ├── RLS: políticas de membro adicionadas às existentes         │
│  └── APIs: /api/v1/app/* (guard: membro OU ministry_user)       │
│                                                                 │
│  manifest.json + service-worker.js  ←  next-pwa (Fase 1)       │
│  VAPID keys + member_push_tokens    ←  Web Push  (Fase 5)       │
└─────────────────────────────────────────────────────────────────┘
                │                              │
          Supabase Auth                  Supabase DB
          (auth.users)                   (RLS por ministry_id
                                          + auth_user_id para membros)
```

---

## 14. ESTIMATIVA DE ESFORÇO

| Fase | Escopo | Estimativa |
|---|---|---|
| **Fase 1** | Auth membro, perfil, carteirinha, PWA base | 2–3 semanas |
| **Fase 2** | Contribuições PIX + eventos | 2–3 semanas |
| **Fase 3** | Certificados, comunicados, solicitações | 2 semanas |
| **Fase 4** | Dashboard presidência mobile | 1–2 semanas |
| **Fase 5** | Push notifications | 1–2 semanas |
| **Fase 6** | React Native/Expo (condicional) | 4–8 semanas |

**Total MVP funcional (Fases 1–4):** 7–10 semanas

---

## 15. ORDEM DE IMPLEMENTAÇÃO RECOMENDADA

```
Etapa  1 — Migration M1: members.auth_user_id + RLS membro        ← bloqueante para tudo
Etapa  2 — next-pwa + manifest.json + viewport meta               ← PWA base
Etapa  3 — /app/layout.tsx (MobileLayout + bottom nav)            ← layout isolado
Etapa  4 — /app/login (magic link + fluxo CPF+nascimento+OTP)     ← auth membro
Etapa  5 — /api/v1/app/me + /app/perfil                           ← self-service
Etapa  6 — /app/carteirinha + API carteirinha com QR Code         ← mais demandado
Etapa  7 — /app/contribuir + reutilizar gateway EFI/ASAAS         ← geração de receita
Etapa  8 — /app/eventos + inscrições + pagamento                  ← alta visibilidade
Etapa  9 — Migration M2 (comunicados) + API + tela                ← engajamento
Etapa 10 — Migration M3 (member_certificados) + API + tela        ← valor percebido
Etapa 11 — /app/presidencia/* + APIs consolidadas                 ← liderança
Etapa 12 — Migration M4 (push tokens) + Web Push (Fase 5)         ← retenção
```
