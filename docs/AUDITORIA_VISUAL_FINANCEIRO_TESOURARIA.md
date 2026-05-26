# Auditoria Visual e Funcional — Tesouraria, Financeiro, Configurações

> Gerado em: 23/05/2026  
> Objetivo: mapear o que está disponível para o usuário final antes de avançar para Eventos Pagos (Fase 4).

---

## 1. Tabela-resumo por recurso

| Recurso | Banco? | Código? | UI visível? | Rota | Pronto pro usuário? | Pendência |
|---|:---:|:---:|:---:|---|:---:|---|
| Lançamentos — CRUD completo | ✅ | ✅ | ✅ | `/tesouraria → Lançamentos` | ✅ | — |
| Dashboard Tesouraria (KPIs + gráfico) | ✅ | ✅ | ✅ | `/tesouraria → Dashboard` | ✅ | — |
| Fechamento mensal protegido | ✅ | ✅ | ✅ | `/tesouraria → Caixa Mensal` | ✅ | — |
| Relatório + Export CSV | ✅ | ✅ | ✅ | `/tesouraria → Relatório` | ✅ | — |
| Dizimistas | ✅ | ✅ | ✅ | `/tesouraria → Dizimistas` | ✅ | — |
| Dashboard Financeiro Avançado | ✅ | ✅ | ✅ | `/financeiro` | ⚠️ | Vazio sem contas/categorias cadastradas |
| Select **Conta/Caixa** no formulário de lançamento | ✅ | ✅ | ⚠️ | `/tesouraria → form` | ⚠️ | **Condicional:** aparece só se `fin_contas.length > 0` |
| Select **Categoria** no formulário de lançamento | ✅ | ✅ | ⚠️ | `/tesouraria → form` | ⚠️ | **Condicional:** aparece só se `fin_categorias.length > 0` |
| **CRUD de `fin_contas`** (criar/editar caixas) | ✅ | ❌ | ❌ | _Nenhuma_ | ❌ | **Tela não existe** |
| **CRUD de `fin_categorias`** (plano de contas) | ✅ | ❌ | ❌ | _Nenhuma_ | ❌ | **Tela não existe** |
| Gateways — configurar ASAAS | ✅ | ✅ | ✅ | `/configuracoes → Gateways` | ✅ | Funcional (só ADMIN) |
| Gateways — configurar EFI | ✅ | ✅ | ✅ | `/configuracoes → Gateways` | ✅ | Funcional (só ADMIN) |
| Webhook multi-tenant por ministério | ✅ | ❌ | ❌ | _Nenhuma_ | ❌ | Fase 4A |
| Eventos pagos | ✅ | ❌ | ❌ | _Nenhuma_ | ❌ | Fase 4A |

---

## 2. Detalhamento por tela

### `/tesouraria`

**O que existe e funciona:**
- 5 abas: Dashboard, Lançamentos, Caixa Mensal, Relatório, Dizimistas
- Formulário de lançamento salva corretamente: `conta_id`, `categoria_id`, `departamento_id`, `member_id`, `tipo_movimento`, `forma_pagamento`
- Fechamento mensal bloqueia edição de meses fechados via trigger no banco
- Relatório por período com filtro de tipo (entradas/saídas/tudo) e export CSV
- Os campos **Conta/Caixa** e **Categoria financeira** já existem no formulário, mas ficam **invisíveis** enquanto não há registros em `fin_contas` e `fin_categorias`:

```tsx
// Condicional atual — usuário nunca vê enquanto não houver dados
{finContas.length > 0 && (
  <select value={form.conta_id} ...>...</select>
)}
{finCategorias.length > 0 && (
  <select value={form.categoria_id} ...>...</select>
)}
```

**O que não existe:**
- Nenhuma seção para criar/editar/excluir **Contas e Caixas** (`fin_contas`)
- Nenhuma seção para criar/editar/excluir **Categorias financeiras** (`fin_categorias`)

---

### `/financeiro`

**O que existe e funciona:**
- Sidebar: visível somente para planos com `has_modulo_financeiro_avancado = true`
- Dashboard read-only:
  - 6 KPI cards (Entradas, Saídas, Saldo, Dízimos, Contas ativas, Resultado %)
  - Gráfico de barras — Entradas × Saídas — últimos 12 meses
  - Pie chart de entradas por categoria
  - Tabela de saídas por categoria
  - Tabela de contas com saldo estimado
  - Alerta de fechamento pendente do mês anterior
  - Filtro por mês (MonthPicker)

**Problema crítico:** quando nenhuma conta está cadastrada, exibe:

```
"Nenhuma conta cadastrada.
 Acesse Tesouraria para configurar caixas e contas bancárias."
```

Mas a **Tesouraria também não tem essa tela**. O link leva o usuário a lugar nenhum funcionalmente.

**O que não existe:**
- Qualquer CRUD — a página é 100% leitura
- Gerenciamento de `fin_contas` ou `fin_categorias`

---

### `/configuracoes → aba Gateways`

**O que existe e funciona:**
- Aba "💳 Gateways de Pagamento" visível para administradores
- Cards para ASAAS e EFI com:
  - Toggle ativo/inativo
  - Botão "Configurar credenciais" (abre modal com campos de API key)
  - Botão "Testar conexão"
  - Exibição do ambiente (sandbox / production)
  - URL de webhook gerada automaticamente por `webhook_token`
- API routes funcionais:
  - `GET /api/v1/ministry/gateway` — lista gateways do ministério (sem credenciais)
  - `POST /api/v1/ministry/gateway` — salva/atualiza gateway com credenciais criptografadas
- Credenciais salvas com AES-256-GCM via `CREDENTIALS_ENCRYPTION_KEY`

**O que não existe:**
- Configuração de `fin_contas` nas configurações
- Configuração de `fin_categorias` nas configurações

---

## 3. O gap principal — ciclo sem saída

O banco e o código de consumo estão completos. O problema é que **não existe nenhuma tela de administração** para `fin_contas` e `fin_categorias`. Isso cria um ciclo:

```
Usuário quer usar "Conta/Caixa" no formulário de lançamento
  → Select não aparece (condicionado a fin_contas.length > 0)
  → Usuário procura onde cadastrar contas
  → /financeiro diz "acesse Tesouraria"
  → /tesouraria não tem a tela
  → ❌ Loop sem saída — impossível sem intervenção direta no banco
```

O mesmo comportamento ocorre com categorias financeiras.

---

## 4. Estado das migrations aplicáveis

| Migration | Conteúdo | Status |
|---|---|---|
| `20260523100000_fin_categorias.sql` | Tabela `fin_categorias` + RLS + categorias padrão do sistema (`is_sistema=true`) | Criada, **não aplicada ao banco** |
| `20260523110000_fin_contas.sql` | Tabela `fin_contas` + RLS + índice único de conta padrão | Criada, **não aplicada ao banco** |
| `20260523120000_tesouraria_campos_fundacao.sql` | `conta_id`, `categoria_id`, `origem_modulo`, `origem_id` em `tesouraria_lancamentos` | Criada, **não aplicada ao banco** |
| `20260523130000_ministry_payment_gateways.sql` | Tabela `ministry_payment_gateways` + RLS + RPC segura | Criada, **não aplicada ao banco** |

> ⚠️ Nenhuma dessas migrations foi aplicada ao banco de produção ainda. Os selects de Conta/Caixa e Categoria no formulário **nunca aparecem** até que `fin_contas` e `fin_categorias` existam no banco com dados.

---

## 5. O que precisa ser implementado

### Prioridade 1 — Desbloqueadores imediatos (antes de Fase 4)

| Item | Onde implementar | Complexidade |
|---|---|---|
| Aplicar as 4 migrations ao banco (Supabase) | Supabase Dashboard / CLI | Baixa |
| CRUD de `fin_contas` — criar caixas, contas bancárias, chaves PIX, saldo inicial | Nova aba "Contas" dentro de `/tesouraria` | Média |
| CRUD de `fin_categorias` — plano de contas customizável + categorias padrão do sistema | Nova aba "Categorias" dentro de `/tesouraria` | Média |

### Prioridade 2 — Para Fase 4 funcionar corretamente

| Item | Por quê é necessário |
|---|---|
| `fin_contas` cadastrada | O webhook de evento pago precisa saber em qual conta creditar o recebimento |
| `fin_categorias` com categoria "Inscrição de Evento" | O sync `eventos_pagamentos → tesouraria_lancamentos` precisa de `categoria_id` para classificar a receita |
| `ministry_payment_gateways` aplicado + configurado | Sem isso, `/configuracoes → Gateways` não carrega (tabela inexistente no banco) |

### Proposta de estrutura da aba "Contas" na Tesouraria

```
/tesouraria → nova aba "Contas"
  ├── Lista de contas/caixas (nome, tipo, saldo inicial, status ativo/inativo, conta padrão ★)
  ├── Botão "+ Nova Conta"
  ├── Formulário: nome, tipo (caixa/conta_corrente/poupanca/pix/fundo/outro),
  │              banco, agência, conta, chave PIX, saldo inicial, congregação (opcional)
  └── Toggle: definir como conta padrão
```

### Proposta de estrutura da aba "Categorias" na Tesouraria

```
/tesouraria → nova aba "Categorias"
  ├── Seção: Categorias do sistema (is_sistema=true) — somente leitura
  ├── Seção: Categorias personalizadas — CRUD completo
  ├── Filtro: Entradas / Saídas / Ambas
  └── Formulário: nome, tipo_movimento, código, cor, ícone, categoria pai (hierarquia)
```
