# DASHBOARD 2.0 — PLANO REVISADO (v2)

> Data: 29 de maio de 2026
> Status: **APROVADO — Implementação em andamento (v3 final)**

### Ajustes finais incorporados (v3)
1. Dois rankings: Membros Ativos + Saúde Ministerial (presidência vê saúde primeiro)
2. Central de Pendências: +PIX Vencidos/Expirados → link `/tesouraria`
3. `ministerio_mensagens`: adicionados campos `data_inicio` e `data_fim` — exibe somente se `ativo=true` e data atual entre `data_inicio` e `data_fim`
4. Dashboard Presidência: ranking Saúde Ministerial posicionado acima do ranking de Membros

---

## 1. WIREFRAME TEXTUAL COMPLETO

```
╔═════════════════════════════════════════════════════════════════════════════╗
║  CABEÇALHO EXECUTIVO INSTITUCIONAL                                          ║
║  [LOGO]  Igreja Batista Emanuel                        29 mai 2026 | 14:32  ║
║          Painel Administrativo                         ● Administrador      ║
║          Bem-vindo, João da Silva                                           ║
║  (gradiente: azul-inst #1E3A5F → azul-sec #2563EB)                         ║
╚═════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════╗
║  ATALHOS RÁPIDOS (scroll horizontal no mobile — contextuais por perfil)    ║
║  [👤 + Membro]  [R$↑ Entrada]  [R$↓ Saída]  [✉ Carta]  [📋 EBD]  [⚙ Cfg]  ║
╚═════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════╗
║  📢 MENSAGEM DA PRESIDÊNCIA  (visível apenas se ativa + perfil autorizado) ║
║  ┌──────────────────────┐  Título da Mensagem                              ║
║  │                      │  Texto ou embed do vídeo (YouTube/upload)        ║
║  │   [EMBED VIDEO]      │  — Exibido para: presidencia, administrador      ║
║  │   ou TEXTO           │                                                  ║
║  └──────────────────────┘                                                  ║
╚═════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════╗
║  KPIs — ROW 1 (4 cards)                                                    ║
║  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                  ║
║  │🏛 CONGR.  │  │👥 MEMBROS│  │💰 RECEITA│  │📉 DESPESA│                  ║
║  │   12     │  │   847    │  │ R$28,4k  │  │ R$19,1k  │                  ║
║  │ +2 no mês│  │ ▲ +1,3% │  │ ▲ +8,2% │  │ ▼ -2,1% │                  ║
║  │[TURQUESA]│  │[AZ.INST] │  │ [VERDE]  │  │[VERMELHO]│                  ║
║  └──────────┘  └──────────┘  └──────────┘  └──────────┘                  ║
╚═════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════╗
║  KPIs — ROW 2 (3 cards)                                                    ║
║  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐               ║
║  │  💼 SALDO      │  │  📈 CRESCIMENTO│  │  📲 PIX        │               ║
║  │   R$ 9,3k      │  │     +4,2%      │  │   R$ 12,1k     │               ║
║  │  [positivo ✓]  │  │  vs mês ant.  │  │  % do total    │               ║
║  │ [AZ.SECUNDÁRIO]│  │   [DOURADO]   │  │  [TURQUESA]    │               ║
║  └────────────────┘  └────────────────┘  └────────────────┘               ║
╚═════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════╗
║  🔴 CENTRAL DE PENDÊNCIAS                                                   ║
║                                                                             ║
║  ┌─────────────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ║
║  │🏛 Sem Fechamento    │ │📋 Pareceres │ │✉ Cartas     │ │📅 Eventos   │ ║
║  │   3 congregações    │ │  5 pendentes│ │  8 pendentes│ │  2 próximos │ ║
║  │ [link → tesouraria] │ │[→ presidencia│ │[→ secretaria│ │ [→ eventos] │ ║
║  └─────────────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ ║
║  badge vermelho se > 0, verde se 0 (ok)                                    ║
╚═════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════╗  ╔═════════════════════════════════════════════════╗
║ 🏥 SAÚDE MINISTERIAL║  ║  🔔 ATIVIDADES RECENTES                         ║
║                     ║  ║  [Cartas] [Fluxos] [Pedidos]                    ║
║  Score médio: 78/100║  ║  ─────────────────────────────────────────────  ║
║ [gauge visual]      ║  ║  📄 Carta - João Silva - há 10 min              ║
║                     ║  ║  📄 Carta - Maria Oliveira - ontem              ║
║ ◆ EXCELENTE  2  90+║  ║  ⚙ Fluxo Consagração - pendente                ║
║ ● SAUDÁVEL   6  80+║  ║  ⚙ Fluxo Transferência - concluído             ║
║ ◐ ATENÇÃO    3  60+║  ║  📨 Pedido carta - João P. - pendente           ║
║ ✕ CRÍTICA    1  <60║  ║  [Ver todos →]                                  ║
║                     ║  ╚═════════════════════════════════════════════════╝
║ [Ver congregações →]║
╚═════════════════════╝

╔═════════════════════════════════════════════════════╗  ╔═════════════════╗
║  📊 RECEITAS × DESPESAS — últimos 6 meses           ║  ║ 🍩 PIX & FORMAS ║
║                                                     ║  ║                 ║
║  AreaChart com gradiente                            ║  ║  [DONUT]        ║
║  ▓▓ Entradas | ░░ Saídas                            ║  ║  ■ PIX   45%    ║
║  dez  jan  fev  mar  abr  mai                       ║  ║  ■ Dinheiro 30% ║
║                                                     ║  ║  ■ Cartão  15%  ║
║                                                     ║  ║  ■ Trans.  10%  ║
╚═════════════════════════════════════════════════════╝  ╚═════════════════╝

╔═════════════════════════════════════════════════════════════════════════════╗
║  🏆 RANKING CONGREGAÇÕES (membros ativos)                                   ║
║  Igreja Central   █████████████████████████████████████████  247   #1      ║
║  Filial Norte     ████████████████████████                   148   #2      ║
║  Filial Sul       ████████████████████                       123   #3      ║
╚═════════════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════════════╗
║  📈 CRESCIMENTO DE MEMBROS — últimos 12 meses (LineChart com área)          ║
║  Jan  Fev  Mar  Abr  Mai  Jun  Jul  Ago  Set  Out  Nov  Dez               ║
╚═════════════════════════════════════════════════════════════════════════════╝
```

---

## 2. SAÚDE MINISTERIAL — SCORE COMPOSTO

### Fórmula

```
Score = (F × 0,40) + (S × 0,30) + (A × 0,20) + (E × 0,10)
```

Onde cada dimensão vale 0–100 pontos:

### Dimensão Financeiro — F (40%)

| Critério | Pontos |
|---|---|
| Tem lançamentos no mês corrente | 40 |
| Saldo positivo no mês (entradas > saídas) | 35 |
| Crescimento de receita vs mês anterior ≥ 0% | 25 |

```sql
-- Query: tesouraria_lancamentos
--   GROUP BY congregacao_id
--   WHERE data_lancamento LIKE mesAtual%
--   → tem_lancamentos, sum_entradas, sum_saidas
--   → mês anterior para variação
```

### Dimensão Secretaria — S (30%)

| % Membros Ativos | Pontos Base |
|---|---|
| ≥ 80% | 100 |
| 60–79% | 80 |
| 40–59% | 55 |
| 20–39% | 30 |
| < 20% | 10 |

```sql
-- Query: members
--   GROUP BY congregacao_id
--   COUNT(*) total, COUNT(WHERE status2='ativo') ativos
--   → taxa = ativos / total
```

### Dimensão Auditoria — A (20%)

| Critério | Pontos |
|---|---|
| Tem usuário com atividade nos últimos 30 dias | 50 |
| ≥ 80% dos membros com campos obrigatórios preenchidos | 30 |
| Sem lançamentos rejeitados/estornados no mês | 20 |

```sql
-- Query 1: audit_logs
--   WHERE ministry_id = X AND created_at >= now()-30d
--   → tem_atividade_recente

-- Query 2: members
--   WHERE congregacao_id = X
--   → % com nome + status + data_nascimento preenchidos
```

### Dimensão Eventos — E (10%)

| Critério | Pontos |
|---|---|
| Tem evento programado nos próximos 30 dias | 50 |
| Último evento teve ≥ 60% de presença | 30 |
| Realizou ≥ 2 eventos no mês anterior | 20 |

```sql
-- Query: eventos
--   WHERE congregacao_id = X
--   → futuro: data_inicio BETWEEN now() AND now()+30d AND status='programado'
--   → presença: (confirmados/capacidade) do último evento
```

### Classificação Final

| Faixa | Label | Cor |
|---|---|---|
| 90–100 | Excelente | `#1E3A5F` azul profundo |
| 80–89 | Saudável | `#16A34A` verde |
| 60–79 | Atenção | `#D97706` âmbar |
| 0–59 | Crítica | `#DC2626` vermelho |

---

## 3. CENTRAL DE PENDÊNCIAS — MAPA DE QUERIES

| Card | Tabela | Query | Link |
|---|---|---|---|
| **Congr. sem fechamento** | `congregacoes` LEFT JOIN `tesouraria_lancamentos` | `SELECT c.id WHERE NOT EXISTS (lancamentos no mes corrente)` | `/tesouraria` |
| **Pareceres pendentes** | `flow_instances` | `COUNT WHERE status IN ('pendente','em_analise')` | `/presidencia/prestacao-contas-oficial` |
| **Cartas pendentes** | `carta_pedidos` | `COUNT WHERE status = 'pendente'` | `/secretaria/cartas` |
| **Eventos próximos** | `eventos` | `COUNT WHERE data_inicio BETWEEN now() AND now()+30d AND status = 'programado'` | `/eventos` |
| **PIX Vencidos** | `tesouraria_lancamentos` | `COUNT WHERE forma_pagamento='pix' AND tipo_movimento='entrada' AND status='vencido'` | `/tesouraria` |

**Regra de badge:** `> 0` → badge vermelho com contagem; `= 0` → badge verde "OK"

---

## 4. MENSAGEM DA PRESIDÊNCIA

### Nova Migration Necessária

```sql
-- supabase/migrations/20260529_ministerio_mensagens.sql

CREATE TABLE ministerio_mensagens (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ministry_id   uuid NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  titulo        text NOT NULL,
  conteudo_texto text,
  video_url     text,
  video_tipo    text CHECK (video_tipo IN ('youtube', 'upload', 'texto')),
  roles_visiveis text[] DEFAULT '{}',   -- vazio = todos; ou ['presidencia','administrador']
  ativo         boolean DEFAULT true,
  data_inicio   date NOT NULL DEFAULT CURRENT_DATE,  -- exibe a partir desta data
  data_fim      date NOT NULL DEFAULT (CURRENT_DATE + 30),  -- expira nesta data
  ordem         integer DEFAULT 0,
  criado_por    uuid REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE ministerio_mensagens ENABLE ROW LEVEL SECURITY;
-- RLS: leitura = ministry_id match + role in roles_visiveis + CURRENT_DATE BETWEEN data_inicio AND data_fim
-- Escrita = administrador ou presidencia
```

### Comportamento do Componente

```
Usuário acessa o dashboard
  ↓
Query: SELECT * FROM ministerio_mensagens
       WHERE ministry_id = X AND ativo = true
       AND data_inicio <= CURRENT_DATE AND data_fim >= CURRENT_DATE
       AND (roles_visiveis = '{}' OR role_atual = ANY(roles_visiveis))
       ORDER BY ordem ASC LIMIT 1
  ↓
Se retorna mensagem:
  ├── video_tipo = 'youtube' → extrai ID do YouTube → embed <iframe>
  ├── video_tipo = 'upload'  → <video src={video_url} controls>
  └── video_tipo = 'texto'   → renderiza conteudo_texto (com sanitização)

Gerenciamento (editar/criar):
  └── /configuracoes/mensagem-presidencia  [NOVO — fora do escopo da dashboard]
```

---

## 5. NOVA PALETA DE CORES

| Token | Hex | Uso |
|---|---|---|
| `blue-inst` | `#1E3A5F` | Cabeçalho, KPI Membros, badge Excelente |
| `blue-sec` | `#2563EB` | KPI Saldo, botões primários |
| `golden` | `#D4A017` | KPI Crescimento, destaques |
| `turquoise` | `#0D9488` | KPI Congregações, KPI PIX |
| `green` | `#16A34A` | KPI Receita, badge Saudável |
| `red` | `#DC2626` | KPI Despesa, badge Crítica |
| `amber` | `#D97706` | badge Atenção |
| `bg-dark` | `#0F172A` | Fundo geral (dark) |
| `bg-card` | `#1E293B` | Cards |
| `bg-card-hover` | `#253047` | Hover em cards |
| `border` | `rgba(255,255,255,0.08)` | Bordas sutis |

---

## 6. MAPA COMPLETO DE MÉTRICAS (v2)

| KPI / Seção | Tabela | Campo chave | Cálculo | Delta |
|---|---|---|---|---|
| Congregações | `congregacoes` | `id` | COUNT | +N criadas no mês |
| Membros | `members` | `status2` | COUNT WHERE ativo | % vs mês anterior |
| Receita Mês | `tesouraria_lancamentos` | `tipo_movimento='entrada'` | SUM(valor) mês atual | % vs mês anterior |
| Despesa Mês | `tesouraria_lancamentos` | `tipo_movimento='saida'` | SUM(valor) mês atual | % vs mês anterior |
| Saldo Mês | calculado | receita − despesa | R$ | badge +/− |
| Crescimento | `members` | `created_at` | (novos_mês / total_ant − 1) × 100 | ↑↓ |
| **PIX** | `tesouraria_lancamentos` | `forma_pagamento='pix'` | SUM(valor) WHERE tipo='entrada' mês atual | % do total de receita |
| Sem fechamento | `congregacoes` + `tesouraria_lancamentos` | — | LEFT JOIN sem lançamentos no mês | contagem |
| Pareceres pend. | `flow_instances` | `status` | COUNT pendente/em_analise, tipo parecer | contagem |
| Cartas pend. | `carta_pedidos` | `status` | COUNT WHERE pendente | contagem |
| Eventos próximos | `eventos` | `data_inicio`, `status` | COUNT próximos 30 dias | contagem |
| Score Saúde F | `tesouraria_lancamentos` | por congregacao_id | algoritmo 40pts + 35pts + 25pts | — |
| Score Saúde S | `members` | por congregacao_id | % ativos → faixa 10/30/55/80/100 | — |
| Score Saúde A | `audit_logs` + `members` | por ministry_id | atividade recente + completude | — |
| Score Saúde E | `eventos` | por congregacao_id | futuro + presença + frequência | — |
| Mensagem Presid. | `ministerio_mensagens` | `ativo`, `roles_visiveis` | match role + ativo=true | — |

---

## 7. DASHBOARD POR PERFIL

| Seção | Admin | Presidência | Financeiro | Conselho Fiscal | Secretaria |
|---|:---:|:---:|:---:|:---:|:---:|
| Cabeçalho executivo | ✅ | ✅ | ✅ | ✅ | ✅ |
| Atalhos contextuais | ✅ pleno | ✅ leitura | ✅ financeiro | ✅ leitura | ✅ secretaria |
| Mensagem Presidência | ✅ | ✅ | ❌ | ❌ | ❌ |
| KPI Congregações | ✅ | ✅ | ❌ | ❌ | ✅ |
| KPI Membros | ✅ | ✅ | ❌ | ❌ | ✅ |
| KPI Receita | ✅ | ✅ | ✅ | ✅ | ❌ |
| KPI Despesa | ✅ | ✅ | ✅ | ✅ | ❌ |
| KPI Saldo | ✅ | ✅ | ✅ | ✅ | ❌ |
| KPI Crescimento | ✅ | ✅ | ❌ | ❌ | ✅ |
| KPI PIX | ✅ | ✅ | ✅ | ✅ | ❌ |
| Central de Pendências | ✅ plena | ✅ pareceres+eventos | ✅ fechamentos | ✅ leitura | ✅ cartas+eventos |
| Saúde Ministerial | ✅ | ✅ | ❌ | ❌ | ❌ |
| Atividades recentes | ✅ | ✅ resumo | ✅ lançamentos | ✅ leitura | ✅ cartas+fluxos |
| Receitas × Despesas | ✅ | ✅ | ✅ | ✅ | ❌ |
| Arrecadação por forma | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ranking Congregações | ✅ | ✅ | ❌ | ❌ | ✅ |
| Crescimento Membros | ✅ | ✅ | ❌ | ❌ | ✅ |

### Atalhos por Perfil

| Perfil | Atalhos disponíveis |
|---|---|
| **Administrador** | + Membro, Lançar Entrada, Lançar Saída, Emitir Carta, Chamada EBD, Novo Usuário, Configurações |
| **Presidência** | Relatório Financeiro, Ver Membros, Ver Congregações, Configurações |
| **Financeiro** | Lançar Entrada, Lançar Saída, Relatório Financeiro, Exportar |
| **Conselho Fiscal** | Relatório Financeiro, Exportar (apenas leitura) |
| **Secretaria** | + Membro, Emitir Carta, Chamada EBD, Novo Fluxo |

---

## 8. ESTRUTURA DE COMPONENTES (v2)

```
src/
├── app/
│   └── dashboard/
│       └── page.tsx                           ← REFATORADO
│
└── components/
    └── dashboard/                             ← NOVA PASTA
        ├── ExecutiveHeader.tsx                ← NOVO
        ├── QuickActionsBar.tsx                ← NOVO
        ├── KpiCard.tsx                        ← NOVO (genérico)
        ├── KpiGrid.tsx                        ← NOVO (7 KPIs, layout 4+3)
        ├── PendenciesPanel.tsx                ← NOVO ★ Central de Pendências
        ├── PresidencyMessage.tsx              ← NOVO ★ Mensagem da Presidência
        ├── MinisterialHealthPanel.tsx         ← NOVO ★ Score composto
        ├── RecentActivityPanel.tsx            ← NOVO
        ├── FinancialAreaChart.tsx             ← NOVO
        ├── RevenueByMethodChart.tsx           ← NOVO (forma pagamento + PIX)
        ├── CongregationRanking.tsx            ← NOVO
        └── MemberGrowthChart.tsx              ← NOVO
```

### Props dos Componentes Principais

```typescript
// PendenciesPanel.tsx
interface PendenciesData {
  semFechamento: number;
  pareceresP:    number;
  cartasP:       number;
  eventosProx:   number;
}

// MinisterialHealthPanel.tsx
interface HealthScore {
  congregacaoId:   string;
  congregacaoNome: string;
  scoreFinanceiro: number;   // 0-100
  scoreSecretaria: number;   // 0-100
  scoreAuditoria:  number;   // 0-100
  scoreEventos:    number;   // 0-100
  scoreFinal:      number;   // 0-100 (ponderado)
  classificacao:   'excelente' | 'saudavel' | 'atencao' | 'critica';
}

// PresidencyMessage.tsx
interface MinisterioMensagem {
  id:             string;
  titulo:         string;
  conteudo_texto: string | null;
  video_url:      string | null;
  video_tipo:     'youtube' | 'upload' | 'texto';
}

// KpiCard.tsx
interface KpiCardProps {
  title:       string;
  value:       string | number;
  delta?:      number;
  deltaLabel?: string;
  deltaType?:  'percent' | 'absolute';
  icon:        LucideIcon;
  color:       'inst' | 'secondary' | 'golden' | 'turquoise' | 'green' | 'red';
  badge?:      'positive' | 'negative' | 'neutral';
  loading?:    boolean;
}
```

---

## 9. ARQUIVOS QUE SERÃO ALTERADOS

| # | Arquivo | Tipo | Mudança |
|---|---|---|---|
| 1 | `src/app/dashboard/page.tsx` | **Refatorado** | Mantém lógica de dados; adiciona queries: PIX, pendências, score saúde, mensagem presidência |
| 2 | `tailwind.config.js` | **Alterado** | Tokens: `blue-inst`, `blue-sec`, `golden`, `turquoise` |
| 3 | `src/components/dashboard/ExecutiveHeader.tsx` | **Novo** | — |
| 4 | `src/components/dashboard/QuickActionsBar.tsx` | **Novo** | — |
| 5 | `src/components/dashboard/KpiCard.tsx` | **Novo** | — |
| 6 | `src/components/dashboard/KpiGrid.tsx` | **Novo** | 7 KPIs, grid 4+3 |
| 7 | `src/components/dashboard/PendenciesPanel.tsx` | **Novo** | ★ Central de Pendências |
| 8 | `src/components/dashboard/PresidencyMessage.tsx` | **Novo** | ★ Mensagem da Presidência |
| 9 | `src/components/dashboard/MinisterialHealthPanel.tsx` | **Novo** | ★ Score composto |
| 10 | `src/components/dashboard/RecentActivityPanel.tsx` | **Novo** | — |
| 11 | `src/components/dashboard/FinancialAreaChart.tsx` | **Novo** | — |
| 12 | `src/components/dashboard/RevenueByMethodChart.tsx` | **Novo** | PIX + formas de pagamento |
| 13 | `src/components/dashboard/CongregationRanking.tsx` | **Novo** | — |
| 14 | `src/components/dashboard/MemberGrowthChart.tsx` | **Novo** | — |
| 15 | `supabase/migrations/20260529_ministerio_mensagens.sql` | **Novo** | Tabela ministerio_mensagens + RLS |

**Total: 2 alterados + 12 novos componentes + 1 migration**

---

## 10. RESUMO DAS MUDANÇAS v1 → v2

| Item | v1 (aprovação inicial) | v2 (revisado) |
|---|---|---|
| KPIs | 6 (grid uniforme) | **7** (grid 4+3 — +PIX) |
| Saúde Ministerial | ativos/total | **Score composto 4 dimensões** |
| Seção nova | — | **Central de Pendências** |
| Seção nova | — | **Mensagem da Presidência** |
| Gráfico arrecadação | Donut por tipo de receita | **Donut por forma de pagamento** (PIX em destaque) |
| Migration | nenhuma | **+1 migration** `ministerio_mensagens` |
| Componentes | 10 | **12** (+PendenciesPanel, +PresidencyMessage) |

---

## 11. REGRAS DE NEGÓCIO PRESERVADAS (sem toque)

- ✅ Redirecionamento automático por perfil (SUPERINTENDENTE → EBD, FINANCEIRO → tesouraria, etc.)
- ✅ Filtro de escopo por `congregacao_id`, `supervisao_id`, `ministry_id`
- ✅ Controle de acesso via `useUserContext` + `podeAcessar()`
- ✅ Verificação de plano via `usePlanFeatures`
- ✅ Todas as queries Supabase existentes mantidas
- ✅ Responsividade mobile preservada
