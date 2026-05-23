# Auditoria Financeira Fase 0 — Gestão Eklésia

> **Data:** 23 de maio de 2026  
> **Base analisada:** migrations reais, código das páginas, integrações existentes.  
> **Restrição:** somente análise e proposta arquitetural — sem implementação, sem migrations, sem alteração de arquivos.

---

## 1. Tabelas Financeiras Compartilhadas por Todos os Módulos

### Proposta: `tesouraria_lancamentos` como ledger central universal

`tesouraria_lancamentos` **já é** o registro contábil canônico do sistema. Todo evento financeiro de qualquer módulo que gere entrada ou saída de valor **deve ter um registro correspondente nela**. Isso já acontece com Missões (via `tesouraria_lancamento_id`). Deve acontecer com todos.

**Tabelas que devem ser compartilhadas/centralizadas:**

| Tabela | Situação atual | Papel futuro |
|---|---|---|
| `tesouraria_lancamentos` | Existe, ledger da Tesouraria | **Ledger universal** de todos os módulos |
| `tesouraria_fechamentos` | Existe, fechamento mensal | Mantida — aplica-se ao ministério inteiro |
| `ministry_payment_gateways` | Não existe | Nova — configuração de gateway por ministério |
| `ministry_transactions` | Não existe | Nova — cobranças geradas pelos módulos |
| `ministry_webhook_events` | Não existe | Nova — eventos recebidos dos gateways |
| `fin_contas` | Não existe | Nova — caixas e contas bancárias por ministério |
| `fin_categorias` | Não existe | Nova — plano de contas configurável |

---

## 2. Tabelas Financeiras Específicas por Módulo

Estas tabelas guardam **contexto do domínio** (quem doou, em qual turma, em qual projeto), mas **não devem ser o registro financeiro primário**. Elas são origem; o lançamento na Tesouraria é o destino.

| Tabela módulo | Papel | Vinculação ao ledger |
|---|---|---|
| `missoes_arrecadacoes` | Contexto da arrecadação missionária | ✅ `tesouraria_lancamento_id` (existe) |
| `ebd_ofertas` | Contexto da oferta por aula/turma | ⚠️ `lancamento_tesouraria_id` existe na migration, mas a UI não cria o lançamento automaticamente |
| `dizimistas_pagamentos` | Controle mensal de dízimo por membro | ❌ Sem FK para `tesouraria_lancamentos` — sincronização manual no código, frágil |
| `eventos_inscricoes` | Inscrição em evento pago | ❌ Sem campo financeiro ainda |
| `ebd_pedidos_revistas` | Compra de revistas | ❌ Tem `valor_total` mas sem lançamento na Tesouraria |

**Conclusão:** somente Missões tem integração bidirecional real com a Tesouraria. Os demais módulos são ilhas financeiras.

---

## 3. Separação: Plataforma vs. Ministério

### Camada 1 — Cobrança da plataforma GestãoEklesia

```
payments (subscription)
├── ministry_id → quem pagou a mensalidade
├── asaas_payment_id → ID na conta ASAAS da PLATAFORMA
└── asaas_webhook_events → eventos de webhook da PLATAFORMA

Responsável: Admin plataforma
Gateway: conta ASAAS única (env ASAAS_API_KEY)
Não é visível ao usuário do ministério
```

### Camada 2 — Transações internas do ministério

```
ministry_transactions (futuro)
├── ministry_id → qual ministério gerou a cobrança
├── gateway_id → conta ASAAS/EFI do próprio ministério
└── origem_tipo → 'tesouraria' | 'evento' | 'dizimo' | 'missoes' | 'ebd'

Responsável: Tesoureiro/Admin do ministério
Gateway: conta própria do ministério (criptografada)
Visível na tela de configuração do ministério
```

**Regra absoluta:** `payments` nunca aparece para o ministério. `ministry_transactions` nunca aparece para o admin da plataforma. São namespaces distintos que jamais se cruzam.

---

## 4. Modelo de Contas Bancárias / Caixas

### Situação atual

O sistema atual usa `congregacao_id = NULL` como "Caixa Geral (sede)" e `congregacao_id = <UUID>` como caixa de cada congregação. **Não existe conceito de conta bancária ou tipo de caixa.**

Isso é problemático porque uma igreja pode ter:
- Caixa físico (dinheiro em espécie)
- Conta corrente Banco do Brasil
- Conta PIX (chave CNPJ)
- Conta separada para Eventos
- Fundo de Missões

Todos esses convivem na mesma congregação, sem distinção.

### Proposta: tabela `fin_contas`

```sql
fin_contas
├── id UUID
├── ministry_id UUID
├── congregacao_id UUID (null = conta da sede)
├── nome VARCHAR(100)         -- "Caixa Geral", "BB Conta Corrente", "Fundo Missões"
├── tipo VARCHAR(30)          -- 'caixa' | 'conta_corrente' | 'poupanca' | 'pix' | 'fundo' | 'outro'
├── banco VARCHAR(100)        -- "Banco do Brasil", "Bradesco", etc (null para caixa físico)
├── agencia VARCHAR(20)
├── conta VARCHAR(30)
├── chave_pix VARCHAR(255)
├── saldo_inicial NUMERIC(12,2) DEFAULT 0
├── saldo_atual NUMERIC(12,2)  -- calculado via trigger ou view
├── is_ativa BOOLEAN DEFAULT TRUE
├── is_padrao BOOLEAN DEFAULT FALSE  -- conta padrão do ministério
├── gateway_id UUID (null = sem gateway integrado)
└── created_at / updated_at
```

`tesouraria_lancamentos` ganha campo `conta_id UUID REFERENCES fin_contas(id)`.

**Mapeamento do modelo atual para o novo:**
- `congregacao_id = NULL` → conta padrão do ministério (tipo='caixa', is_padrao=TRUE)
- `congregacao_id = X` → conta da congregação X (tipo='caixa', congregacao_id=X)

---

## 5. Categorias Financeiras e Centros de Custo

### Situação atual — Diagnóstico crítico

As categorias estão **hardcoded em CHECK constraints** em cada tabela:

```sql
-- tesouraria_lancamentos
tipo_recebimento IN ('oferta','dizimo','evento','campanha','contribuicao','outros','missoes')

-- ebd_ofertas
destino IN ('tesouraria_local','tesouraria_geral','missoes')

-- missoes_arrecadacoes
forma IN ('oferta','dizimo_especifico','doacao','campanha','outro')
```

**Problemas:**
1. Adicionar uma nova categoria requer migration + ALTER TABLE
2. Cada módulo tem seu próprio vocabulário de categorias — sem padronização
3. Não é possível criar categorias customizadas por ministério
4. Não existe hierarquia (categoria pai / subcategoria)
5. Não existe separação clara entre "tipo de receita" e "categoria contábil"

### Proposta: tabela `fin_categorias`

```sql
fin_categorias
├── id UUID
├── ministry_id UUID (null = categorias padrão do sistema)
├── nome VARCHAR(100)
├── tipo_movimento VARCHAR(10)  -- 'entrada' | 'saida' | 'ambos'
├── codigo VARCHAR(20)          -- ex: '1.1', '1.2.3' (para plano de contas)
├── categoria_pai_id UUID REFERENCES fin_categorias(id) (hierarquia)
├── cor VARCHAR(7)              -- hex para UI
├── icone VARCHAR(50)
├── is_sistema BOOLEAN          -- categorias do sistema que não podem ser excluídas
├── is_ativa BOOLEAN DEFAULT TRUE
├── modulo_origem VARCHAR(30)   -- 'tesouraria' | 'ebd' | 'missoes' | 'eventos' | null
└── created_at
```

**Categorias padrão do sistema (pré-seeded, `ministry_id = NULL`):**

Entradas: Dízimo, Oferta Geral, Oferta de Missões, Oferta EBD, Evento, Campanha, Doação, Contribuição, Outros

Saídas: Aluguel, Água/Luz/Internet, Material, Pessoal/Salários, Manutenção, Missões (repasse), Eventos (despesa), Cursos, Dízimo enviado ao campo, Outros

Cada ministério pode criar subcategorias a partir das categorias do sistema.

`tesouraria_lancamentos` ganha campo `categoria_id UUID REFERENCES fin_categorias(id)`.

---

## 6. Integração ASAAS/EFI: uma vez, reutilizável em todos os módulos

### Arquitetura proposta: camada de abstração `ministry-gateway-client`

```
┌─────────────────────────────────────────────────────────────────┐
│           src/lib/ministry-gateway-client.ts                    │
│                                                                 │
│  createCharge(ministryId, chargeData) → ChargeResult           │
│  cancelCharge(ministryId, transactionId) → void                │
│  getChargeStatus(ministryId, transactionId) → StatusResult     │
│  refundCharge(ministryId, transactionId) → void                │
└──────────────┬────────────────────────────────┬────────────────┘
               │                                │
        ┌──────▼───────┐              ┌─────────▼──────┐
        │  asaas.ts    │              │   efi.ts        │
        │  (existente) │              │   (futuro)      │
        │  adaptado    │              │                 │
        └──────────────┘              └─────────────────┘
```

`createCharge` recebe:

```typescript
{
  ministryId: string,
  origemTipo: 'tesouraria' | 'evento' | 'dizimo' | 'missoes' | 'ebd',
  origemId: string,       // UUID do registro de origem
  amount: number,
  dueDate: string,
  description: string,
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED',
  payer: { name, email, cpfCnpj, phone }
}
```

O cliente:
1. Busca o gateway ativo em `ministry_payment_gateways`
2. Descriptografa credenciais
3. Chama o gateway correto (ASAAS ou EFI)
4. Salva resultado em `ministry_transactions`
5. Atualiza o registro de origem (`eventos_inscricoes.transaction_id`, etc.)
6. Retorna `{ transactionId, pixQrCode, boletoUrl, invoiceUrl }`

**Reutilização por módulo:**

| Módulo | Tipo de cobrança | `origemTipo` |
|---|---|---|
| Tesouraria | Lançamento gerado | `'tesouraria'` |
| Eventos | Inscrição paga | `'evento'` |
| Dízimos | Cobrança mensal ao dizimista | `'dizimo'` |
| Missões | Campanha com meta | `'missoes'` |
| EBD | Oferta por link PIX | `'ebd'` |
| Loja (futuro) | Produto | `'loja'` |
| Cursos (futuro) | Matrícula | `'curso'` |

---

## 7. Fluxo Ideal de uma Cobrança

```
1. CRIAÇÃO
   ↓
   Módulo cria registro de origem
   (ex: eventos_inscricoes com status='lista_espera')
   ↓
   API Route: POST /api/v1/ministry/transactions
   Valida: gateway ativo? ministério configurado? valor > 0?

2. TRANSAÇÃO
   ↓
   Cria ministry_transactions {status='pending', origem_tipo, origem_id}
   ↓
   ministry-gateway-client.createCharge(...)
   ↓
   Se erro → ministry_transactions.status='error', last_error preenchido
   Se sucesso → ministry_transactions.gateway_transaction_id preenchido

3. ENVIO AO GATEWAY
   ↓
   ASAAS/EFI retorna: pix_qr_code | boleto_url | invoice_url
   ↓
   ministry_transactions.{pix_qr_code, invoice_url, bank_slip_url} preenchidos
   ↓
   Frontend exibe QR Code ou link ao pagador

4. WEBHOOK (assíncrono)
   ↓
   Gateway → POST /api/v1/ministry-webhook/{gateway}/{token}
   ↓
   Lookup: webhook_token → ministry_payment_gateways → ministry_id
   ↓
   Verifica event_id em ministry_webhook_events (idempotência)
   ↓
   Atualiza ministry_transactions.status = 'paid'
   ↓
   Chama fn_conciliar_pagamento(transaction_id)

5. CONCILIAÇÃO
   ↓
   fn_conciliar_pagamento:
     INSERT INTO tesouraria_lancamentos (
       ministry_id, conta_id, categoria_id, valor, data_lancamento,
       tipo_movimento='entrada', forma_pagamento='pix_gateway',
       origem_modulo='gateway',
       origem_id=ministry_transactions.id
     )
   ↓
   ministry_transactions.lancamento_id = novo lançamento
   ↓
   Atualiza registro de origem (evento: inscricao.status='confirmado')

6. LANÇAMENTO NA TESOURARIA
   ↓
   tesouraria_lancamentos com origem_modulo='gateway'
   badge "Pago via PIX ✅" visível na Tesouraria
   ↓
   Fechamento mensal inclui este lançamento normalmente

7. RECIBO/COMPROVANTE
   ↓
   PDF gerado via API com:
   - Dados do pagador
   - Valor, data, método
   - Código da transação (gateway_transaction_id)
   - Logo e dados do ministério
   - QR Code de verificação (futuro)
```

---

## 8. Fluxo Ideal de um Evento Pago

```
Evento criado com:
  aceita_inscricao = TRUE
  valor_inscricao = 50.00

Participante abre formulário de inscrição
  ↓
  Preenche nome/email/telefone (membro ou externo)
  ↓
  Sistema verifica: gateway ativo no ministério?
    NÃO → inscrição direta com status='confirmado' (presencial, sem cobrança digital)
    SIM → exibe opções: PIX | Boleto | Cartão
  ↓
  Participante escolhe PIX
  ↓
  API cria:
    eventos_inscricoes { status='lista_espera', transaction_id=null }
    ministry_transactions { status='pending', origem_tipo='evento', origem_id=inscricao.id }
  ↓
  Gateway gera QR Code PIX
  ↓
  Tela exibe QR + "Aguardando pagamento..."

  Participante paga → Webhook chega
  ↓
  eventos_inscricoes.status = 'confirmado'
  ministry_transactions.status = 'paid'
  tesouraria_lancamentos INSERT (categoria='Evento', conta=padrão)
  ↓
  E-mail de confirmação enviado (Resend)
  ↓
  Check-in: presente=TRUE bloqueado até status='confirmado'
  ↓
  Relatório de presença mostra "Confirmado (pago via PIX)"

  Se timeout (48h sem pagamento):
  ↓
  ministry_transactions.status = 'expired'
  eventos_inscricoes.status = 'cancelado'
```

---

## 9. Fluxo Ideal de Oferta/Dízimo via PIX

```
Opção A — PIX Estático (simples, sem gateway)
  ↓
  Configurações → Financeiro → chave_pix = "12.345.678/0001-90"
  ↓
  Tesouraria mostra QR Code estático gerado com a chave PIX
  ↓
  Confirmação: MANUAL pelo tesoureiro (clica "Confirmar Pagamento")
  ↓
  INSERT tesouraria_lancamentos { forma_pagamento='pix_manual', tipo='dizimo' }
  ↓
  Atualiza dizimistas_pagamentos { status='pago' }  ← via trigger

Opção B — PIX Dinâmico via Gateway (Fase 5)
  ↓
  Tesoureiro gera link de dízimo para um membro específico
  ↓
  API cria ministry_transactions { origem_tipo='dizimo', origem_id=membro.id }
  ↓
  Gateway gera QR Code dinâmico (valor específico + identificação do membro)
  ↓
  Link enviado por WhatsApp ao dizimista
  ↓
  Webhook confirma → dizimistas_pagamentos atualizado + tesouraria_lancamentos
  ↓
  Relatório de dizimistas atualizado automaticamente

Opção C — PIX Online (público, formulário sem login)
  ↓
  Ministério gera link público: /doacoes/{ministry_slug}
  ↓
  Visitante entra, informa nome + valor + tipo (oferta/dízimo/campanha)
  ↓
  Sistema usa gateway do ministério → gera QR PIX
  ↓
  Webhook confirma → INSERT tesouraria_lancamentos
  ↓
  Recibo enviado por e-mail ao doador
```

---

## 10. Fluxo Ideal de Campanha Missionária com Meta

```
Criação da campanha:
  missoes_projetos {
    nome: "Missões África 2026",
    meta_arrecadacao: 15000.00,
    data_inicio: ...,
    data_fim: ...
  }
  Optionally: link público /campanhas/{ministry_slug}/{projeto_id}

Arrecadações entram por múltiplos canais:
  A) Manual no módulo Missões:
     INSERT missoes_arrecadacoes
     → INSERT tesouraria_lancamentos (vinculado)

  B) PIX estático da campanha:
     Chave PIX configurada → QR gerado
     Confirmação manual → INSERT ambas tabelas

  C) PIX Dinâmico via Gateway:
     API → ministry_transactions { origem_tipo='missoes', origem_id=projeto_id }
     Webhook → INSERT missoes_arrecadacoes + tesouraria_lancamentos

Progresso da meta:
  SELECT SUM(valor) FROM missoes_arrecadacoes WHERE projeto_id = X
  Barra de progresso: 9.200 / 15.000 (61%)

Relatório:
  Arrecadações por forma (dinheiro, pix, cartão, transferência)
  Arrecadações por congregação
  Evolução temporal (semana/mês)
  Exportação CSV/PDF

Encerramento da campanha:
  projeto.status = 'concluido'
  Lançamento de repasse para o campo (SAÍDA na Tesouraria, tipo='missoes_saida')
```

---

## 11. Como Evitar Duplicidade Entre Tabelas

### Diagnóstico do estado atual

| Tabela | Contém valores financeiros | Source of Truth | Problema |
|---|---|---|---|
| `tesouraria_lancamentos` | ✅ | **Deveria ser** | ⚠️ Nem todos os módulos vinculam |
| `dizimistas_pagamentos` | ✅ | ❌ Duplica | ❌ Sem FK para `tesouraria_lancamentos` |
| `missoes_arrecadacoes` | ✅ | ❌ Duplica | ✅ Tem `tesouraria_lancamento_id` |
| `ebd_ofertas` | ✅ | ❌ Duplica | ⚠️ Tem FK mas UI não cria o lançamento |
| `eventos_inscricoes` | `valor_inscricao` no evento | ❌ Sem lançamento | ❌ Sem link financeiro |
| `payments` | ✅ | Plataforma | OK — contexto diferente |

### Regras anti-duplicidade

**Regra 1 — Unicidade por origem:**

`tesouraria_lancamentos` deve ter campos:

```sql
origem_modulo VARCHAR(30)   -- 'manual' | 'missoes' | 'ebd' | 'evento' | 'dizimo' | 'gateway'
origem_id UUID              -- ID do registro de origem
UNIQUE (ministry_id, origem_modulo, origem_id) WHERE origem_modulo IS NOT NULL
```

Um mesmo `missoes_arrecadacao.id` nunca pode gerar dois lançamentos.

**Regra 2 — Dizimistas sincronizados via trigger:**

Quando `tesouraria_lancamentos` INSERT com `tipo_recebimento = 'dizimo'` e `member_id IS NOT NULL`:

```sql
-- Trigger automático:
INSERT INTO dizimistas_pagamentos (ministry_id, member_id, mes_referencia, status, valor, data_pagamento)
VALUES (NEW.ministry_id, NEW.member_id, to_char(NEW.data_lancamento, 'YYYY-MM'), 'pago', NEW.valor, NEW.data_lancamento)
ON CONFLICT (ministry_id, member_id, mes_referencia) DO UPDATE SET status='pago', valor=EXCLUDED.valor;
```

Elimina a sincronização manual no código TypeScript.

**Regra 3 — EBD integrada automaticamente:**

`ebd_ofertas` deve ter trigger de INSERT que cria `tesouraria_lancamentos` automaticamente (como já acontece com Missões via código, deve virar trigger no banco).

**Regra 4 — `ministry_transactions` não é duplicata:**

`ministry_transactions` é a **cobrança pendente** (antes do pagamento). `tesouraria_lancamentos` é o **lançamento contábil** (após confirmação). São registros de fases distintas do mesmo fluxo, não duplicatas.

---

## 12. Source of Truth por Operação

| Operação | Source of Truth | Motivo |
|---|---|---|
| **Cobrança pendente** | `ministry_transactions` | Tem status do gateway, QR Code, datas de expiração |
| **Pagamento confirmado** | `ministry_transactions.status = 'paid'` | Reflete o gateway; `tesouraria_lancamentos` é a consequência |
| **Lançamento contábil** | `tesouraria_lancamentos` | Imutável após fechamento mensal; base para relatórios financeiros |
| **Conciliação** | `tesouraria_lancamentos.origem_id` + `ministry_transactions.lancamento_id` | Relação bidirecional — ambas apontam uma para outra |
| **Estorno/cancelamento** | `ministry_transactions.status = 'refunded'` | Deve gerar lançamento NEGATIVO em `tesouraria_lancamentos` (não deletar o original) |
| **Dízimo mensal** | `dizimistas_pagamentos` (status consolidado) | `tesouraria_lancamentos` tem os valores; `dizimistas_pagamentos` tem o status "pago/pendente" |
| **Meta de campanha** | `missoes_projetos.meta_arrecadacao` vs `SUM(missoes_arrecadacoes.valor)` | Calculado dinamicamente |
| **Saldo atual** | `tesouraria_fechamentos.saldo_final` + soma dos lançamentos do mês corrente | Não armazenar saldo calculado — derivar sempre |

---

## 13. Segurança

### Credenciais criptografadas

- `pgcrypto` já está habilitado (`pgp_sym_encrypt`/`pgp_sym_decrypt`)
- `CREDENTIALS_ENCRYPTION_KEY` deve ser um segredo de 32+ chars no Vercel Secrets
- Campo `encrypted_credentials BYTEA` — nunca exposto ao frontend
- Frontend recebe apenas `{ hasApiKey: true, masked: "$aac****...4321" }`
- Sem botão "revelar" na UI — por design arquitetural

### Webhooks falsos

- URL por `webhook_token` único (UUID) — não adivinhável
- Verificação adicional: header `asaas-access-token` ou HMAC-SHA256
- Idempotência via `event_id UNIQUE` em `ministry_webhook_events`
- Processamento atômico: `BEGIN; UPDATE + INSERT; COMMIT;` para evitar estado parcial

### Duplicidade de pagamento

- `event_id UNIQUE` no log de webhooks bloqueia reprocessamento
- Verificar `ministry_transactions.status` antes de processar: se já `'paid'`, retornar 200 sem processar novamente

### Vazamento cross-tenant

- RLS em todas as tabelas financeiras via `ministry_id`
- `ministry_payment_gateways`: SELECT restrito a `ADMINISTRADOR` ou gerente do ministério
- `encrypted_credentials`: nunca retornada em queries — usar View sem a coluna ou RPC
- `ministry_transactions`: `ministry_id` sempre derivado do `gateway_id` no webhook, **nunca do payload**
- Trigger `fn_bloquear_periodo_fechado` já usa `SECURITY DEFINER` para blindagem

### RLS por perfil financeiro

| Permissão | Escopo | Acesso |
|---|---|---|
| `ADMINISTRADOR` | Todo ministério | CRUD completo em todos os lançamentos |
| `FINANCEIRO` | Todo ministério | CRUD em todos os lançamentos |
| `FINANCEIRO_LOCAL` | Apenas `congregacao_id` própria | CRUD apenas nos lançamentos da sua congregação |
| Sem permissão financeira | — | Sem acesso a nenhuma tabela financeira |

**Lacuna atual:** `FINANCEIRO_LOCAL` não tem escopo em `fin_contas` ou `ministry_payment_gateways` — deve ser apenas leitura, sem acesso a credenciais.

### Logs de auditoria

`audit_logs` já existe no sistema. Adicionar entradas para:
- Qualquer CRUD em `ministry_payment_gateways` (quem configurou/alterou credenciais)
- INSERT em `ministry_transactions` (quem criou a cobrança)
- Processamento de webhook (IP, event_id, resultado)
- Fechamento de período (`tesouraria_fechamentos.status = 'fechado'`)

### LGPD

| Dado sensível | Tabela | Tratamento |
|---|---|---|
| CPF/CNPJ do pagador | `ministry_transactions.payer_cpf_cnpj` | Considerar hash ou enviar direto ao gateway sem armazenar |
| Certificado EFI (chave privada) | `encrypted_credentials` | Apenas `pgp_sym_encrypt` — nunca plain text |
| Dados do webhook (nomes, CPFs) | `ministry_webhook_events.payload` | Dado sensível — acesso restrito a `ADMINISTRADOR` |
| `asaas_response JSONB` em `payments` | `payments` | Verificar se contém dados pessoais; mascarar se necessário |
| Política de retenção | Todas as tabelas financeiras | 5 anos (padrão BR para registros contábeis) |

---

## 14. Arquitetura para Múltiplos Gateways e Meios de Pagamento

### Abstração gateway

```typescript
// Interface genérica — qualquer gateway implementa
interface GatewayClient {
  createCharge(data: ChargeInput): Promise<ChargeOutput>
  cancelCharge(id: string): Promise<void>
  getStatus(id: string): Promise<ChargeStatus>
  refundCharge(id: string, amount?: number): Promise<void>
  processWebhook(payload: unknown, token: string): Promise<WebhookResult>
}

// Implementações
class AsaasClient implements GatewayClient { ... }
class EfiClient implements GatewayClient { ... }  // futuro
class PagarmeClient implements GatewayClient { ... }  // futuro
```

`ministry-gateway-client.ts` faz o dispatch:

```typescript
const client = gateway === 'asaas' ? new AsaasClient(creds) : new EfiClient(creds)
```

### Meios de pagamento — mapa completo

| Meio | Tipo | Gateway | Confirmação | Implementação |
|---|---|---|---|---|
| PIX Dinâmico | Online | ASAAS/EFI | Automática (webhook) | Fase 2+ |
| Boleto | Online | ASAAS/EFI | Automática (webhook) | Fase 2+ |
| Cartão de Crédito | Online | ASAAS/EFI | Automática (webhook) | Fase 2+ |
| PIX Manual (paste) | Offline | Nenhum | Manual pelo tesoureiro | ✅ Já existe |
| Dinheiro | Offline | Nenhum | Manual | ✅ Já existe |
| Transferência | Offline | Nenhum | Manual | ✅ Já existe |
| Cheque | Offline | Nenhum | Manual | ✅ Já existe |
| Cartão (maquininha) | Offline | Nenhum | Manual | ✅ Já existe |

`tesouraria_lancamentos.forma_pagamento` deve distinguir PIX manual de PIX gateway:

```sql
CHECK (forma_pagamento IN (
  -- Offline (manual)
  'dinheiro', 'pix_manual', 'transferencia', 'cheque', 'cartao_maquininha',
  -- Online (gateway)
  'pix_gateway', 'boleto', 'cartao_online', 'link_pagamento'
))
```

---

## 15. Migrations Necessárias no Futuro

### Tabelas a criar

```
Fase 1:  ministry_payment_gateways
         fin_contas
         fin_categorias

Fase 3:  ministry_transactions
         ministry_webhook_events

Fase 5:  dizimo_links (links públicos de dízimo por membro)

Fase 6:  campanha_links (links públicos de campanha)

Fase 7:  loja_produtos, loja_pedidos
         cursos, cursos_matriculas
```

### Campos a adicionar em tabelas existentes

```sql
-- tesouraria_lancamentos
ADD COLUMN conta_id       UUID REFERENCES fin_contas(id) ON DELETE SET NULL;
ADD COLUMN categoria_id   UUID REFERENCES fin_categorias(id) ON DELETE SET NULL;
ADD COLUMN origem_modulo  VARCHAR(30)
  CHECK (origem_modulo IN ('manual','missoes','ebd','evento','dizimo','gateway','loja','curso'));
ADD COLUMN origem_id      UUID;
ADD COLUMN transaction_id UUID REFERENCES ministry_transactions(id) ON DELETE SET NULL;
-- índice único: mesmo registro de origem não gera dois lançamentos
CREATE UNIQUE INDEX uq_tesouraria_origem
  ON tesouraria_lancamentos (ministry_id, origem_modulo, origem_id)
  WHERE origem_modulo IS NOT NULL;

-- Atualizar CHECK de forma_pagamento para incluir 'pix_manual', 'pix_gateway', 'boleto', 'cartao_online'

-- dizimistas_pagamentos
ADD COLUMN tesouraria_lancamento_id UUID REFERENCES tesouraria_lancamentos(id) ON DELETE SET NULL;

-- eventos_inscricoes
ADD COLUMN transaction_id    UUID REFERENCES ministry_transactions(id) ON DELETE SET NULL;
ADD COLUMN payment_required  BOOLEAN NOT NULL DEFAULT FALSE;

-- missoes_arrecadacoes
ADD COLUMN forma_pagamento VARCHAR(30) DEFAULT 'dinheiro';

-- missoes_projetos
ADD COLUMN conta_destino_id UUID REFERENCES fin_contas(id) ON DELETE SET NULL;
```

### Triggers a criar

```sql
-- Ao confirmar pagamento → INSERT automático em tesouraria_lancamentos
CREATE TRIGGER trg_conciliar_pagamento
  AFTER UPDATE OF status ON ministry_transactions
  FOR EACH ROW
  WHEN (NEW.status = 'paid' AND OLD.status != 'paid')
  EXECUTE FUNCTION fn_conciliar_pagamento();

-- Ao lançar dízimo em tesouraria → upsert em dizimistas_pagamentos
CREATE TRIGGER trg_sync_dizimista
  AFTER INSERT OR UPDATE ON tesouraria_lancamentos
  FOR EACH ROW
  WHEN (NEW.tipo_recebimento = 'dizimo' AND NEW.member_id IS NOT NULL AND NEW.tipo_movimento = 'entrada')
  EXECUTE FUNCTION fn_sync_dizimista();

-- Ao excluir lançamento de dízimo → reabrir dizimistas_pagamentos
CREATE TRIGGER trg_unsync_dizimista
  AFTER DELETE ON tesouraria_lancamentos
  FOR EACH ROW
  WHEN (OLD.tipo_recebimento = 'dizimo' AND OLD.member_id IS NOT NULL)
  EXECUTE FUNCTION fn_unsync_dizimista();
```

---

## 16. Arquivos a Criar ou Alterar

### Novos arquivos

| Arquivo | Fase | Propósito |
|---|---|---|
| `supabase/migrations/..._fin_fundacao.sql` | 1 | `fin_contas`, `fin_categorias`, seed de categorias padrão |
| `supabase/migrations/..._ministry_gateways.sql` | 1 | `ministry_payment_gateways` + RLS |
| `supabase/migrations/..._tesouraria_campos_fundacao.sql` | 1 | `conta_id`, `categoria_id`, `origem_modulo`, `origem_id` em `tesouraria_lancamentos` |
| `supabase/migrations/..._ministry_transactions.sql` | 3 | `ministry_transactions`, `ministry_webhook_events` |
| `supabase/migrations/..._triggers_conciliacao.sql` | 3–4 | Triggers de conciliação e sync |
| `src/lib/ministry-credentials.ts` | 1 | encrypt / decrypt / mask credentials |
| `src/lib/ministry-gateway-client.ts` | 3 | Dispatcher multi-gateway |
| `src/lib/efi-client.ts` | 6 | Wrapper EFI (OAuth + mTLS) |
| `src/app/api/v1/ministry/gateway/route.ts` | 1 | CRUD configuração gateway |
| `src/app/api/v1/ministry/gateway/test/route.ts` | 2 | Teste de conexão com gateway |
| `src/app/api/v1/ministry/transactions/route.ts` | 3 | Criar cobranças |
| `src/app/api/v1/ministry-webhook/asaas/[token]/route.ts` | 4 | Webhook ASAAS multi-tenant |
| `src/app/api/v1/ministry-webhook/efi/[token]/route.ts` | 6 | Webhook EFI multi-tenant |

### Arquivos a alterar

| Arquivo | Fase | O Que Muda |
|---|---|---|
| `src/app/configuracoes/page.tsx` | 1 | Nova aba "Gateways de Pagamento" |
| `src/app/tesouraria/page.tsx` | 1 | Filtro por `conta_id` e `categoria_id`; seletor de conta ao lançar |
| `src/app/tesouraria/page.tsx` | 3 | Botão "Cobrar via Gateway" |
| `src/app/missoes/page.tsx` | 1 | Campo `conta_destino_id` nos projetos |
| `src/app/eventos/page.tsx` | 5 | QR Code / link ao criar inscrição paga |
| `src/app/ebd/ofertas/page.tsx` | 1 | Trigger DB substitui sincronização manual ausente |
| `src/app/financeiro/page.tsx` | 1 | **Implementar** — hoje é placeholder com R$ 0,00 |
| `.env.local` / Vercel Secrets | 1 | `CREDENTIALS_ENCRYPTION_KEY` |

---

## 17. Plano de Implementação em 7 Fases

### Fase 1 — Fundação Financeira

**Objetivo:** estrutura base da qual todos os módulos dependem

- Migration: `fin_contas` + seed (Caixa Geral padrão criado automaticamente ao ativar ministério)
- Migration: `fin_categorias` + seed de categorias padrão do sistema
- Migration: campos em `tesouraria_lancamentos` (`conta_id`, `categoria_id`, `origem_modulo`, `origem_id`)
- Migration: `ministry_payment_gateways` + RLS
- `src/lib/ministry-credentials.ts`
- API Routes: CRUD contas, categorias, configuração gateway
- UI: aba "Gateways" em Configurações
- UI: seletor de conta e categoria na Tesouraria (opcionais, compatíveis com dados históricos)
- UI: implementar `financeiro/page.tsx` como dashboard consolidado
- Trigger: sincronização `dizimistas_pagamentos` ↔ `tesouraria_lancamentos`

**Resultado:** plano de contas, categorias configuráveis, estrutura pronta para gateways.

---

### Fase 2 — Gateways por Ministério

**Objetivo:** ministério cadastra e testa suas credenciais

- API Route: teste de conexão com gateway
- UI: modal configuração ASAAS (API key, ambiente sandbox/prod, webhook URL)
- `webhook_token` gerado automaticamente na configuração
- Status de conexão exibido: `last_test_at`, latência, `last_error`
- Badge vermelho "PRODUÇÃO" ao ativar ambiente real (confirmação dupla)

**Resultado:** ministério tem sua conta ASAAS conectada; ainda sem cobranças ativas.

---

### Fase 3 — Cobrança Manual na Tesouraria

**Objetivo:** tesoureiro gera cobrança PIX/boleto diretamente na Tesouraria

- Migration: `ministry_transactions` + `ministry_webhook_events`
- `src/lib/ministry-gateway-client.ts`
- API Route: `POST /api/v1/ministry/transactions`
- Webhook ASAAS multi-tenant (`/api/v1/ministry-webhook/asaas/[token]`)
- Trigger de conciliação: webhook → lançamento automático
- UI: botão "Cobrar via PIX" em lançamentos

**Resultado:** primeiro fluxo end-to-end: cobrança → QR PIX → webhook → lançamento na Tesouraria.

---

### Fase 4 — Eventos Pagos

**Objetivo:** inscrição em eventos com cobrança integrada

- Migration: `eventos_inscricoes.transaction_id` + `payment_required`
- UI: exibir QR Code ao se inscrever em evento pago
- Check-in: bloqueio para inscrições não pagas
- Recibo de inscrição paga (PDF ou e-mail)
- Timeout de inscrição: 48h sem pagamento → status='cancelado'

**Resultado:** evento pago funciona end-to-end.

---

### Fase 5 — Dízimos e Ofertas Online

**Objetivo:** dizimistas pagam via link/PIX sem ir à igreja

- Migration: `dizimo_links` (token público por membro)
- Página pública `/doacoes/{ministry_slug}` (sem autenticação)
- Geração de link individual por membro para pagamento do dízimo mensal
- Webhook → `dizimistas_pagamentos` atualizado automaticamente

**Resultado:** tesoureiro envia link de dízimo via WhatsApp; confirmação automática.

---

### Fase 6 — Missões e Campanhas

**Objetivo:** campanhas missionárias com meta e link público de arrecadação

- Página pública `/campanhas/{ministry_slug}/{projeto_slug}`
- Doações via PIX/boleto para o projeto específico
- Relatório de progresso em tempo real (barra de meta)
- Integração: doação → `missoes_arrecadacoes` + `tesouraria_lancamentos`
- Opcional: integração EFI (`src/lib/efi-client.ts`)

**Resultado:** link de campanha compartilhável; arrecadação automática com conciliação.

---

### Fase 7 — Loja e Cursos

**Objetivo:** monetização de conteúdo e produtos

- `loja_produtos`: itens à venda (livros, materiais, camisetas)
- `loja_pedidos`: pedidos com status de pagamento
- `cursos`: cursos online com acesso liberado após pagamento
- `cursos_matriculas`: matrícula vinculada à transação paga
- Todos integrados ao mesmo `ministry-gateway-client`

**Resultado:** ministério tem e-commerce básico integrado ao gateway e à Tesouraria.

---

## 18. Riscos Técnicos e Decisões Críticas

### Riscos

| Risco | Severidade | Causa | Mitigação |
|---|---|---|---|
| Perda da `CREDENTIALS_ENCRYPTION_KEY` | Crítico | Chave do Vercel apagada por acidente | Backup em cofre seguro; rotacionar anualmente; manter cópia offline |
| `tesouraria_lancamentos` sem `conta_id` em produção | Alto | Migration sem DEFAULT adequado | Migration adiciona nullable; seed cria conta padrão obrigatoriamente |
| Dizimistas dessincronizados | Alto | Dois caminhos independentes escrevem nos mesmos dados | Implementar trigger DB antes de Fase 5; remover lógica TypeScript duplicada |
| `ebd_ofertas` não cria lançamento | Médio | UI não implementou integração apesar do FK existir | Confirmar se o campo `lancamento_tesouraria_id` fica sempre NULL em produção; criar trigger corretivo |
| Fechamento mensal bloqueia outros módulos | Alto | Trigger `fn_bloquear_periodo_fechado` afeta INSERT de Missões/EBD | Trigger já é baseado em `data_lancamento` — testar todos os módulos após implementar Fase 1 |
| Webhook processa duas vezes (retry) | Alto | Gateway reenvia em caso de timeout | `event_id UNIQUE` em `ministry_webhook_events` mitiga — implementar antes de Fase 3 |
| Troca sandbox → produção com cobranças reais | Crítico | Erro do administrador | UI com confirmação dupla + badge vermelho permanente "PRODUÇÃO" + bloquear troca com transações pendentes |
| Saldo negativo em conta | Médio | Saídas sem validação de saldo | Opcional: validação de saldo antes de INSERT de saída (configurável por ministério) |

### Decisões críticas antes da Fase 1

**Decisão 1: `fin_contas` obrigatória ou opcional?**
> Recomendação: nullable — compatível com dados históricos; obrigatória apenas para lançamentos via gateway.

**Decisão 2: categorias do sistema são imutáveis?**
> Recomendação: categorias `is_sistema = TRUE` são somente leitura; ministério cria subcategorias sob elas.

**Decisão 3: o que fazer com lançamentos históricos sem `origem_modulo`?**
> Recomendação: `origem_modulo = 'manual'` para todos os lançamentos existentes; não reprocessar.

**Decisão 4: trigger de conciliação vs. lógica no código?**
> Recomendação: trigger DB para dizimistas (alta criticidade, múltiplos pontos de entrada); código TypeScript para conciliação de gateway (mais controle, logging, rollback explícito).

**Decisão 5: `financeiro/page.tsx` — módulo separado ou unificar com Tesouraria?**
> Hoje é um placeholder (R$ 0,00 em todos os cards).  
> Recomendação: `financeiro` vira dashboard consolidado (visão cross-módulo); `tesouraria` permanece o registro operacional de lançamentos.

---

## 19. Recomendação Final

### Primeira implementação real: **Fase 1 — Fundação Financeira**

**Por que não começar pelos gateways:**

| Se pular Fase 1... | Consequência |
|---|---|
| Gateways sem `fin_contas` | Todas as transações vão para "Caixa Geral" — sem distinção de conta |
| Gateways sem `fin_categorias` | Lançamentos automáticos sem categoria — relatórios inúteis |
| Sem `origem_modulo` em `tesouraria_lancamentos` | Impossível saber qual módulo gerou qual lançamento |
| Sem trigger de dizimistas | Bugs de sincronização continuam a cada lançamento manual |

**Sequência exata para Fase 1:**

1. Migration: `fin_categorias` + seed das categorias padrão
2. Migration: campos `categoria_id`, `origem_modulo`, `origem_id`, `conta_id` em `tesouraria_lancamentos`
3. Migration: `fin_contas` + function de seed da conta padrão por ministério
4. Migration: `ministry_payment_gateways` + RLS
5. Migration: trigger `trg_sync_dizimista` ↔ `tesouraria_lancamentos`
6. UI: seletor de categoria e conta na Tesouraria (opcionais — compatível com histórico)
7. UI: aba "Gateways" em Configurações
8. UI: implementar `financeiro/page.tsx` como dashboard consolidado

**Resultado imediato:**
- Tesouraria com plano de contas configurável
- Categorias personalizadas por ministério
- Múltiplas contas (Caixa, Banco, Fundo de Missões)
- Dízimos sincronizados automaticamente ao lançar na Tesouraria
- Estrutura pronta para receber gateways na Fase 2
- `financeiro/page.tsx` deixa de ser placeholder
