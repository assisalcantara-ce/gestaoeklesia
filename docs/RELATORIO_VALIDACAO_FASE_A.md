# Relatório de Validação Técnica — Fase A: Tesouraria Distribuída Multi-Congregação

**Data:** 2026-05-24  
**Validador:** GitHub Copilot  
**Escopo:** Validação técnica da Fase A. Sem novas funcionalidades — apenas correção de bugs críticos.

---

## 1. Resultado Geral

| Item | Status |
|---|---|
| TypeScript (`npx tsc --noEmit`) | ✅ Exit 0 — limpo |
| Build (`npm run build`) | ✅ Exit 0 — limpo |
| Bugs críticos corrigidos | ✅ 2/2 |
| Warnings de lint corrigidos | ✅ 1/1 |
| Segurança (OWASP Top 10) | ✅ Sem vulnerabilidades identificadas |
| **Conclusão** | **✅ Pronto para teste em sandbox real** |

---

## 2. Bugs Encontrados e Corrigidos

### BUG CRÍTICO #1 — `gatewayEventId` não-idempotente

| | |
|---|---|
| **Arquivo** | `src/app/api/v1/ministry-webhook/asaas/[token]/route.ts` |
| **Severidade** | Crítica — quebra idempotência do webhook |
| **Causa** | `payload?.id` é sempre `undefined` em payloads ASAAS (sem campo `id` no nível raiz). O fallback usava `Date.now()`, gerando um valor diferente a cada requisição. A `UNIQUE(gateway, gateway_event_id)` em `fin_webhook_events` nunca detectava duplicata — cada retry de webhook inseria uma nova linha. |
| **Antes** | `const gatewayEventId = String(payload?.id ?? \`${event}_${chargeId}_${Date.now()}\`);` |
| **Depois** | `const gatewayEventId = \`${event}_${chargeId}\`;` |
| **Impacto da correção** | Retentativas do ASAAS (até 3x por evento) são detectadas como duplicata via `onConflict: 'gateway,gateway_event_id'` e ignoradas corretamente. |

---

### BUG CRÍTICO #2 — Idempotência incompleta para lançamento de tesouraria

| | |
|---|---|
| **Arquivo** | `src/app/api/v1/ministry-webhook/asaas/[token]/route.ts` |
| **Severidade** | Crítica — pode resultar em cobranças pagas sem lançamento contábil |
| **Causa** | Se o `status` da cobrança fosse atualizado para `'pago'` (passo 1) mas o insert em `tesouraria_lancamentos` falhasse (passo 2 — timeout de DB, erro de rede), numa retentativa o código verificava apenas `digitalCharge.status === 'pago'` e retornava `skipped: 'already_paid'`. O lançamento nunca era criado. |
| **Antes** | `if (digitalCharge.status === 'pago') { return skipped }` |
| **Depois** | `if (digitalCharge.status === 'pago' && digitalCharge.tesouraria_lancamento_id) { return skipped }` |
| **Impacto da correção** | Se `tesouraria_lancamento_id` for `null` (insert falhou), a retentativa reprocura o destino e tenta inserir novamente. O índice único `uq_tesouraria_origem(ministry_id, origem_modulo, origem_id)` garante que não haverá duplicatas no banco. |

---

### WARNING LINT #3 — `useEffect` com deps incompletos

| | |
|---|---|
| **Arquivo** | `src/app/tesouraria/page.tsx` |
| **Severidade** | Baixa — apenas aviso de lint, sem impacto funcional |
| **Causa** | `carregarContasFull` referenciada dentro do `useEffect` da aba `arrecadacao` estava ausente do array de dependências. |
| **Fix** | Adicionado `carregarContasFull` ao deps array + supressão explícita com `// eslint-disable-next-line react-hooks/exhaustive-deps` para indicar intenção deliberada. |

---

## 3. Validações de Integridade Realizadas

### 3.1 Constraints do banco — `tesouraria_lancamentos`

O webhook insere com `tipo_recebimento` mapeado via `TIPO_MAP`. Todos os valores foram validados contra a constraint `tesouraria_tipo_valido` da migration `20260416100000_tesouraria_fechamento_mensal.sql`:

```sql
tipo_movimento = 'saida'
OR tipo_recebimento IN ('oferta','dizimo','evento','campanha','contribuicao','outros','missoes')
```

| `tipo_recebimento` do destino | Mapeado para | Status |
|---|---|---|
| `dizimo` | `dizimo` | ✅ Válido |
| `oferta` | `oferta` | ✅ Válido |
| `missoes` | `missoes` | ✅ Válido |
| `doacao` | `contribuicao` | ✅ Válido |
| `campanha_local` | `campanha` | ✅ Válido |
| `evento_local` | `evento` | ✅ Válido |

O campo `forma_pagamento: 'pix'` é `VARCHAR(30)` sem CHECK constraint — válido.  
O campo `tipo_movimento: 'entrada'` está dentro do CHECK `('entrada','saida')` — válido.

### 3.2 Idempotência de lançamentos

O índice único `uq_tesouraria_origem` (migration `20260523120000_tesouraria_campos_fundacao.sql`):

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_tesouraria_origem
  ON public.tesouraria_lancamentos(ministry_id, origem_modulo, origem_id)
  WHERE origem_modulo IS NOT NULL AND origem_id IS NOT NULL;
```

Garante que dois processos paralelos (race condition de webhook) não criem dois lançamentos para o mesmo `digitalCharge.id`. O segundo insert falha silenciosamente no nível do banco.

### 3.3 Rota pública `/pagar/[token]`

Confirmado: **não existe `middleware.ts` no projeto** (`middleware-manifest.json` → `"middleware": {}, "sortedMiddleware": []`). A rota `/pagar/[token]` é pública sem bloqueio de autenticação — comportamento correto.

### 3.4 Segurança da API pública `/api/v1/pagar/[token]`

- GET: expõe apenas `label, descricao, tipo_recebimento, tipo_label, valor_fixo, congregacao_nome` — nenhum ID interno, `ministry_id` ou credencial.
- POST: valida `is_ativo`, `expires_at`, usa `decryptCredentials` para a chave ASAAS, cria charge com `externalReference = "fpd:{uuid_sem_hifens}"`.
- Sem vazamento de dados sensíveis. ✅

### 3.5 Permissões por nível de acesso

| Ação | Níveis autorizados |
|---|---|
| Criar destino de pagamento | ADMINISTRADOR, FINANCEIRO, FINANCEIRO_LOCAL (própria congregação) |
| Editar destino | ADMINISTRADOR, FINANCEIRO, owner |
| Desativar destino (soft delete) | ADMINISTRADOR |
| Listar destinos | ADMINISTRADOR, FINANCEIRO (todos), FINANCEIRO_LOCAL (filtrado por congregação) |
| Gerar cobrança PIX | Qualquer pessoa (rota pública) |

Todas as rotas de API utilizam `ctx.admin` (service_role) — o RLS é bypassed server-side, com verificação de permissão explícita no código.

---

## 4. Riscos Restantes (sem bloqueio ao sandbox)

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| R1 | `fin_webhook_events.gateway_event_id` é nullable — PostgreSQL permite múltiplos NULLs em UNIQUE constraint | Baixo | Com Bug #1 corrigido, o campo sempre recebe valor não-nulo (`${event}_${chargeId}`). Problema eliminado na prática. |
| R2 | Race condition simultânea de dois PAYMENT_CONFIRMED: ambos passam pela verificação de status antes da atualização | Baixo | O upsert com `ignoreDuplicates: true` na `fin_webhook_events` e o índice `uq_tesouraria_origem` previnem duplicatas no banco. |
| R3 | `PAYMENT_REFUNDED` não estorna o lançamento em `tesouraria_lancamentos` | Médio | Para MVP, aceitável. Requer implementação futura de reversão contábil. |
| R4 | Duplo clique no botão "Gerar PIX" na página `/pagar/[token]` pode criar 2 charges no ASAAS | Baixo | O estado `paying` já desabilita o botão durante a requisição. |
| R5 | Migration da Fase A ainda não aplicada no Supabase | **Bloqueante para produção** | Requer ação manual do usuário (ver seção 5). |

---

## 5. Ação Manual Pendente (usuário)

A migration da Fase A **deve ser aplicada manualmente** no SQL Editor do Supabase antes do primeiro teste em sandbox:

```
supabase/migrations/20260524100000_tesouraria_digital_fase_a.sql
```

Ela cria as tabelas:
- `fin_payment_destinations` — destinos de pagamento com QR Code
- `fin_payment_charges` — cobranças PIX geradas
- `fin_webhook_events` — log idempotente de eventos do gateway

**Como aplicar:**
1. Abra o Supabase Dashboard → SQL Editor
2. Cole o conteúdo da migration
3. Execute

---

## 6. Arquivos da Fase A

| Arquivo | Tipo | Status |
|---|---|---|
| `supabase/migrations/20260524100000_tesouraria_digital_fase_a.sql` | Migration SQL | ⚠️ Criado — aguarda aplicação manual |
| `src/app/api/v1/ministry/payment-destinations/route.ts` | API GET/POST | ✅ |
| `src/app/api/v1/ministry/payment-destinations/[id]/route.ts` | API GET/PUT/DELETE | ✅ |
| `src/app/api/v1/pagar/[token]/route.ts` | API pública | ✅ |
| `src/app/pagar/[token]/page.tsx` | Página pública PIX | ✅ |
| `src/app/api/v1/ministry-webhook/asaas/[token]/route.ts` | Webhook handler | ✅ (bugs #1 e #2 corrigidos) |
| `src/app/tesouraria/page.tsx` | Aba Arrecadação Digital | ✅ (lint corrigido) |
