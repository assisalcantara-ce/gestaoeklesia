import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Central Financeira Corporativa - Regras de Domínio e Consolidação', () => {

  // Simulação de faturas de billing automáticas (platform_billing_invoices)
  const MOCK_BILLING_INVOICES = [
    { id: 'inv-1', amount: 600.00, status: 'paid', paid_at: '2026-09-10T10:00:00Z', due_date: '2026-09-10', ministry_id: 'min-1' },
    { id: 'inv-2', amount: 349.00, status: 'paid', paid_at: '2026-09-11T12:00:00Z', due_date: '2026-09-11', ministry_id: 'min-2' },
    { id: 'inv-3', amount: 600.00, status: 'pending', paid_at: null, due_date: '2026-09-20', ministry_id: 'min-1' },
    { id: 'inv-4', amount: 197.00, status: 'pending', paid_at: null, due_date: '2026-09-25', ministry_id: 'min-3' },
    { id: 'inv-5', amount: 97.00, status: 'overdue', paid_at: null, due_date: '2026-09-01', ministry_id: 'min-4' },
    { id: 'inv-6', amount: 600.00, status: 'canceled', paid_at: null, due_date: '2026-09-10', ministry_id: 'min-1' }
  ];

  // Simulação de receitas manuais corporativas (platform_manual_revenues)
  const MOCK_MANUAL_REVENUES = [
    { id: 'rev-1', amount: 1500.00, status: 'received', received_at: '2026-09-05T14:00:00Z', reference_date: '2026-09-05' },
    { id: 'rev-2', amount: 800.00, status: 'pending', received_at: null, reference_date: '2026-09-28' }
  ];

  // Simulação de despesas corporativas (platform_expenses)
  const MOCK_EXPENSES = [
    { id: 'exp-1', amount: 450.00, status: 'paid', paid_at: '2026-09-08T09:00:00Z', due_date: '2026-09-08', reference_date: '2026-09-08' },
    { id: 'exp-2', amount: 250.00, status: 'paid', paid_at: '2026-09-11T15:00:00Z', due_date: '2026-09-11', reference_date: '2026-09-11' },
    { id: 'exp-3', amount: 300.00, status: 'pending', paid_at: null, due_date: '2026-09-30', reference_date: '2026-09-30' }
  ];

  const MOCK_INITIAL_BALANCE = 5000.00;

  function calculateCorporateSummary({ billingInvoices, manualRevenues, expenses, initialBalance }) {
    // 1. Receitas Automáticas (Billing SaaS)
    const paidBilling = billingInvoices.filter(i => i.status === 'paid');
    const pendingBilling = billingInvoices.filter(i => i.status === 'pending');
    const overdueBilling = billingInvoices.filter(i => i.status === 'overdue');

    const receitaAutomaticaRecebida = paidBilling.reduce((acc, i) => acc + i.amount, 0);
    const receitaAutomaticaPrevista = pendingBilling.reduce((acc, i) => acc + i.amount, 0);
    const inadimplenciaValor = overdueBilling.reduce((acc, i) => acc + i.amount, 0);

    // 2. Receitas Manuais
    const receivedManual = manualRevenues.filter(r => r.status === 'received');
    const pendingManual = manualRevenues.filter(r => r.status === 'pending');

    const receitaManualRecebida = receivedManual.reduce((acc, r) => acc + r.amount, 0);
    const receitaManualPendente = pendingManual.reduce((acc, r) => acc + r.amount, 0);

    // 3. Despesas Corporativas
    const paidExpenses = expenses.filter(e => e.status === 'paid');
    const pendingExpenses = expenses.filter(e => e.status === 'pending');

    const despesasPagas = paidExpenses.reduce((acc, e) => acc + e.amount, 0);
    const despesasPendentes = pendingExpenses.reduce((acc, e) => acc + e.amount, 0);

    // 4. Totais e Saldos
    const totalEntradasRecebidas = receitaAutomaticaRecebida + receitaManualRecebida;
    const totalEntradasPrevistas = receitaAutomaticaPrevista + receitaManualPendente;
    const totalDespesas = despesasPagas + despesasPendentes;
    const resultadoLiquido = totalEntradasRecebidas - despesasPagas;
    const saldoFinal = initialBalance + totalEntradasRecebidas - despesasPagas;

    return {
      saldoInicial: initialBalance,
      saldoFinal,
      resultadoLiquido,
      receitaAutomaticaRecebida,
      receitaManualRecebida,
      totalEntradasRecebidas,
      receitaAutomaticaPrevista,
      receitaManualPendente,
      totalEntradasPrevistas,
      despesasPagas,
      despesasPendentes,
      totalDespesas,
      inadimplenciaValor,
      inadimplenciaQtd: overdueBilling.length,
      totalFaturasPagas: paidBilling.length,
      totalFaturasPendentes: pendingBilling.length,
      totalFaturasVencidas: overdueBilling.length
    };
  }

  test('1. Receita automática recebida consolida apenas faturas paid', () => {
    const summary = calculateCorporateSummary({
      billingInvoices: MOCK_BILLING_INVOICES,
      manualRevenues: MOCK_MANUAL_REVENUES,
      expenses: MOCK_EXPENSES,
      initialBalance: MOCK_INITIAL_BALANCE
    });

    // Faturas pagas: 600 + 349 = 949.00
    assert.equal(summary.receitaAutomaticaRecebida, 949.00);
    assert.equal(summary.totalFaturasPagas, 2);
  });

  test('2. Receitas manuais recebidas somam com receitas automáticas sem duplicar billing', () => {
    const summary = calculateCorporateSummary({
      billingInvoices: MOCK_BILLING_INVOICES,
      manualRevenues: MOCK_MANUAL_REVENUES,
      expenses: MOCK_EXPENSES,
      initialBalance: MOCK_INITIAL_BALANCE
    });

    // Receita manual recebida: 1500.00
    assert.equal(summary.receitaManualRecebida, 1500.00);
    // Total entradas recebidas: 949 + 1500 = 2449.00
    assert.equal(summary.totalEntradasRecebidas, 2449.00);
  });

  test('3. Despesas pagas são deduzidas corretamente no resultado líquido', () => {
    const summary = calculateCorporateSummary({
      billingInvoices: MOCK_BILLING_INVOICES,
      manualRevenues: MOCK_MANUAL_REVENUES,
      expenses: MOCK_EXPENSES,
      initialBalance: MOCK_INITIAL_BALANCE
    });

    // Despesas pagas: 450 + 250 = 700.00
    assert.equal(summary.despesasPagas, 700.00);
    // Despesas pendentes: 300.00
    assert.equal(summary.despesasPendentes, 300.00);
    // Resultado líquido: 2449 - 700 = 1749.00
    assert.equal(summary.resultadoLiquido, 1749.00);
  });

  test('4. Cálculo rigoroso de Saldo Final: Saldo Inicial + Entradas Recebidas - Despesas Pagas', () => {
    const summary = calculateCorporateSummary({
      billingInvoices: MOCK_BILLING_INVOICES,
      manualRevenues: MOCK_MANUAL_REVENUES,
      expenses: MOCK_EXPENSES,
      initialBalance: 5000.00
    });

    // Saldo Inicial: 5000.00
    // Entradas: +2449.00
    // Saídas: -700.00
    // Saldo Final: 5000 + 2449 - 700 = 6749.00
    assert.equal(summary.saldoInicial, 5000.00);
    assert.equal(summary.saldoFinal, 6749.00);
  });

  test('5. Inadimplência reflete faturas vencidas (overdue) sem impactar o saldo realizado', () => {
    const summary = calculateCorporateSummary({
      billingInvoices: MOCK_BILLING_INVOICES,
      manualRevenues: MOCK_MANUAL_REVENUES,
      expenses: MOCK_EXPENSES,
      initialBalance: MOCK_INITIAL_BALANCE
    });

    assert.equal(summary.inadimplenciaValor, 97.00);
    assert.equal(summary.inadimplenciaQtd, 1);
  });

  test('6. Faturas canceladas são completamente excluídas das previsões e dos saldos', () => {
    const summary = calculateCorporateSummary({
      billingInvoices: MOCK_BILLING_INVOICES,
      manualRevenues: MOCK_MANUAL_REVENUES,
      expenses: MOCK_EXPENSES,
      initialBalance: MOCK_INITIAL_BALANCE
    });

    // Faturas pendentes: 600 + 197 = 797.00 (inv-6 com 600.00 cancelada não deve entrar)
    assert.equal(summary.receitaAutomaticaPrevista, 797.00);
  });
});
