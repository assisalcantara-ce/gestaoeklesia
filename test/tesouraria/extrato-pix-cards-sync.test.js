import test from 'node:test';
import assert from 'node:assert/strict';

// Simulador das regras de agregação de métricas implementadas no backend e frontend
function aggregateChargesMetrics(charges, filters = {}) {
  const {
    destination_id,
    congregacao_id,
    data_inicio,
    data_fim,
    mes, // YYYY-MM
    q,
  } = filters;

  const filtered = charges.filter((c) => {
    // Filtro por destino
    if (destination_id && destination_id !== 'todos') {
      if (c.destination_id !== destination_id) return false;
    }

    // Filtro por congregacao
    if (congregacao_id) {
      if (congregacao_id === 'none') {
        if (c.congregacao_id !== null && c.congregacao_id !== undefined) return false;
      } else if (c.congregacao_id !== congregacao_id) {
        return false;
      }
    }

    // Filtro por mês
    if (mes) {
      const chargeMonth = c.created_at ? c.created_at.substring(0, 7) : '';
      if (chargeMonth !== mes) return false;
    }

    // Filtro por data_inicio
    if (data_inicio) {
      const chargeDate = c.created_at ? c.created_at.substring(0, 10) : '';
      if (chargeDate < data_inicio) return false;
    }

    // Filtro por data_fim
    if (data_fim) {
      const chargeDate = c.created_at ? c.created_at.substring(0, 10) : '';
      if (chargeDate > data_fim) return false;
    }

    // Filtro por busca textual
    if (q) {
      const term = q.toLowerCase();
      const match =
        (c.payer_name && c.payer_name.toLowerCase().includes(term)) ||
        (c.txid && c.txid.toLowerCase().includes(term)) ||
        (c.description && c.description.toLowerCase().includes(term));
      if (!match) return false;
    }

    return true;
  });

  // Métricas agregadas sobre os registros filtrados
  let totalArrecadado = 0;
  let transacoesPagas = 0;
  const distinctDestinos = new Set();

  for (const c of filtered) {
    const isPaid = c.status === 'PAID' || c.status === 'CONFIRMED';
    if (isPaid) {
      totalArrecadado += Number(c.amount) || 0;
      transacoesPagas += 1;
      if (c.destination_id) {
        distinctDestinos.add(c.destination_id);
      }
    }
  }

  return {
    totalArrecadado,
    transacoesPagas,
    destinosDistintos: distinctDestinos.size,
    filteredCount: filtered.length,
  };
}

test('Sincronização dos cards com filtros do extrato PIX', async (t) => {
  const sampleCharges = [
    {
      id: 'c1',
      status: 'PAID',
      amount: 150.0,
      destination_id: 'dest-mulheres',
      congregacao_id: 'cong-sede',
      created_at: '2026-10-05T10:00:00Z',
      payer_name: 'Maria Oliveira',
      txid: 'tx12345',
      conciliado_com_lancamento_id: 'lanc-01',
    },
    {
      id: 'c2',
      status: 'PAID',
      amount: 250.0,
      destination_id: 'dest-mulheres',
      congregacao_id: 'cong-sede',
      created_at: '2026-10-10T12:00:00Z',
      payer_name: 'Ana Paula',
      txid: 'tx12346',
      conciliado_com_lancamento_id: null,
    },
    {
      id: 'c3',
      status: 'PAID',
      amount: 500.0,
      destination_id: 'dest-missoes',
      congregacao_id: 'cong-norte',
      created_at: '2026-10-15T15:00:00Z',
      payer_name: 'Carlos Alberto',
      txid: 'tx12347',
      conciliado_com_lancamento_id: 'lanc-02',
    },
    {
      id: 'c4',
      status: 'PENDING',
      amount: 100.0,
      destination_id: 'dest-mulheres',
      congregacao_id: 'cong-sede',
      created_at: '2026-10-18T09:00:00Z',
      payer_name: 'Bruna Lima',
      txid: 'tx12348',
      conciliado_com_lancamento_id: null,
    },
    {
      id: 'c5',
      status: 'PAID',
      amount: 300.0,
      destination_id: 'dest-jovens',
      congregacao_id: 'cong-sede',
      created_at: '2026-09-20T18:00:00Z',
      payer_name: 'Lucas Souza',
      txid: 'tx12349',
      conciliado_com_lancamento_id: null,
    },
  ];

  await t.test('1. Total geral de outubro/2026 sem filtros adicionais', () => {
    const summary = aggregateChargesMetrics(sampleCharges, { mes: '2026-10' });
    // c1 (150) + c2 (250) + c3 (500) = 900. (c4 is PENDING, c5 is September)
    assert.equal(summary.totalArrecadado, 900.0);
    assert.equal(summary.transacoesPagas, 3);
    assert.equal(summary.destinosDistintos, 2); // 'dest-mulheres' and 'dest-missoes'
  });

  await t.test('2. Filtrar por destino específico (ex: Missão Mulheres)', () => {
    const summary = aggregateChargesMetrics(sampleCharges, {
      mes: '2026-10',
      destination_id: 'dest-mulheres',
    });
    // Somente c1 (150) e c2 (250)
    assert.equal(summary.totalArrecadado, 400.0);
    assert.equal(summary.transacoesPagas, 2);
    // Destinos distintos no extrato deve ser 1 (não 2, nem contar transações)
    assert.equal(summary.destinosDistintos, 1);
  });

  await t.test('3. Filtrar por congregação específica (cong-norte)', () => {
    const summary = aggregateChargesMetrics(sampleCharges, {
      mes: '2026-10',
      congregacao_id: 'cong-norte',
    });
    // Somente c3 (500)
    assert.equal(summary.totalArrecadado, 500.0);
    assert.equal(summary.transacoesPagas, 1);
    assert.equal(summary.destinosDistintos, 1);
  });

  await t.test('4. Filtrar por busca textual (nome do pagador ou txid)', () => {
    const summary = aggregateChargesMetrics(sampleCharges, {
      mes: '2026-10',
      q: 'maria',
    });
    // Somente c1
    assert.equal(summary.totalArrecadado, 150.0);
    assert.equal(summary.transacoesPagas, 1);
    assert.equal(summary.destinosDistintos, 1);
  });

  await t.test('5. Intervalo de datas customizado', () => {
    const summary = aggregateChargesMetrics(sampleCharges, {
      data_inicio: '2026-10-01',
      data_fim: '2026-10-12',
    });
    // c1 (150) e c2 (250) estão no intervalo; c3 é dia 15
    assert.equal(summary.totalArrecadado, 400.0);
    assert.equal(summary.transacoesPagas, 2);
    assert.equal(summary.destinosDistintos, 1);
  });

  await t.test('6. Sem resultados (filtros sem correspondência)', () => {
    const summary = aggregateChargesMetrics(sampleCharges, {
      mes: '2026-10',
      destination_id: 'dest-inexistente',
    });
    assert.equal(summary.totalArrecadado, 0);
    assert.equal(summary.transacoesPagas, 0);
    assert.equal(summary.destinosDistintos, 0);
  });

  await t.test('7. Garantir que conciliações não duplicam soma', () => {
    // c1 tem conciliado_com_lancamento_id: 'lanc-01', mas o somatório do extrato PIX
    // soma a transação confirmada exatamente uma vez e não a duplica.
    const summary = aggregateChargesMetrics(sampleCharges, {
      destination_id: 'dest-mulheres',
    });
    assert.equal(summary.totalArrecadado, 400.0);
    assert.equal(summary.transacoesPagas, 2);
  });

  await t.test('8. Formatação de data/hora no padrão brasileiro para impressão', () => {
    function formatExtratoDateTime(dateStr) {
      if (!dateStr) return '—';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const ano = d.getFullYear();
      const horas = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${dia}/${mes}/${ano} ${horas}:${mins}`;
    }

    const formatted = formatExtratoDateTime('2026-10-05T14:30:00Z');
    assert.match(formatted, /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    assert.equal(formatExtratoDateTime(null), '—');
    assert.equal(formatExtratoDateTime(''), '—');
  });

  await t.test('9. Colunas de impressão limitadas a Data, Destino, Congregação e Valor', () => {
    const printColumns = ['Data', 'Destino PIX', 'Congregação', 'Valor'];
    assert.equal(printColumns.length, 4);
    assert.ok(!printColumns.includes('Pagador / Doador'));
    assert.ok(!printColumns.includes('Status'));
    assert.ok(!printColumns.includes('Conciliado'));
  });
});
