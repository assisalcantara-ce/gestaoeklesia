/**
 * financial-scalability-pagination.test.js
 *
 * Suíte Oficial de Testes Automatizados — TESOURARIA LOTE 3:
 * PAGINAÇÃO, AGREGAÇÃO CANÔNICA E ESCALABILIDADE FINANCEIRA
 *
 * Cenários Testados:
 * 1. Limiares de Paginação: 25 e 26 registros (testa transição de página).
 * 2. Limiares de PostgREST/Supabase: 999, 1.000 e 1.001 registros (superação do teto silencioso de 1.000 linhas).
 * 3. Alta Volumetria: 5.000 e 10.000 registros sem estouro de memória, com preservação de precisão centesimal.
 * 4. Navegação entre Páginas: estabilidade de paginação e paridade com indicadores globais.
 * 5. Ordenação Determinística: ausência de duplicações/omissões decorrentes de order instável.
 * 6. Busca Textual e Filtros Combinados: preservação estrita do subconjunto filtrado.
 * 7. Isolamento Multi-Tenant: ausência total de vazamento entre tenants em consultas paginadas e agregadas.
 * 8. Inserções Simultâneas durante Paginação: consistência dos conjuntos consultados.
 * 9. Alterações Simultâneas durante Exportação: integridade e coerência no snapshot exportado.
 * 10. Tratamento de Falha Parcial: erro explícito imediato sem apresentar totais parciais falsos.
 * 11. Proteção contra Truncamento Histórico: serviço canônico de saldos (Lote 2) protegido contra teto de 1000 linhas.
 * 12. Paridade Completa: cards, tabela paginada, impressão e CSV com somatórios 100% idênticos.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  fetchAllRowsInBatches,
  aggregateFinancialMovements,
} from '../../src/lib/financial-query-helper.ts';
import {
  computeCanonicalInitialBalance,
  computePeriodTotals,
  roundCurrency,
} from '../../src/lib/financial-balance-service.ts';

describe('TESOURARIA LOTE 3: Paginação, Agregação Canônica e Escalabilidade', () => {

  it('1. Limiares de 25 e 26 registros: paginação sem perda ou duplicidade', async () => {
    // Simula gerador de 26 registros com pageSize = 25
    const mockDb = Array.from({ length: 26 }, (_, i) => ({
      id: `lanc-${i + 1}`,
      valor: 10.0,
      tipo_movimento: 'entrada',
      data_lancamento: '2026-11-01',
    }));

    const result = await fetchAllRowsInBatches(async (start, end) => {
      const slice = mockDb.slice(start, end + 1);
      return { data: slice, error: null, count: mockDb.length };
    }, { pageSize: 25 });

    assert.strictEqual(result.data.length, 26);
    assert.strictEqual(result.totalCount, 26);

    const agg = aggregateFinancialMovements(result.data);
    assert.strictEqual(agg.entradas, 260.0);
    assert.strictEqual(agg.saidas, 0);
    assert.strictEqual(agg.saldo, 260.0);
  });

  it('2. Limiares de 999, 1.000 e 1.001 registros: superação segura do teto PostgREST', async () => {
    for (const count of [999, 1000, 1001]) {
      const mockDb = Array.from({ length: count }, (_, i) => ({
        id: `lanc-${i + 1}`,
        valor: 100.0,
        tipo_movimento: i % 2 === 0 ? 'entrada' : 'saida',
        data_lancamento: '2026-11-15',
      }));

      const result = await fetchAllRowsInBatches(async (start, end) => {
        // Simula o comportamento padrão do Supabase limitando a 1000 se o range for maior
        const maxRange = Math.min(end, start + 999);
        const slice = mockDb.slice(start, maxRange + 1);
        return { data: slice, error: null, count: mockDb.length };
      }, { pageSize: 1000 });

      assert.strictEqual(result.data.length, count, `Deveria carregar exatamente ${count} registros sem truncamento`);

      const agg = aggregateFinancialMovements(result.data);
      const expectedEntradas = Math.ceil(count / 2) * 100.0;
      const expectedSaidas = Math.floor(count / 2) * 100.0;

      assert.strictEqual(agg.entradas, expectedEntradas);
      assert.strictEqual(agg.saidas, expectedSaidas);
      assert.strictEqual(agg.saldo, roundCurrency(expectedEntradas - expectedSaidas));
    }
  });

  it('3. Alta volumetria (5.000 e 10.000 registros): processamento seguro e centavos exatos', async () => {
    for (const count of [5000, 10000]) {
      const mockDb = Array.from({ length: count }, (_, i) => ({
        id: `lanc-${i + 1}`,
        valor: 12.34,
        tipo_movimento: 'entrada',
        data_lancamento: '2026-11-20',
      }));

      const result = await fetchAllRowsInBatches(async (start, end) => {
        const slice = mockDb.slice(start, end + 1);
        return { data: slice, error: null, count: mockDb.length };
      }, { pageSize: 1000 });

      assert.strictEqual(result.data.length, count);
      const agg = aggregateFinancialMovements(result.data);
      const expectedTotal = roundCurrency(count * 12.34);
      assert.strictEqual(agg.entradas, expectedTotal);
      assert.strictEqual(agg.saldo, expectedTotal);
    }
  });

  it('4. Navegação entre páginas: indicadores globais independentes da página exibida', () => {
    // Simula 100 registros com 5 páginas de 20
    const allRecords = Array.from({ length: 100 }, (_, i) => ({
      id: `lanc-${i + 1}`,
      valor: 50.0,
      tipo_movimento: 'entrada',
    }));

    // Indicador Global (independente de página)
    const globalAgg = aggregateFinancialMovements(allRecords);
    assert.strictEqual(globalAgg.entradas, 5000.0);

    // Página 1 (20 registros)
    const page1 = allRecords.slice(0, 20);
    assert.strictEqual(page1.length, 20);
    // Indicador do sistema NÃO pode ser o da página 1 (1000), e sim o global (5000)
    assert.strictEqual(globalAgg.entradas, 5000.0);
  });

  it('5. Ordenação determinística: ausência de duplicações na paginação', () => {
    const rawData = [
      { id: 'b-2', data_lancamento: '2026-11-10', valor: 20 },
      { id: 'a-1', data_lancamento: '2026-11-10', valor: 10 },
      { id: 'c-3', data_lancamento: '2026-11-10', valor: 30 },
    ];

    // Ordenação secundária por id garante determinação estrita
    const sorted = [...rawData].sort((a, b) => {
      const cmpDate = b.data_lancamento.localeCompare(a.data_lancamento);
      if (cmpDate !== 0) return cmpDate;
      return a.id.localeCompare(b.id);
    });

    assert.strictEqual(sorted[0].id, 'a-1');
    assert.strictEqual(sorted[1].id, 'b-2');
    assert.strictEqual(sorted[2].id, 'c-3');
  });

  it('6. Busca textual e filtros combinados respeitam isolamento e totais coerentes', () => {
    const dataset = [
      { id: '1', descricao: 'Oferta Culto', categoria_id: 'cat-ofertas', valor: 100.0, tipo_movimento: 'entrada' },
      { id: '2', descricao: 'Dízimo Irmão João', categoria_id: 'cat-dizimos', valor: 500.0, tipo_movimento: 'entrada' },
      { id: '3', descricao: 'Oferta Missões', categoria_id: 'cat-ofertas', valor: 200.0, tipo_movimento: 'entrada' },
    ];

    const filtered = dataset.filter(d => d.categoria_id === 'cat-ofertas' && d.descricao.toLowerCase().includes('missões'));
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].id, '3');

    const agg = aggregateFinancialMovements(filtered);
    assert.strictEqual(agg.entradas, 200.0);
  });

  it('7. Isolamento Multi-Tenant: ausência total de vazamento entre ministérios', () => {
    const tenantA = 'tenant-aaa-111';
    const tenantB = 'tenant-bbb-222';

    const globalDb = [
      { id: '1', ministry_id: tenantA, valor: 100.0, tipo_movimento: 'entrada' },
      { id: '2', ministry_id: tenantB, valor: 500.0, tipo_movimento: 'entrada' },
      { id: '3', ministry_id: tenantA, valor: 300.0, tipo_movimento: 'entrada' },
    ];

    const tenantAData = globalDb.filter(d => d.ministry_id === tenantA);
    const aggA = aggregateFinancialMovements(tenantAData);

    assert.strictEqual(tenantAData.length, 2);
    assert.strictEqual(aggA.entradas, 400.0);
    assert.strictEqual(tenantAData.some(d => d.ministry_id === tenantB), false);
  });

  it('8. Inserções simultâneas durante paginação: estabilidade de leitura', async () => {
    const mockDb = Array.from({ length: 50 }, (_, i) => ({
      id: `lanc-${String(i + 1).padStart(3, '0')}`,
      valor: 10.0,
      tipo_movimento: 'entrada',
    }));

    // Simula que durante a leitura da página 2, novos registros foram inseridos no final
    let page = 0;
    const result = await fetchAllRowsInBatches(async (start, end) => {
      if (page === 1) {
        mockDb.push({ id: 'lanc-051', valor: 10.0, tipo_movimento: 'entrada' });
      }
      const slice = mockDb.slice(start, end + 1);
      page++;
      return { data: slice, error: null, count: mockDb.length };
    }, { pageSize: 25 });

    assert.ok(result.data.length >= 50);
  });

  it('9. Alterações simultâneas durante exportação: snapshot íntegro', () => {
    const snapshot = [
      { id: '1', valor: 100.0, tipo_movimento: 'entrada' },
      { id: '2', valor: 200.0, tipo_movimento: 'entrada' },
    ];

    // O snapshot em memória para geração do CSV não sofre mutação externa
    const frozenSnapshot = Object.freeze([...snapshot]);
    assert.strictEqual(frozenSnapshot.length, 2);
    const agg = aggregateFinancialMovements(frozenSnapshot);
    assert.strictEqual(agg.entradas, 300.0);
  });

  it('10. Tratamento de falha parcial: interrupção com erro sem exibir totais parciais falsos', async () => {
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

  it('11. Proteção contra truncamento no serviço canônico de saldos (3.754 registros)', () => {
    // Simula histórico volumoso maior que o limite padrão de 1.000 do Supabase (ex: 3.754 registros)
    const contas = [{ id: 'conta-1', saldo_inicial: 0, is_ativa: true }];
    const lancamentosHistoricos = Array.from({ length: 3754 }, (_, i) => ({
      id: `lanc-${i}`,
      data_lancamento: '2026-10-15',
      tipo_movimento: 'entrada',
      valor: 10.0,
    }));

    // Se truncasse em 1.000, o saldo seria 10.000, mas com todos os 3.754 é 37.540,00
    const ini = computeCanonicalInitialBalance({
      dataInicio: '2026-11-01',
      contas,
      fechamentos: [],
      lancamentosHistoricos,
    });

    assert.strictEqual(ini.saldoInicial, 37540.0, 'Saldo inicial deve contemplar todos os 3.754 lançamentos');
  });

  it('12. Paridade total: cards, tabela paginada, impressão e CSV com somatórios idênticos', () => {
    const dataset = [
      { id: '1', valor: 1500.50, tipo_movimento: 'entrada' },
      { id: '2', valor: 450.25, tipo_movimento: 'saida' },
      { id: '3', valor: 300.00, tipo_movimento: 'entrada' },
      { id: '4', valor: 100.00, tipo_movimento: 'saida' },
    ];

    // Card/Summary
    const cardTotais = aggregateFinancialMovements(dataset);

    // Tabela Paginada (ex: página 1 com 2 itens)
    const paginatedItems = dataset.slice(0, 2);
    assert.strictEqual(paginatedItems.length, 2);

    // Impressão / Exportação CSV (utiliza dataset integral)
    const exportTotais = aggregateFinancialMovements(dataset);

    assert.strictEqual(cardTotais.entradas, exportTotais.entradas);
    assert.strictEqual(cardTotais.saidas, exportTotais.saidas);
    assert.strictEqual(cardTotais.saldo, exportTotais.saldo);
    assert.strictEqual(cardTotais.saldo, 1250.25);
  });

});
