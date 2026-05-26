# RELATÓRIO TÉCNICO — FASE D ENTREGA 1
## Integração EFI Pay (Gerencianet) — Multi-Gateway PIX

**Data:** 2026-05-25  
**Status:** ✅ Implementado e validado (0 erros TS, build limpo)

---

## 1. Escopo da Entrega

Implementação completa da integração EFI Pay como segundo gateway de pagamento PIX no sistema, seguindo exatamente a mesma arquitetura do ASAAS já existente. A implementação cobre:

- Cliente EFI com autenticação OAuth2 + mTLS opcional
- Gerenciador de webhook EFI
- Handler de webhook multi-tenant (Arrecadação Digital + Eventos Pagos)
- Teste de conexão real (substitui placeholder)
- Registro automático de webhook ao salvar configuração

---

## 2. Arquivos Criados / Modificados

### Criados

| Arquivo | Tamanho | Descrição |
|---------|---------|-----------|
| `src/lib/efi-pay.ts` | ~330 linhas | Cliente EFI completo — OAuth2, mTLS, PIX CRUD |
| `src/lib/efi-webhook-manager.ts` | ~70 linhas | Registro idempotente de webhook EFI |
| `src/app/api/v1/ministry-webhook/efi/[token]/route.ts` | ~230 linhas | Handler webhook multi-tenant EFI |

### Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/app/api/v1/ministry/gateway/test/route.ts` | Substituído placeholder por teste OAuth2 real via `testEfiConnection()` |
| `src/app/api/v1/ministry/gateway/route.ts` | Adicionado bloco de registro automático de webhook EFI após save |

---

## 3. Arquitetura

### 3.1 Autenticação EFI (diferença crítica vs ASAAS)

```
ASAAS: header access_token: <static_api_key>
EFI:   POST /oauth/token (Basic Auth) → access_token (TTL 3600s) → Bearer <token>
```

A autenticação EFI usa OAuth2 com cache em memória por `client_id + environment`. O token é renovado automaticamente com 60s de margem antes do vencimento. Nenhuma credencial é exposta fora do módulo.

### 3.2 mTLS (certificado p12)

O campo `certificate` nas credenciais EFI é um certificado p12 encodado em base64. Quando presente, é convertido para `Buffer` e passado como `pfx` para um `https.Agent` do Node.js. O `fetch()` nativo não suporta mTLS — por isso todas as chamadas EFI usam `https.request()` do Node.js diretamente.

```typescript
// Primitivo interno — não exportado
async function _httpsRequest(url, method, headers, body?, pfx?, passphrase?)
```

### 3.3 Cache de Token OAuth2

```typescript
// In-memory, não persiste entre restarts
// Chave: "sandbox:client_id" ou "production:client_id"
const _tokenCache = new Map<string, { token, expiresAt }>()
```

Em produção com múltiplas instâncias (serverless), cada instância mantém seu próprio cache. O token expira em 3600s na EFI, então no pior caso cada cold start faz 1 chamada extra de auth.

### 3.4 Fluxo de Cobrança PIX (EFI vs ASAAS)

```
ASAAS: POST /payments { billingType: PIX } → GET /pixQrCode/{id}
EFI:   PUT  /v2/cob/{txid} { chave, valor, devedor } → GET /v2/loc/{id}/qrcode
```

**txid determinístico:** O EFI aceita um txid definido pelo sistema (26-35 chars alfanumérico). O sistema deriva o txid do `externalRef` da cobrança, tornando reenvios idempotentes.

**Chave PIX obrigatória:** O EFI exige que o ministério configure `credentials.pix_key` (chave PIX da conta EFI). Sem ela, cobranças não podem ser criadas. O sistema valida e retorna erro descritivo.

### 3.5 Webhook EFI — Formato de Payload

```json
{
  "pix": [
    {
      "endToEndId": "E...",
      "txid": "abc123...",
      "valor": "10.00",
      "horario": "2024-01-01T12:00:00.000Z",
      "pagador": { "cpf": "...", "nome": "..." }
    }
  ]
}
```

**Diferença vs ASAAS:** O EFI não envia eventos explícitos de cancelamento/expiração via webhook — apenas pagamentos recebidos. O handler processa o array `pix[]` de forma idempotente via `endToEndId` → `fin_webhook_events.gateway_event_id`.

### 3.6 Dual-Flow: Arrecadação Digital + Eventos Pagos

O handler EFI replica exatamente o mesmo dual-flow do ASAAS:

```
Para cada pix recebido:
  1. Log idempotente em fin_webhook_events (UNIQUE gateway + gateway_event_id)
  2. Busca em fin_payment_charges por gateway_charge_id = txid
     → SE ENCONTRADO: atualiza status 'pago', cria tesouraria_lancamentos
  3. SE NÃO: busca em eventos_pagamentos por gateway_charge_id = txid
     → SE ENCONTRADO: atualiza status, confirma inscrição, cria tesouraria_lancamentos
  4. SE NÃO: skipped 'not_found'
```

### 3.7 Registro de Webhook

```
ASAAS: GET /webhooks → PUT (update) ou POST (create)
       Stores: asaas_webhook_id, asaas_webhook_status, asaas_webhook_registered_at

EFI:   PUT /v2/webhook/pix/{chave}
       Não armazena ID separado (EFI não retorna ID de webhook)
       Não-bloqueante, requer pix_key nas credenciais
```

O registro EFI é não-bloqueante: se falhar (ex.: pix_key ainda não configurada), o save do gateway ainda retorna sucesso. O registro pode ser refeito salvando novamente as credenciais.

---

## 4. Credenciais EFI

```typescript
// Campos suportados em encrypted_credentials (EFI)
{
  client_id:     string,  // obrigatório — autenticação OAuth2
  client_secret: string,  // obrigatório — autenticação OAuth2
  certificate:   string,  // opcional — certificado p12 em base64 (mTLS)
  passphrase:    string,  // opcional — senha do certificado p12
  pix_key:       string,  // necessário para criar cobranças e registrar webhook
}
```

A máscara de credenciais já estava implementada em `ministry-credentials.ts`:
```typescript
// maskGatewayCredentials('efi', credentials) retorna:
{ client_id: '••••', client_secret: '••••', certificate: '••••• (certificado salvo)' | null }
```

---

## 5. Validação

### TypeScript
```
npx tsc --noEmit → 0 erros
```

### Build Next.js
```
npm run build → exit code 0 (todas as rotas compiladas)
```

---

## 6. Testes Manuais Recomendados

### 6.1 Configurar Gateway EFI
```
POST /api/v1/ministry/gateway
{
  "gateway": "efi",
  "environment": "sandbox",
  "credentials": {
    "client_id": "...",
    "client_secret": "...",
    "pix_key": "chave@pix.ministerio"
  }
}
```

### 6.2 Testar Conexão
```
POST /api/v1/ministry/gateway/test
{ "gateway": "efi" }

Resposta esperada: { ok: true, status: "connected", latency_ms: ... }
```

### 6.3 Simular Webhook EFI (Sandbox)
```bash
# URL: https://{app}/api/v1/ministry-webhook/efi/{webhook_token}
POST /api/v1/ministry-webhook/efi/{token}
Content-Type: application/json

{
  "pix": [{
    "endToEndId": "E12345678202401011200000000000001",
    "txid": "{gateway_charge_id da fin_payment_charges}",
    "valor": "50.00",
    "horario": "2024-01-01T12:00:00.000Z",
    "pagador": { "cpf": "12345678901", "nome": "João Silva" }
  }]
}
```

Verificar após execução:
- `fin_payment_charges.status = 'pago'`
- `fin_payment_charges.valor_pago = 50.00`
- `fin_payment_charges.tesouraria_lancamento_id` preenchido
- `tesouraria_lancamentos` com novo lançamento (forma_pagamento='pix', origem_modulo='gateway')
- `fin_webhook_events` com `processed = true`

### 6.4 Verificar Webhook Token
```sql
SELECT webhook_token, status, last_test_ok
FROM ministry_payment_gateways
WHERE gateway = 'efi'
  AND ministry_id = '{ministry_id}';
```

---

## 7. Itens Sem Necessidade de Migration

O schema existente já suporta EFI completamente:
- `ministry_payment_gateways.gateway CHECK ('asaas','efi')` — ✅ EFI já aceito
- `fin_payment_charges.gateway VARCHAR(20)` — ✅ armazena 'efi'
- `fin_webhook_events.gateway VARCHAR(20)` — ✅ armazena 'efi'
- Campos ASAAS-específicos (`asaas_webhook_status` etc.) permanecem NULL para EFI — ✅ by design

**Nenhuma migration necessária para esta entrega.**

---

## 8. Limitações Conhecidas / Próximos Passos

| Limitação | Impacto | Solução Futura |
|-----------|---------|----------------|
| Cache de token OAuth2 não persiste entre restarts (serverless) | 1 request extra por cold start | Usar Redis/Supabase para cache |
| Webhook EFI não notifica cancelamento/expiração | Status permanece 'pendente' até polling | Implementar cron job de sincronização |
| QR code image requer chamada adicional `/v2/loc/{id}/qrcode` | Latência +1 request | Cache de imagem em storage |
| Webhook registrado por chave PIX (não por ministério) | Múltiplos ministérios com mesma chave PIX causariam conflito | Validação na UI de configuração |

---

## 9. Diagrama de Fluxo

```
Pagador → EFI PIX API → POST /v2/webhook/pix/{chave}
                            ↓
              /api/v1/ministry-webhook/efi/{token}
                            ↓
              Resolve ministry_id via webhook_token
                            ↓
              ┌─────────────────────────────────┐
              │  Para cada pix[] recebido        │
              │                                 │
              │  Log → fin_webhook_events        │
              │           ↓                     │
              │  fin_payment_charges?            │
              │  → SIM: Arrecadação Digital      │
              │     update status='pago'         │
              │     insert tesouraria_lancamentos│
              │           ↓                     │
              │  NÃO: eventos_pagamentos?        │
              │  → SIM: Evento Pago              │
              │     update status='pago'         │
              │     update eventos_inscricoes    │
              │     insert tesouraria_lancamentos│
              └─────────────────────────────────┘
```
