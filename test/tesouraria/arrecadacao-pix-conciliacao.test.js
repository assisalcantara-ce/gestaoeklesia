import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Funções de lógica pura espelhando a implementação do ArrecadacaoDigitalContent
function computePanelTotals({ summary, cobrancasFiltradas, hasLocalFilters, isExtrato }) {
  const cobrancasPagasFiltradas = cobrancasFiltradas.filter((c) => {
    const st = String(c.status || '').toLowerCase().trim();
    return ['pago', 'paid', 'concluida', 'received', 'confirmed'].includes(st);
  });

  const totalArrecadadoExtratoLocal = cobrancasPagasFiltradas.reduce(
    (acc, c) => acc + Number(c.valor_pago ?? c.valor_solicitado ?? 0),
    0
  );

  const transacoesPagasCount = isExtrato
    ? (hasLocalFilters
        ? cobrancasPagasFiltradas.length
        : (summary?.transacoesPagas !== undefined && summary?.transacoesPagas !== null
            ? summary.transacoesPagas
            : cobrancasPagasFiltradas.length))
    : (summary?.transacoesPagas !== undefined && summary?.transacoesPagas !== null
        ? summary.transacoesPagas
        : cobrancasPagasFiltradas.length);

  const totalArrecadadoCalculado = isExtrato
    ? (hasLocalFilters
        ? totalArrecadadoExtratoLocal
        : (summary?.totalArrecadado !== undefined && summary?.totalArrecadado !== null
            ? summary.totalArrecadado
            : totalArrecadadoExtratoLocal))
    : (summary?.totalArrecadado !== undefined && summary?.totalArrecadado !== null
        ? summary.totalArrecadado
        : totalArrecadadoExtratoLocal);

  return {
    totalArrecadadoCalculado,
    transacoesPagasCount,
  };
}

function computePrintTotals({ summary, cobrancasPagasFiltradas, hasLocalFilters }) {
  const totalArrecadado = hasLocalFilters
    ? cobrancasPagasFiltradas.reduce((acc, c) => acc + Number(c.valor_pago ?? c.valor_solicitado ?? 0), 0)
    : (summary?.totalArrecadado !== undefined && summary?.totalArrecadado !== null
        ? summary.totalArrecadado
        : cobrancasPagasFiltradas.reduce((acc, c) => acc + Number(c.valor_pago ?? c.valor_solicitado ?? 0), 0));

  const transacoesPagas = hasLocalFilters
    ? cobrancasPagasFiltradas.length
    : (summary?.transacoesPagas !== undefined && summary?.transacoesPagas !== null
        ? summary.transacoesPagas
        : cobrancasPagasFiltradas.length);

  return { totalArrecadado, transacoesPagas };
}

describe('Tesouraria — Conciliação de Arrecadação PIX', () => {
  it('1. Deve conciliar Painel e Impressão no cenário de 132 transações (R$ 10.539,80) sem truncamento a 100', () => {
    // 132 cobranças no backend
    const mockSummary = {
      totalArrecadado: 10539.80,
      transacoesPagas: 132,
      destinosDistintos: 1,
    };

    // Simulando que o extrato na tela está na página 1 (exibindo 50 itens)
    const page1Cobrancas = Array.from({ length: 50 }, (_, i) => ({
      id: `charge-${i}`,
      status: 'pago',
      valor_pago: 79.84, // média aproximada
    }));

    // Sem filtro de busca textual local
    const panel = computePanelTotals({
      summary: mockSummary,
      cobrancasFiltradas: page1Cobrancas,
      hasLocalFilters: false,
      isExtrato: true,
    });

    const print = computePrintTotals({
      summary: mockSummary,
      cobrancasPagasFiltradas: page1Cobrancas,
      hasLocalFilters: false,
    });

    assert.equal(panel.totalArrecadadoCalculado, 10539.80);
    assert.equal(panel.transacoesPagasCount, 132);
    assert.equal(print.totalArrecadado, 10539.80);
    assert.equal(print.transacoesPagas, 132);
  });

  it('2. Deve preservar zero legítimo sem usar fallback indevido de operador ||', () => {
    const mockZeroSummary = {
      totalArrecadado: 0,
      transacoesPagas: 0,
      destinosDistintos: 0,
    };

    const panel = computePanelTotals({
      summary: mockZeroSummary,
      cobrancasFiltradas: [],
      hasLocalFilters: false,
      isExtrato: true,
    });

    const print = computePrintTotals({
      summary: mockZeroSummary,
      cobrancasPagasFiltradas: [],
      hasLocalFilters: false,
    });

    assert.equal(panel.totalArrecadadoCalculado, 0);
    assert.equal(panel.transacoesPagasCount, 0);
    assert.equal(print.totalArrecadado, 0);
    assert.equal(print.transacoesPagas, 0);
  });

  it('3. Quando houver filtro local ativo (busca textual), totais devem refletir o subconjunto filtrado', () => {
    const mockSummary = {
      totalArrecadado: 10539.80,
      transacoesPagas: 132,
      destinosDistintos: 1,
    };

    // Pagador específico filtrado na busca textual
    const filteredLocal = [
      { id: '1', status: 'pago', valor_pago: 150.00 },
      { id: '2', status: 'pago', valor_pago: 200.00 },
      { id: '3', status: 'pendente', valor_solicitado: 50.00 }, // não pago
    ];

    const panel = computePanelTotals({
      summary: mockSummary,
      cobrancasFiltradas: filteredLocal,
      hasLocalFilters: true,
      isExtrato: true,
    });

    const print = computePrintTotals({
      summary: mockSummary,
      cobrancasPagasFiltradas: filteredLocal.filter(c => c.status === 'pago'),
      hasLocalFilters: true,
    });

    assert.equal(panel.totalArrecadadoCalculado, 350.00);
    assert.equal(panel.transacoesPagasCount, 2);
    assert.equal(print.totalArrecadado, 350.00);
    assert.equal(print.transacoesPagas, 2);
  });

  it('4. Status de pagamento: canceladas, pendentes e expiradas não devem somar no total arrecadado', () => {
    const mixedList = [
      { id: '1', status: 'pago', valor_pago: 100 },
      { id: '2', status: 'confirmed', valor_pago: 200 },
      { id: '3', status: 'pendente', valor_solicitado: 500 },
      { id: '4', status: 'expirado', valor_solicitado: 300 },
      { id: '5', status: 'cancelado', valor_solicitado: 1000 },
    ];

    const panel = computePanelTotals({
      summary: null,
      cobrancasFiltradas: mixedList,
      hasLocalFilters: true,
      isExtrato: true,
    });

    assert.equal(panel.totalArrecadadoCalculado, 300);
    assert.equal(panel.transacoesPagasCount, 2);
  });
});
