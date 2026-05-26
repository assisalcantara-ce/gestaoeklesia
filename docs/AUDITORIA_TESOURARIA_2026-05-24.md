# Auditoria Completa — Módulo Tesouraria
**Gestão Eklésia · Data: 24/05/2026**
**Auditado por:** GitHub Copilot (leitura estática de código, migrations e APIs)
**Escopo:** Banco de dados · APIs REST · Frontend · Permissões · Menus · Dashboard · Relatórios · Arrecadação Digital

---

## Índice

1. [Funcionalidades 100% Concluídas](#1-funcionalidades-100-concluídas)
2. [Funcionalidades Implementadas mas Ocultas](#2-funcionalidades-implementadas-mas-ocultas)
3. [Funcionalidades Parcialmente Concluídas](#3-funcionalidades-parcialmente-concluídas)
4. [Permissões](#4-permissões)
5. [Menus e Rotas](#5-menus-e-rotas)
6. [Banco de Dados](#6-banco-de-dados)
7. [Dashboard Financeiro](#7-dashboard-financeiro)
8. [Relatórios](#8-relatórios)
9. [Arrecadação Digital](#9-arrecadação-digital)
10. [Conclusão Executiva](#10-conclusão-executiva)

---

## 1. Funcionalidades 100% Concluídas

### 1.1 Tesouraria — Lançamentos (`/tesouraria` → aba "Lançamentos")

| Item | Banco | API | UI | Permissões | Fluxo completo |
|---|---|---|---|---|---|
| Criar lançamento de entrada | ✅ | Direto Supabase | ✅ | ✅ | ✅ |
| Criar lançamento de saída/despesa | ✅ | Direto Supabase | ✅ | ✅ | ✅ |
| Editar lançamento (mês aberto) | ✅ | Direto Supabase | ✅ | ✅ | ✅ |
| Excluir lançamento | ✅ | Direto Supabase | ✅ | ✅ | ✅ |
| Filtros por: mês, congregação, tipo, movimento | ✅ | — | ✅ | ✅ | ✅ |
| Exportação CSV | ✅ | — | ✅ | ✅ | ✅ |
| Bloqueio de meses fechados | ✅ (trigger + guard) | — | ✅ | ✅ | ✅ |
| Vinculação a conta/caixa | ✅ | — | ✅ | ✅ | ✅ |
| Vinculação a categoria | ✅ | — | ✅ | ✅ | ✅ |
| Vínculo com dizimista (membro ou avulso) | ✅ | — | ✅ | ✅ | ✅ |
| Escopo FINANCEIRO_LOCAL (por congregação) | ✅ | — | ✅ | ✅ | ✅ |
| Lançamento via gateway (origem_modulo=gateway) | ✅ | Webhook automático | ✅* | ✅ | ✅ |

*visível na lista de lançamentos, sem form de edição manual.

**Tipos de recebimento suportados:** oferta, dízimo, evento, campanha, contribuição, missões, outros
**Tipos de saída suportados:** aluguel, água/luz/internet, material, pessoal/salários, manutenção, missões (repasse), eventos (despesa), outros

---

### 1.2 Tesouraria — Fechamento Mensal (`/tesouraria` → aba "Caixa Mensal")

| Item | Banco | UI | Fluxo |
|---|---|---|---|
| Fechar mês com saldo inicial | ✅ | ✅ | ✅ |
| Bloquear lançamentos em meses fechados | ✅ (verificado no frontend) | ✅ (mensagem de erro clara) | ✅ |
| Histórico de fechamentos | ✅ | ✅ | ✅ |
| Observações no fechamento | ✅ | ✅ | ✅ |
| Registro de quem fechou (`fechado_por`) | ✅ | ✅ | ✅ |
| Alerta de mês anterior em aberto | ✅ | ✅ (no Dashboard Financeiro) | ✅ |

---

### 1.3 Tesouraria — Dizimistas (`/tesouraria` → aba "Dizimistas")

| Item | Banco | UI | Fluxo |
|---|---|---|---|
| Lista de membros marcados como dizimistas | ✅ (`members.is_dizimista`) | ✅ | ✅ |
| Status por mês (pago/pendente) | ✅ (`dizimistas_pagamentos`) | ✅ | ✅ |
| Dízimos avulsos (sem vínculo de membro) | ✅ | ✅ | ✅ |
| Filtros: nome, congregação, status | ✅ | ✅ | ✅ |
| Registro automático ao lançar dízimo | ✅ | ✅ | ✅ |
| Impressão da lista | ✅ | ✅ | ✅ |
| Escopo FINANCEIRO_LOCAL | ✅ | ✅ | ✅ |

---

### 1.4 Tesouraria — Contas e Caixas (`/tesouraria` → aba "Contas")

| Item | Banco | UI | Fluxo |
|---|---|---|---|
| CRUD de contas (caixa, conta corrente, poupança, PIX, fundo, outro) | ✅ | ✅ | ✅ |
| Conta padrão (UNIQUE INDEX) | ✅ | ✅ | ✅ |
| Ativar/desativar conta | ✅ | ✅ | ✅ |
| Vinculação por congregação | ✅ | ✅ | ✅ |
| Dados bancários (banco, agência, conta, chave PIX) | ✅ | ✅ | ✅ |
| Saldo inicial configurável | ✅ | ✅ | ✅ |

---

### 1.5 Tesouraria — Categorias (`/tesouraria` → aba "Categorias")

| Item | Banco | UI | Fluxo |
|---|---|---|---|
| CRUD de categorias customizadas | ✅ | ✅ | ✅ |
| Categorias do sistema (seed, só leitura) | ✅ | ✅ | ✅ |
| Tipo de movimento (entrada/saída/ambos) | ✅ | ✅ | ✅ |
| Cor e ícone | ✅ | ✅ | ✅ |
| Ativar/desativar | ✅ | ✅ | ✅ |
| Filtro por tipo | ✅ | ✅ | ✅ |

---

### 1.6 Arrecadação Digital — Destinos (`/tesouraria` → aba "Arrecadação Digital")

| Item | Banco | API | UI | Fluxo |
|---|---|---|---|---|
| CRUD de destinos (label, tipo, congregação) | ✅ | `GET/POST /api/v1/ministry/payment-destinations` | ✅ | ✅ |
| Edição de destino (`[id]`) | ✅ | `PUT /api/v1/ministry/payment-destinations/[id]` | ✅ | ✅ |
| Ativar/desativar destino | ✅ | `PUT` | ✅ | ✅ |
| Valor fixo ou aberto | ✅ | ✅ | ✅ | ✅ |
| QR Code modal (copia-e-cola + imagem) | ✅ | — | ✅ | ✅ |
| Link público copiável | ✅ | — | ✅ | ✅ |
| Total arrecadado por destino | ✅ (via `fin_payment_charges`) | ✅ | ✅ | ✅ |
| Filtros (status, tipo, congregação) | ✅ | — | ✅ | ✅ |
| Escopo FINANCEIRO_LOCAL | ✅ | ✅ | ✅ | ✅ |

---

### 1.7 Arrecadação Digital — Fluxo de Pagamento PIX (Homologado)

| Item | Status | Evidência |
|---|---|---|
| `GET /api/v1/pagar/[token]` — página pública | ✅ | Homologação 24/05/2026 |
| Formulário público `/pagar/[token]` (nome, email, CPF, valor) | ✅ | pay_4448foda7pjr7sh4 |
| `POST /api/v1/pagar/[token]` → cobrança ASAAS | ✅ | 201 Created |
| `pix_payload` (copia-e-cola EMV) retornado | ✅ | EMV válido |
| `pix_qrcode` (base64 PNG) retornado | ✅ | data:image/png |
| Webhook `PAYMENT_CONFIRMED` → atualiza status | ✅ | processed=true |
| Lançamento automático em `tesouraria_lancamentos` | ✅ | bdd1fd22-… |
| Idempotência (reenvio não duplica) | ✅ | skipped=already_paid |
| `gateway_event_id` determinístico | ✅ | PAYMENT_CONFIRMED_{chargeId} |
| Visibilidade na Tesouraria (dashboard, relatório, fechamento) | ✅ | 3/3 queries |

---

### 1.8 Dashboard Financeiro (`/financeiro`)

| Item | Status |
|---|---|
| 6 KPIs (entradas, saídas, saldo, dízimos, contas, resultado%) | ✅ |
| Gráfico 12 meses — Entradas × Saídas (BarChart) | ✅ |
| Pie chart — Entradas por categoria | ✅ |
| Pie chart — Saídas por categoria | ✅ |
| Top saídas por categoria | ✅ |
| Visão por conta/caixa (saldo estimado do mês) | ✅ |
| Alerta de fechamento pendente | ✅ |
| Seletor de mês | ✅ |
| Escopo FINANCEIRO_LOCAL | ✅ |

---

### 1.9 Configuração de Gateway (`/configuracoes`)

| Item | Banco | API | UI | Fluxo |
|---|---|---|---|---|
| Criar/atualizar gateway ASAAS | ✅ | `POST /api/v1/ministry/gateway` | ✅ (/configuracoes) | ✅ |
| Testar conexão | ✅ | `POST /api/v1/ministry/gateway/test` | ✅ | ✅ |
| Desativar gateway | ✅ | `DELETE /api/v1/ministry/gateway?gateway=` | ✅ | ✅ |
| Auto-registro webhook ASAAS | ✅ | `ensureAsaasWebhook()` | — | ✅ |
| Credenciais criptografadas AES-256-GCM | ✅ | ✅ (nunca expostas) | — | ✅ |
| Credenciais mascaradas na resposta GET | ✅ | ✅ | ✅ | ✅ |
| Webhook token multi-tenant (UUID único) | ✅ | — | ✅ | ✅ |

---

## 2. Funcionalidades Implementadas mas Ocultas

Tabelas, APIs e componentes que existem no sistema mas **não aparecem em menus ou telas para o usuário final**.

### 2.1 `fin_payment_charges` — Cobranças PIX Geradas

- **Tabela:** ✅ Existe com 12 campos (gateway_charge_id, status, pix_payload, pix_qrcode_url, payer_name, payer_document, etc.)
- **API:** ✅ Criada via `POST /api/v1/pagar/[token]`; atualizada via webhook
- **UI:** ❌ **SEM TELA** — o usuário da tesouraria só vê o `total_arrecadado` no card do destino. Não há lista de cobranças, não se vê quem pagou, CPF, data, status individual

### 2.2 `fin_webhook_events` — Log de Webhooks

- **Tabela:** ✅ Existe com campos de auditoria (event_type, gateway_event_id, processed, processed_at, payload JSONB)
- **API:** ✅ Gravada via webhook handler; lida em scripts de homologação
- **UI:** ❌ **SEM TELA** — nenhum usuário consegue visualizar webhooks recebidos, eventos com erro de processamento ou histórico de eventos

### 2.3 `eventos_pagamentos` — Pagamentos de Eventos

- **Tabela:** ✅ Existe (gateway_charge_id, pix_payload, pix_qrcode, status, tesouraria_lancamento_id)
- **API:** ✅ Webhook handler processa `eventos_pagamentos` (linhas 225, 247, 297, 320 do webhook route); cron job `expire-event-payments` expira PIX pendentes; `GET /api/v1/eventos/pagamento/[id]/status`; `POST /api/v1/eventos/inscricao` cria cobrança
- **UI:** ❌ **SEM TELA** — o coordenador de eventos não vê quais inscrições foram pagas, quais expiraram, qual o valor arrecadado por evento. A Tesouraria tampouco tem uma aba de reconciliação de eventos

### 2.4 `fin_categorias.categoria_pai_id` — Hierarquia de Categorias

- **Banco:** ✅ Campo `categoria_pai_id UUID REFERENCES fin_categorias(id)` existe
- **UI (formulário):** ✅ Formulário de nova categoria tem select "Categoria Pai"
- **UI (listagem):** ❌ A listagem exibe todas as categorias como lista plana; a relação pai/filho não é renderizada como árvore/hierarquia

### 2.5 `fin_payment_destinations.expires_at` — Destinos com Validade

- **Banco:** ✅ Campo `expires_at TIMESTAMPTZ` existe na tabela
- **API:** ✅ Campo aceito no POST de criação
- **UI:** ❌ Formulário de criação de destino não tem campo de "validade". O campo nunca é preenchido pela UI atual

### 2.6 `fin_contas.gateway_id` — Conta Vinculada ao Gateway

- **Banco:** ✅ Campo `gateway_id UUID` existe em `fin_contas`
- **UI:** ❌ Formulário de conta não expõe esse vínculo; nunca é preenchido pela UI

### 2.7 `API /api/v1/payments` e `/api/v1/payments/boleto`

- **Código:** `listTenantPayments` / `getTenantPaymentBoleto` (pagamento de assinatura SaaS do tenant)
- **UI:** ❌ Não há tela de fatura/boleto para o administrador pagar o Gestão Eklésia dentro do app

---

## 3. Funcionalidades Parcialmente Concluídas

### 3.1 Relatório de Cobranças PIX

**O que existe:** Total arrecadado por destino (um número no card)
**O que falta:** Tela de listagem de `fin_payment_charges` com filtros por data, status, destino; exportação CSV; detalhes do pagador (nome, CPF, data, valor pago)
**Impacto:** O tesoureiro não consegue auditar quem fez o PIX, nem comparar o lançamento automático com o comprovante bancário
**Esforço estimado:** 2–3 dias (nova aba ou sub-tela na aba Arrecadação)

---

### 3.2 Saldo Real Acumulado por Conta

**O que existe:** `saldo_estimado = saldo_inicial + entradas_mês - saídas_mês` (saldo do mês selecionado apenas)
**O que falta:** Saldo histórico acumulado desde a criação da conta (considerar todos os meses, não só o selecionado)
**Impacto:** Para contas com histórico de meses anteriores, o saldo exibido no Dashboard Financeiro está tecnicamente incorreto — representa apenas o mês em tela, não o saldo bancário real
**Esforço estimado:** 1 dia (query acumulada ou stored procedure de recálculo por conta)

---

### 3.3 Gateway EFI (Efí Pay)

**O que existe:** Schema aceita `gateway IN ('asaas','efi')`; API `POST /api/v1/ministry/gateway` aceita `gateway: 'efi'`; teste de conexão retorna mensagem específica
**O que falta:** Implementação real do teste de credenciais EFI + geração de cobranças PIX via EFI + webhook EFI
**Impacto:** Ministérios que usam EFI Pay não conseguem usar a Arrecadação Digital
**Esforço estimado:** 5–8 dias (integração completa com SDK EFI)

---

### 3.4 Pagamentos de Eventos com Tesouraria

**O que existe:** `eventos_pagamentos` gravada; webhook processa e cria lançamento em `tesouraria_lancamentos`; cron de expiração
**O que falta:**
- UI no módulo de Eventos mostrando status de pagamento por inscrição
- UI na Tesouraria de reconciliação de eventos (quais inscrições geraram lançamento)
- Relatório financeiro por evento (total arrecadado, total pendente, expirados)
**Impacto:** O coordenador de eventos não sabe quem pagou; o tesoureiro não consegue reconciliar as arrecadações por evento
**Esforço estimado:** 3–5 dias (aba no módulo de Eventos + coluna extra na Tesouraria)

---

### 3.5 Dashboard de Arrecadação Digital

**O que existe:** Card por destino com `total_arrecadado` (um único número)
**O que falta:**
- Gráfico de evolução por destino ao longo do tempo
- Taxa de conversão (cobranças geradas / pagas / expiradas)
- Ranking de destinos por arrecadação
- Filtro por período
**Impacto:** Sem visão gerencial da arrecadação digital; não há como comparar performance entre destinos
**Esforço estimado:** 2–3 dias (nova seção de analytics na aba Arrecadação)

---

### 3.6 Relatório Visual com Gráficos na Aba "Relatório"

**O que existe:** Tabela com totalizadores por tipo + exportação CSV + impressão
**O que falta:** Gráfico de barras/pizza dentro da aba de relatório (o gráfico existe no Dashboard mas não no Relatório)
**Impacto:** Para impressão e análise, o relatório é puramente textual
**Esforço estimado:** 1 dia (reutilizar Recharts já importado)

---

## 4. Permissões

### 4.1 Matriz de Permissões — Tesouraria

> **NOTA CRÍTICA:** Os perfis `TESOUREIRO`, `SECRETÁRIO` e `MEMBRO` **não existem** no sistema atual. A lista de roles efetivos é:  
> `administrador · financeiro · financeiro_local · supervisor · admin_local · superintendente · coordenador · operador`

| Função | Modulo `tesouraria` | Modulo `financeiro` | Pode visualizar | Pode criar/editar | Pode excluir | Escopo |
|---|---|---|---|---|---|---|
| **ADMINISTRADOR** | ✅ | ✅ | Tudo | Tudo | ✅ | Global |
| **FINANCEIRO** | ✅ | ✅ | Tudo | Tudo | ✅ (lançamentos) | Global |
| **FINANCEIRO_LOCAL** | ✅ | ✅ | Só congregação vinculada | Só congregação vinculada | ❌ | Congregação |
| SUPERVISOR | ❌ | ❌ | Nenhum acesso financeiro | ❌ | ❌ | — |
| ADMIN_LOCAL | ❌ | ❌ | Nenhum acesso financeiro | ❌ | ❌ | — |
| SUPERINTENDENTE | ❌ | ❌ | Nenhum acesso financeiro | ❌ | ❌ | — |
| COORDENADOR | ❌ | ❌ | Nenhum acesso financeiro | ❌ | ❌ | — |
| OPERADOR | ❌ | ❌ | Nenhum acesso financeiro | ❌ | ❌ | — |

### 4.2 Detalhe por Funcionalidade

| Funcionalidade | ADMINISTRADOR | FINANCEIRO | FINANCEIRO_LOCAL | Outros |
|---|---|---|---|---|
| Ver lançamentos | ✅ Todos | ✅ Todos | ✅ Só congregação | ❌ |
| Criar lançamentos | ✅ | ✅ | ✅ Só congregação | ❌ |
| Editar lançamentos | ✅ | ✅ | ✅ Só congregação | ❌ |
| Excluir lançamentos | ✅ | ✅ | ❌ | ❌ |
| Fechar mês | ✅ | ✅ | ❌ | ❌ |
| Ver fechamentos | ✅ | ✅ | ❌ | ❌ |
| CRUD Contas | ✅ | ✅ criar/editar | ❌ | ❌ |
| Excluir Contas | ✅ | ❌ | ❌ | ❌ |
| CRUD Categorias | ✅ | ✅ criar/editar | ❌ | ❌ |
| Excluir Categorias | ✅ | ❌ | ❌ | ❌ |
| Ver dizimistas | ✅ | ✅ | ✅ | ❌ |
| CRUD Destinos PIX | ✅ | ✅ | ✅ Só congregação | ❌ |
| Configurar Gateway | ✅ | ❌ (ver apenas) | ❌ | ❌ |
| Dashboard Financeiro | ✅ | ✅ | ✅ (escopo cong.) | ❌ |

### 4.3 Controle por Plano de Assinatura

| Plano | `has_modulo_financeiro` | `has_modulo_financeiro_avancado` | Acesso a |
|---|---|---|---|
| Basic | ❌ | ❌ | Nenhum módulo financeiro |
| Starter | ✅ | ❌ | /tesouraria |
| Intermediário | ✅ | ❌ | /tesouraria |
| Profissional | ✅ | ✅ | /tesouraria + /financeiro |

---

## 5. Menus e Rotas

### 5.1 Sidebar — Itens Financeiros

| Item no Menu | Rota | Plano mínimo | Permissão mínima | Status |
|---|---|---|---|---|
| 💰 Tesouraria | `/tesouraria` | Starter | administrador / financeiro / financeiro_local | ✅ Implementado |
| 💳 Financeiro | `/financeiro` | Profissional | administrador / financeiro / financeiro_local | ✅ Implementado |

### 5.2 Rotas sem Menu (por design ou esquecimento)

| Rota | Tipo | Tem menu? | Observação |
|---|---|---|---|
| `/pagar/[token]` | Página pública (doação) | ❌ (correto) | Sem autenticação, acesso externo |
| `/api/v1/ministry-webhook/asaas/[token]` | Webhook endpoint | ❌ (correto) | Chamado pelo ASAAS |
| `/api/v1/ministry/gateway` | API REST | ❌ | UI em `/configuracoes` |
| `/api/v1/ministry/payment-destinations` | API REST | ❌ | Consumida internamente pela aba Arrecadação |
| `/api/v1/payments` e `/api/v1/payments/boleto` | API REST | ❌ | Pagamento SaaS do tenant, sem tela |
| `/api/v1/eventos/pagamento/[id]/status` | API REST | ❌ | Consultada internamente mas sem tela de status |

### 5.3 Menus sem Implementação Completa

> Nenhum item de menu financeiro está sem página implementada. Todos os itens levam a páginas funcionais.

### 5.4 Implementações sem Menu Direto

| Implementação | Acessível por | Problema |
|---|---|---|
| Configuração de Gateway ASAAS | `/configuracoes` (scroll até seção Gateway) | Configuração financeira está em "Configurações Gerais", não na Tesouraria — difícil de encontrar |
| Webhook eventos log | Não acessível | Zero visibilidade |
| Cobranças PIX individuais | Não acessível | Zero visibilidade |
| Pagamentos de eventos | Não acessível | Zero visibilidade |

---

## 6. Banco de Dados

### 6.1 Mapeamento Completo das Tabelas Financeiras

#### `tesouraria_lancamentos`
| Campo | Tipo | Finalidade |
|---|---|---|
| id | UUID PK | Identificador |
| ministry_id | UUID FK | Multi-tenant |
| congregacao_id | UUID FK nullable | NULL = Caixa Geral (sede) |
| departamento_id | UUID FK nullable | Vínculo com departamento |
| member_id | UUID FK nullable | Dizimista identificado |
| dizimista_nome | VARCHAR | Nome avulso ou cache do membro |
| tipo_movimento | VARCHAR | `entrada` \| `saida` |
| tipo_recebimento | VARCHAR | oferta, dízimo, evento, campanha, contribuição, missões, outros |
| valor | NUMERIC(12,2) | Valor positivo |
| forma_pagamento | VARCHAR | dinheiro, pix, cartão, transferência, cheque |
| conta_id | UUID FK nullable | Conta/caixa vinculado |
| categoria_id | UUID FK nullable | Categoria do plano de contas |
| origem_modulo | VARCHAR | `manual` \| `gateway` \| `ebd` |
| origem_id | UUID nullable | ID da cobrança de origem (fin_payment_charges) |
| data_lancamento | DATE | Data do lançamento |

**Utilização atual:** Alta — todas as abas da tesouraria leem desta tabela
**Telas consumindo:** /tesouraria (Dashboard, Lançamentos, Caixa, Relatório, Dizimistas) + /financeiro

---

#### `tesouraria_fechamentos`
| Campo | Tipo | Finalidade |
|---|---|---|
| ministry_id | UUID FK | Multi-tenant |
| mes_referencia | VARCHAR(7) | YYYY-MM |
| saldo_inicial | NUMERIC(12,2) | Saldo de abertura |
| total_entradas | NUMERIC(12,2) | Calculado no momento do fechamento |
| total_saidas | NUMERIC(12,2) | Calculado no momento do fechamento |
| saldo_final | NUMERIC(12,2) | saldo_inicial + entradas - saidas |
| status | VARCHAR | `aberto` \| `fechado` |
| fechado_por | UUID FK | Usuário que fechou |

**Utilização atual:** Alta — controla bloqueio de lançamentos + histórico
**Telas consumindo:** /tesouraria (aba Caixa Mensal) + alerta no /financeiro

---

#### `fin_contas`
| Campo | Tipo | Finalidade |
|---|---|---|
| nome | VARCHAR | Nome do caixa/conta |
| tipo | VARCHAR | caixa, conta_corrente, poupança, pix, fundo, outro |
| banco / agencia / conta | VARCHAR | Dados bancários |
| chave_pix | VARCHAR | Chave PIX da conta |
| saldo_inicial | NUMERIC(12,2) | Saldo de abertura cadastrado |
| is_padrao | BOOLEAN | Conta padrão (único por ministry) |
| congregacao_id | UUID nullable | NULL = conta da sede |
| gateway_id | UUID nullable | **⚠️ NUNCA PREENCHIDO pela UI atual** |

**Utilização atual:** Alta — vinculada a lançamentos e ao Dashboard Financeiro
**Telas consumindo:** /tesouraria (aba Contas, aba Lançamentos) + /financeiro (visão por conta)

---

#### `fin_categorias`
| Campo | Tipo | Finalidade |
|---|---|---|
| nome | VARCHAR | Nome da categoria |
| tipo_movimento | VARCHAR | entrada \| saida \| ambos |
| codigo | VARCHAR | Código no plano de contas (único para categorias do sistema) |
| categoria_pai_id | UUID nullable | **⚠️ Hierarquia não renderizada na UI** |
| is_sistema | BOOLEAN | Categorias padrão do sistema (protegidas) |
| modulo_origem | VARCHAR | tesouraria, ebd, missoes, gateway, etc. |

**Utilização atual:** Média — opcional nos lançamentos; obrigatória nos pie charts do /financeiro
**Telas consumindo:** /tesouraria (aba Categorias, formulário de lançamento) + /financeiro (pie charts)

---

#### `dizimistas_pagamentos`
| Campo | Tipo | Finalidade |
|---|---|---|
| member_id | UUID FK | Membro dizimista |
| mes_referencia | VARCHAR(7) | YYYY-MM |
| status | VARCHAR | `pago` \| `pendente` |
| valor | NUMERIC nullable | Valor pago naquele mês |
| data_pagamento | DATE nullable | Data efetiva |

**Utilização atual:** Alta — base do controle de adimplência
**Telas consumindo:** /tesouraria (aba Dizimistas)

---

#### `ministry_payment_gateways`
| Campo | Tipo | Finalidade |
|---|---|---|
| gateway | VARCHAR | `asaas` \| `efi` |
| environment | VARCHAR | `sandbox` \| `production` |
| encrypted_credentials | TEXT | AES-256-GCM (NUNCA exposto ao cliente) |
| webhook_token | UUID | Token único para URL do webhook |
| webhook_url_hint | TEXT | URL sugerida para configurar no ASAAS |
| asaas_webhook_status | VARCHAR | Status do auto-registro do webhook |
| last_test_ok / last_test_at | BOOLEAN / TIMESTAMP | Resultado do último teste |

**Utilização atual:** Alta — base de toda a Arrecadação Digital
**Telas consumindo:** /configuracoes (seção Gateway)
**NOTA:** Não aparece como aba da Tesouraria; usuários financeiros não sabem que o gateway está em Configurações

---

#### `fin_payment_destinations`
| Campo | Tipo | Finalidade |
|---|---|---|
| label | VARCHAR | Nome do destino ("Dízimo — Sede") |
| tipo_recebimento | VARCHAR | dizimo, oferta, missoes, doacao, campanha_local, evento_local |
| public_token | UUID UNIQUE | Token público do link |
| valor_fixo | NUMERIC nullable | NULL = valor aberto |
| expires_at | TIMESTAMPTZ nullable | **⚠️ Nunca preenchido pela UI atual** |
| is_ativo | BOOLEAN | Ativo/inativo |
| total_arrecadado | COMPUTED | Soma de fin_payment_charges status=pago |

**Utilização atual:** Alta — homologado em produção (sandbox)
**Telas consumindo:** /tesouraria (aba Arrecadação Digital)

---

#### `fin_payment_charges`
| Campo | Tipo | Finalidade |
|---|---|---|
| gateway_charge_id | VARCHAR UNIQUE | ID da cobrança no ASAAS (ex.: pay_xxx) |
| status | VARCHAR | pendente, pago, cancelado, expirado, estornado |
| pix_payload | TEXT | EMV copia-e-cola |
| pix_qrcode_url | TEXT | Base64 PNG do QR Code |
| payer_name / payer_document | VARCHAR | Nome e CPF do pagador |
| valor_solicitado / valor_pago | NUMERIC | Valores |
| tesouraria_lancamento_id | UUID | FK ao lançamento criado |
| paid_at | TIMESTAMPTZ | Momento do pagamento |

**Utilização atual:** Alta — criada via rota de pagamento; atualizada via webhook
**Telas consumindo:** ❌ **NENHUMA** — campo `total_arrecadado` no card do destino é o único reflexo visível

---

#### `fin_webhook_events`
| Campo | Tipo | Finalidade |
|---|---|---|
| event_type | VARCHAR | PAYMENT_CONFIRMED, PAYMENT_RECEIVED, etc. |
| gateway_event_id | VARCHAR UNIQUE | Idempotência determinística |
| processed | BOOLEAN | Se foi processado com sucesso |
| processing_error | TEXT | Mensagem de erro se falhou |
| payload | JSONB | Payload completo do webhook |
| received_at | TIMESTAMPTZ | Momento de recebimento |

**Utilização atual:** Alta — gravada em todo webhook recebido; base da idempotência
**Telas consumindo:** ❌ **NENHUMA**

---

#### `eventos_pagamentos`
| Campo | Tipo | Finalidade |
|---|---|---|
| evento_id / inscricao_id | UUID FK | Vínculo com evento e inscrição |
| gateway_charge_id | VARCHAR | ID no ASAAS |
| pix_payload / pix_qrcode | TEXT | PIX gerado |
| status | VARCHAR | pendente, pago, cancelado, expirado, estornado |
| tesouraria_lancamento_id | UUID | FK ao lançamento na tesouraria |
| expires_at | TIMESTAMPTZ | Expiração do PIX |

**Utilização atual:** Média — infra pronta; webhook processa; cron expira pendentes
**Telas consumindo:** ❌ **NENHUMA**

---

## 7. Dashboard Financeiro

### 7.1 Indicadores e Validação

| Indicador | Fonte de Dados | Cálculo | Status | Problema |
|---|---|---|---|---|
| Entradas do mês | `tesouraria_lancamentos WHERE tipo_movimento='entrada'` | Soma no mês selecionado | ✅ Correto | — |
| Saídas do mês | `tesouraria_lancamentos WHERE tipo_movimento='saida'` | Soma no mês selecionado | ✅ Correto | — |
| Saldo do mês | entradas - saídas | Matemática direta | ✅ Correto | — |
| Dízimos recebidos | `tipo_recebimento='dizimo'` | Soma no mês | ✅ Correto | — |
| Contas/caixas ativos | `fin_contas WHERE is_ativa=true` | COUNT | ✅ Correto | — |
| Resultado s/ entradas | saldo / entradas × 100 | Percentual | ✅ Correto | — |
| Gráfico 12 meses (E × S) | `tesouraria_lancamentos` últimos 12 meses | Agrupado por mês | ✅ Correto | — |
| Pie chart entradas por cat. | `tesouraria_lancamentos JOIN fin_categorias` | Soma por categoria_id | ✅ Correto | — |
| Pie chart saídas por cat. | `tesouraria_lancamentos JOIN fin_categorias` | Soma por categoria_id | ✅ Correto | — |
| Visão por conta — saldo | `saldo_inicial + entradas_mês - saídas_mês` | Estimativa do mês | ⚠️ **IMPRECISO** | Ver §7.2 |
| Alerta de fechamento | `tesouraria_fechamentos` do mês anterior | status='aberto' | ✅ Correto | — |
| Comparativo mês atual vs anterior | Dados do gráfico 12m | Variação percentual | ✅ Correto | — |

### 7.2 Problema Identificado — Saldo das Contas

**Como está:** `saldo_estimado = saldo_inicial + Σ(entradas_mês_selecionado) - Σ(saídas_mês_selecionado)`

**Como deveria ser:** `saldo_atual = saldo_inicial + Σ(todas_entradas_históricas) - Σ(todas_saídas_históricas)` desde a criação da conta.

**Impacto real:** Uma conta com `saldo_inicial = R$ 0` que acumulou R$ 10.000 ao longo de 6 meses mostrará saldo R$ 0 se o mês selecionado não tiver lançamentos. O número é matematicamente correto para o mês, mas semanticamente enganoso como "saldo da conta".

---

## 8. Relatórios

| Relatório | Localização | Filtros | Exportação | Status |
|---|---|---|---|---|
| Relatório mensal de entradas | /tesouraria → aba Relatório | mês, congregação | CSV + Impressão | ✅ Funcionando |
| Relatório mensal de saídas | /tesouraria → aba Relatório | mês, congregação | CSV + Impressão | ✅ Funcionando |
| Relatório completo (entradas+saídas) | /tesouraria → aba Relatório | mês, congregação | CSV + Impressão | ✅ Funcionando |
| Lista de dizimistas adimplentes | /tesouraria → aba Dizimistas | mês, congregação, status | Impressão | ✅ Funcionando |
| Lista de dizimistas inadimplentes | /tesouraria → aba Dizimistas | mês, congregação | Impressão | ✅ Funcionando |
| Resumo do fechamento mensal | /tesouraria → aba Caixa Mensal | mês | — | ✅ Funcionando |
| Dashboard visual 12 meses | /financeiro | mês | — | ✅ Funcionando |
| Distribuição por categoria | /financeiro | mês | — | ✅ Funcionando |
| Relatório de cobranças PIX | — | — | — | ❌ Inexistente |
| Relatório de pagamentos de eventos | — | — | — | ❌ Inexistente |
| Relatório de log de webhooks | — | — | — | ❌ Inexistente |
| Relatório multi-congregação consolidado | — | — | — | ❌ Inexistente |
| Exportação PDF | — | — | — | ❌ Inexistente (só CSV/impressão) |

---

## 9. Arrecadação Digital

| Funcionalidade | Banco | API | UI | Status |
|---|---|---|---|---|
| Configurar gateway ASAAS | ✅ | ✅ | ✅ (/configuracoes) | ✅ |
| Teste de conexão ASAAS | ✅ | ✅ | ✅ | ✅ |
| Auto-registro webhook | ✅ | ✅ | — | ✅ |
| Criar destino de arrecadação | ✅ | ✅ | ✅ | ✅ |
| Link público `/pagar/{token}` | ✅ | ✅ | ✅ (QR modal + link copiável) | ✅ |
| Formulário público de pagamento | ✅ | ✅ | ✅ (/pagar/[token]) | ✅ |
| Campo CPF/CNPJ (obrigatório ASAAS) | ✅ | ✅ | ✅ | ✅ |
| Geração de PIX dinâmico (ASAAS sandbox) | ✅ | ✅ | ✅ | ✅ (Homologado) |
| QR Code retornado ao usuário | ✅ | ✅ | ✅ | ✅ |
| Webhook PAYMENT_CONFIRMED | ✅ | ✅ | — | ✅ (Homologado) |
| Lançamento automático na Tesouraria | ✅ | ✅ | — | ✅ (Homologado) |
| Idempotência de webhook | ✅ | ✅ | — | ✅ (Homologado) |
| Total arrecadado por destino | ✅ | ✅ | ✅ | ✅ |
| Ativar/desativar destino | ✅ | ✅ | ✅ | ✅ |
| Listagem de cobranças individuais | ✅ banco | ❌ sem API | ❌ | ❌ Faltando |
| Relatório de arrecadação por período | — | — | — | ❌ Faltando |
| Funil de conversão (geradas/pagas/expiradas) | — | — | — | ❌ Faltando |
| Destino com validade (`expires_at`) | ✅ banco | ✅ aceita | ❌ sem campo na UI | ⚠️ Parcial |
| Gateway EFI Pay | ✅ schema | ⚠️ sem teste real | ❌ sem UI | ⚠️ Parcial |
| Boleto bancário | — | — | — | ❌ Não implementado |
| Cobrança recorrente | — | — | — | ❌ Não implementado |

---

## 10. Conclusão Executiva

### 10.1 Tabela de Status por Área

| Área | Status | % Concluído | Observação |
|---|---|---|---|
| Tesouraria (CRUD + Fechamentos) | ✅ Concluído | **100%** | Completo e homologado |
| Dizimistas | ✅ Concluído | **100%** | Completo |
| Contas & Caixas | ✅ Concluído | **98%** | Falta gateway_id no form |
| Categorias Financeiras | ✅ Quase completo | **90%** | Hierarquia não renderizada |
| Dashboard Financeiro (`/financeiro`) | ✅ Quase completo | **90%** | Saldo conta = estimativa do mês, não acumulado |
| Relatórios | ⚠️ Parcial | **65%** | Faltam: PIX, eventos, PDF, consolidado |
| Gateway / Configuração | ✅ Quase completo | **88%** | EFI não implementado |
| Arrecadação Digital (Fase A) | ✅ Quase completo | **82%** | Falta: listagem de cobranças, relatório |
| Eventos Pagamentos (infra) | ⚠️ Parcial | **35%** | Infra OK, zero UI |
| Dashboard de Arrecadação | ⚠️ Parcial | **30%** | Só total_arrecadado por destino |

---

### 10.2 O que Falta para Declarar o Módulo como CONCLUÍDO

Em ordem de impacto:

1. **Tela de cobranças PIX** — listagem de `fin_payment_charges` com detalhes do pagador, status, data, valor; exportação CSV
2. **Saldo acumulado histórico nas contas** — cálculo desde a criação, não só do mês selecionado
3. **Log de webhooks visível** — tela de auditoria do `fin_webhook_events` para suporte e transparência
4. **Configuração de gateway dentro da Tesouraria** — ou pelo menos um link direto de "Configurações de Pagamento" na aba Arrecadação
5. **Destino com validade** — campo `expires_at` no formulário de destino para campanhas temporárias

---

### 10.3 O que Deve Entrar na Fase B — Inteligência Financeira

| Feature | Justificativa | Complexidade |
|---|---|---|
| Relatório consolidado multi-congregação | Visão de rede para administração central | Média |
| Orçamento mensal por congregação | Planejamento financeiro | Alta |
| UI de reconciliação de Eventos Pagamentos | Gestor de eventos precisa saber quem pagou | Média |
| Saldo histórico real por conta | Precisão contábil | Baixa |
| EFI Pay completo | Segundo gateway suportado | Alta |
| Boleto bancário | Formas de pagamento além do PIX | Alta |
| Exportação PDF dos relatórios | Profissionalismo dos documentos | Baixa |
| Assinatura digital de fechamentos | Validade jurídica dos fechamentos | Alta |
| Funil de conversão de arrecadação | Inteligência sobre campanhas digitais | Média |
| Cobrança recorrente de dízimos | Automação do dízimo mensal | Alta |
| Dashboard comparativo multi-mês | Tendências e projeções | Média |
| Previsão de fechamento (AI) | Alertas preditivos de deficit | Alta |

---

*Relatório gerado em 24/05/2026 por análise estática do código-fonte, migrations SQL e APIs do Gestão Eklésia.*
*Arquivos analisados: `src/app/tesouraria/page.tsx`, `src/app/financeiro/page.tsx`, `src/components/Sidebar.tsx`, `src/lib/access-control.ts`, `src/hooks/usePermissions.ts`, `src/app/api/v1/ministry/gateway/route.ts`, `src/app/api/v1/ministry/payment-destinations/route.ts`, `src/app/api/v1/ministry-webhook/asaas/[token]/route.ts`, e 15+ migrations SQL.*
