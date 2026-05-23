# Auditoria Técnica + Plano de Arquitetura — Configurações Financeiras por Ministério

> Data: 23 de maio de 2026  
> Status: Auditoria concluída — sem implementação

---

## 1. Estrutura Atual de Configurações

### Páginas existentes em `/configuracoes`

| Rota | Arquivo | Função |
|---|---|---|
| `/configuracoes` | `configuracoes/page.tsx` | Hub com abas: Perfil, Identidade Visual, Faturas, Plano, Nomenclaturas |
| `/configuracoes/perfil-ministerio` | `perfil-ministerio/page.tsx` | Dados cadastrais do ministério |
| `/configuracoes/branding` | `branding/page.tsx` | Logo, cores |
| `/configuracoes/faturas` | `faturas/page.tsx` | Faturas de assinatura da plataforma |
| `/configuracoes/plano` | `plano/page.tsx` | Plano contratado |
| `/configuracoes/nomenclaturas` | `nomenclaturas/page.tsx` | Nomenclaturas organizacionais |
| `/configuracoes/cartoes` | `cartoes/page.tsx` | Templates de cartões |
| `/configuracoes/certificados` | `certificados/page.tsx` | Templates de certificados |

**Ausente:** não existe aba ou página financeira/gateways em nenhuma dessas rotas.

### Tabelas existentes relevantes

| Tabela | Função | Observação |
|---|---|---|
| `ministries` | Dados do ministério | Possui `asaas_customer_id` — ID do ministério **como cliente da plataforma** no ASAAS |
| `ministry_users` | Usuários com `role` + `permissions JSONB` | Roles: `admin`, `manager`, `operator`, `viewer` |
| `payments` | Pagamentos de **assinatura da plataforma** | `ministry_id` refere ao ministério que pagou à plataforma |
| `asaas_webhook_events` | Log de eventos do webhook global | Single-tenant — sem `ministry_id` |
| `pre_registrations` | Pré-cadastros com `asaas_payment_id` | Fluxo de onboarding |

### Como permissões são tratadas

```
ministry_users.role IN ('admin', 'manager', 'operator', 'viewer')
ministry_users.permissions JSONB  -- ex: ["ADMINISTRADOR", "TESOUREIRO"]
```

O hook `useRequireModulo('configuracoes')` + `ctx.podeAcessar(modulo)` garante acesso à página. Não existe permissão granular para a sub-seção financeira ainda.

---

## 2. Integrações Existentes

### `src/lib/asaas.ts` — Análise crítica

```
ASAAS_API_KEY  →  variável de ambiente GLOBAL
ASAAS_API_URL  →  variável de ambiente GLOBAL
```

**Problema central:** a chave ASAAS atual pertence à **plataforma GestãoEklesia**, não a cada ministério. Toda cobrança feita hoje é **em nome da plataforma** (receitas de assinatura). Não existe conceito de cada ministério ter sua própria conta ASAAS.

Funções existentes:

| Função | Propósito atual |
|---|---|
| `createAsaasCustomer()` | Cria ministério como **cliente** da plataforma |
| `ensureAsaasCustomer()` | Busca/cria o cliente ASAAS do ministério |
| `createAsaasPayment()` | Cria cobrança para o ministério pagar a assinatura |
| `buildMonthlyInstallments()` | Parcelas mensais de assinatura |

**`externalReference` atual:** usado como `pre-${preReg.id}` ou `${ministryId}_p${index}` — referência para encontrar o registro correto no webhook. Não identifica ministério de forma determinística.

### Webhook atual (`/api/v1/asaas/webhook`)

```
Token:             ASAAS_WEBHOOK_TOKEN (env var global, único)
Tabela atualizada: payments (via asaas_payment_id)
Tabela de log:     asaas_webhook_events (sem ministry_id)
```

**Limitação crítica para multi-tenant:** o webhook atual não sabe de qual ministério veio o evento — ele apenas atualiza `payments.status` buscando por `asaas_payment_id`. Isso funciona hoje pois é single-account. Com múltiplas contas ASAAS por ministério, o mesmo `asaas_payment_id` pode existir em contas diferentes.

### API de pagamentos (`/api/v1/admin/payments`)

Gerenciada pelo painel admin. Cria cobranças de assinatura usando a chave global. Associa `ministry_id` no `payments` para controle interno.

### EFI / Gerencianet

**Não existe nenhuma referência** no código, migrations, variáveis de ambiente ou dependências. Clean slate completo.

### pgcrypto

`CREATE EXTENSION IF NOT EXISTS pgcrypto` já está habilitado em múltiplas migrations. Funções `pgp_sym_encrypt` e `pgp_sym_decrypt` estão disponíveis no banco sem configuração adicional.

**Supabase Vault** não está sendo usado no projeto.

---

## 3. Proposta de Arquitetura Multi-Tenant

### Separação conceitual (OBRIGATÓRIA antes de qualquer implementação)

```
Conta ASAAS da Plataforma (global)
└── Gerencia assinaturas dos ministérios → tabela payments → webhook /api/v1/asaas/webhook

Conta ASAAS do Ministério X (por ministério)
└── Gerencia cobranças internas da igreja → tabela ministry_transactions → webhook /api/v1/ministry-webhook/asaas/{gateway_token}

Conta EFI do Ministério Y (por ministério)
└── Mesma separação
```

As duas "camadas" não se misturam. A tabela `payments` permanece inalterada (assinatura da plataforma). As cobranças internas dos ministérios usam uma nova tabela e novos endpoints.

### Modelo de credenciais por ministério

```
ministries (1) → (N) ministry_payment_gateways
                          ↓
                  gateway = 'asaas' | 'efi'
                  environment = 'sandbox' | 'production'
                  encrypted_credentials BYTEA (pgp_sym_encrypt)
                  webhook_token UUID (público, por gateway/ministério)
                  status = 'active' | 'inactive' | 'error'
```

---

## 4. Segurança — Armazenamento de Credenciais

### Avaliação das opções

| Opção | Prós | Contras | Recomendação |
|---|---|---|---|
| Plain text no banco | Simples | Expõe credenciais em qualquer dump/backup | **NÃO** |
| JSONB sem criptografia | Simples | Idem | **NÃO** |
| Supabase Vault | Criptografia gerenciada, audit trail | Não está habilitado no projeto | Fase 2 (opcional) |
| `pgp_sym_encrypt` com chave de aplicação | Já disponível (pgcrypto ativo), boa proteção em repouso | Chave da aplicação no env; se vazada, dados descriptografados | **RECOMENDADO para Fase 1** |
| Tabela separada com RLS restrita | Isola no schema, RLS forte | Não resolve criptografia em repouso | Complementar |

### Estratégia recomendada (Fase 1)

```sql
-- encrypted_credentials armazena JSONB criptografado com pgp_sym_encrypt
-- A chave simétrica (CREDENTIALS_ENCRYPTION_KEY) fica no .env (Vercel Secret)
-- Nunca é exposta ao frontend — apenas lida server-side em API Routes

pgp_sym_encrypt(credentials_json::text, env.CREDENTIALS_ENCRYPTION_KEY)
```

**Estrutura interna do JSONB antes de criptografar — ASAAS:**
```json
{
  "api_key": "$aact_...",
  "api_url": "https://api.asaas.com/v3"
}
```

**Estrutura interna do JSONB antes de criptografar — EFI:**
```json
{
  "client_id": "...",
  "client_secret": "...",
  "certificate_base64": "...",
  "sandbox": false
}
```

### O que jamais volta ao frontend

- `api_key` nunca é enviada ao cliente — apenas `hasApiKey: true` + máscara (`$aac****...1234`)
- `client_secret` idem
- `certificate_base64` idem — apenas indica se está configurado
- A descriptografia ocorre **exclusivamente em API Routes server-side** antes de chamar o gateway

### Quem pode visualizar/editar

| Operação | Quem pode |
|---|---|
| Ver status (ativo/inativo) | Qualquer usuário do ministério |
| Ver indicadores (tem API key: sim/não) | Usuário com role `admin` ou `manager` |
| Editar credenciais | Somente `admin` do ministério (`role = 'admin'`) |
| Ver credenciais descriptografadas | Ninguém no frontend — jamais |
| Testar conexão | `admin` do ministério |

### RLS na tabela de gateways

```sql
-- SELECT: apenas role admin/manager do mesmo ministério
-- INSERT/UPDATE: apenas role admin do ministério
-- DELETE: apenas role admin do ministério
-- encrypted_credentials deve ser omitida em SELECTs via View ou RPC
```

**Solução para não expor `encrypted_credentials` via RLS:** criar uma View sem a coluna ou usar uma função RPC que descriptografa server-side e retorna apenas indicadores (true/false, máscara).

---

## 5. Banco de Dados — Proposta de Migration

### Tabela principal: `ministry_payment_gateways`

```sql
CREATE TABLE public.ministry_payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,

  -- Identificação do gateway
  gateway VARCHAR(20) NOT NULL,               -- 'asaas' | 'efi'
  environment VARCHAR(12) NOT NULL DEFAULT 'sandbox', -- 'sandbox' | 'production'
  display_name VARCHAR(100),                  -- nome amigável

  -- Estado
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'not_configured',
    -- 'not_configured' | 'configured' | 'connected' | 'error'

  -- Credenciais criptografadas (BYTEA — output do pgp_sym_encrypt)
  encrypted_credentials BYTEA,

  -- Webhook
  webhook_token UUID NOT NULL DEFAULT gen_random_uuid(), -- token público por gateway/ministério
  webhook_url_hint TEXT,                      -- URL gerada para mostrar ao usuário

  -- Diagnóstico
  last_test_at TIMESTAMPTZ,
  last_test_ok BOOLEAN,
  last_error TEXT,
  connection_latency_ms INTEGER,

  -- Auditoria
  configured_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Garantias
  CONSTRAINT mpg_gateway_valido CHECK (gateway IN ('asaas', 'efi')),
  CONSTRAINT mpg_environment_valido CHECK (environment IN ('sandbox', 'production')),
  CONSTRAINT mpg_status_valido CHECK (
    status IN ('not_configured', 'configured', 'connected', 'error')
  ),
  UNIQUE (ministry_id, gateway, environment)
);
```

### Tabela de transações internas dos ministérios: `ministry_transactions`

> Separada de `payments` (que é de assinatura da plataforma).

```sql
CREATE TABLE public.ministry_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  gateway_id UUID REFERENCES public.ministry_payment_gateways(id) ON DELETE SET NULL,

  -- Origem da transação
  origem_tipo VARCHAR(30),         -- 'tesouraria' | 'evento' | 'manual'
  origem_id UUID,                  -- ID do lançamento ou inscrição

  -- Dados do pagador
  payer_name VARCHAR(255),
  payer_email VARCHAR(255),
  payer_cpf_cnpj VARCHAR(20),

  -- Gateway
  gateway VARCHAR(20) NOT NULL,
  gateway_transaction_id VARCHAR(200),  -- ID gerado pelo gateway
  gateway_status VARCHAR(50),
  gateway_response JSONB,

  -- Financeiro
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  due_date DATE,
  payment_method VARCHAR(30),      -- 'pix' | 'boleto' | 'credit_card'
  payment_date TIMESTAMPTZ,

  -- URLs de pagamento
  invoice_url TEXT,
  bank_slip_url TEXT,
  pix_qr_code TEXT,
  pix_copy_paste TEXT,

  -- Status interno
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded'

  -- Conciliação tesouraria
  lancamento_id UUID,              -- FK futura para tesouraria_lancamentos
  conciliado_em TIMESTAMPTZ,
  conciliado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Auditoria
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Tabela de eventos de webhook por ministério: `ministry_webhook_events`

```sql
CREATE TABLE public.ministry_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID REFERENCES public.ministries(id) ON DELETE SET NULL,
  gateway_id UUID REFERENCES public.ministry_payment_gateways(id) ON DELETE SET NULL,
  gateway VARCHAR(20) NOT NULL,

  event_id VARCHAR(200) UNIQUE,           -- ID único do evento no gateway (idempotência)
  event_type VARCHAR(100) NOT NULL,
  transaction_id UUID REFERENCES public.ministry_transactions(id) ON DELETE SET NULL,
  gateway_transaction_id VARCHAR(200),

  payload JSONB NOT NULL,
  process_status VARCHAR(20) NOT NULL DEFAULT 'received',
    -- 'received' | 'processed' | 'error' | 'ignored'
  process_error TEXT,

  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
```

### Índices necessários

```sql
-- ministry_payment_gateways
CREATE INDEX idx_mpg_ministry ON ministry_payment_gateways(ministry_id);
CREATE INDEX idx_mpg_webhook_token ON ministry_payment_gateways(webhook_token);
CREATE UNIQUE INDEX idx_mpg_active_gateway
  ON ministry_payment_gateways(ministry_id, gateway)
  WHERE is_active = TRUE;

-- ministry_transactions
CREATE INDEX idx_mt_ministry ON ministry_transactions(ministry_id);
CREATE INDEX idx_mt_gateway_txid ON ministry_transactions(gateway_transaction_id);
CREATE INDEX idx_mt_origem ON ministry_transactions(origem_tipo, origem_id);
CREATE INDEX idx_mt_status ON ministry_transactions(status);

-- ministry_webhook_events
CREATE INDEX idx_mwe_gateway_txid ON ministry_webhook_events(gateway_transaction_id);
CREATE INDEX idx_mwe_ministry ON ministry_webhook_events(ministry_id);
CREATE INDEX idx_mwe_received ON ministry_webhook_events(received_at DESC);
```

### Avaliação do modelo sugerido originalmente

A proposta inicial (`encrypted_credentials JSONB`) é válida, com duas melhorias:
1. Usar `BYTEA` em vez de `JSONB` para o campo criptografado — `pgp_sym_encrypt` retorna bytes, não JSON válido
2. Separar a tabela de transações da tabela de gateways — responsabilidades distintas
3. O modelo único (`ministry_payment_gateways`) para ambos ASAAS e EFI é o correto — discriminado por `gateway`

---

## 6. Interface — Proposta de Tela

### Localização

**Nova aba dentro de `/configuracoes`**, seguindo o padrão das demais abas (Perfil, Identidade Visual, etc). Visível somente para `role = 'admin'`. Não criar nova rota.

### Layout

```
[Configurações] → aba "💳 Gateways de Pagamento"

┌─────────────────────────────────────────────────────────────┐
│ Gateways de Pagamento                                       │
│ Configure como sua igreja recebe pagamentos via PIX,        │
│ boleto e cartão.                                            │
├─────────────────────────────────────────────────────────────┤
│  ASAAS                    [● Ativo] [Sandbox]               │
│  Status: Conectado ✅  Último teste: 22/05/2026 14:30       │
│  API Key: $aac****...4321        [Editar] [Testar]          │
│  Webhook URL: https://app.../webhook/asaas/{token}          │
│  [Copiar URL]                                               │
├─────────────────────────────────────────────────────────────┤
│  EFI (Gerencianet)        [○ Inativo] [Produção]            │
│  Status: Não configurado                                    │
│  [Configurar]                                               │
└─────────────────────────────────────────────────────────────┘
```

**Modal de configuração ASAAS:**
```
Ambiente: [Sandbox] [Produção]
API Key: [campo type="password"]
Webhook Token (gerado automático): [campo readonly + botão Regenerar]
URL do Webhook: [campo readonly + botão Copiar]
[Cancelar] [Salvar e Testar Conexão]
```

**Modal de configuração EFI:**
```
Client ID:        [campo]
Client Secret:    [campo type="password"]
Certificado .p12: [upload de arquivo → base64]
Ambiente:         [Sandbox] [Produção]
[Cancelar] [Salvar e Testar Conexão]
```

### Regras de UI (não negociáveis)

- Campo `api_key` / `client_secret`: sempre `type="password"`, nunca pré-preenchido com valor real
- Após salvar, exibe apenas a máscara (`$aac****...4321`)
- Botão "Revelar" **não existe** — credenciais são opacas no frontend por design
- Botão "Regenerar Token Webhook" gera novo UUID no banco e exibe nova URL
- Frontend recebe apenas `{ ok: true, status: 'connected', latency_ms: 312 }` após salvar

---

## 7. Tesouraria — Uso Futuro

### Fluxo de cobrança manual

```
Tesouraria → Novo Lançamento → marcar como "Cobrar via gateway"
    ↓
Seleciona: PIX | Boleto | Cartão
    ↓
POST /api/v1/ministry/transactions
    ↓
Busca gateway ativo em ministry_payment_gateways
    ↓
Descriptografa credenciais (server-side)
    ↓
Chama ASAAS/EFI com credenciais do ministério
    ↓
Cria registro em ministry_transactions (status='pending')
    ↓
Retorna PIX QR Code / URL Boleto / Link Cartão
```

### Fluxo de confirmação via webhook

```
ASAAS do ministério → POST /api/v1/ministry-webhook/asaas/{webhook_token}
    ↓
webhook_token identifica ministry_payment_gateways.id + ministry_id
    ↓
Valida payload, cria registro em ministry_webhook_events (idempotência via event_id)
    ↓
Atualiza ministry_transactions.status = 'paid'
    ↓
Cria automaticamente tesouraria_lancamentos (tipo='receita', origem='gateway')
    ↓
Marca ministry_transactions.lancamento_id = novo lançamento
    ↓
Retorna 200
```

### Conciliação automática

- `tesouraria_lancamentos` receberá campo `gateway_transaction_id TEXT` para rastrear origem
- Tesouraria exibe badge "Pago via PIX ✅" quando `lancamento.gateway_transaction_id IS NOT NULL`

---

## 8. Eventos — Uso Futuro

### Fluxo de evento pago

```
Evento com aceita_inscricao=true E valor_inscricao > 0
    ↓
Participante faz inscrição
    ↓
Se gateway ativo → oferece PIX / Boleto / Cartão
    ↓
Cria ministry_transactions com origem_tipo='evento', origem_id=inscricao.id
    ↓
eventos_inscricoes.status = 'lista_espera' (aguarda pagamento)
    ↓
Webhook confirma → eventos_inscricoes.status = 'confirmado'
    ↓
(Opcional) check-in liberado somente para status='confirmado'
    ↓
(Fase 6) Emissão de recibo em PDF com dados da transação
```

### Campos adicionais necessários no schema de eventos (migration futura)

- `eventos_inscricoes.transaction_id UUID` → FK para `ministry_transactions`
- `eventos_inscricoes.payment_required BOOLEAN` → derivado do evento, útil desnormalizado

---

## 9. Webhooks Multi-Tenant — Estratégia

### Problema

ASAAS e EFI enviam webhooks para uma URL configurada **por conta**. Com múltiplas contas (uma por ministério), precisamos de uma URL única por ministério para identificar qual ministério processará o evento.

### Solução recomendada: URL com `webhook_token` público

```
/api/v1/ministry-webhook/asaas/{webhook_token}
/api/v1/ministry-webhook/efi/{webhook_token}
```

`webhook_token` é um UUID gerado automaticamente por linha de `ministry_payment_gateways`, armazenado em plain text (é público por natureza — é registrado na conta do gateway). Único e não adivinhável.

**Lookup no banco:**
```sql
SELECT mpg.*, mpg.ministry_id
FROM ministry_payment_gateways mpg
WHERE mpg.webhook_token = $1
  AND mpg.gateway = $2
  AND mpg.is_active = TRUE
LIMIT 1;
```

### Validação adicional de autenticidade

- **ASAAS:** verificar header `asaas-access-token` com token de verificação independente por ministério
- **EFI:** validar assinatura HMAC-SHA256 com o `client_secret` do ministério

### Comparativo das opções de roteamento

| Estratégia | Confiabilidade | Complexidade | Recomendação |
|---|---|---|---|
| URL com `webhook_token` | Alta — lookup direto | Baixa | ✅ Recomendada |
| `externalReference` parsing | Média — depende do payload | Baixa | Backup |
| Endpoint global + tabela de roteamento | Alta | Média | Alternativa |
| ministry_id direto na URL | Alta | Baixa | Equivalente ao token |

---

## 10. Riscos

### Segurança

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Vazar `api_key` no frontend | Alta (se não criptografado) | Crítico | Nunca retornar credencial no body — apenas máscara |
| Credenciais plain text no banco | Alta (se não implementado) | Crítico | `pgp_sym_encrypt` obrigatório desde Fase 1 |
| `CREDENTIALS_ENCRYPTION_KEY` comprometida | Baixa | Crítico | Rotacionar periodicamente; Vercel Secret; não commitar |
| Webhook falso (sem validação) | Média | Alto | Validar token + assinatura HMAC; idempotência por `event_id` |
| SSRF via `api_url` configurável | Baixa | Alto | Whitelist de URLs permitidas (`api.asaas.com`, `api.efipay.com.br`) |
| Escalonamento de privilégio | Média | Alto | RLS obrigatória — nunca confiar no `ministry_id` vindo do frontend |

### LGPD

| Risco | Mitigação |
|---|---|
| `payer_cpf_cnpj` em `ministry_transactions` | Minimização de dados; considerar hash ou armazenar apenas no gateway |
| `certificate_base64` da EFI (chave privada) | Criptografar com `pgp_sym_encrypt`; nunca no front |
| Retenção de dados de pagamento | Definir política de retenção; purge após N anos |
| Log de webhook com dados do pagador | `ministry_webhook_events.payload` pode ter dados pessoais — tratar como dado sensível |

### Operacionais

| Risco | Mitigação |
|---|---|
| Pagamento duplicado | `event_id UNIQUE` em `ministry_webhook_events`; verificar antes de processar |
| Troca sandbox → produção por acidente | Confirmação explícita na UI; badge vermelho "PRODUÇÃO" |
| Falha de rede durante criação de cobrança | Timeout com retry; status `pending_creation`; jobs de reconciliação |
| Conciliação incorreta (webhook atrasado) | `ministry_transactions` sempre como source of truth |
| Certificado EFI expirado | `last_test_at` periódico; notificação de status `error` na tela |
| `CREDENTIALS_ENCRYPTION_KEY` perdida | Dados se tornam inutilizáveis → backup seguro da chave obrigatório |

---

## 11. Plano de Implementação em Fases

### Fase 1 — Banco + Tela de Configuração (ASAAS)

**Escopo:** infraestrutura base + UI de configuração por ministério

- Migration: `ministry_payment_gateways` + índices + RLS
- `CREDENTIALS_ENCRYPTION_KEY` no `.env.local` e Vercel Secrets
- `src/lib/ministry-credentials.ts` — `encryptCredentials()`, `decryptCredentials()`, `maskCredentials()`
- `POST /api/v1/ministry/gateway` — salva credenciais criptografadas
- `GET /api/v1/ministry/gateway` — retorna status + máscara
- Nova aba "💳 Gateways de Pagamento" em `/configuracoes` (visível apenas para `role = 'admin'`)

**Resultado:** ministério consegue cadastrar suas credenciais ASAAS com segurança.

---

### Fase 2 — Teste de Conexão

**Escopo:** endpoint que descriptografa e testa ao vivo

- `POST /api/v1/ministry/gateway/test` — descriptografa credencial, chama `GET /payments?limit=1`, retorna latência e status
- Atualiza `last_test_at`, `last_test_ok`, `connection_latency_ms`, `last_error`
- UI: botão "Testar Conexão" com feedback em tempo real

**Resultado:** ministério sabe se as credenciais funcionam antes de usar.

---

### Fase 3 — Geração de Cobrança Manual na Tesouraria

**Escopo:** criar cobranças usando a conta ASAAS do próprio ministério

- Migration: tabela `ministry_transactions`
- `src/lib/ministry-gateway-client.ts` — wrapper que busca credenciais, descriptografa e chama o gateway
- `POST /api/v1/ministry/transactions` — cria cobrança, registra em `ministry_transactions`
- Tesouraria: botão "Cobrar via Gateway" em lançamentos

**Resultado:** tesouraria pode gerar PIX/boleto/cartão em nome da própria igreja.

---

### Fase 4 — Webhook Multi-Tenant (ASAAS)

**Escopo:** receber confirmações de pagamento por ministério

- Migration: tabela `ministry_webhook_events`
- `POST /api/v1/ministry-webhook/asaas/[token]` — lookup por `webhook_token`, valida, processa idempotentemente
- Atualiza `ministry_transactions.status`
- Cria `tesouraria_lancamentos` automaticamente (origem='gateway')
- Testa com ASAAS sandbox

**Resultado:** pagamentos confirmados automaticamente sem intervenção manual.

---

### Fase 5 — Eventos Pagos

**Escopo:** inscrição em eventos com cobrança integrada

- `eventos_inscricoes.transaction_id` adicionado via migration
- Fluxo: criar inscrição (lista_espera) → cobrar → webhook confirma → muda para confirmado
- UI de inscrição: exibe QR Code PIX ou link boleto
- Check-in: badge "Aguardando pagamento" se `transaction_id IS NOT NULL AND status != 'paid'`

**Resultado:** eventos pagos funcionam end-to-end.

---

### Fase 6 — EFI (Gerencianet)

**Escopo:** segundo gateway para ministérios que preferem EFI

- `src/lib/efi-client.ts` — wrapper para API EFI (OAuth 2.0 com certificado mTLS)
- Suporte a upload de certificado `.p12` (armazenado como base64 criptografado)
- UI: formulário específico EFI com campos Client ID, Client Secret, upload de certificado
- Webhook EFI com validação de assinatura HMAC
- `ministry-gateway-client.ts` adiciona `case 'efi'`

**Resultado:** ministérios com conta EFI têm integração completa.

---

## 12. Relatório Final

### Arquitetura Recomendada

```
┌──────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js App Router)                │
│  /configuracoes → aba "Gateways" (admin only)                   │
│  Mostra: status, máscara, botões editar/testar                   │
│  NUNCA recebe: api_key real, client_secret, certificado         │
└─────────────────────────┬────────────────────────────────────────┘
                          │ HTTPS
┌─────────────────────────▼────────────────────────────────────────┐
│                  API ROUTES (server-side)                        │
│  /api/v1/ministry/gateway           → CRUD configuração         │
│  /api/v1/ministry/gateway/test      → testa conexão live        │
│  /api/v1/ministry/transactions      → cria cobranças            │
│  /api/v1/ministry-webhook/asaas/[token] → confirmações ASAAS    │
│  /api/v1/ministry-webhook/efi/[token]   → confirmações EFI      │
└───────┬─────────────────┬──────────────────────┬────────────────┘
        │                 │                       │
┌───────▼────────┐ ┌──────▼───────┐  ┌───────────▼───────────┐
│   Supabase DB  │ │ ASAAS do     │  │  EFI do ministério    │
│                │ │ ministério   │  │                       │
│ ministry_pay.. │ │ api.asaas.   │  │  api.efipay.com.br    │
│ _gateways      │ │ com/v3       │  │  (mTLS + certificado) │
│ (criptografado)│ └──────────────┘  └───────────────────────┘
│ ministry_trans │
│ ministry_webh..│
└────────────────┘
```

### Tabelas a Criar

| Tabela | Fase | Propósito |
|---|---|---|
| `ministry_payment_gateways` | 1 | Configuração e credenciais por ministério |
| `ministry_transactions` | 3 | Cobranças geradas pelos ministérios |
| `ministry_webhook_events` | 4 | Log de eventos recebidos por ministério |

### Campos a Adicionar em Tabelas Existentes

| Tabela | Campo | Fase | Motivo |
|---|---|---|---|
| `tesouraria_lancamentos` | `gateway_transaction_id TEXT` | 4 | Conciliação |
| `tesouraria_lancamentos` | `origem VARCHAR(20)` | 4 | 'manual' ou 'gateway' |
| `eventos_inscricoes` | `transaction_id UUID` | 5 | Rastreamento de pagamento |
| `eventos_inscricoes` | `payment_required BOOLEAN` | 5 | Gate de check-in |

### Arquivos a Criar

| Arquivo | Fase | Conteúdo |
|---|---|---|
| `migrations/20260522220000_ministry_payment_gateways.sql` | 1 | Tabelas + índices + RLS |
| `src/lib/ministry-credentials.ts` | 1 | `encryptCredentials()`, `decryptCredentials()`, `maskCredentials()` |
| `src/lib/ministry-gateway-client.ts` | 3 | Wrapper multi-gateway (descriptografa + chama API) |
| `src/app/api/v1/ministry/gateway/route.ts` | 1 | GET + POST + PUT configuração |
| `src/app/api/v1/ministry/gateway/test/route.ts` | 2 | POST teste de conexão |
| `src/app/api/v1/ministry/transactions/route.ts` | 3 | POST criar cobrança |
| `src/app/api/v1/ministry-webhook/asaas/[token]/route.ts` | 4 | POST webhook ASAAS |
| `src/app/api/v1/ministry-webhook/efi/[token]/route.ts` | 6 | POST webhook EFI |
| `src/lib/efi-client.ts` | 6 | Wrapper EFI (OAuth mTLS) |

### Arquivos a Alterar

| Arquivo | Fase | O Que Muda |
|---|---|---|
| `src/app/configuracoes/page.tsx` | 1 | Nova aba "Gateways de Pagamento" (condicional: role=admin) |
| `src/app/tesouraria/page.tsx` | 3 | Botão "Cobrar via Gateway" em lançamentos |
| `src/app/eventos/page.tsx` | 5 | Exibir QR/link em inscrições pagas |
| `.env.local` | 1 | `CREDENTIALS_ENCRYPTION_KEY=<chave aleatória 32+ chars>` |

### Riscos Prioritários

1. **Vazar credenciais no frontend** — mitigado por arquitetura server-only
2. **Pagamento duplicado** — mitigado por `event_id UNIQUE`
3. **Troca sandbox/produção por acidente** — UI com confirmação + badge vermelho
4. **Perda da `CREDENTIALS_ENCRYPTION_KEY`** — backup obrigatório antes da Fase 1

### Esforço Estimado por Fase

| Fase | Complexidade | Arquivos novos | Arquivos alterados |
|---|---|---|---|
| 1 — Banco + Tela | Média | 4 | 2 |
| 2 — Teste de Conexão | Baixa | 1 | 1 |
| 3 — Cobrança Tesouraria | Alta | 2 | 1 |
| 4 — Webhook Multi-tenant | Alta | 1 + migration | 0 |
| 5 — Eventos Pagos | Média | 1 + migration | 1 |
| 6 — EFI | Alta | 2 | 2 |

### Primeira Implementação Recomendada (Fase 1)

Iniciar pela migration `ministry_payment_gateways` + a lib `ministry-credentials.ts` (funções de criptografia/descriptografia) + a API Route de GET/POST + a nova aba na tela de Configurações.

Isso entrega valor imediato (ministérios podem cadastrar suas credenciais) sem nenhuma cobrança real ainda, permitindo testar o fluxo com segurança no sandbox antes de avançar para as fases seguintes.
