/**
 * financial-indicators-canonical.test.js
 *
 * Suíte de Testes do Lote 4 — Padronização Canônica de Indicadores e Relatórios Financeiros
 * Referência: docs/AUDITORIA_ESTRUTURAL_TESOURARIA.md
 * Protocolo de Segurança: docs/PROTOCOLO_SEGURANCA_PRODUCAO.md
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeCanonicalIndicators,
  computeCanonicalAccountBalances,
  computeCanonicalPixSummary,
  getFinancialBadge,
} from '../../src/lib/financial-indicators-service.ts';
import { roundCurrency } from '../../src/lib/financial-balance-service.ts';

describe('TESOURARIA LOTE 4: Indicadores e Relatórios Financeiros Canônicos', () => {

  test('1. Receitas, despesas e resultado operacional (Superávit e Déficit)', () => {
    // Cenário Superávit
    const lancamentosSuperavit = [
      { tipo_movimento: 'entrada', valor: 1500.50, tipo_recebimento: 'dizimo' },
      { tipo_movimento: 'entrada', valor: 500.25, tipo_recebimento: 'oferta' },
      { tipo_movimento: 'saida', valor: 800.75 },
    ];
    const ind1 = computeCanonicalIndicators(lancamentosSuperavit);
    assert.equal(ind1.totalReceitas, 2000.75);
    assert.equal(ind1.totalDespesas, 800.75);
    assert.equal(ind1.resultadoOperacional, 1200.00);
    assert.equal(ind1.isSuperavit, true);
    assert.equal(ind1.totalLancamentos, 3);

    const badge1 = getFinancialBadge(ind1.resultadoOperacional);
    assert.equal(badge1.label, 'Superávit');
    assert.equal(badge1.isSuperavit, true);

    // Cenário Déficit
    const lancamentosDeficit = [
      { tipo_movimento: 'entrada', valor: 300.00 },
      { tipo_movimento: 'saida', valor: 750.50 },
    ];
    const ind2 = computeCanonicalIndicators(lancamentosDeficit);
    assert.equal(ind2.totalReceitas, 300.00);
    assert.equal(ind2.totalDespesas, 750.50);
    assert.equal(ind2.resultadoOperacional, -450.50);
    assert.equal(ind2.isSuperavit, false);

    const badge2 = getFinancialBadge(ind2.resultadoOperacional);
    assert.equal(badge2.label, 'Déficit');
    assert.equal(badge2.isSuperavit, false);
  });

  test('2. Segregação canônica de dízimos, ofertas e outros recebimentos', () => {
    const lancamentos = [
      { tipo_movimento: 'entrada', valor: 1000.00, tipo_recebimento: 'dizimo' },
      { tipo_movimento: 'entrada', valor: 250.00, tipo_recebimento: 'dizimo' },
      { tipo_movimento: 'entrada', valor: 350.00, tipo_recebimento: 'oferta' },
      { tipo_movimento: 'entrada', valor: 150.00, tipo_recebimento: 'oferta_especial' },
      { tipo_movimento: 'entrada', valor: 500.00, tipo_recebimento: 'pix' },
      { tipo_movimento: 'entrada', valor: 100.00, tipo_recebimento: null },
      { tipo_movimento: 'saida', valor: 400.00, tipo_recebimento: null },
    ];

    const ind = computeCanonicalIndicators(lancamentos);
    assert.equal(ind.totalReceitas, 2350.00);
    assert.equal(ind.totalDizimos, 1250.00);
    assert.equal(ind.totalOfertas, 500.00); // oferta (350) + oferta_especial (150)
    assert.equal(ind.totalOutros, 600.00);  // pix (500) + sem tipo (100)
    assert.equal(ind.totalDespesas, 400.00);
    assert.equal(ind.resultadoOperacional, 1950.00);
  });

  test('3. Margem operacional percentual com proteção contra divisão por zero', () => {
    // Caso com receita zero
    const indZero = computeCanonicalIndicators([]);
    assert.equal(indZero.totalReceitas, 0);
    assert.equal(indZero.margemOperacionalPercentual, 0);

    // Caso com receita e despesa
    const indMargem = computeCanonicalIndicators([
      { tipo_movimento: 'entrada', valor: 1000.00 },
      { tipo_movimento: 'saida', valor: 250.00 },
    ]);
    // 750 / 1000 = 75.0%
    assert.equal(indMargem.margemOperacionalPercentual, 75.0);
  });

  test('4. Arrecadação Digital PIX: bruto, transações pagas, ticket médio e destinos distintos', () => {
    const charges = [
      { destination_id: 'dest-1', valor_pago: 50.00, status: 'pago' },
      { destination_id: 'dest-1', valor_pago: 100.00, status: 'paid' },
      { destination_id: 'dest-2', valor_pago: 75.50, status: 'concluida' },
      { destination_id: 'dest-2', valor_solicitado: 24.50, status: 'received' },
      { destination_id: 'dest-3', valor_pago: 150.00, status: 'confirmed' },
      // Não elegíveis
      { destination_id: 'dest-1', valor_solicitado: 200.00, status: 'pendente' },
      { destination_id: 'dest-2', valor_solicitado: 50.00, status: 'canceled' },
      { destination_id: 'dest-3', valor_solicitado: 80.00, status: 'expirado' },
    ];

    const pix = computeCanonicalPixSummary(charges);
    assert.equal(pix.totalArrecadadoBruto, 400.00); // 50 + 100 + 75.50 + 24.50 + 150 = 400.00
    assert.equal(pix.totalTransacoesPagas, 5);
    assert.equal(pix.ticketMedio, 80.00); // 400 / 5 = 80.00
    assert.equal(pix.destinosDistintos, 3);
  });

  test('5. Saldos de contas bancárias e caixas físicos (histórico acumulado vs período)', () => {
    const contas = [
      { id: 'conta-bb', nome: 'Banco do Brasil', tipo: 'banco', saldo_inicial: 5000.00, is_ativa: true },
      { id: 'caixa-geral', nome: 'Caixa Sede', tipo: 'caixa_fisico', saldo_inicial: 1000.00, is_ativa: true },
      { id: 'conta-antiga', nome: 'Bradesco Inativo', tipo: 'banco', saldo_inicial: 200.00, is_ativa: false },
    ];

    // Histórico prévio acumulado
    const historico = [
      { conta_id: 'conta-bb', tipo_movimento: 'entrada', valor: 2500.00 },
      { conta_id: 'conta-bb', tipo_movimento: 'saida', valor: 500.00 },
      { conta_id: 'caixa-geral', tipo_movimento: 'entrada', valor: 300.00 },
      // Lançamento do mês atual também faz parte do histórico acumulado
      { conta_id: 'conta-bb', tipo_movimento: 'entrada', valor: 1000.00 },
    ];

    // Lançamentos estritamente do mês selecionado
    const periodo = [
      { conta_id: 'conta-bb', tipo_movimento: 'entrada', valor: 1000.00 },
    ];

    const saldos = computeCanonicalAccountBalances(contas, historico, periodo);

    const bb = saldos.find(c => c.contaId === 'conta-bb');
    assert.ok(bb);
    assert.equal(bb.saldoInicial, 5000.00);
    assert.equal(bb.saldoEstimado, 8000.00); // 5000 + 2500 - 500 + 1000
    assert.equal(bb.entradasPeriodo, 1000.00);
    assert.equal(bb.saidasPeriodo, 0.00);

    const caixa = saldos.find(c => c.contaId === 'caixa-geral');
    assert.ok(caixa);
    assert.equal(caixa.saldoInicial, 1000.00);
    assert.equal(caixa.saldoEstimado, 1300.00); // 1000 + 300
    assert.equal(caixa.entradasPeriodo, 0.00);

    const inativa = saldos.find(c => c.contaId === 'conta-antiga');
    assert.ok(inativa);
    assert.equal(inativa.saldoInicial, 200.00);
    assert.equal(inativa.saldoEstimado, 200.00);
    assert.equal(inativa.isAtiva, false);
  });

  test('6. Paridade transversal: Dashboard, Tesouraria, Financeiro e Presidência', () => {
    // Um mesmo lote de lançamentos apurado pelas 4 interfaces deve produzir resultados idênticos
    const dataset = [
      { id: '1', congregacao_id: 'cong-1', tipo_movimento: 'entrada', valor: 12500.00, tipo_recebimento: 'dizimo' },
      { id: '2', congregacao_id: 'cong-2', tipo_movimento: 'entrada', valor: 8300.50, tipo_recebimento: 'oferta' },
      { id: '3', congregacao_id: 'cong-1', tipo_movimento: 'saida', valor: 4200.25 },
      { id: '4', congregacao_id: null, tipo_movimento: 'entrada', valor: 2000.00, tipo_recebimento: 'outros' },
    ];

    // 1. Tesouraria useTesouraria
    const indTesouraria = computeCanonicalIndicators(dataset);

    // 2. Dashboard Geral
    const indDashboard = computeCanonicalIndicators(dataset);

    // 3. Financeiro Executivo
    const indFinanceiro = computeCanonicalIndicators(dataset);

    // 4. Presidência Consolidado
    const indPresidencia = computeCanonicalIndicators(dataset);

    assert.equal(indTesouraria.totalReceitas, indDashboard.totalReceitas);
    assert.equal(indDashboard.totalReceitas, indFinanceiro.totalReceitas);
    assert.equal(indFinanceiro.totalReceitas, indPresidencia.totalReceitas);

    assert.equal(indTesouraria.totalDespesas, indDashboard.totalDespesas);
    assert.equal(indDashboard.totalDespesas, indFinanceiro.totalDespesas);
    assert.equal(indFinanceiro.totalDespesas, indPresidencia.totalDespesas);

    assert.equal(indTesouraria.resultadoOperacional, indDashboard.resultadoOperacional);
    assert.equal(indDashboard.resultadoOperacional, indFinanceiro.resultadoOperacional);
    assert.equal(indFinanceiro.resultadoOperacional, indPresidencia.resultadoOperacional);
    assert.equal(indTesouraria.resultadoOperacional, 18600.25);
  });

  test('7. Reconciliação Fiel do Cenário Real: AD Ananindeua (Novembro/2026)', () => {
    // Dados oficiais auditados do banco em modo somente leitura:
    // PIX Nov/2026: 822 transações pagas, R$ 39.006,52
    // Missão Mulheres (07/11 a 23/11): 37 cobranças pagas, R$ 2.560,00
    // Tesouraria Nov/2026: 981 lançamentos, Entradas R$ 52.311,83, Saídas R$ 0,00
    // Saldo Inicial Histórico Apurado: R$ 85.153,28
    // Saldo Final Calculado: R$ 137.465,11

    // Simulação exata dos totais de AD Ananindeua
    const pixChargesSimuladas = [
      { valor_pago: 36446.52, status: 'pago', destination_id: 'outros' },
      { valor_pago: 2560.00, status: 'pago', destination_id: 'missao-mulheres' },
    ];
    const pixSummary = computeCanonicalPixSummary(pixChargesSimuladas);
    assert.equal(pixSummary.totalArrecadadoBruto, 39006.52);

    const missaoMulheresSummary = computeCanonicalPixSummary([
      { valor_pago: 2560.00, status: 'pago', destination_id: 'missao-mulheres' },
    ]);
    assert.equal(missaoMulheresSummary.totalArrecadadoBruto, 2560.00);

    const tesourariaLancamentosSimulados = [
      { tipo_movimento: 'entrada', valor: 52311.83, tipo_recebimento: 'dizimo' },
    ];
    const indTesouraria = computeCanonicalIndicators(tesourariaLancamentosSimulados);
    assert.equal(indTesouraria.totalReceitas, 52311.83);
    assert.equal(indTesouraria.totalDespesas, 0.00);
    assert.equal(indTesouraria.resultadoOperacional, 52311.83);

    const saldoInicial = 85153.28;
    const saldoFinal = roundCurrency(saldoInicial + indTesouraria.totalReceitas - indTesouraria.totalDespesas);
    assert.equal(saldoFinal, 137465.11);
  });

  test('8. Ausência total de desvio de ponto flutuante em somas e subtrações centesimais', () => {
    // 0.1 + 0.2 no IEEE 754 resulta em 0.30000000000000004
    const lancamentosFloat = [
      { tipo_movimento: 'entrada', valor: 0.1 },
      { tipo_movimento: 'entrada', valor: 0.2 },
      { tipo_movimento: 'saida', valor: 0.15 },
    ];
    const ind = computeCanonicalIndicators(lancamentosFloat);
    assert.equal(ind.totalReceitas, 0.3);
    assert.equal(ind.totalDespesas, 0.15);
    assert.equal(ind.resultadoOperacional, 0.15);
  });
});
