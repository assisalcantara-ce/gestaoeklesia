# Auditoria Técnica — Fase 4: Eventos Pagos ASAAS

> Gerado em: 23/05/2026  
> Objetivo: projetar a Fase 4 com mínimo retrabalho futuro antes de qualquer implementação.

---

## 1. Estado atual dos módulos auditados

### 1.1 Módulo Eventos (`20260522200000_eventos_module.sql`)

| Coluna | Situação para Fase 4 |
|---|---|
| `valor_inscricao NUMERIC(12,2) DEFAULT 0` | ✅ Já existe — `0 = gratuito`, `> 0 = pago` |
| `aceita_inscricao BOOLEAN` | ✅ Já existe |
| `is_publico BOOLEAN` | ✅ Já existe |
| `capacidade INTEGER` | ✅ Já existe |

**Conclusão:** A tabela `eventos` não precisa de nenhuma coluna nova para Fase 4A.

---

### 1.2 Módulo Inscrições (`20260522210000_eventos_inscricoes.sql`)

**Status atual:**

```sql
status IN ('confirmado', 'cancelado', 'lista_espera')
```

**Gap:** Os estados `aguardando_pagamento` e `expirado` são **ausentes**. São obrigatórios para o fluxo de pagamento pendente e para liberar vagas de cobranças vencidas.

**UNIQUE constraints atuais:**
- `UNIQUE (evento_id, member_id)` — para membros
- `UNIQUE INDEX (evento_id, email_externo) WHERE email_externo IS NOT NULL` — para externos (adicionado na Fase 3)

Ambas funcionam para bloquear duplicidade durante pagamento pendente, **desde que** o status `aguardando_pagamento` seja tratado como "vaga ocupada" (não apenas `confirmado`).

---

### 1.3 Gateway (`20260523130000_ministry_payment_gateways.sql`)

**Estrutura já existente — altamente aproveitável:**

| Campo | Uso na Fase 4 |
|---|---|
| `gateway VARCHAR(30)` com `CHECK IN ('asaas','efi')` | Expandir para `mercadopago`, `stripe` na Fase 4C |
| `encrypted_credentials TEXT` (AES-256-GCM) | ✅ Pronto — decodificar na API |
| `webhook_token UUID` (por registro) | ✅ Pronto — base da URL multi-tenant |
| `webhook_url_hint TEXT` | ✅ Pronto |
| `environment VARCHAR(12)` | ✅ sandbox/production |

**Gap crítico:** O webhook atual em `/api/v1/asaas/webhook/route.ts` usa **um único token global** (`ASAAS_WEBHOOK_TOKEN` em `.env`). Ele serve para cobranças de **planos de assinatura**, não para eventos. A arquitetura de `ministry_payment_gateways.webhook_token` previu a separação — mas a rota multi-tenant **ainda não existe**.

---

### 1.4 Tesouraria (`20260415100000_tesouraria_module.sql`)

**Campos relevantes:**

```sql
tipo_recebimento IN ('oferta','dizimo','evento','campanha','contribuicao')
forma_pagamento  IN ('dinheiro','pix','cartao','transferencia','cheque')
referencia       VARCHAR(255)  -- pode receber titulo do evento
member_id        UUID          -- adicionado via migration 20260416200000
```

`fin_categorias.modulo_origem` já inclui `'eventos'` no CHECK constraint.

**Padrão já estabelecido (missões):** `missoes_arrecadacoes.tesouraria_lancamento_id` guarda a FK reversa para rastreabilidade. O mesmo padrão deve ser seguido para eventos pagos via `eventos_pagamentos.tesouraria_lancamento_id`.

---

### 1.5 Padrão de pagamento existente (`pre_registrations`)

A migration `20260413195000_pre_registrations_payment_fields.sql` revela o padrão ASAAS atual:

```sql
asaas_customer_id, asaas_payment_id, asaas_status,
asaas_invoice_url, asaas_bank_slip_url,
payment_amount, payment_due_date
```

Este padrão coloca tudo na tabela principal — funciona para relação 1:1 (1 pagamento por pré-cadastro). Para eventos, onde:

- Uma inscrição pode ter **múltiplas tentativas** de pagamento
- Um lote pode ter **múltiplas inscrições** em **uma cobrança**
- Um gateway pode ser trocado no retry

O modelo colunar **não é escalável**. Uma **tabela dedicada** é obrigatória.

---

## 2. Modelagem de banco — Fase 4

### 2.1 Alterações em `eventos_inscricoes`

```sql
-- Migration: 20260524090000_eventos_inscricoes_pagamento_status.sql

ALTER TABLE public.eventos_inscricoes
  DROP CONSTRAINT IF EXISTS inscricao_status_valido;

ALTER TABLE public.eventos_inscricoes
  ADD CONSTRAINT inscricao_status_valido CHECK (
    status IN (
      'aguardando_pagamento',  -- pago pendente (vaga reservada)
      'confirmado',            -- ativo (gratuito confirmado OU pagamento confirmado)
      'lista_espera',          -- sem vaga disponível
      'cancelado',             -- cancelado pelo usuário ou admin
      'expirado'               -- pagamento venceu, vaga liberada automaticamente
    )
  );

-- Coluna para vincular ao lote (Fase 4D — NULL no MVP)
ALTER TABLE public.eventos_inscricoes
  ADD COLUMN IF NOT EXISTS lote_id UUID
    REFERENCES public.eventos_inscricoes_lotes(id) ON DELETE SET NULL;
```

**Máquina de estados por tipo de evento:**

```
Gratuito:
  (nova) → confirmado | lista_espera

Pago (vaga disponível):
  (nova) → aguardando_pagamento
         ↓ webhook PAYMENT_CONFIRMED
         → confirmado  → tesouraria sync
         ↓ webhook PAYMENT_CANCELED / cron expires_at
         → cancelado | expirado  → vaga liberada → promover lista_espera

Pago (sem vaga):
  (nova) → lista_espera  [SEM criar cobrança]
         ↓ quando alguém cancela/expira
         → aguardando_pagamento → fluxo normal
```

**Regra crítica:** inscrições em `lista_espera` para eventos pagos **nunca geram cobrança** até serem promovidas.

---

### 2.2 Nova tabela `eventos_inscricoes_lotes` (Fase 4D — declarar agora, usar depois)

```sql
CREATE TABLE IF NOT EXISTS public.eventos_inscricoes_lotes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id          UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  evento_id            UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  tipo                 VARCHAR(20) NOT NULL DEFAULT 'individual',
  -- 'individual' | 'lote' | 'caravana'
  responsavel_nome     VARCHAR(255) NOT NULL,
  responsavel_email    VARCHAR(255),
  responsavel_telefone VARCHAR(30),
  congregacao_origem   VARCHAR(255),  -- para caravanas
  quantidade           INTEGER NOT NULL DEFAULT 1,
  valor_total          NUMERIC(12,2) NOT NULL DEFAULT 0,
  status               VARCHAR(30) NOT NULL DEFAULT 'aguardando_pagamento',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT lote_tipo_check   CHECK (tipo IN ('individual','lote','caravana')),
  CONSTRAINT lote_status_check CHECK (status IN ('aguardando_pagamento','pago','cancelado','expirado'))
);
```

---

### 2.3 Nova tabela `eventos_pagamentos` (coração da Fase 4)

```sql
CREATE TABLE IF NOT EXISTS public.eventos_pagamentos (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id              UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  evento_id                UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,

  -- Alvo: individual OU lote (exatamente um)
  inscricao_id             UUID REFERENCES public.eventos_inscricoes(id) ON DELETE CASCADE,
  lote_id                  UUID REFERENCES public.eventos_inscricoes_lotes(id) ON DELETE CASCADE,

  -- Gateway
  gateway                  VARCHAR(30) NOT NULL,
  -- 'asaas' | 'efi' | 'mercadopago' | 'stripe'
  gateway_charge_id        VARCHAR(100),
  gateway_customer_id      VARCHAR(100),
  gateway_response         JSONB,
  payment_method           VARCHAR(30),
  -- 'pix' | 'boleto' | 'cartao' | 'manual'

  -- Valores
  valor                    NUMERIC(12,2) NOT NULL,
  status                   VARCHAR(30) NOT NULL DEFAULT 'pendente',
  -- 'pendente' | 'pago' | 'cancelado' | 'expirado' | 'estornado'

  -- PIX
  pix_payload              TEXT,
  pix_qrcode               TEXT,

  -- Boleto / Fatura
  invoice_url              TEXT,
  bank_slip_url            TEXT,

  -- Rastreabilidade financeira
  tesouraria_lancamento_id UUID
    REFERENCES public.tesouraria_lancamentos(id) ON DELETE SET NULL,

  -- Timestamps
  expires_at               TIMESTAMPTZ,
  paid_at                  TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ep_gateway_check CHECK (
    gateway IN ('asaas','efi','mercadopago','stripe')
  ),
  CONSTRAINT ep_method_check CHECK (
    payment_method IN ('pix','boleto','cartao','manual')
  ),
  CONSTRAINT ep_status_check CHECK (
    status IN ('pendente','pago','cancelado','expirado','estornado')
  ),
  CONSTRAINT ep_target_check CHECK (
    (inscricao_id IS NOT NULL AND lote_id IS NULL) OR
    (inscricao_id IS NULL AND lote_id IS NOT NULL)
  ),
  CONSTRAINT ep_gateway_charge_unique UNIQUE (gateway, gateway_charge_id)
);

CREATE INDEX IF NOT EXISTS idx_ep_inscricao  ON public.eventos_pagamentos(inscricao_id);
CREATE INDEX IF NOT EXISTS idx_ep_lote       ON public.eventos_pagamentos(lote_id);
CREATE INDEX IF NOT EXISTS idx_ep_evento     ON public.eventos_pagamentos(evento_id);
CREATE INDEX IF NOT EXISTS idx_ep_charge_id  ON public.eventos_pagamentos(gateway, gateway_charge_id);
CREATE INDEX IF NOT EXISTS idx_ep_status     ON public.eventos_pagamentos(status);
CREATE INDEX IF NOT EXISTS idx_ep_expires    ON public.eventos_pagamentos(expires_at)
  WHERE status = 'pendente';
```

---

### 2.4 Rota de webhook multi-tenant

Novo arquivo: `src/app/api/v1/ministry-webhook/[gateway]/[token]/route.ts`

**Fluxo interno:**

```
POST /api/v1/ministry-webhook/asaas/{webhook_token}
  1. Lookup ministry_payment_gateways WHERE webhook_token = $token AND gateway = 'asaas'
  2. Resolve ministry_id
  3. Parse payload ASAAS (event_type, payment.id)
  4. Lookup eventos_pagamentos WHERE gateway = 'asaas' AND gateway_charge_id = payment.id
  5. Atualizar eventos_pagamentos.status
  6. Se pago: atualizar eventos_inscricoes.status → 'confirmado'
  7. Se pago: criar tesouraria_lancamentos
  8. Se cancelado/expirado: status → 'cancelado'/'expirado' → liberar vaga → promover lista_espera
  9. Idempotência: upsert em asaas_webhook_events por event_id
```

**Separação entre os dois webhooks:**

| Webhook | Rota | Propósito |
|---|---|---|
| Planos de assinatura (existente) | `/api/v1/asaas/webhook` | Pagamento de planos da plataforma |
| Eventos por ministério (novo) | `/api/v1/ministry-webhook/asaas/[token]` | Pagamento de inscrições em eventos |

---

## 3. Integração do fluxo de inscrição (Q1 + Q5)

```
POST /api/v1/eventos/inscricao
│
├── valor_inscricao == 0 ──────────────────────────────────→ status='confirmado'
│                                                             retorna { inscricao_id, status }
│
└── valor_inscricao > 0
    │
    ├── sem vaga ─────────────────────────────────────────→ status='lista_espera'
    │                                                        retorna { inscricao_id, status }
    │                                                        [SEM criar cobrança]
    │
    └── com vaga
        ├── 1. Check UNIQUE: (evento_id, email_externo) ou (evento_id, member_id)
        │      Se existe com status='aguardando_pagamento' → retorna pagamento existente
        │      Se existe com status='confirmado'           → 409 "já inscrito"
        │      Se existe com status='expirado'/'cancelado' → UPDATE (reutilizar registro)
        │
        ├── 2. INSERT eventos_inscricoes status='aguardando_pagamento'
        │
        ├── 3. Resolver gateway ativo do ministério:
        │      SELECT * FROM ministry_payment_gateways
        │      WHERE ministry_id = $id AND is_active = true LIMIT 1
        │
        ├── 4. Descriptografar credentials (AES-256-GCM via CREDENTIALS_ENCRYPTION_KEY)
        │
        ├── 5. Chamar ASAAS API → criar cobrança PIX (ou boleto)
        │      customer: member.asaas_customer_id OU criar novo customer
        │      value: evento.valor_inscricao
        │      dueDate: now() + 30min (PIX) | now() + 3 dias (boleto)
        │      externalReference: inscricao_id
        │
        ├── 6. INSERT eventos_pagamentos {
        │      gateway='asaas', charge_id, pix_payload, pix_qrcode,
        │      expires_at, valor, status='pendente'
        │    }
        │
        └── 7. Retornar {
               inscricao_id, payment_id,
               pix_payload, pix_qrcode,
               expires_at, valor
             }
```

---

## 4. Sync pagamento → tesouraria (Q6)

```typescript
// Dentro do webhook handler, após confirmar pagamento:
async function syncToTesouraria(pagamento: EventoPagamento, evento: Evento) {
  const { data: lancamento } = await admin
    .from('tesouraria_lancamentos')
    .insert({
      ministry_id:      pagamento.ministry_id,
      congregacao_id:   null,               // Caixa Geral (ou congregação do evento)
      tipo_recebimento: 'evento',
      descricao:        `Inscrição — ${evento.titulo}`,
      referencia:       evento.titulo,
      valor:            pagamento.valor,
      forma_pagamento:  pagamento.payment_method,  // 'pix' | 'cartao'
      data_lancamento:  pagamento.paid_at,
      criado_por:       null,               // sistema (webhook)
    })
    .select('id')
    .single();

  // Rastreabilidade bidirecional
  await admin.from('eventos_pagamentos')
    .update({ tesouraria_lancamento_id: lancamento.id })
    .eq('id', pagamento.id);
}
```

---

## 5. Tratamento de expiração (Q7)

**Dois mecanismos complementares:**

**A. Vercel Cron** (`vercel.json`):
```json
{
  "crons": [{ "path": "/api/v1/cron/expire-payments", "schedule": "*/15 * * * *" }]
}
```

```
GET /api/v1/cron/expire-payments (Bearer secreto em header)
  1. SELECT eventos_pagamentos WHERE status='pendente' AND expires_at < now()
  2. UPDATE eventos_pagamentos SET status='expirado'
  3. UPDATE eventos_inscricoes SET status='expirado' WHERE id IN (...)
  4. Para cada expirado: verificar lista_espera → promover próximo
```

**B. On-demand** (quando usuário acessa página de pagamento):
```
GET /api/v1/eventos/pagamento/[payment_id]/status
  → Se expires_at < now() AND status='pendente' → marcar expirado inline
  → Retornar status atual
```

**TTLs recomendados:**

| Método | TTL |
|---|---|
| PIX | 30 minutos |
| Boleto | 3 dias úteis |
| Caravana / Lote | 7 dias |

---

## 6. Suporte a múltiplos gateways (Q8)

**Adapter pattern** em `src/lib/payment-gateways/`:

```
src/lib/payment-gateways/
├── index.ts          ← factory: getGateway(gateway, credentials)
├── types.ts          ← interfaces compartilhadas
├── asaas.ts          ← AsaasGateway implements PaymentGateway
├── efi.ts            ← EfiGateway implements PaymentGateway
├── mercadopago.ts    ← MercadoPagoGateway (Fase 4C)
└── stripe.ts         ← StripeGateway (Fase 4C)
```

```typescript
// types.ts
interface ChargeParams {
  valor: number;
  descricao: string;
  method: 'pix' | 'boleto' | 'cartao';
  customer: { nome: string; email: string; cpf?: string };
  externalReference: string;  // inscricao_id ou lote_id
  dueDate?: Date;
}

interface ChargeResult {
  chargeId: string;
  pixPayload?: string;
  pixQrcode?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  expiresAt: Date;
  gatewayRawResponse: unknown;
}

interface PaymentGateway {
  createCharge(params: ChargeParams): Promise<ChargeResult>;
  cancelCharge(chargeId: string): Promise<void>;
  getChargeStatus(chargeId: string): Promise<'pendente' | 'pago' | 'cancelado' | 'expirado'>;
}
```

**Seleção do gateway por ministério:**
```typescript
const gateway = await getActiveGateway(ministry_id);
const credentials = decrypt(gateway.encrypted_credentials);
const adapter = getGateway(gateway.gateway, credentials);
const charge = await adapter.createCharge(params);
```

**Expandir CHECK constraint em `ministry_payment_gateways.gateway`** na Fase 4C:
```sql
CONSTRAINT mpg_gateway_check CHECK (gateway IN ('asaas','efi','mercadopago','stripe'))
```

---

## 7. Riscos identificados

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| R1 | Race condition nas vagas (dois POSTs simultâneos) | 🔴 Alto | `SELECT FOR UPDATE SKIP LOCKED` na contagem de vagas dentro de transação DB |
| R2 | Webhook chega antes do INSERT de `eventos_pagamentos` (timing) | 🔴 Alto | Webhook faz retry se charge_id não encontrado; processar com fila |
| R3 | `encrypted_credentials` em memória → log acidental | 🟠 Médio | Nunca logar o objeto de credentials; sanitizar respostas de erro |
| R4 | Evento cancelado com cobranças pendentes | 🟠 Médio | Ao cancelar evento: cancelar cobranças no gateway + marcar inscrições |
| R5 | Usuário paga duas vezes (refresh da página PIX) | 🟡 Baixo | Idempotência por `externalReference` na ASAAS; retornar pagamento existente se pendente |
| R6 | Tesouraria sync falha após pagamento confirmado | 🟠 Médio | Webhook idempotente + fila de retry; `tesouraria_lancamento_id = NULL` indica pendência |
| R7 | PIX expira mas webhook de confirmação chega tarde | 🟡 Baixo | ASAAS notifica mesmo assim; webhook trata `expirado → pago` como caso válido |
| R8 | Lista de espera paga: capacidade muda antes de promover | 🟡 Baixo | Sempre verificar capacidade atual antes de criar cobrança ao promover da fila |

---

## 8. Roadmap executivo por fases

### Fase 4A — ASAAS MVP (PIX individual)

**Escopo:**
- Migration: adicionar `aguardando_pagamento` e `expirado` ao status de `eventos_inscricoes`
- Migration: criar `eventos_inscricoes_lotes` (estrutura preparatória, sem lógica de negócio ainda)
- Migration: criar `eventos_pagamentos`
- Modificar `POST /api/v1/eventos/inscricao`: detectar `valor_inscricao > 0` → criar cobrança PIX ASAAS
- Criar `GET /api/v1/eventos/pagamento/[id]/status`: polling de status pelo frontend
- Criar `POST /api/v1/ministry-webhook/asaas/[token]`: webhook multi-tenant ASAAS
- Webhook handler: confirmar pagamento → update inscricao → sync tesouraria
- Cron `GET /api/v1/cron/expire-payments`: expirar PIX vencidos (Vercel Cron a cada 15min)
- Modificar página pública `/eventos/e/[slug]`: exibir QR code PIX + polling de status

**Não alterar:** UI de admin, regras de lista de espera gratuita, módulo de tesouraria admin.

**Migrations necessárias (em ordem):**

| Arquivo | Conteúdo |
|---|---|
| `20260524090000_eventos_inscricoes_pagamento_status.sql` | Novos status + coluna `lote_id` |
| `20260524091000_eventos_inscricoes_lotes.sql` | Tabela preparatória para lotes/caravanas |
| `20260524092000_eventos_pagamentos.sql` | Tabela central de pagamentos + RLS |

---

### Fase 4B — EFI (Pix + Boleto)

**Escopo:**
- Implementar `EfiGateway` em `src/lib/payment-gateways/efi.ts`
- Webhook handler já suporta: `/api/v1/ministry-webhook/efi/[token]`
- UI de configuração de gateway: já existe via `ministry_payment_gateways`
- Adicionar `boleto` como `payment_method`
- `bank_slip_url` já existe em `eventos_pagamentos`

---

### Fase 4C — Múltiplos gateways (Mercado Pago + Stripe)

**Escopo:**
- Implementar adapters `MercadoPagoGateway` e `StripeGateway`
- Migration: expandir CHECK de `mpg_gateway_check` para `'mercadopago'` e `'stripe'`
- Webhook routes: `/api/v1/ministry-webhook/mercadopago/[token]` e `.../stripe/[token]`
- UI: selector de gateway na configuração por ministério (tabela já existe)
- Cartão de crédito: `payment_method = 'cartao'` já previsto no schema

---

### Fase 4D — Inscrições em lote e caravanas

**Escopo:**
- Ativar lógica de `eventos_inscricoes_lotes` (tabela já criada na Fase 4A)
- Nova rota: `POST /api/v1/eventos/inscricao-lote` — aceita array de participantes
- UI: formulário de cadastro em lote na página pública
- Responsável paga uma cobrança pelo total (`quantidade × valor_inscricao`)
- Webhook confirma → cria todas as inscrições + `tesouraria_lancamento` único
- Caravana: `congregacao_origem` no lote para agrupamento no relatório de check-in

---

## 9. Decisões de design que evitam retrabalho futuro

| Decisão | Alternativa rejeitada | Justificativa |
|---|---|---|
| Tabela `eventos_pagamentos` dedicada | Colunas em `eventos_inscricoes` | Suporta retries, lotes, múltiplos gateways, histórico de tentativas |
| `gateway VARCHAR(30)` + CHECK | PostgreSQL ENUM | ENUM exige `ALTER TYPE`; VARCHAR + CHECK é extensível com migration simples |
| Webhook URL `/ministry-webhook/[gateway]/[token]` | Token global no env | Isolamento multi-tenant; cada ministério tem seu próprio token |
| `lote_id` nullable em `eventos_inscricoes` desde 4A | Adicionar depois | Evita `ALTER TABLE` em tabela com dados de produção |
| `externalReference = inscricao_id` na ASAAS | Usar `payment_id` interno | Localiza inscrição sem JOIN extra no webhook |
| Sync com tesouraria via webhook (assíncrono) | Sync síncrono no POST | POST pode falhar antes do pagamento; webhook garante que só sincroniza confirmados |
| `asaas_webhook_events` para idempotência | Apenas upsert | Audit trail de todos os eventos; permite reprocessamento sem duplicidade |
