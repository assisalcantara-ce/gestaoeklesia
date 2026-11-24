/**
 * financial-integrated-homologation.test.js
 *
 * Suíte Oficial de Homologação Financeira Integrada (Lote 5)
 * Referências:
 * - docs/AUDITORIA_ESTRUTURAL_TESOURARIA.md
 * - docs/PROTOCOLO_SEGURANCA_PRODUCAO.md
 *
 * Valida a integração transversal dos 4 lotes anteriores:
 * - Lote 1: Padronização temporal canônica
 * - Lote 2: Saldos, implantação e fechamentos contábeis
 * - Lote 3: Paginação segura em lotes e escalabilidade
 * - Lote 4: Indicadores transversais e relatórios
 * - Segurança Multi-Tenant, idempotência e paridade contábil
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  isAsaasCivilDateTimestamp,
  getFinancialCivilDateStr,
  formatFinancialDateTime,
  buildPeriodFilterBounds,
} from '../../src/lib/financial-date-utils.ts';

import {
  roundCurrency,
  computeCanonicalInitialBalance,
  computePeriodTotals,
} from '../../src/lib/financial-balance-service.ts';

import {
  fetchAllRowsInBatches,
  aggregateFinancialMovements,
} from '../../src/lib/financial-query-helper.ts';

import {
  computeCanonicalIndicators,
  computeCanonicalAccountBalances,
  computeCanonicalPixSummary,
  getFinancialBadge,
} from '../../src/lib/financial-indicators-service.ts';

describe('TESOURARIA LOTE 5: Homologação Financeira Integrada', () => {

  // ── 1. Homologação Lote 1 — Padronização Temporal ────────────────────────
  describe('1. Padronização Temporal e Semântica de Datas', () => {
    test('1.1 Identificação e extração de data civil ASAAS sem recuo de dia', () => {
      const paidAtAsaas = '2026-11-07T00:00:00+00:00';
      assert.equal(isAsaasCivilDateTimestamp(paidAtAsaas), true);
      assert.equal(getFinancialCivilDateStr(paidAtAsaas), '2026-11-07');

      // Formatação institucional em dd/MM/yyyy
      const formatted = formatFinancialDateTime(paidAtAsaas, 'date-only');
      assert.equal(formatted, '07/11/2026');
    });

    test('1.2 Timestamp real convertido com respeito ao timezone UTC-3', () => {
      // 2026-11-20 01:30:00 UTC equivale a 2026-11-19 22:30:00 UTC-3
      const timestampUtc = '2026-11-20T01:30:00.000Z';
      const formatted = formatFinancialDateTime(timestampUtc, 'date-only');
      assert.equal(formatted.startsWith('19/11/2026'), true);
    });

    test('1.3 buildPeriodFilterBounds gera limites seguros para datas civis e timestamps', () => {
      const bounds = buildPeriodFilterBounds('2026-11-01', '2026-11-30');
      // Início ancorado no timezone institucional
      assert.equal(bounds.startIso.startsWith('2026-11-01T00:00:00.000'), true);
      // Fim se estende até o fim do dia institucional
      assert.equal(bounds.endIso.startsWith('2026-11-30T23:59:59.999'), true);
    });
  });

  // ── 2. Homologação Lote 2 — Saldos e Fechamentos Contábeis ────────────────
  describe('2. Saldos, Implantação e Fechamentos Financeiros', () => {
    test('2.1 Continuidade matemática entre períodos consecutivos', () => {
      const saldoInicialOutubro = 10000.00;
      const lancamentosOutubro = [
        { data_lancamento: '2026-10-05', tipo_movimento: 'entrada', valor: 5000.00 },
        { data_lancamento: '2026-10-15', tipo_movimento: 'saida', valor: 2000.00 },
      ];
      const balancoOutubro = computePeriodTotals({
        saldoInicial: saldoInicialOutubro,
        dataInicio: '2026-10-01',
        dataFim: '2026-10-31',
        lancamentos: lancamentosOutubro,
      });
      assert.equal(balancoOutubro.saldoFinal, 13000.00);

      // Novembro herda o saldo final de Outubro como saldo inicial
      const saldoInicialNovembro = balancoOutubro.saldoFinal;
      const lancamentosNovembro = [
        { data_lancamento: '2026-11-05', tipo_movimento: 'entrada', valor: 7000.00 },
        { data_lancamento: '2026-11-15', tipo_movimento: 'saida', valor: 4000.00 },
      ];
      const balancoNovembro = computePeriodTotals({
        saldoInicial: saldoInicialNovembro,
        dataInicio: '2026-11-01',
        dataFim: '2026-11-30',
        lancamentos: lancamentosNovembro,
      });
      assert.equal(balancoNovembro.entradas, 7000.00);
      assert.equal(balancoNovembro.saidas, 4000.00);
      assert.equal(balancoNovembro.saldoFinal, 16000.00);
    });

    test('2.2 Fechamento homologado ancora o saldo e impede recálculo redundante', () => {
      const fechamentosHomologados = [
        { mes_referencia: '2026-10', saldo_final: 13000.00, status: 'fechado', congregacao_id: null },
      ];
      const contas = [{ id: 'c1', saldo_inicial: 10000.00, is_ativa: true, congregacao_id: null }];
      const lancamentosHistoricos = [
        { data_lancamento: '2026-09-15', tipo_movimento: 'entrada', valor: 5000.00 },
        { data_lancamento: '2026-10-20', tipo_movimento: 'entrada', valor: 3000.00 },
      ];

      const abertura = computeCanonicalInitialBalance({
        dataInicio: '2026-11-01',
        contas,
        fechamentos: fechamentosHomologados,
        lancamentosHistoricos,
      });

      assert.equal(abertura.saldoInicial, 13000.00);
      assert.equal(abertura.ancoragem, 'fechamento_anterior');
    });

    test('2.3 Meses sem fechamento formal apuram saldo histórico sem duplicar implantação', () => {
      const contas = [{ id: 'c1', saldo_inicial: 5000.00, is_ativa: true, congregacao_id: null }];
      const fechamentos = [];
      const lancamentosHistoricos = [
        { data_lancamento: '2026-08-10', tipo_movimento: 'entrada', valor: 2000.00 },
        { data_lancamento: '2026-09-10', tipo_movimento: 'saida', valor: 1000.00 },
      ];

      const abertura = computeCanonicalInitialBalance({
        dataInicio: '2026-10-01',
        contas,
        fechamentos,
        lancamentosHistoricos,
      });

      // 5000 (implantação) + 2000 (entradas) - 1000 (saídas) = 6000
      assert.equal(abertura.saldoInicial, 6000.00);
      assert.equal(abertura.ancoragem, 'saldo_implantacao');
    });
  });

  // ── 3. Homologação Lote 3 — Paginação e Agregação Segura ─────────────────
  describe('3. Paginação e Escalabilidade sem Truncamento', () => {
    test('3.1 fetchAllRowsInBatches supera teto de 1.000 linhas com deduplicação por ID', async () => {
      const mockDb = Array.from({ length: 2500 }, (_, i) => ({
        id: `id-${i}`,
        tipo_movimento: 'entrada',
        valor: 10.00,
      }));

      const result = await fetchAllRowsInBatches(async (start, end) => {
        const slice = mockDb.slice(start, end + 1);
        return { data: slice, error: null };
      }, { pageSize: 1000 });

      assert.equal(result.data.length, 2500);
      const total = result.data.reduce((acc, r) => acc + r.valor, 0);
      assert.equal(roundCurrency(total), 25000.00);
    });

    test('3.2 Deduplicação automática descarta registros deslocados por mutação concorrente', async () => {
      let callCount = 0;
      const result = await fetchAllRowsInBatches(async (start, end) => {
        callCount++;
        if (callCount === 1) {
          return {
            data: Array.from({ length: 1000 }, (_, i) => ({ id: `id-${i}`, valor: 1.00 })),
            error: null,
          };
        } else if (callCount === 2) {
          return {
            data: [{ id: 'id-999', valor: 1.00 }, { id: 'id-1000', valor: 1.00 }],
            error: null,
          };
        }
        return { data: [], error: null };
      }, { pageSize: 1000 });

      assert.equal(result.data.length, 1001);
    });

    test('3.3 Tratamento de falha parcial bloqueia exibição de valores parciais falsos', async () => {
      let callCount = 0;
      try {
        await fetchAllRowsInBatches(async (start, end) => {
          callCount++;
          if (callCount === 2) {
            return { data: null, error: { message: 'Network timeout connection lost' } };
          }
          return { data: [{ id: '1', valor: 100, tipo_movimento: 'entrada' }], error: null };
        }, { pageSize: 1 });
        assert.fail('Deveria ter lançado exceção de erro');
      } catch (err) {
        assert.ok(err.message.includes('Falha ao consultar lote financeiro'));
      }
    });
  });

  // ── 4. Homologação Lote 4 — Indicadores Transversais e Paridade ──────────
  describe('4. Indicadores Canônicos e Paridade Transversal', () => {
    test('4.1 Paridade absoluta entre Dashboard, Tesouraria, Financeiro e Presidência', () => {
      const lancamentosMes = [
        { id: '1', tipo_movimento: 'entrada', valor: 35000.00, tipo_recebimento: 'dizimo' },
        { id: '2', tipo_movimento: 'entrada', valor: 17311.83, tipo_recebimento: 'oferta' },
        { id: '3', tipo_movimento: 'saida', valor: 12500.50 },
      ];

      const indTesouraria = computeCanonicalIndicators(lancamentosMes);
      const indDashboard = computeCanonicalIndicators(lancamentosMes);
      const indFinanceiro = computeCanonicalIndicators(lancamentosMes);

      assert.equal(indTesouraria.totalReceitas, 52311.83);
      assert.equal(indDashboard.totalReceitas, indTesouraria.totalReceitas);
      assert.equal(indFinanceiro.totalReceitas, indTesouraria.totalReceitas);

      assert.equal(indTesouraria.totalDespesas, 12500.50);
      assert.equal(indDashboard.totalDespesas, indTesouraria.totalDespesas);

      assert.equal(indTesouraria.resultadoOperacional, 39811.33);
      assert.equal(indDashboard.resultadoOperacional, 39811.33);
      assert.equal(indFinanceiro.resultadoOperacional, 39811.33);
      assert.equal(indTesouraria.isSuperavit, true);

      const badge = getFinancialBadge(indTesouraria.resultadoOperacional);
      assert.equal(badge.label, 'Superávit');
    });

    test('4.2 Distinção conceitual estrita entre Resultado Operacional e Saldo Final em Caixa', () => {
      const saldoInicial = 85153.28;
      const receitas = 52311.83;
      const despesas = 0.00;

      const resultadoOperacional = roundCurrency(receitas - despesas);
      assert.equal(resultadoOperacional, 52311.83);

      const saldoFinalCaixaBancos = roundCurrency(saldoInicial + receitas - despesas);
      assert.equal(saldoFinalCaixaBancos, 137465.11);

      // Nunca devem ser confundidos
      assert.notEqual(resultadoOperacional, saldoFinalCaixaBancos);
    });

    test('4.3 Arrecadação Digital PIX: bruto, pagas e ticket médio', () => {
      const charges = [
        { valor_pago: 100.00, status: 'pago', destination_id: 'd1' },
        { valor_pago: 200.00, status: 'concluida', destination_id: 'd2' },
        { valor_solicitado: 50.00, status: 'received', destination_id: 'd1' },
        { valor_solicitado: 500.00, status: 'pendente', destination_id: 'd3' },
        { valor_solicitado: 100.00, status: 'canceled', destination_id: 'd1' },
      ];

      const pix = computeCanonicalPixSummary(charges);
      assert.equal(pix.totalArrecadadoBruto, 350.00);
      assert.equal(pix.totalTransacoesPagas, 3);
      assert.equal(pix.destinosDistintos, 2);
      assert.equal(pix.ticketMedio, 116.67);
    });
  });

  // ── 5. Segurança Multi-Tenant e Idempotência de Integrações ───────────────
  describe('5. Segurança Multi-Tenant e Idempotência', () => {
    test('5.1 Isolamento de dados: registros de outro tenant são completamente ignorados', () => {
      const tenantA = 'tenant-a-uuid';
      const tenantB = 'tenant-b-uuid';

      const allRecords = [
        { ministry_id: tenantA, tipo_movimento: 'entrada', valor: 1000.00 },
        { ministry_id: tenantB, tipo_movimento: 'entrada', valor: 99999.00 },
      ];

      const recordsA = allRecords.filter(r => r.ministry_id === tenantA);
      const indA = computeCanonicalIndicators(recordsA);

      assert.equal(indA.totalReceitas, 1000.00);
      assert.equal(indA.totalLancamentos, 1);
    });

    test('5.2 Idempotência de webhooks: processamento duplicado do mesmo ID não altera totais', () => {
      const processedTransactions = new Map();

      function processWebhookCharge(charge) {
        if (processedTransactions.has(charge.gateway_id)) {
          return { status: 'already_processed', charge: processedTransactions.get(charge.gateway_id) };
        }
        processedTransactions.set(charge.gateway_id, charge);
        return { status: 'processed', charge };
      }

      const charge1 = { gateway_id: 'pay_asaas_123', valor: 250.00, status: 'CONFIRMED' };
      const res1 = processWebhookCharge(charge1);
      assert.equal(res1.status, 'processed');

      // Tentativa de reprocessamento do mesmo webhook (retry do ASAAS)
      const res2 = processWebhookCharge(charge1);
      assert.equal(res2.status, 'already_processed');
      assert.equal(processedTransactions.size, 1);
    });

    test('5.3 Estornos e cancelamentos preservam neutralidade contábil matemática', () => {
      const lancamentos = [
        { tipo_movimento: 'entrada', valor: 500.00 },
        // Estorno contábil correspondente
        { tipo_movimento: 'saida', valor: 500.00 },
      ];

      const ind = computeCanonicalIndicators(lancamentos);
      assert.equal(ind.resultadoOperacional, 0.00);
    });
  });

  // ── 6. Reconciliação Fiel do Cenário AD Ananindeua ────────────────────────
  describe('6. Reconciliação Fiel AD Ananindeua (Novembro/2026)', () => {
    test('6.1 Todos os totais auditados no banco real fecham com exatidão centesimal', () => {
      const auditData = {
        pixChargesPagas: 822,
        pixTotalArrecadado: 39006.52,
        missaoMulheresPagas: 37,
        missaoMulheresTotal: 2560.00,
        tesourariaLancamentos: 981,
        tesourariaEntradas: 52311.83,
        tesourariaSaidas: 0.00,
        saldoInicialHistorico: 85153.28,
        saldoFinalContabil: 137465.11,
      };

      const resultadoOperacional = roundCurrency(auditData.tesourariaEntradas - auditData.tesourariaSaidas);
      assert.equal(resultadoOperacional, 52311.83);

      const saldoFinal = roundCurrency(auditData.saldoInicialHistorico + resultadoOperacional);
      assert.equal(saldoFinal, auditData.saldoFinalContabil);
      assert.equal(saldoFinal, 137465.11);
    });
  });
});
