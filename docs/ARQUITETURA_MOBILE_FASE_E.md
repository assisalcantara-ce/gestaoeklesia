# ARQUITETURA MOBILE — FASE E: Auditoria Completa
**GestãoEklesia — FASE E Entrega 0**
**Data:** 2026-05-25 | **Tipo:** Auditoria Arquitetural (sem UI, sem rotas, sem migrations)

---

## ÍNDICE

1. [Auditoria da tabela `members`](#1-auditoria-da-tabela-members)
2. [Vínculo Membro ↔ Auth](#2-vínculo-membro--auth)
3. [Carteirinha Digital](#3-carteirinha-digital)
4. [Histórico Ministerial](#4-histórico-ministerial)
5. [Contribuições Mobile](#5-contribuições-mobile)
6. [Eventos Mobile](#6-eventos-mobile)
7. [Comunicados](#7-comunicados)
8. [Dashboard Presidência Mobile](#8-dashboard-presidência-mobile)
9. [Resumo Executivo](#9-resumo-executivo)

---

## 1. Auditoria da tabela `members`

### 1.1 Colunas (66 colunas confirmadas no banco)

| Grupo | Colunas | Status |
|-------|---------|--------|
| **Identidade** | `id`, `ministry_id`, `matricula`, `unique_id` | ✅ |
| **Dados Básicos** | `name`, `email`, `phone`, `cpf`, `rg`, `orgao_emissor` | ✅ |
| **Pessoais** | `data_nascimento`, `sexo`, `tipo_sanguineo`, `escolaridade`, `estado_civil`, `nome_conjuge`, `cpf_conjuge`, `data_nascimento_conjuge`, `nome_pai`, `nome_mae`, `nacionalidade`, `naturalidade`, `uf_naturalidade` | ✅ |
| **Documentos Eleitorais** | `titulo_eleitoral`, `zona_eleitoral`, `secao_eleitoral` | ✅ |
| **Datas Ministeriais** | `data_batismo_aguas`, `data_batismo_espirito_santo`, `data_consagracao`, `data_emissao`, `data_validade_credencial` | ✅ |
| **Endereço** | `cep`, `logradouro`, `numero`, `bairro`, `complemento`, `cidade`, `estado` | ✅ |
| **Contato** | `celular`, `whatsapp` | ✅ |
| **Geolocalização** | `congregacao_id`, `latitude`, `longitude` | ✅ |
| **Ministerial** | `tipo_cadastro`, `role`, `profissao`, `cargo_ministerial`, `dados_cargos` (JSONB), `tem_funcao_igreja`, `qual_funcao`, `setor_departamento`, `pastor_auxiliar`, `procedencia`, `procedencia_local`, `observacoes_ministeriais`, `curso_teologico`, `instituicao_teologica` | ✅ |
| **Sistema** | `foto_url`, `member_since`, `status`, `custom_fields` (JSONB), `observacoes`, `is_dizimista`, `created_at`, `updated_at` | ✅ |
| **Auth Mobile** | `auth_user_id` (UUID, nullable) | ⚠️ EXISTE mas sem FK e sem RLS self-read |

> **Coluna extra descoberta em banco real:** `is_dizimista BOOLEAN` — não constava nas migrations auditadas, adicionada pela migration `20260415130000_dizimistas_module.sql`.

### 1.2 Índices

| Índice | Colunas | Tipo |
|--------|---------|------|
| `idx_members_ministry_id` | `(ministry_id)` | B-tree |
| `idx_members_status` | `(ministry_id, status)` | B-tree |
| `idx_members_tipo_cadastro` | `(ministry_id, tipo_cadastro)` | B-tree |
| `idx_members_email` | `(ministry_id, email)` WHERE `email IS NOT NULL` | B-tree parcial |
| `idx_members_cpf` | `(ministry_id, cpf)` WHERE `cpf IS NOT NULL` | B-tree parcial |
| `idx_members_created_at` | `(ministry_id, created_at ASC)` | B-tree |
| `idx_members_congregacao_id` | `(congregacao_id)` WHERE `NOT NULL` | B-tree parcial |
| `idx_members_name_trgm` | `(name)` | GIN (pg_trgm) |

> **Índice ausente:** `(auth_user_id)` — necessário para lookup rápido de membro por sessão mobile.

### 1.3 Constraints

```sql
-- UNIQUE constraints
UNIQUE NULLS NOT DISTINCT (ministry_id, cpf)
UNIQUE NULLS NOT DISTINCT (ministry_id, email)
UNIQUE (ministry_id, unique_id)

-- CHECK constraints
CHECK status IN ('active','inactive','deceased','transferred')
CHECK tipo_cadastro IN ('membro','congregado','ministro','crianca')
```

### 1.4 RLS (Row Level Security)

| Policy | Ação | Condição | Cobre |
|--------|------|----------|-------|
| `members_select` | SELECT | `ministry_id IN get_owned_ministry_ids() OR get_linked_ministry_ids()` | ministry_users ✅ |
| `members_insert` | INSERT | idem | ministry_users ✅ |
| `members_update` | UPDATE | idem | ministry_users ✅ |
| `members_delete` | DELETE | idem | ministry_users ✅ |
| **`members_self_read`** | **SELECT** | **— AUSENTE —** | **membro mobile ❌** |

> **RLS de auto-acesso não existe.** Membros autenticados via `auth.uid()` não conseguem ler seus próprios dados sem que o staff logue como proxy.

### 1.5 Campos Ausentes para Mobile

| Campo | Finalidade | Prioridade |
|-------|-----------|-----------|
| FK `auth_user_id → auth.users(id)` | Integridade referencial do login | ALTA |
| Índice em `auth_user_id` | Performance do lookup mobile | ALTA |
| Policy `auth_user_id = auth.uid()` | RLS self-read do membro | ALTA |
| `push_token TEXT` | Notificações push (FCM/APNS) | MÉDIA |
| `foto_perfil_aprovada BOOLEAN` | Controle de moderação de foto | BAIXA |

---

## 2. Vínculo Membro ↔ Auth

### 2.1 Estado Atual

| Item | Situação |
|------|---------|
| Coluna `auth_user_id` em `members` | ✅ EXISTE (UUID nullable) |
| FK `REFERENCES auth.users(id)` | ❌ NÃO EXISTE |
| Índice em `auth_user_id` | ❌ NÃO EXISTE |
| RLS `auth_user_id = auth.uid()` | ❌ NÃO EXISTE |
| Membros vinculados atualmente | **0 de 10** (todos NULL) |
| Fluxo de cadastro de conta para membro | ❌ NÃO EXISTE |
| Fluxo de login de membro | ❌ NÃO EXISTE |
| Nível RBAC `membro` em `NivelAcesso` | ❌ NÃO EXISTE |

### 2.2 Lógica de Login de Membro (ausente — proposta técnica)

O sistema atual só tem autenticação para `ministry_users` (staff). Para o mobile, o fluxo proposto é:

```
1. Membro acessa app → informar CPF ou email
2. Sistema verifica se existe member.cpf ou member.email no ministério
3. Se existe e auth_user_id IS NULL → criar account em auth.users
4. Gerar link mágico ou senha provisória enviada por email/SMS
5. Após auth → setar members.auth_user_id = auth.uid()
6. RLS self-read passa a funcionar
```

> **Dependência crítica:** toda a FASE E depende desta vinculação. É o bloqueador #1.

### 2.3 Migrations Necessárias

```sql
-- M-01: FK de auth_user_id
ALTER TABLE public.members
  ADD CONSTRAINT fk_members_auth_user
  FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- M-02: Índice de performance
CREATE INDEX IF NOT EXISTS idx_members_auth_user_id
  ON public.members(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- M-03: RLS self-read
CREATE POLICY members_self_read ON public.members
  FOR SELECT USING (auth_user_id = auth.uid());
```

---

## 3. Carteirinha Digital

### 3.1 Dados Disponíveis vs. Necessários

| Dado | Tabela/Coluna | Disponível |
|------|--------------|-----------|
| Nome completo | `members.name` | ✅ |
| Foto | `members.foto_url` | ✅ |
| Matrícula | `members.matricula` | ✅ |
| Data de batismo | `members.data_batismo_aguas` | ✅ |
| Cargo ministerial | `members.cargo_ministerial` | ✅ |
| Status do membro | `members.status` | ✅ |
| Validade da credencial | `members.data_validade_credencial` | ✅ |
| Congregação | `members.congregacao_id` → `congregacoes.nome` | ✅ (JOIN) |
| Ministério (nome) | `members.ministry_id` → `ministries.name` | ✅ (JOIN) |
| Logo do ministério | `ministries.logo_url` | ✅ (JOIN) |
| QR Code | Gerado on-demand via `qrcode.react` (já instalado) | ✅ |
| Tipo cadastro | `members.tipo_cadastro` | ✅ |

> **Veredicto de dados: 100% dos campos necessários para carteirinha estão presentes.** Não é necessária nenhuma migration de schema para a tela de carteirinha — apenas vincular o auth e criar a API.

### 3.2 Estrutura da Query para Carteirinha

```sql
SELECT
  m.id, m.name, m.matricula, m.unique_id,
  m.foto_url, m.cargo_ministerial, m.tipo_cadastro,
  m.data_batismo_aguas, m.data_validade_credencial, m.status,
  m.member_since,
  c.nome AS congregacao_nome,
  min.name AS ministerio_nome,
  min.logo_url AS ministerio_logo
FROM members m
LEFT JOIN congregacoes c ON c.id = m.congregacao_id
JOIN ministries min ON min.id = m.ministry_id
WHERE m.auth_user_id = auth.uid();
```

### 3.3 Grau de Prontidão: **85%**

| Componente | Status |
|-----------|--------|
| Dados no banco | ✅ 100% |
| RLS self-read | ❌ Falta migration M-03 |
| API `/v1/mobile/member/me` | ❌ Falta criar |
| QR Code library | ✅ `qrcode.react` instalado |

---

## 4. Histórico Ministerial

### 4.1 Tabelas Existentes

#### `batismo_aguas_registros` ✅ EXISTE
```
id, ministry_id, candidato_id (→ members nullable),
candidato_nome, candidato_data_nascimento, candidato_sexo, candidato_telefone,
data_batismo, local_batismo, pastor_nome,
status (registrado), observacoes,
certificado_template_key, certificado_emitido_em,
created_at, updated_at
```
- FK para members: `fk_batismo_aguas_candidato` (ON DELETE SET NULL)
- Índices: `ministry_id`, `candidato_id`, `data_batismo`, `status`
- RLS atual: somente `ministry_users` — **membro mobile não lê**

#### `consagracao_registros` ✅ EXISTE
```
id, ministry_id, member_id (→ members nullable),
tipo_registro, regiao, numero_processo, data_processo,
cpf, nome, data_nascimento, sexo, rg, orgao_emissor, estado_civil,
nacionalidade, naturalidade, uf, email, telefone, nome_pai, nome_mae, nome_conjuge,
matricula, supervisao_id, campo_id, congregacao_id,
cargo_ocupa, cargo_pretendido, pastor_solicitante, data_autorizacao,
status_processo (em_processo), observacoes, foto_url,
created_at, updated_at
```
- FK para members: `fk_consagracao_registros_member` (ON DELETE SET NULL)
- Índices: `ministry_id`, `status_processo`, `numero_processo`, `cpf`, `member_id`
- RLS atual: somente `ministry_users` — **membro mobile não lê**

#### `apresentacao_criancas_registros` ✅ EXISTE
```
id, ministry_id, agendamento_id,
crianca_nome, crianca_data_nascimento, crianca_sexo,
pai_nome, mae_nome, responsavel_nome, responsavel_telefone,
data_apresentacao, local_apresentacao, status,
observacoes, certificado_template_key, certificado_emitido_em,
created_at, updated_at
```
- **SEM `member_id`** — pais/responsáveis não são vinculados como membro
- Só pesquisa por nome manualmente

#### `carta_pedidos` ✅ EXISTE (vazia — estrutura apenas)

#### `certificados_templates` ✅ EXISTE (12 templates cadastrados)
```
id, ministry_id, template_key, name, description,
template_data (JSONB), preview_url, is_default, is_active,
created_at, updated_at
```

#### Campos diretamente em `members` (histórico inline)
| Campo | Dado |
|-------|------|
| `data_batismo_aguas` | Data de batismo nas águas |
| `data_batismo_espirito_santo` | Batismo no Espírito Santo |
| `data_consagracao` | Data de consagração |
| `curso_teologico` | Nome do curso |
| `instituicao_teologica` | Instituição |
| `cargo_ministerial` | Cargo atual |
| `dados_cargos` JSONB | Histórico de cargos (estrutura livre) |
| `procedencia` | Denominação de origem |
| `procedencia_local` | Localização de origem |

### 4.2 Gaps Identificados

| Módulo | Situação |
|--------|---------|
| Batismo nas águas | ✅ Tabela dedicada com FK para members |
| Batismo Espírito Santo | ⚠️ Somente data em `members` (sem tabela de registro) |
| Consagração | ✅ Tabela dedicada com FK para members |
| Apresentação de crianças | ⚠️ Sem FK para members (busca por nome) |
| Cartas ministeriais | ✅ `carta_pedidos` existe (sem dados) |
| Discipulado | ❌ Tabela NÃO EXISTE |
| Cursos / Capacitações | ❌ Tabela NÃO EXISTE (só campo texto em members) |
| Certificados emitidos | ⚠️ Referenciado por `template_key` em batismo e apresentação, mas sem tabela consolidada |
| RLS self-read para histórico | ❌ Nenhuma das tabelas tem policy para `auth_user_id` |

### 4.3 Migrations Necessárias para Histórico

```sql
-- M-04: RLS self-read para batismo (via member_id)
CREATE POLICY batismo_aguas_self_read ON public.batismo_aguas_registros
  FOR SELECT USING (
    candidato_id IN (SELECT id FROM members WHERE auth_user_id = auth.uid())
  );

-- M-05: RLS self-read para consagração
CREATE POLICY consagracao_self_read ON public.consagracao_registros
  FOR SELECT USING (
    member_id IN (SELECT id FROM members WHERE auth_user_id = auth.uid())
  );

-- M-06: Vincular apresentacao_criancas ao member (pai/mãe)
ALTER TABLE public.apresentacao_criancas_registros
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE SET NULL;
```

### 4.4 Grau de Prontidão: **60%**

---

## 5. Contribuições Mobile

### 5.1 Tabelas Auditadas

#### `fin_payment_destinations` ✅ REUTILIZÁVEL
```
id, ministry_id, gateway_id, congregacao_id, conta_id, categoria_id,
tipo_recebimento (oferta|dizimo|missoes|...), label, descricao,
cor, icone, public_token, valor_fixo,
is_ativo, expires_at,
created_at, updated_at
```
- `public_token` permite acesso anônimo para geração de cobranças — **PIX público funciona**
- 8 destinos ativos no banco

#### `fin_payment_charges` ⚠️ REQUER ALTERAÇÃO
```
id, ministry_id, destination_id, gateway, gateway_charge_id,
gateway_customer_id, gateway_external_ref, gateway_response, charge_type,
payment_method, valor_solicitado, valor_pago,
pix_payload, pix_qrcode_url, invoice_url,
payer_name, payer_document, payer_email,
status (pendente|pago|cancelado|expirado),
tesouraria_lancamento_id, idempotency_key,
expires_at, paid_at, created_at, updated_at
```
- **`member_id` NÃO EXISTE** — histórico de contribuições não é ligado ao membro diretamente
- Único rastreio possível: `payer_document = members.cpf` (frágil, CPF pode ser NULL)

#### `tesouraria_lancamentos` ✅ TEM `member_id`
```
id, ministry_id, congregacao_id, departamento_id,
tipo_recebimento, tipo_movimento, forma_pagamento,
valor, descricao, referencia, data_lancamento,
member_id, dizimista_nome,
conta_id, categoria_id, origem_modulo, origem_id, transaction_id,
observacoes, criado_por, created_at, updated_at
```
- `member_id` existe — lançamentos de dízimo vinculados ao membro são rastreáveis
- `dizimista_nome` como fallback texto

#### `ministry_payment_gateways` ✅
```
gateway IN ('asaas','efi'), encrypted_credentials (AES-256-GCM),
webhook_token (UUID), is_active, status
```

### 5.2 Capacidades Atuais

| Cenário | Possível Hoje |
|---------|--------------|
| Membro gera PIX via link público | ✅ SIM — `/v1/pagar/[token]` |
| Membro vê histórico de cobranças geradas | ❌ NÃO — sem `member_id` em `fin_payment_charges` |
| Membro vê histórico de dízimos lançados | ⚠️ PARCIAL — via `tesouraria_lancamentos.member_id` mas sem RLS self-read |
| Membro verifica status de pagamento | ⚠️ PARCIAL — via `gateway_charge_id` (requer ID externo) |

### 5.3 Migration Necessária

```sql
-- M-07: Adicionar member_id em fin_payment_charges
ALTER TABLE public.fin_payment_charges
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fin_charges_member_id
  ON public.fin_payment_charges(member_id)
  WHERE member_id IS NOT NULL;

-- M-08: RLS self-read para contribuições
CREATE POLICY fin_charges_self_read ON public.fin_payment_charges
  FOR SELECT USING (
    member_id IN (SELECT id FROM members WHERE auth_user_id = auth.uid())
  );

-- M-09: RLS self-read para lançamentos de tesouraria
CREATE POLICY lancamentos_self_read ON public.tesouraria_lancamentos
  FOR SELECT USING (
    member_id IN (SELECT id FROM members WHERE auth_user_id = auth.uid())
  );
```

### 5.4 Grau de Prontidão: **50%**

---

## 6. Eventos Mobile

### 6.1 Tabelas Auditadas

#### `eventos` ✅ REUTILIZÁVEL
```
id, ministry_id, congregacao_id, titulo, descricao, tipo,
data_inicio, data_fim, local_nome, local_endereco,
capacidade, is_publico, aceita_inscricao, valor_inscricao,
status (programado|em_andamento|concluido|cancelado),
criado_por, created_at, updated_at, slug
```

#### `eventos_inscricoes` ✅ TEM `member_id`
```
id, evento_id, ministry_id, member_id,
nome_externo, email_externo, telefone,
status (confirmado|aguardando_pagamento|cancelado),
observacoes, presente, checkin_em, checkin_por,
criado_por, created_at, updated_at
```
- `member_id` presente — **membro pode listar suas inscrições sem alteração**

#### `eventos_pagamentos` ⚠️ SEM `member_id` direto
```
id, ministry_id, evento_id, inscricao_id, gateway,
gateway_charge_id, gateway_customer_id, gateway_response,
payment_method, valor, status,
pix_payload, pix_qrcode, invoice_url,
tesouraria_lancamento_id, expires_at, paid_at, created_at, updated_at
```
- Acesso via join: `eventos_pagamentos.inscricao_id → eventos_inscricoes.member_id`

### 6.2 Capacidades Atuais

| Cenário | Possível Hoje |
|---------|--------------|
| Ver eventos públicos por slug | ✅ `/v1/eventos/publico/[slug]` |
| Inscrever em evento | ✅ `/v1/eventos/inscricao` |
| Ver status de pagamento de evento | ✅ `/v1/eventos/pagamento/[id]/status` |
| Listar "minhas inscrições" | ⚠️ Dados presentes mas API não existe |
| Ver eventos futuros filtrados por congregação | ⚠️ Dados presentes mas API não existe |

### 6.3 APIs Novas Necessárias

```
GET /v1/mobile/member/eventos          → minhas inscrições (via member_id)
GET /v1/mobile/eventos/proximos        → eventos futuros do ministério (público)
GET /v1/mobile/eventos/[id]            → detalhe de evento (reutiliza publico/[slug] ou nova)
```

### 6.4 Grau de Prontidão: **75%**

---

## 7. Comunicados

### 7.1 Tabela `comunicados` — JÁ EXISTE ✅

Colunas confirmadas no banco:
```
id                UUID PK
ministry_id       UUID NOT NULL → ministries FK
congregacao_id    UUID → congregacoes FK (nullable)
titulo            TEXT NOT NULL
conteudo          TEXT NOT NULL
autor_user_id     UUID (referência ao ministry_user que criou)
publicado_em      TIMESTAMP
expira_em         TIMESTAMP (nullable)
created_at        TIMESTAMP
```

> **A tabela existe mas está vazia** (0 registros). A interface administrativa de comunicados possivelmente não foi construída ainda.

### 7.2 Campos Ausentes para Mobile

| Campo | Finalidade | Prioridade |
|-------|-----------|-----------|
| `categoria VARCHAR(50)` | Tipo: `aviso`, `informativo`, `urgente`, `devocional` | ALTA |
| `destinatario_tipo VARCHAR(50)` | Escopo: `todos`, `membros`, `ministerio`, `congregacao` | ALTA |
| `status VARCHAR(20)` | `rascunho`, `publicado`, `arquivado` | ALTA |
| `arquivo_url TEXT` | Anexo (PDF, imagem) | MÉDIA |
| `visualizacoes INT` | Contador de leituras | BAIXA |
| Índice em `(ministry_id, publicado_em DESC)` | Performance listagem mobile | MÉDIA |

### 7.3 RLS para Membro Ler Comunicados

Atualmente RLS cobre somente `ministry_users`. Para mobile:

```sql
-- M-10: Comunicados: expandir colunas
ALTER TABLE public.comunicados
  ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) DEFAULT 'informativo',
  ADD COLUMN IF NOT EXISTS destinatario_tipo VARCHAR(50) DEFAULT 'todos',
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'publicado',
  ADD COLUMN IF NOT EXISTS arquivo_url TEXT;

-- M-11: Index para listagem mobile
CREATE INDEX IF NOT EXISTS idx_comunicados_ministry_publicado
  ON public.comunicados(ministry_id, publicado_em DESC)
  WHERE status = 'publicado';

-- M-12: RLS membro lê comunicados do seu ministério
CREATE POLICY comunicados_member_read ON public.comunicados
  FOR SELECT USING (
    ministry_id IN (
      SELECT ministry_id FROM public.members
      WHERE auth_user_id = auth.uid()
    )
    AND status = 'publicado'
    AND (expira_em IS NULL OR expira_em > NOW())
  );
```

### 7.4 Modelagem Mínima Proposta (caso comunicados precisasse ser criada do zero)

Como a tabela já existe, o MVP é apenas adicionar os campos ausentes acima. A estrutura base está correta.

### 7.5 Grau de Prontidão: **65%**

---

## 8. Dashboard Presidência Mobile

### 8.1 Tabelas que Alimentam o Dashboard

#### `tesouraria_lancamentos` ✅ REUTILIZÁVEL
- Consultas já alimentam totais por `tipo_recebimento`, `tipo_movimento`, `data_lancamento`
- Query consolidado mensal:
```sql
SELECT tipo_recebimento, tipo_movimento, SUM(valor) AS total,
       DATE_TRUNC('month', data_lancamento) AS mes
FROM tesouraria_lancamentos
WHERE ministry_id = $1
GROUP BY tipo_recebimento, tipo_movimento, mes
ORDER BY mes DESC;
```

#### `tesouraria_fechamentos` ⚠️ ESTRUTURA EXISTE, SEM DADOS
Tabela confirmada com estrutura, mas 0 registros — módulo de fechamento nunca foi executado.

Colunas esperadas (via migration `20260416100000_tesouraria_fechamento_mensal.sql`):
```
id, ministry_id, congregacao_id, mes_referencia,
saldo_inicial, total_entradas, total_saidas, saldo_final,
status (aberto|fechado), status_conselho_fiscal,
created_at, updated_at
```

#### `financial_fiscal_reviews` ⚠️ ESTRUTURA EXISTE, SEM DADOS
Tabela confirmada (`20260525110000_conselho_fiscal_reviews.sql`), vazia.
Estrutura base: revisões do conselho fiscal sobre fechamentos mensais.

#### `financial_audit_logs` ⚠️ ESTRUTURA EXISTE, SEM DADOS
Tabela para trilha de auditoria financeira — sem registros ainda.

### 8.2 Módulos de Presidência Auditados

| Módulo | Tabela | Status |
|--------|--------|--------|
| Tesouraria — lançamentos | `tesouraria_lancamentos` | ✅ 10 registros |
| Tesouraria — fechamentos | `tesouraria_fechamentos` | ⚠️ Vazia |
| Conselho Fiscal | `financial_fiscal_reviews` | ⚠️ Vazia |
| Auditoria Financeira | `financial_audit_logs` | ⚠️ Vazia |
| Missões | `tesouraria_lancamentos` (tipo_recebimento=missoes) | ✅ Via filtro |
| Dízimos digitais | `fin_payment_charges` + `tesouraria_lancamentos` | ✅ Via JOIN |
| Eventos (arrecadação) | `eventos_pagamentos` + `fin_payment_charges` | ✅ Via JOIN |
| EBD | Módulo separado (ebd_*) | ⚠️ Sem API mobile |
| Patrimônio | Módulo separado | ⚠️ Sem API mobile |

### 8.3 RPCs/Views de Presidência

Pesquisa confirmou: **nenhuma RPC de consolidado ou radar ministerial existe** no banco. As queries de dashboard na presidência atual são feitas client-side via múltiplas chamadas ao Supabase.

### 8.4 APIs Existentes Úteis para Presidência

Nenhuma API de presidência foi exposta via `/api/v1/` para consumo mobile. Todo acesso é via Supabase client direto no frontend web.

### 8.5 Queries para Dashboard Presidência Mobile (propostas)

```sql
-- Consolidado financeiro mensal
SELECT
  DATE_TRUNC('month', data_lancamento) AS mes,
  SUM(CASE WHEN tipo_movimento = 'entrada' THEN valor ELSE 0 END) AS total_entradas,
  SUM(CASE WHEN tipo_movimento = 'saida' THEN valor ELSE 0 END) AS total_saidas,
  SUM(CASE WHEN tipo_movimento = 'entrada' THEN valor ELSE -valor END) AS saldo
FROM tesouraria_lancamentos
WHERE ministry_id = $1
GROUP BY mes ORDER BY mes DESC LIMIT 12;

-- Arrecadação por tipo (radar)
SELECT tipo_recebimento, SUM(valor) AS total
FROM tesouraria_lancamentos
WHERE ministry_id = $1
  AND data_lancamento >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY tipo_recebimento ORDER BY total DESC;

-- Status de membros
SELECT status, COUNT(*) AS qtd
FROM members
WHERE ministry_id = $1
GROUP BY status;

-- Inscrições por evento (resumo)
SELECT e.titulo, COUNT(ei.id) AS inscritos,
       SUM(ep.valor) AS arrecadado
FROM eventos e
LEFT JOIN eventos_inscricoes ei ON ei.evento_id = e.id
LEFT JOIN eventos_pagamentos ep ON ep.evento_id = e.id AND ep.status = 'pago'
WHERE e.ministry_id = $1
GROUP BY e.id, e.titulo ORDER BY e.data_inicio DESC;
```

### 8.6 Grau de Prontidão: **40%**

---

## 9. Resumo Executivo

### 9.1 Tabelas Reutilizáveis (sem alteração de schema)

| Tabela | Uso Mobile | Observação |
|--------|-----------|-----------|
| `members` | Carteirinha, histórico, perfil | Schema completo — falta RLS + API |
| `congregacoes` | Exibição na carteirinha | JOIN simples |
| `ministries` | Logo e nome na carteirinha | JOIN simples |
| `eventos` | Listagem de eventos | API pública existe |
| `eventos_inscricoes` | Minhas inscrições | `member_id` presente |
| `eventos_pagamentos` | Pagamentos de eventos | Via `inscricao_id` |
| `fin_payment_destinations` | Gerar cobranças PIX | `public_token` funciona |
| `comunicados` | Comunicados do ministério | Estrutura básica OK |
| `certificados_templates` | Exibir certificados | 12 templates disponíveis |
| `batismo_aguas_registros` | Histórico de batismo | FK para members existe |
| `consagracao_registros` | Histórico de consagração | FK para members existe |
| `tesouraria_lancamentos` | Histórico de dízimos | `member_id` presente |
| `carta_pedidos` | Pedidos de carta | Estrutura existe |

### 9.2 Tabelas que Precisam Alteração

| Tabela | Alteração Necessária | Migration |
|--------|---------------------|----------|
| `members` | FK `auth_user_id → auth.users`, índice, RLS self-read | M-01, M-02, M-03 |
| `fin_payment_charges` | ADD `member_id` + índice + RLS self-read | M-07, M-08 |
| `comunicados` | ADD `categoria`, `destinatario_tipo`, `status`, `arquivo_url` | M-10, M-11, M-12 |
| `apresentacao_criancas_registros` | ADD `member_id` FK | M-06 |
| `batismo_aguas_registros` | ADD RLS self-read via `candidato_id` | M-04 |
| `consagracao_registros` | ADD RLS self-read via `member_id` | M-05 |
| `tesouraria_lancamentos` | ADD RLS self-read via `member_id` | M-09 |

### 9.3 Migrations Necessárias (resumo)

| ID | Arquivo Proposto | Descrição |
|----|-----------------|-----------|
| M-01 | `20260526_members_auth_fk.sql` | FK `auth_user_id → auth.users` |
| M-02 | `20260526_members_auth_index.sql` | Índice em `auth_user_id` |
| M-03 | `20260526_members_self_read_rls.sql` | RLS `auth_user_id = auth.uid()` |
| M-04 | `20260526_batismo_self_read_rls.sql` | RLS self-read batismo via candidato_id |
| M-05 | `20260526_consagracao_self_read_rls.sql` | RLS self-read consagração via member_id |
| M-06 | `20260526_apresentacao_add_member_id.sql` | ADD `member_id` em apresentacao_criancas |
| M-07 | `20260526_fin_charges_add_member_id.sql` | ADD `member_id` em fin_payment_charges |
| M-08 | `20260526_fin_charges_self_read_rls.sql` | RLS self-read cobranças |
| M-09 | `20260526_lancamentos_self_read_rls.sql` | RLS self-read lançamentos de tesouraria |
| M-10 | `20260526_comunicados_expand_columns.sql` | ADD `categoria`, `destinatario_tipo`, `status`, `arquivo_url` |
| M-11 | `20260526_comunicados_index.sql` | Índice de listagem mobile |
| M-12 | `20260526_comunicados_member_rls.sql` | RLS membro lê comunicados do ministério |

> **Total: 12 migrations** — nenhuma destrói dado existente. Todas são `ALTER TABLE ADD COLUMN IF NOT EXISTS` ou `CREATE POLICY/INDEX`.

### 9.4 APIs Reutilizáveis (já existem)

| API | Rota | Uso Mobile |
|----|------|-----------|
| Evento público | `GET /v1/eventos/publico/[slug]` | Detalhe de evento |
| Inscrição em evento | `POST /v1/eventos/inscricao` | Inscrever no evento |
| Status de pagamento | `GET /v1/eventos/pagamento/[id]/status` | Checar pagamento |
| Pagar por link | `GET/POST /v1/pagar/[token]` | PIX público |
| Destinos de pagamento | `GET /v1/ministry/payment-destinations` | Listar destinos PIX |
| Membros (CRUD staff) | `/v1/members` + `/v1/members/[id]` | Base para self-service |

### 9.5 APIs Novas Necessárias

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/v1/mobile/auth/register` | Criar conta de membro (por CPF/email) |
| `GET` | `/v1/mobile/member/me` | Dados do membro autenticado (carteirinha) |
| `GET` | `/v1/mobile/member/historico` | Histórico ministerial consolidado |
| `GET` | `/v1/mobile/member/contribuicoes` | Histórico de contribuições/dízimos |
| `GET` | `/v1/mobile/member/eventos` | Minhas inscrições em eventos |
| `GET` | `/v1/mobile/comunicados` | Comunicados do ministério |
| `GET` | `/v1/mobile/eventos/proximos` | Próximos eventos (por congregação) |
| `GET` | `/v1/mobile/dashboard/presidencia` | Consolidado financeiro + KPIs para presidência |

### 9.6 Grau de Prontidão por Módulo

| Módulo | Schema | RLS | API | Total |
|--------|--------|-----|-----|-------|
| Auth Mobile (vínculo) | 80% | 0% | 0% | **27%** |
| Carteirinha Digital | 100% | 0% | 0% | **33%** |
| Histórico Ministerial | 70% | 0% | 0% | **23%** |
| Contribuições Mobile | 60% | 0% | 80% | **47%** |
| Eventos Mobile | 90% | 60% | 60% | **70%** |
| Comunicados | 75% | 0% | 0% | **25%** |
| Dashboard Presidência | 70% | 0% | 0% | **23%** |

**Prontidão Global: ~35%**

> O baixo número reflete que o schema está bem avançado (legado do sistema web), mas as camadas de segurança (RLS para membro) e APIs mobile são zero. O trabalho real é de exposição segura dos dados, não de modelagem.

### 9.7 Bloqueador Crítico

> **Todo o acesso mobile depende de uma única peça: `members.auth_user_id` vinculado a `auth.users` + RLS `auth_user_id = auth.uid()`.** Sem as migrations M-01, M-02 e M-03, nenhuma tela mobile consegue acessar dados de forma segura. Este é o primeiro entregável da FASE E Entrega 1.

---

*Documento gerado em: 2026-05-25*
*Auditoria: FASE E Entrega 0 — GestãoEklesia Mobile/PWA*
*Regra: Somente auditoria — sem UI, sem rotas, sem next-pwa, sem componentes criados.*
