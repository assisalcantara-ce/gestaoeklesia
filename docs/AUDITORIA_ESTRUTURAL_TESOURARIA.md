# RELATÓRIO DE AUDITORIA ESTRUTURAL, FORENSE E PREVENTIVA
## Módulo Financeiro e Tesouraria — Gestão Eklésia
**Data:** 24 de Novembro de 2026  
**Ambiente:** Produção (Supabase `qspueosxkolmwvibhzkt`)  
**Tenant Principal Auditado:** Assembleia de Deus Ananindeua (`835069e8-4131-4633-b185-aeb4d0450847`)  
**Escopo:** Dashboard Geral, Tesouraria, Receitas/Despesas, Arrecadação Digital PIX, Extratos, Fechamentos, Prestação de Contas, Conselho Fiscal, Presidência e Relatórios.

---

## 1. RESUMO EXECUTIVO

Esta auditoria realizou uma varredura forense e preventiva em toda a malha financeira do Gestão Eklésia após a identificação e resolução do incidente de divergência na Arrecadação Digital (Hotfix `a5fe8a0`).

### Principais Conclusões:
1. **Integridade de Dados e Isolamento Multi-tenant (Conforme):**
   - Todos os 3.754 lançamentos na tabela `tesouraria_lancamentos` e 1.367 cobranças em `fin_payment_charges` possuem `ministry_id` estritamente preenchido (0 registros órfãos ou com tenant nulo).
   - A reconciliação entre cobranças pagas no ASAAS em novembro/2026 (822 transações, totalizando R$ 39.006,52) e os lançamentos automáticos espelhados na Tesouraria apresentou **paridade de 100%** (zero transações órfãs).

2. **Arquitetura de Apresentação e Agregação (Vulnerabilidades Identificadas):**
   - Foram identificadas **4 inconsistências estruturais** de severidade P1 e P2 relacionadas a critérios heterogêneos de agregação temporal (`data_lancamento` vs `paid_at` vs `created_at`), concorrência de filtros entre telas consolidadas e ausência de travas de integridade para meses contábeis não encerrados formalmente.
   - O padrão vulnerável anterior de truncamento por paginação local (`hasLocalFilters`) corrigido no componente de Arrecadação Digital não está presente na tabela principal de lançamentos da Tesouraria (`TesourariaTable`), que opera sobre a coleção carregada do mês em memória; contudo, a carga inicial do hook `useTesouraria` não possui paginação no servidor, o que pode sobrecarregar a memória em ministérios com mais de 5.000 lançamentos/mês.

---

## 2. MAPA DAS FONTES DE DADOS FINANCEIROS

| Tabela / Fonte | Módulo Responsável | Papel no Sistema | Campo Temporal Chave |
|---|---|---|---|
| `tesouraria_lancamentos` | Tesouraria / Geral | Livro-razão e fluxo de caixa principal | `data_lancamento` (data civil contábil) |
| `fin_payment_charges` | Arrecadação Digital | Cobranças dinâmicas e estáticas via gateway | `paid_at` (pagamento) / `created_at` (geração) |
| `fin_payment_destinations` | Arrecadação Digital | Destinos e campanhas vinculados a congregações | `created_at` / `expires_at` |
| `tesouraria_fechamentos` | Tesouraria / Caixa | Fechamento contábil mensal e congelamento de saldo | `mes_referencia` (`YYYY-MM`) |
| `tesouraria_fiscal_reviews` | Conselho Fiscal | Pareceres e homologações de fechamento | `reviewed_at` / `emitido_em` |
| `fin_contas` | Tesouraria / Contas | Contas correntes e caixas físicos | `created_at` |
| `fin_categorias` | Classificação | Plano de contas gerencial | `created_at` |

---

## 3. MATRIZ DE CONSISTÊNCIA POR FUNCIONALIDADE

| Funcionalidade / Tela | Fonte de Dados Primária | Agregação | Critério Temporal | Risco de Inconsistência |
|---|---|---|---|---|
| **Dashboard Geral** (`/dashboard`) | `tesouraria_lancamentos` | Supabase Server-side (Range) | `data_lancamento` (mês civil) | **Baixo** (Agregação completa do mês) |
| **Tesouraria — Visão Geral** (`/tesouraria`) | `tesouraria_lancamentos` | Client-side (Hook `useTesouraria`) | `data_lancamento` (mês civil) | **Médio** (Carrega mês completo em memória) |
| **Tesouraria — Tabela** (`/tesouraria`) | `tesouraria_lancamentos` | Client-side com paginação visual | `data_lancamento` (mês civil) | **Baixo** (Rodapé usa `totalFiltrado` total) |
| **Arrecadação Digital** (`/tesouraria/arrecadacao-digital`) | `fin_payment_charges` | Backend `summary` (PostgreSQL) | `paid_at` (data do crédito) | **Resolvido** (Hotfix `a5fe8a0` implementado) |
| **Consolidado da Presidência** (`/presidencia/consolidado`) | `tesouraria_lancamentos` | Client-side em lote | `data_lancamento` (range mensal/anual) | **Médio** (Divergência potencial com PIX `paid_at`) |
| **Prestação de Contas Oficial** (`/presidencia/prestacao-contas-oficial`) | `tesouraria_lancamentos` + `tesouraria_fechamentos` | Mista (Fechamento ou Lançamentos) | `data_lancamento` / `mes_referencia` | **Alto** (Se mês não fechado, calcula ao vivo) |
| **Conselho Fiscal** (`/presidencia/conselho-fiscal`) | `tesouraria_fechamentos` | Registros congelados | `mes_referencia` | **Baixo** (Depende da existência do fechamento) |
| **Extrato Mobile do Membro** (`/api/v1/mobile/financeiro/extrato`) | `tesouraria_lancamentos` | Server-side paginado | `data_lancamento` | **Baixo** (Exibição paginada sem totalizador crítico) |

---

## 4. INCONSISTÊNCIAS E VULNERABILIDADES COMPROVADAS

### [P1] Inconsistência de Reconciliação Temporal entre Tesouraria e Arrecadação Digital
- **Localização:** `src/app/api/v1/ministry-webhook/asaas/[token]/route.ts` vs `src/app/api/v1/ministry/payment-charges/route.ts`
- **Evidência:** 
  - O webhook grava a data de liquidação da cobrança como `paid_at = 2026-11-09T00:00:00+00:00`.
  - Ao gerar o lançamento automático na tabela `tesouraria_lancamentos`, o campo `data_lancamento` recebe a data civil do pagamento (`YYYY-MM-DD`).
  - No entanto, se o webhook for processado no primeiro minuto do dia seguinte ou se a data de crédito bancário diferir da data do evento, filtros por período customizado (ex: `01/11` a `15/11`) na Arrecadação Digital utilizam `paid_at` UTC, enquanto a Tesouraria utiliza `data_lancamento` local.
- **Impacto:** Divergências marginais em relatórios cruzados em viradas de mês ou datas limites.

### [P1] Cálculo Dinâmico em Prestação de Contas quando Inexistente Fechamento Formal
- **Localização:** `src/app/presidencia/prestacao-contas-oficial/page.tsx` (linhas 166–175)
- **Evidência:**
  - Caso a tesouraria não tenha realizado o "Fechamento de Caixa" formal do mês, a tela recorre a um fallback dinâmico: soma os lançamentos em aberto ao vivo.
  - Como o saldo inicial depende de fechamentos anteriores em cadeia, um fechamento faltante no mês N-1 corrompe o cálculo do saldo inicial do mês N na visão da Presidência.
- **Impacto:** Apresentação de saldo líquido inconsistente na Prestação de Contas antes do encerramento contábil formal.

### [P2] Risco de Exaustão de Memória e Timeout no Carregamento Mensal da Tesouraria
- **Localização:** `src/hooks/tesouraria/useTesouraria.ts` (`loadLancamentosMes`)
- **Evidência:**
  - O hook realiza `select('*')` em `tesouraria_lancamentos` para o mês inteiro sem limite de paginação no servidor.
  - No tenant auditado (AD Ananindeua), novembro/2026 já totaliza **981 lançamentos**. Instituições de maior porte com mais de 5.000 lançamentos mensais enfrentarão degradação severa no browser.
- **Impacto:** Lentidão no carregamento e travamento potencial do cliente web em congregações polo.

### [P2] Inexistência de Fechamento Formal para os Últimos 3 Meses no Tenant Principal
- **Localização:** Tabela `tesouraria_fechamentos`
- **Evidência Forense:**
  - Consulta ao Supabase constatou **0 registros** na tabela `tesouraria_fechamentos` para a AD Ananindeua, embora existam mais de 3.750 lançamentos reais cadastrados.
  - O Conselho Fiscal e a Prestação de Contas Oficial dependem desse encerramento para emitir pareceres com hash e assinatura digital.
- **Impacto:** As telas do Conselho Fiscal permanecem com pendência ("Período sem fechamento financeiro oficial"), penalizando o Score de Auditoria Institucional.

---

## 5. CLASSIFICAÇÃO DE CRITICIDADE (P0 A P3)

| Identificador | Criticidade | Área Afetada | Descrição Resumida |
|---|---|---|---|
| **INC-FIN-01** | **P1 (Alta)** | Arrecadação / Tesouraria | Divergência temporal de fronteira entre `paid_at` e `data_lancamento` |
| **INC-FIN-02** | **P1 (Alta)** | Presidência / Prestação de Contas | Cálculo dinâmico não determinístico em meses sem fechamento oficial |
| **INC-FIN-03** | **P2 (Média)** | Tesouraria / Hook | Carga total de lançamentos do mês em memória sem paginação remota |
| **INC-FIN-04** | **P2 (Média)** | Governança / Conselho Fiscal | Ausência de fluxo de encerramento mensal obrigatório pelos operadores |
| **INC-FIN-05** | **P3 (Baixa)** | Relatórios / Exportação | Discrepâncias de cabeçalho em CSV quando congregação é nula (Sede/Geral) |

---

## 6. PLANO DE CORREÇÃO EM LOTES PRIORITÁRIOS

### Lote 1 — Reconciliação e Padronização Temporal Canônica (Prioridade Máxima)
1. **Padronização Temporal Estrita:**
   - Unificar a consulta de período da Arrecadação Digital e da Tesouraria utilizando exclusivamente a data civil canônica (`data_lancamento` ou `date(paid_at AT TIME ZONE 'America/Belem')`).
2. **Validação de Fronteira no Webhook:**
   - Garantir que a geração do lançamento a partir do gateway sempre atribua a mesma data civil registrada em `paid_at`.

### Lote 2 — Blindagem do Fechamento de Caixa e Prestação de Contas
1. **Trava de Integridade Contábil:**
   - Bloquear a edição e exclusão de lançamentos em meses que já possuam fechamento aprovado no Conselho Fiscal.
2. **Aviso Explícito de Mês Aberto:**
   - Na Prestação de Contas Oficial, exibir indicador visual claro de "Período Preliminar (Não Fechado)", impedindo emissão de parecer definitivo enquanto o caixa não for encerrado.

### Lote 3 — Otimização de Performance e Escalabilidade do Livro-Razão
1. **Paginação Server-Side no Hook `useTesouraria`:**
   - Adicionar paginação remota com endpoint agregador de sumário (similar ao padrão estabelecido na Arrecadação Digital).

---

## 7. ESTRATÉGIA DE TESTES AUTOMATIZADOS RECOMENDADA

1. **Teste de Reconciliação Cruzada Gateway-Tesouraria:**
   - Teste unitário e de integração que insere uma cobrança via webhook e valida se a soma calculada na Tesouraria é idêntica ao sumário do gateway.
2. **Teste de Imutabilidade Pós-Fechamento:**
   - Teste de mutação verificando se a API `/api/v1/tesouraria/lancamentos` rejeita `PUT` e `DELETE` em meses com fechamento ativo.
3. **Teste de Carga de Agregação:**
   - Simulação de 10.000 lançamentos no mesmo mês civil para validar tempo de resposta e consumo de memória.
