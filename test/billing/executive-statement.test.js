import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Prestação de Contas Executiva e DRE para Sócios - Etapa 4', () => {

  // Teste de resolução de período trimestral e anual
  describe('Resolução de Períodos Trimestrais e Anuais', () => {
    function resolveDateRange(periodo, year = 2026) {
      if (periodo === '1_trimestre') {
        return {
          startDate: `${year}-01-01T00:00:00.000Z`,
          endDate: `${year}-03-31T23:59:59.999Z`,
        };
      }
      if (periodo === '2_trimestre') {
        return {
          startDate: `${year}-04-01T00:00:00.000Z`,
          endDate: `${year}-06-30T23:59:59.999Z`,
        };
      }
      if (periodo === '3_trimestre') {
        return {
          startDate: `${year}-07-01T00:00:00.000Z`,
          endDate: `${year}-09-30T23:59:59.999Z`,
        };
      }
      if (periodo === '4_trimestre') {
        return {
          startDate: `${year}-10-01T00:00:00.000Z`,
          endDate: `${year}-12-31T23:59:59.999Z`,
        };
      }
      return null;
    }

    test('1. Deve resolver 1º Trimestre (01/01 a 31/03)', () => {
      const r = resolveDateRange('1_trimestre', 2026);
      assert.equal(r.startDate, '2026-01-01T00:00:00.000Z');
      assert.equal(r.endDate, '2026-03-31T23:59:59.999Z');
    });

    test('2. Deve resolver 2º Trimestre (01/04 a 30/06)', () => {
      const r = resolveDateRange('2_trimestre', 2026);
      assert.equal(r.startDate, '2026-04-01T00:00:00.000Z');
      assert.equal(r.endDate, '2026-06-30T23:59:59.999Z');
    });

    test('3. Deve resolver 3º Trimestre (01/07 a 30/09)', () => {
      const r = resolveDateRange('3_trimestre', 2026);
      assert.equal(r.startDate, '2026-07-01T00:00:00.000Z');
      assert.equal(r.endDate, '2026-09-30T23:59:59.999Z');
    });

    test('4. Deve resolver 4º Trimestre (01/10 a 31/12)', () => {
      const r = resolveDateRange('4_trimestre', 2026);
      assert.equal(r.startDate, '2026-10-01T00:00:00.000Z');
      assert.equal(r.endDate, '2026-12-31T23:59:59.999Z');
    });
  });

  // Teste de cálculo da DRE
  describe('Cálculo da DRE Estruturada', () => {
    const MOCK_SAAS_REVENUE = 10000.00;
    const MOCK_MANUAL_REVENUE = 2500.00;
    const MOCK_CATEGORIES = [
      { id: 'cat-1', name: 'Infraestrutura e Servidores' },
      { id: 'cat-2', name: 'Gateway e Taxas Bancárias' },
      { id: 'cat-3', name: 'Marketing e Vendas' },
    ];
    const MOCK_EXPENSES = [
      { id: 'exp-1', category_id: 'cat-1', amount: 1500.00, status: 'paid' },
      { id: 'exp-2', category_id: 'cat-1', amount: 500.00, status: 'paid' },
      { id: 'exp-3', category_id: 'cat-2', amount: 350.00, status: 'paid' },
      { id: 'exp-4', category_id: 'cat-3', amount: 800.00, status: 'paid' },
      { id: 'exp-5', category_id: 'cat-3', amount: 1200.00, status: 'pending' }, // Não entra na DRE de despesas pagas
      { id: 'exp-6', category_id: 'cat-1', amount: 400.00, status: 'canceled' }, // Cancelado é descartado
    ];

    function calculateDRE(receitaSaaS, receitasManuais, categories, expenses) {
      const receitaBruta = receitaSaaS + receitasManuais;
      const paidExpenses = expenses.filter(e => e.status === 'paid');
      const totalDespesas = paidExpenses.reduce((acc, e) => acc + e.amount, 0);

      const catMap = new Map();
      categories.forEach(c => {
        catMap.set(c.id, { name: c.name, amount: 0 });
      });

      paidExpenses.forEach(e => {
        const cat = catMap.get(e.category_id) || { name: 'Outras Despesas', amount: 0 };
        cat.amount += e.amount;
        catMap.set(e.category_id, cat);
      });

      const despesasOperacionais = Array.from(catMap.values())
        .filter(c => c.amount > 0)
        .map(c => ({
          name: c.name,
          amount: c.amount,
          percentage: receitaBruta > 0 ? (c.amount / receitaBruta) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      const resultadoLiquido = receitaBruta - totalDespesas;
      const margemLiquida = receitaBruta > 0 ? (resultadoLiquido / receitaBruta) * 100 : 0;

      return {
        receitaSaaS,
        receitasManuais,
        receitaBruta,
        despesasOperacionais,
        totalDespesas,
        resultadoLiquido,
        margemLiquida,
      };
    }

    test('5. Receita Bruta Total deve somar SaaS e Manuais exatamente', () => {
      const dre = calculateDRE(MOCK_SAAS_REVENUE, MOCK_MANUAL_REVENUE, MOCK_CATEGORIES, MOCK_EXPENSES);
      assert.equal(dre.receitaBruta, 12500.00);
      assert.equal(dre.receitaSaaS, 10000.00);
      assert.equal(dre.receitasManuais, 2500.00);
    });

    test('6. Despesas operacionais agrupam por categoria e ignoram pendentes e canceladas', () => {
      const dre = calculateDRE(MOCK_SAAS_REVENUE, MOCK_MANUAL_REVENUE, MOCK_CATEGORIES, MOCK_EXPENSES);
      
      // Despesas pagas: 1500 + 500 (Infra) + 350 (Gateway) + 800 (Mkt) = 3150.00
      assert.equal(dre.totalDespesas, 3150.00);
      assert.equal(dre.despesasOperacionais.length, 3);

      const infra = dre.despesasOperacionais.find(d => d.name === 'Infraestrutura e Servidores');
      assert.equal(infra.amount, 2000.00);
      assert.equal(infra.percentage, 16.0); // 2000 / 12500 = 16%
    });

    test('7. Resultado Líquido e Margem Líquida oficiais', () => {
      const dre = calculateDRE(MOCK_SAAS_REVENUE, MOCK_MANUAL_REVENUE, MOCK_CATEGORIES, MOCK_EXPENSES);
      // 12500 - 3150 = 9350.00
      assert.equal(dre.resultadoLiquido, 9350.00);
      // Margem = (9350 / 12500) * 100 = 74.8%
      assert.equal(dre.margemLiquida, 74.8);
    });
  });

  // Teste de Equação do Fluxo de Caixa Realizado
  describe('Equação Contábil e Fluxo de Caixa Realizado', () => {
    test('8. Saldo Final Real = Saldo Inicial + Total Recebido - Despesas Pagas', () => {
      const saldoInicial = 10000.00;
      const receitaSaaSRecebida = 5000.00;
      const receitasManuaisRecebidas = 1500.00;
      const despesasPagas = 2500.00;

      const totalRecebidoReal = receitaSaaSRecebida + receitasManuaisRecebidas; // 6500.00
      const resultadoLiquido = totalRecebidoReal - despesasPagas; // 4000.00
      const saldoFinalReal = saldoInicial + resultadoLiquido; // 14000.00

      assert.equal(totalRecebidoReal, 6500.00);
      assert.equal(resultadoLiquido, 4000.00);
      assert.equal(saldoFinalReal, 14000.00);
    });

    test('9. Projeção e Inadimplência não afetam o Saldo Final Real em Caixa', () => {
      const saldoInicial = 5000.00;
      const receitaSaaSRecebida = 2000.00;
      const receitasManuaisRecebidas = 0;
      const despesasPagas = 1000.00;
      
      const faturasVencidasOverdue = 1500.00;
      const faturasPrevistasPending = 3000.00;
      const despesasPendentes = 800.00;

      const saldoFinalReal = saldoInicial + (receitaSaaSRecebida + receitasManuaisRecebidas) - despesasPagas;
      assert.equal(saldoFinalReal, 6000.00);

      // Saldo projetado considera previsões
      const saldoFinalProjetado = saldoFinalReal + faturasPrevistasPending - despesasPendentes;
      assert.equal(saldoFinalProjetado, 8200.00);

      // Caixa real não foi contaminado
      assert.equal(saldoFinalReal, 6000.00);
    });
  });

});
