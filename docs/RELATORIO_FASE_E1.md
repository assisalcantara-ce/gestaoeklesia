# Relatório Final — FASE E Entrega 1
**App Mobile/PWA — Fundação (Auth + Perfil + Carteirinha)**

Data: 2026-05-26  
Status: ✅ ENTREGUE — Build OK, tsc OK, 0 erros

---

## 1. Arquivos Criados / Alterados

### Migration de Banco
| Arquivo | Ação | Descrição |
|---|---|---|
| `supabase/migrations/20260526000000_members_mobile_auth.sql` | CRIADO | FK `members.auth_user_id → auth.users(id)`, índice parcial, RLS `members_self_read`, `members_self_update` |

### Backend / APIs
| Arquivo | Ação | Descrição |
|---|---|---|
| `src/lib/mobile-member-auth.ts` | CRIADO | Helper: `resolveMobileMember()`, `mobileMemberErrorResponse()`, `maskCpf()` |
| `src/app/api/v1/mobile/auth/link-member/route.ts` | CRIADO | POST: vincula auth.uid() ao membro via CPF + data_nascimento |
| `src/app/api/v1/mobile/member/me/route.ts` | CRIADO | GET: dados do membro; PUT: atualiza whitelist de 12 campos |
| `src/app/api/v1/mobile/member/carteirinha/route.ts` | CRIADO | GET: dados da carteirinha + QR payload base64 |

### Frontend — Providers e Componentes
| Arquivo | Ação | Descrição |
|---|---|---|
| `src/providers/MobileMemberProvider.tsx` | CRIADO | Context React com MemberData, routing guard, refresh() |
| `src/components/mobile/MobileShell.tsx` | CRIADO | Wrapper client-side que fornece MobileMemberProvider |
| `src/components/mobile/MobileHeader.tsx` | CRIADO | Header fixo mobile: bg-dark-blue, título, botão voltar opcional |
| `src/components/mobile/MobileBottomNav.tsx` | CRIADO | Bottom nav: Início/Perfil/Carteirinha (ativos) + Contribuir/Eventos (em breve) |

### Frontend — Layout e Páginas
| Arquivo | Ação | Descrição |
|---|---|---|
| `src/app/app/layout.tsx` | CRIADO | Layout server component: metadata + MobileShell |
| `src/app/app/page.tsx` | CRIADO | Root `/app`: loading spinner, provider faz redirect |
| `src/app/app/login/page.tsx` | CRIADO | Magic link (OTP) com tela de confirmação |
| `src/app/app/vincular/page.tsx` | CRIADO | Formulário CPF + data_nascimento → POST link-member |
| `src/app/app/inicio/page.tsx` | CRIADO | Saudação, status badge, atalhos, logo ministério |
| `src/app/app/perfil/page.tsx` | CRIADO | View mode + edit mode, PUT /me, refresh automático |
| `src/app/app/carteirinha/page.tsx` | CRIADO | Card carteirinha + QRCodeSVG + dados + atualizar |

**Total: 15 arquivos criados, 0 alterados**

---

## 2. APIs Mobile — Referência

### POST `/api/v1/mobile/auth/link-member`
**Auth:** Bearer token (JWT do membro)  
**Body:** `{ cpf: string, data_nascimento: string }`  
**Resposta 200:** `{ success: true, member_id, name, ministry_id }`  
**Erros:** `MEMBER_NOT_FOUND` (404), `ALREADY_LINKED` (409), `ALREADY_LINKED_OTHER` (409)

### GET `/api/v1/mobile/member/me`
**Auth:** Bearer token  
**Resposta 200:** MemberData completo com CPF mascarado + join congregação + ministério

### PUT `/api/v1/mobile/member/me`
**Auth:** Bearer token  
**Body:** Subset de: `email, phone, celular, whatsapp, foto_url, cep, logradouro, numero, bairro, complemento, cidade, estado`  
**Segurança:** Campos fora da whitelist são ignorados silenciosamente; email normalizado para lowercase

### GET `/api/v1/mobile/member/carteirinha`
**Auth:** Bearer token  
**Resposta 200:** Dados completos da carteirinha + `qr_payload` (base64 JSON: `{mid, uid, min, ts}`)

---

## 3. Fluxo de Autenticação

```
1. /app/login        → signInWithOtp(email, emailRedirectTo: /app)
2. Email enviado     → usuário clica no link mágico
3. /app              → Supabase processa PKCE callback → sessão criada
4. MobileMemberProvider → detecta user, chama GET /api/v1/mobile/member/me
5a. 200 OK (vinculado)  → isLinked=true → redirect /app/inicio
5b. 403 MEMBER_NOT_LINKED → isLinked=false → redirect /app/vincular
6. /app/vincular     → POST link-member → refresh() → redirect /app/inicio
```

---

## 4. Segurança

| Aspecto | Implementação |
|---|---|
| Auth verificada em toda API | `resolveMobileMember()` via `createServerClientFromRequest()` |
| Acesso ao membro | `service_role` com filtro `auth_user_id = userId` — não expõe outros membros |
| CPF mascarado | `***.*56.789-**` — nunca retorna CPF completo via API mobile |
| Campos editáveis | Whitelist explícita no PUT — `cpf`, `status`, `ministry_id` nunca aceitos |
| Vinculação segura | `member_id` nunca aceito no body; vinculação verificada por CPF + data_nascimento |
| RLS self-read/update | Políticas PERMISSIVE adicionadas — não quebram acesso admin existente |
| Logs de erro | Nunca logam CPF ou dados pessoais, apenas códigos de erro |

---

## 5. Rotas do App Mobile

| Rota | Arquivo | Acesso |
|---|---|---|
| `/app` | `src/app/app/page.tsx` | Redirect via provider |
| `/app/login` | `src/app/app/login/page.tsx` | Público |
| `/app/vincular` | `src/app/app/vincular/page.tsx` | Auth, não vinculado |
| `/app/inicio` | `src/app/app/inicio/page.tsx` | Auth + vinculado |
| `/app/perfil` | `src/app/app/perfil/page.tsx` | Auth + vinculado |
| `/app/carteirinha` | `src/app/app/carteirinha/page.tsx` | Auth + vinculado |

---

## 6. Pendências para Próximas Fases

| Item | Fase |
|---|---|
| Aplicar migration no Supabase (CLI ou dashboard) | E.1 pós-deploy |
| Testes com member real no ambiente de produção | E.1 pós-deploy |
| Contribuições (Pix/cartão via Asaas) | E.2 |
| Eventos — inscrição mobile | E.2 |
| Push notifications (FCM/OneSignal) | E.3 |
| Modo offline / PWA manifest | E.3 |

---

## 7. Riscos Identificados

| Risco | Severidade | Mitigação |
|---|---|---|
| Magic link vai para spam | Médio | Configurar domínio no Supabase Auth; instruir membros |
| `auth_user_id` sem FK antes da migration | Baixo | Migration idempotente com `IF NOT EXISTS` |
| Membros com CPF em formatos diferentes | Baixo | Busca aceita CPF com ou sem máscara |
| `data_validade_credencial` nula em muitos membros | Baixo | UI exibe "—" graciosamente |
| Token expirado na carteirinha | Baixo | Supabase auto-refresh via `createClient()` browser |

---

## 8. Progresso FASE E

| Entrega | Status | % |
|---|---|---|
| E.0 — Auditoria Arquitetural | ✅ Completo | 100% |
| E.1 — Fundação App Mobile | ✅ Completo | 100% |
| E.2 — Módulo Financeiro Mobile | ⏳ Pendente | 0% |
| E.3 — PWA + Notificações | ⏳ Pendente | 0% |

**FASE E total: ~50% (2/4 entregas concluídas)**

---

## 9. Validação do Build

```
✓ Compiled successfully in 29.2s
✓ Finished TypeScript in 42s
✓ Collecting page data (48/48)
✓ Generating static pages (48/48)
✓ Finalizing page optimization

Rotas mobile geradas:
  ƒ /app
  ƒ /app/carteirinha
  ƒ /app/inicio
  ƒ /app/login
  ƒ /app/perfil
  ƒ /app/vincular
  ƒ /api/v1/mobile/auth/link-member
  ƒ /api/v1/mobile/member/carteirinha
  ƒ /api/v1/mobile/member/me
```
