# Homologação Fase 4A — Eventos Pagos ASAAS PIX

**Data:** 24 de maio de 2026  
**Versão validada:** commit `1212633` (fix: tipo_recebimento='evento')  
**Status geral:** 🔴 PENDENTE — Homologação manual em sandbox não executada

---

## Bugs Encontrados e Corrigidos (Auditoria de Código)

| # | Severidade | Arquivo | Bug | Commit |
|---|---|---|---|---|
| 1 | CRÍTICO | `webhook/[token]/route.ts` | `origem_modulo: 'eventos_pagamentos'` viola CHECK da tesouraria | `827d9cd` |
| 2 | CRÍTICO | `migration 20260523200000` | `eventos_inscricoes` sem coluna `updated_at` — webhook/cron falhavam silenciosamente | `827d9cd` |
| 3 | CRÍTICO | `inscricao/route.ts` | Re-inscrição bloqueada após status `expirado`/`cancelado` | `827d9cd` |
| 4 | CRÍTICO | `inscricao/route.ts` | Overbooking: contagem de vagas ignorava `aguardando_pagamento` | `827d9cd` |
| 5 | MÉDIO | `webhook/[token]/route.ts` | Webhook processava gateways inativos (sem filtro `is_active`) | `827d9cd` |
| 6 | CRÍTICO | `webhook/[token]/route.ts` | `tipo_recebimento: 'pix'` viola CHECK da tesouraria — lançamento nunca criado | `1212633` |

> **Total: 5 bugs críticos + 1 médio corrigidos antes da execução em sandbox.**

---

## Variáveis de Ambiente

| Variável | Status | Observação |
|---|---|---|
| `CREDENTIALS_ENCRYPTION_KEY` | ✅ Configurada | AES-256-GCM para credenciais de gateway |
| `CRON_SECRET` | ✅ Adicionada | Adicionada ao `.env.local` em 23/05/2026 |
| `ASAAS_API_URL` | ✅ Adicionada (sandbox) | `https://sandbox.asaas.com/api/v3` |
| `ASAAS_API_KEY` (env) | ⚠️ Chave de PRODUÇÃO | Usada apenas pelo módulo de planos — NÃO para eventos |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Configurada | `https://qspueosxkolmwvibhzkt.supabase.co` |

> **Nota:** Eventos pagos usam credenciais por ministério, armazenadas criptografadas em `ministry_payment_gateways`. A `ASAAS_API_KEY` do env **não** é usada no fluxo de eventos. Para homologação, configure o gateway no painel do app com uma **API Key de sandbox** obtida em sandbox.asaas.com.

---

## Pré-Requisitos para Execução

- [ ] `npm run dev` rodando em `http://localhost:3000`
- [ ] Migration `20260523200000_eventos_pagamentos.sql` aplicada no Supabase
- [ ] Conta sandbox criada em [sandbox.asaas.com](https://sandbox.asaas.com)
- [ ] API Key sandbox obtida no painel ASAAS Sandbox
- [ ] Túnel HTTP ativo (ngrok ou similar) para receber webhooks localmente
- [ ] Gateway ASAAS configurado no painel do app com a API Key sandbox

---

## FASE 1 — Infraestrutura

**Objetivo:** Confirmar que a migration foi aplicada corretamente.

**SQL de validação:** `tools/homologacao-fase4a.sql` — queries 1A a 1H

| Verificação | Query | Esperado |
|---|---|---|
| Tabela `eventos_pagamentos` existe | 1A | 1 linha |
| Colunas da tabela | 1B | 20+ colunas incluindo `updated_at` |
| Coluna `updated_at` em `eventos_inscricoes` | 1C | 1 linha (Bug #2 corrigido) |
| CHECK constraint `eventos_inscricoes` | 1D | Inclui `aguardando_pagamento` e `expirado` |
| CHECK constraint `eventos_pagamentos` | 1E | `pendente,pago,cancelado,expirado,estornado` |
| Índices criados | 1F | `idx_ep_ministry`, `idx_ep_evento`, `idx_ep_inscricao`, `idx_ep_charge`, `idx_ep_status_expires` |
| RLS ativa | 1G | `rowsecurity = true` |
| Política RLS | 1H | `ep_select` para SELECT; INSERT/UPDATE só via service_role |

**Resultado:** 🔲 A executar

---

## FASE 2 — Gateway

**Objetivo:** Confirmar gateway ASAAS configurado e credenciais funcionando.

**Passos manuais:**
1. No app: **Configurações → Gateway de Pagamento**
2. Cadastrar gateway ASAAS com API Key sandbox
3. Marcar como Ativo → Salvar
4. Clicar "Testar conexão" → deve retornar sucesso
5. Anotar o `webhook_token` (UUID)

**Configurar webhook no ASAAS Sandbox:**
```
URL: https://{ngrok-url}/api/v1/ministry-webhook/asaas/{webhook_token}
Eventos: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_DELETED
```

**SQL de validação:** queries 2A e 2B

| Verificação | Esperado |
|---|---|
| Gateway cadastrado | `is_active=true`, `creds_status='CONFIGURADO'` |
| Webhook token válido | `token_valido=true` (formato UUID) |
| Teste de conexão | HTTP 200 com dados da conta ASAAS |

**Resultado:** 🔲 A executar

---

## FASE 3 — Evento de Teste

**Objetivo:** Criar evento pago e validar link público.

**Dados do evento:**
| Campo | Valor |
|---|---|
| Título | TESTE PIX ASAAS |
| Valor de inscrição | R$ 10,00 |
| Capacidade | 2 |
| Público | ✅ |
| Aceita inscrição | ✅ |

**SQL de validação:** query 3A

**URL pública:** `http://localhost:3000/eventos/e/{slug}`

| Verificação | Esperado |
|---|---|
| Evento no banco | `valor_inscricao=10.00`, `capacidade=2`, `is_publico=true` |
| Página abre sem login | ✅ |
| Valor exibido na página | "Pagar R$ 10,00 via PIX" |
| Formulário funcional | Campos nome, email, telefone, CPF (opcional) |

**Resultado:** 🔲 A executar

---

## FASE 4 — Inscrição

**Objetivo:** Realizar inscrição e validar geração de cobrança PIX.

**Requisição:**
```http
POST http://localhost:3000/api/v1/eventos/inscricao
Content-Type: application/json

{
  "slug": "{slug-do-evento}",
  "nome": "João Teste",
  "email": "joao@teste.com",
  "telefone": "(11) 99999-9999",
  "cpf_cnpj": "123.456.789-09"
}
```

**Resposta esperada (HTTP 201):**
```json
{
  "inscricao_id": "uuid...",
  "status": "aguardando_pagamento",
  "pix": {
    "payload": "00020126...",
    "qrcode_base64": "iVBORw0KGgo...",
    "expira_em": "2026-05-26T23:59:59-03:00",
    "invoice_url": "https://sandbox.asaas.com/..."
  }
}
```

**SQL de validação:** query 4A

| Verificação | Esperado |
|---|---|
| `inscricao.status` | `aguardando_pagamento` |
| `pagamento.status` | `pendente` |
| `gateway_charge_id` | `pay_XXXXXXXX` (ID ASAAS) |
| QR Code | Base64 presente |
| PIX copia-e-cola | Payload EMV presente |
| Expiração exibida | Data 2 dias à frente |

**IDs a registrar:**

| Campo | Valor |
|---|---|
| `evento_id` | — |
| `inscricao_id` | — |
| `pagamento_id` | — |
| `gateway_charge_id` | — |

**Resultado:** 🔲 A executar

---

## FASE 5 — Pagamento

**Objetivo:** Simular pagamento no ASAAS Sandbox e validar webhook.

**Passos:**
1. No painel ASAAS Sandbox, localizar a cobrança pelo `gateway_charge_id`
2. Clicar em **Simular Pagamento**
3. Aguardar webhook no terminal do `npm run dev`

**Log esperado no terminal:**
```
[webhook/asaas] PAYMENT_CONFIRMED → pagamento {id} marcado como pago
```

**SQL de validação:** query 5A

| Verificação | Esperado |
|---|---|
| `ep.status` | `pago` |
| `ep.paid_at` | Data/hora preenchida |
| `ei.status` | `confirmado` |
| `ep.tesouraria_lancamento_id` | UUID não nulo |
| Polling na tela pública | "Pagamento confirmado!" com ícone verde |

**Resultado:** 🔲 A executar

---

## FASE 6 — Tesouraria

**Objetivo:** Confirmar lançamento criado automaticamente com dados corretos.

**SQL de validação:** queries 6A e 6B

| Campo | Esperado |
|---|---|
| `tipo_movimento` | `entrada` |
| `tipo_recebimento` | `evento` |
| `origem_modulo` | `evento` |
| `origem_id` | UUID do registro em `eventos_pagamentos` |
| `valor` | `10.00` |
| `descricao` | `"Inscrição Evento: TESTE PIX ASAAS — João Teste"` |
| `data_lancamento` | Data do pagamento |

**Resultado:** 🔲 A executar

---

## FASE 7 — Idempotência

**Objetivo:** Garantir que reenvios do webhook não duplicam lançamentos.

**Teste:**
Reenviar o mesmo payload de webhook (POST para `/api/v1/ministry-webhook/asaas/{token}` com o mesmo chargeId).

**SQL de validação:** queries 7A e 7B

| Verificação | Esperado |
|---|---|
| `total_lancamentos` por pagamento | `1` (após N webhooks) |
| UNIQUE INDEX `uq_tesouraria_origem` | Existe com `WHERE NOT NULL` |
| Resposta do webhook no reenvio | `{"received":true,"skipped":"already_paid"}` |

**Resultado:** 🔲 A executar

---

## FASE 8 — Capacidade

**Objetivo:** Validar limite de vagas e lista de espera.

| Inscrição | Status Esperado | Observação |
|---|---|---|
| 1ª | `aguardando_pagamento` → `confirmado` | Normal |
| 2ª | `aguardando_pagamento` → `confirmado` | Normal (última vaga) |
| 3ª | `lista_espera` | Sem cobrança PIX |

**SQL de validação:** queries 8A e 8B

> A 3ª inscrição **não deve gerar** cobrança ASAAS nem registro em `eventos_pagamentos`.

**Resultado:** 🔲 A executar

---

## FASE 9 — Expiração

**Objetivo:** Validar cron de expiração de pagamentos vencidos.

**Passos:**
1. Criar nova inscrição (com vaga disponível)
2. Forçar `expires_at` no passado via SQL (query 9A)
3. Executar o cron:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/v1/cron/expire-event-payments" `
  -Headers @{ Authorization = "Bearer 4otEz5iwLqZp28LgjwrTQnYtBKQpfQT2SrJkzGCwj+4=" }
```

**Resposta esperada:** `{"expired": 1}`

**SQL de validação:** queries 9B e 9C

| Verificação | Esperado |
|---|---|
| `ep.status` | `expirado` |
| `ei.status` | `expirado` |
| Contagem de vagas | Reduz (vaga liberada) |
| Tela pública | "PIX expirado" com botão "Tentar novamente" |

**Resultado:** 🔲 A executar

---

## FASE 10 — Relatório Final

**SQL de evidências consolidadas:** query 10A em `tools/homologacao-fase4a.sql`

### Evidências

*(Cole aqui os resultados das queries após execução)*

### Tabelas Afetadas

| Tabela | Operações |
|---|---|
| `eventos_inscricoes` | INSERT (inscrição), UPDATE (status, updated_at) |
| `eventos_pagamentos` | INSERT (cobrança), UPDATE (status, paid_at, tesouraria_lancamento_id) |
| `tesouraria_lancamentos` | INSERT (lançamento de entrada) |
| `ministry_payment_gateways` | SELECT (credenciais e webhook_token) |
| `eventos` | SELECT (dados do evento) |

### Veredicto

🔲 **PENDENTE** — Aguardando execução das fases 1 a 9 em sandbox.

Após execução, atualizar para:

> ✅ **APROVADO PARA PRODUÇÃO** — Todos os cenários validados sem erros.

ou

> ❌ **NÃO APROVADO** — *descrever falhas encontradas*

---

## Checklist Final

### Infraestrutura
- [ ] Migration aplicada (tabela + índices + RLS)
- [ ] `updated_at` em `eventos_inscricoes` confirmada
- [ ] Novos status no CHECK confirmados

### Variáveis
- [ ] `CREDENTIALS_ENCRYPTION_KEY` — OK
- [ ] `CRON_SECRET` — OK
- [ ] `ASAAS_API_URL` sandbox — OK
- [ ] API Key sandbox configurada no gateway do ministério

### Fluxo Pago
- [ ] Inscrição cria `aguardando_pagamento`
- [ ] Cobrança ASAAS criada
- [ ] QR Code visível na tela pública
- [ ] PIX copia-e-cola funcional
- [ ] Webhook confirma pagamento
- [ ] Inscrição vira `confirmado`
- [ ] Lançamento tesouraria criado (`tipo_recebimento='evento'`, `origem_modulo='evento'`)
- [ ] Polling detecta confirmação na tela

### Controles
- [ ] Idempotência: reenvio não duplica lançamento
- [ ] Capacidade: 3ª inscrição vai para lista_espera
- [ ] Expiração: cron expira pagamentos vencidos e libera vagas
- [ ] Re-inscrição: após expirado, usuário consegue nova tentativa
