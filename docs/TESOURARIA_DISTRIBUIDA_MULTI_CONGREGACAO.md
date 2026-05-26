# Relatório Técnico — Tesouraria Distribuída Multi-Congregação

> **Status**: Design técnico — NÃO implementado  
> **Data**: 24 de maio de 2026  
> **Objetivo**: Permitir que o ministério use uma única conta ASAAS/EFI, mas gere QR Codes ou links de pagamento individuais por congregação, tipo de receita e campanha.

---

## 1. Pesquisa de Plataforma: ASAAS e EFI

### 1.1 ASAAS — `externalReference`

O ASAAS oferece o campo `externalReference` em **todos os endpoints de cobrança** (PIX, boleto, cartão, link de pagamento, assinaturas). Ele:

- Aceita uma string de até **200 caracteres** (formato livre — UUID, JSON compactado, slug)
- É **retornado intacto** no payload de todos os webhooks de pagamento
- **Persiste** nas cobranças listadas via `GET /v3/payments?externalReference=...`
- Não é exposto ao pagador (campo interno)

Isso significa que se o sistema emitir uma cobrança PIX com:

```json
{ "externalReference": "fpd:4a3b2c1d..." }
```

...o webhook que confirmar o pagamento trará `externalReference` com esse valor, permitindo roteamento preciso para a congregação e categoria corretas.

Para **links de pagamento estáticos** (`POST /v3/paymentLinks`) o `externalReference` também existe, e os pagamentos individuais gerados pelo link **herdam** o `externalReference` do link — portanto, o valor precisa já codificar congregação e tipo de receita.

**Conclusão ASAAS**: ✅ Suporte completo via `externalReference`. MVP totalmente viável.

### 1.2 EFI Bank (Gerencianet) — equivalente

O EFI usa o campo `txid` no PIX e `metadata.custom_id` nas cobranças. O `txid` tem restrições de formato (32 chars alfanumérico), mas o **`metadata.custom_id`** aceita string livre até 255 chars e é retornado no webhook `PAYMENT_RECEIVED`. Para links de pagamento do EFI, existe `metadata` no nível do link.

**Conclusão EFI**: ✅ Viável via `metadata.custom_id`. Requer adaptação de parsing diferente do ASAAS.

---

## 2. Conceito Central: Destinos de Pagamento

O problema é que o ministério tem **uma conta** no gateway, mas precisa que cada QR Code ou link saiba para onde o dinheiro "pertence" — sem criar múltiplas contas.

A solução é criar um **destino de pagamento** como entidade do sistema, que:

1. Codifica a combinação: congregação + tipo + categoria + campanha
2. Gera um **token público único** (UUID) para uso nas URLs — nunca expõe `ministry_id`
3. Armazena o `externalReference` que será enviado ao ASAAS/EFI
4. Ao receber o webhook, o sistema localiza o destino e lança na tesouraria

---

## 3. Arquitetura Proposta

### 3.1 Tabela: `fin_payment_destinations`

```sql
CREATE TABLE public.fin_payment_destinations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id      UUID NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  gateway_id       UUID NOT NULL REFERENCES ministry_payment_gateways(id) ON DELETE CASCADE,

  -- Contexto financeiro (resolve o lançamento na tesouraria)
  congregacao_id   UUID REFERENCES congregacoes(id) ON DELETE SET NULL,
  conta_id         UUID REFERENCES fin_contas(id) ON DELETE SET NULL,
  categoria_id     UUID REFERENCES fin_categorias(id) ON DELETE SET NULL,
  tipo_recebimento VARCHAR(30) NOT NULL,
  -- 'dizimo' | 'oferta' | 'campanha' | 'evento' | 'missoes' | 'ebd' | 'doacao'

  -- Escopo opcional
  campanha_nome    VARCHAR(150),       -- "Reforma do Templo", "Missão Peru"
  meta_valor       NUMERIC(12,2),      -- meta da campanha (nullable)
  evento_id        UUID,               -- FK para eventos (fase C)
  missao_id        UUID,               -- FK para missoes (fase C)
  member_id        UUID,               -- FK para member (dizimo identificado - fase C)

  -- Exibição pública
  label            VARCHAR(100) NOT NULL, -- "Dízimo — Cong. Central"
  descricao        TEXT,
  cor              VARCHAR(7),
  icone            VARCHAR(50),

  -- Token público para a URL do QR (nunca expõe ministry_id)
  public_token     UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

  -- Configuração
  valor_fixo       NUMERIC(12,2),      -- NULL = valor aberto pelo pagador
  is_ativo         BOOLEAN NOT NULL DEFAULT true,
  expires_at       TIMESTAMPTZ,        -- NULL = sem expiração

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.2 Tabela: `fin_payment_charges`

```sql
CREATE TABLE public.fin_payment_charges (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id               UUID NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  destination_id            UUID NOT NULL REFERENCES fin_payment_destinations(id),

  -- Gateway
  gateway                   VARCHAR(20) NOT NULL,
  gateway_charge_id         VARCHAR(255) UNIQUE,    -- ID no ASAAS/EFI
  gateway_customer_id       VARCHAR(255),
  gateway_external_ref      VARCHAR(200),           -- externalReference enviado
  gateway_response          JSONB,                  -- payload completo (auditoria)

  -- Tipo e método
  charge_type               VARCHAR(20) NOT NULL,
  -- 'pix_dinamico' | 'pix_estatico' | 'link_pagamento' | 'boleto' | 'cartao'
  payment_method            VARCHAR(20),

  -- Valores
  valor_solicitado          NUMERIC(12,2),          -- NULL = aberto
  valor_pago                NUMERIC(12,2),

  -- PIX dinâmico
  pix_payload               TEXT,                   -- copia-e-cola EMV
  pix_qrcode_url            TEXT,                   -- URL da imagem
  invoice_url               TEXT,                   -- URL da fatura ASAAS

  -- Pagador (opcional, para dízimo identificado)
  member_id                 UUID REFERENCES members(id) ON DELETE SET NULL,
  payer_name                VARCHAR(255),
  payer_document            VARCHAR(20),            -- CPF/CNPJ mascarado após uso

  -- Status
  status                    VARCHAR(20) NOT NULL DEFAULT 'pendente',
  -- 'pendente' | 'pago' | 'cancelado' | 'expirado' | 'estornado'

  -- Rastreabilidade
  tesouraria_lancamento_id  UUID,                   -- preenchido após confirmação
  idempotency_key           VARCHAR(100) UNIQUE,    -- evita duplicidade de criação

  -- Datas
  expires_at                TIMESTAMPTZ,
  paid_at                   TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.3 Tabela: `fin_webhook_events`

```sql
CREATE TABLE public.fin_webhook_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id      UUID NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,

  gateway          VARCHAR(20) NOT NULL,
  event_type       VARCHAR(50) NOT NULL,       -- PAYMENT_CONFIRMED, etc.
  gateway_event_id VARCHAR(255),               -- ID único do evento no ASAAS
  charge_id        VARCHAR(255),               -- gateway_charge_id
  external_ref     VARCHAR(200),               -- externalReference do payload
  payload          JSONB NOT NULL,             -- payload completo (auditoria)

  -- Processamento
  processed        BOOLEAN NOT NULL DEFAULT false,
  processed_at     TIMESTAMPTZ,
  processing_error TEXT,                       -- erro, se houver
  destination_id   UUID,                       -- destino resolvido
  lancamento_id    UUID,                       -- lançamento criado

  received_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Idempotência: mesmo evento não é processado duas vezes
  UNIQUE(gateway, gateway_event_id)
);
```

---

## 4. Diferença entre os Tipos de Cobrança

| Tipo | Como funciona | Quando usar |
|------|---------------|-------------|
| **QR Code estático** | URL estática com `public_token`. Pagador digita valor. Sem expiração. Impresso em cartaz. | Oferta, dízimo em culto presencial |
| **Link de pagamento dinâmico** | Gerado via `POST /v3/paymentLinks`. URL pública partilhável. Valor fixo ou livre. | Campanha com meta, evento pago, missões |
| **Cobrança PIX dinâmica** | Gerado via `POST /v3/payments`. QR Code com expiração. Valor pré-definido. | Dízimo identificado por membro, evento com inscrição |
| **PIX com valor aberto** | `valor_fixo = NULL`. Pagador define o valor no app. | Oferta avulsa, doação livre |
| **PIX com valor fixo** | `valor_fixo = X`. Pagador vê o valor bloqueado. | Evento com ingresso, campanha com cota |

---

## 5. Fluxos por Caso de Uso

### 5.1 Dízimo por congregação (mais comum)

```
Admin cria destino "Dízimo — Cong. Central"
  → fin_payment_destinations(tipo=dizimo, congregacao_id=X, valor_fixo=NULL)
  → public_token = uuid-A

Sistema gera URL pública:
  https://gestaoeklesia.com.br/pagar/uuid-A

Admin imprime cartaz com QR Code dessa URL.

Membro escaneia → vê "Dízimo — Cong. Central" → digita valor → paga.

Sistema (handler público):
  1. Valida public_token → resolve destination_id → resolve ministry_id
  2. Cria cobrança PIX no ASAAS com:
       externalReference: "fpd:{destination_id_hex}"
  3. Retorna pix_payload + pix_qrcode para o membro escanear

ASAAS confirma pagamento → webhook → /api/v1/ministry-webhook/asaas/{webhook_token}
  1. Extrai externalReference → localiza fin_payment_destinations
  2. Cria tesouraria_lancamentos:
       tipo_recebimento='dizimo', congregacao_id=X, conta_id, categoria_id
       forma_pagamento='pix', origem_modulo='gateway', origem_id=charge_id
  3. Marca fin_payment_charges.status='pago'
```

### 5.2 Oferta por congregação

Mesmo fluxo do dízimo, com `tipo='oferta'` e valor aberto. Pode ser gerado em massa para todas as congregações de uma vez.

### 5.3 Campanha com meta (Fase B)

```
Admin cria campanha "Reforma do Templo" com meta R$ 50.000
  → fin_payment_destinations(tipo=campanha, campanha_nome=X, meta_valor=50000)

Sistema cria paymentLink no ASAAS:
  { externalReference: "fpd:{id}", description: "Campanha Reforma", ... }

Dashboard mostra: arrecadado / meta / % / ranking de doadores
```

### 5.4 Evento pago

Reutiliza o fluxo existente de `eventos_pagamentos`, adicionando `destination_id` como FK. O webhook de evento pago já lança na tesouraria — a mudança enriquece o lançamento com `congregacao_id` e `categoria_id` vindos do destino.

### 5.5 Dízimo identificado por membro (Fase C)

```
Sistema gera cobrança PIX avulsa para membro específico:
  externalReference: "fpd:{destination_id_hex}:m:{member_id_hex}"

Webhook confirma → cria dizimistas_pagamentos + tesouraria_lancamentos
```

---

## 6. Resolução de Origem pelo Webhook

O handler atual em `/api/v1/ministry-webhook/asaas/{webhook_token}` já resolve o `ministry_id` pelo `webhook_token`. A cadeia de resolução completa:

```
Webhook recebido:
  1. webhook_token → ministry_payment_gateways → ministry_id  (já existe)
  2. gateway_event_id → fin_webhook_events (idempotência — se já existe, ignore com 200 OK)
  3. externalReference → parse → destination_id
  4. destination_id → fin_payment_destinations → congregacao_id, conta_id, categoria_id, tipo
  5. Upsert em fin_payment_charges (gateway_charge_id como key)
  6. Se status === PAYMENT_CONFIRMED ou PAYMENT_RECEIVED:
       → INSERT tesouraria_lancamentos com todos os campos resolvidos
       → UPDATE dizimistas_pagamentos (se member_id presente no externalReference)
       → UPDATE fin_payment_charges.tesouraria_lancamento_id
```

**Formato do `externalReference`** (proposto):

| Caso | Formato | Exemplo | Tamanho |
|------|---------|---------|---------|
| Destino simples | `fpd:{uuid_hex}` | `fpd:4a3b2c1d...` | 36 chars |
| Dízimo por membro | `fpd:{uuid_hex}:m:{member_hex}` | `fpd:4a3b...:m:9f8e...` | 72 chars |

Ambos dentro do limite de 200 chars do ASAAS.

---

## 7. Lançamento Automático em `tesouraria_lancamentos`

Após confirmação de pagamento pelo webhook:

```typescript
await supabase.from('tesouraria_lancamentos').insert({
  ministry_id:        destination.ministry_id,
  congregacao_id:     destination.congregacao_id,       // resolvido do destino
  conta_id:           destination.conta_id,             // resolvido do destino
  categoria_id:       destination.categoria_id,         // resolvido do destino
  tipo_recebimento:   destination.tipo_recebimento,     // 'dizimo' | 'oferta' | ...
  forma_pagamento:    'pix',
  valor:              charge.valor_pago,
  data_lancamento:    toDate(paid_at),
  descricao:          `PIX confirmado — ${destination.label}`,
  referencia:         destination.campanha_nome ?? destination.label,
  origem_modulo:      'gateway',
  origem_id:          charge.id,                        // FK para fin_payment_charges
})
```

O índice único `uq_tesouraria_origem(ministry_id, origem_modulo, origem_id)` já existente **garante que um mesmo charge não gera dois lançamentos** — proteção automática contra webhook duplicado.

---

## 8. Prevenção de Duplicidade

| Problema | Proteção |
|----------|----------|
| Webhook recebido 2x | `UNIQUE(gateway, gateway_event_id)` em `fin_webhook_events` |
| Dois lançamentos do mesmo charge | `UNIQUE(ministry_id, origem_modulo, origem_id)` em `tesouraria_lancamentos` (já existe) |
| QR Code antigo ainda em uso | `expires_at` no destino; `is_ativo=false` desabilita geração |
| Link compartilhado indevido | `public_token` único por destino; revogável via `is_ativo=false` |
| Cobrança criada duas vezes | `idempotency_key UNIQUE` em `fin_payment_charges` |

---

## 9. Interface do Usuário

### Tela: Gestão de QR Codes / Destinos

```
[Dropdown: Congregação]     [Dropdown: Tipo]     [Buscar]

┌─────────────────────────────────────────────────────────────────────┐
│  🟢 Dízimo — Cong. Central      valor livre    [QR] [Copiar] [🖨]   │
│  🟢 Oferta — Cong. Central      valor livre    [QR] [Copiar] [🖨]   │
│  🔵 Campanha Reforma            R$ 50.000 meta [QR] [Copiar] [🖨]   │
│  ⚪ Missões Peru                expirado        [Reativar]          │
└─────────────────────────────────────────────────────────────────────┘
[+ Novo destino]          [Gerar QR para todas as congregações ▼]
```

### Dashboard por Congregação

```
Arrecadação — Maio 2026       [Exportar CSV] [Exportar PDF]

Cong. Central       R$ 12.340  ████████████░░░░  43%
Cong. Vila Nova     R$  8.210  ████████░░░░░░░░  29%
Cong. Betel         R$  5.100  █████░░░░░░░░░░░  18%
Outras (28)         R$  2.890  ██░░░░░░░░░░░░░░  10%

Total do ministério: R$ 28.540
```

### Escala com 100+ congregações

- Busca por nome com debounce 300ms (carregamento paginado)
- Seleção múltipla com checkbox "Selecionar todas visíveis"
- Geração em lote → ZIP com imagens PNG 300×300
- Impressão em lote → PDF multi-página, 1 cartaz por página (A4)
- Exportação CSV: token, URL, congregação, tipo, arrecadado, data criação

---

## 10. Segurança

| Aspecto | Solução |
|---------|---------|
| `ministry_id` nunca exposto | URL pública usa `public_token` (UUID opaco). Mapeamento feito server-side. |
| Token revogável | `is_ativo=false` + `expires_at`. Desativar invalida novas cobranças. |
| Webhook multi-tenant | Mantém modelo atual: `webhook_token` → `ministry_id`. Cada ministério tem endpoint isolado. |
| Rate limit | 10 req/min por IP no endpoint público `/pagar/{token}`. |
| Validação server-side | `destination_id` sempre revalidado contra `ministry_id` — nunca confiar em parâmetro do client. |
| LGPD | `payer_document` mascarado após confirmação. `payer_name` retido apenas para reconciliação. |
| Idempotência | `gateway_event_id` unique em `fin_webhook_events` — duplicatas silenciadas com 200 OK. |

---

## 11. Impacto nas Tabelas Existentes

| Tabela | Mudança necessária |
|--------|--------------------|
| `tesouraria_lancamentos` | Nenhuma — `conta_id`, `categoria_id`, `origem_modulo`, `origem_id` já existem ✅ |
| `fin_contas` | Nenhuma — `congregacao_id` e `gateway_id` já existem ✅ |
| `fin_categorias` | Nenhuma — valor `'gateway'` já existe em `modulo_origem` ✅ |
| `ministry_payment_gateways` | Nenhuma — single-gateway por tipo continua válido ✅ |
| `congregacoes` | Nenhuma ✅ |
| `members` | Nenhuma para Fase A; Fase C usa busca por `id` existente ✅ |
| `dizimistas_pagamentos` | Fase C: adicionar `fin_payment_charge_id UUID` para rastrear origem digital |
| `eventos_pagamentos` | Fase C: adicionar `destination_id UUID` FK para `fin_payment_destinations` |

> **Destaque**: a Fase A não altera nenhuma tabela existente. Apenas cria as 3 novas tabelas.

---

## 12. Roadmap

### Fase A — MVP (8–12 dias) ⭐ Recomendada primeiro

> QR Code e link por congregação + tipo de receita. Webhook → lançamento automático.

**Escopo**:
- Tabelas: `fin_payment_destinations`, `fin_payment_charges`, `fin_webhook_events`
- Endpoint público `GET/POST /pagar/{public_token}` — gera PIX dinâmico no ASAAS
- Webhook handler: resolve `externalReference` → lança na tesouraria
- UI: tela de gestão de destinos, QR Code inline, botão copiar link
- Badge de arrecadação por destino

**Esforço estimado**: 1 desenvolvedor, ~10 dias

---

### Fase B — Campanha com meta (4–5 dias)

> Barra de progresso, contagem de doadores, link via ASAAS `paymentLinks`.

**Escopo**:
- `meta_valor` e `campanha_nome` já modelados na Fase A
- Dashboard com progresso visual e ranking
- Criação/reutilização de `paymentLink` no ASAAS

---

### Fase C — Dízimo identificado por membro (5–7 dias)

> Membro acessa link pessoal, paga, `dizimistas_pagamentos` atualizado automaticamente.

**Escopo**:
- Cobrança com `member_id` no `externalReference`
- Webhook resolve membro → atualiza `dizimistas_pagamentos`
- Envio de link por WhatsApp/e-mail

---

### Fase D — Impressão em lote (3–4 dias)

> PDF multi-página com cartaz por congregação. ZIP de QR Codes.

**Escopo**:
- QR Code PNG server-side (lib `qrcode`)
- PDF via `jsPDF` ou Puppeteer
- Download ZIP (JSZip)

---

### Fase E — Conciliação avançada (5–6 dias)

> Relatório de cobranças não conciliadas. Reprocessamento de webhooks perdidos. Extrato reconciliado.

---

## 13. Recomendação Final — Por que começar pela Fase A

A Fase A é o MVP mais simples, seguro e comercialmente forte pelos seguintes motivos:

1. **Dor imediata**: administradores de campos com 50–100 congregações fazem conciliação manual hoje. O sistema identifica cada PIX automaticamente.

2. **Zero atrito para o pagador**: membro escaneia QR Code normal do celular. Sem app, sem cadastro, sem dados extras.

3. **Construído sobre o que já existe**: tesouraria, congregações, gateway, webhook handler e `externalReference` do ASAAS já estão disponíveis. A Fase A é essencialmente uma **camada de roteamento** entre eles.

4. **Diferencial competitivo**: nenhum sistema de gestão de igrejas no Brasil oferece conciliação automática PIX → congregação → tesouraria.

5. **Fundação para todas as fases**: as tabelas da Fase A já carregam os campos opcionais (`meta_valor`, `member_id`, `evento_id`) que as fases seguintes precisam.

**Primeira implementação recomendada** (antes da UI completa): aplicar as 3 novas tabelas + endpoint de geração de PIX para uma congregação de teste. Isso valida o fluxo ASAAS → webhook → tesouraria em produção com risco zero.
