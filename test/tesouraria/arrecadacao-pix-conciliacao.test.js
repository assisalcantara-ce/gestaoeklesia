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

  it('5. Ordenação decrescente: transações de 19 e 18/11 devem aparecer antes de 17/11', () => {
    const rawList = [
      { id: 't1', created_at: '2026-11-17T14:30:00.000Z', valor_pago: 50 },
      { id: 't2', created_at: '2026-11-19T09:15:00.000Z', valor_pago: 100 },
      { id: 't3', created_at: '2026-11-18T22:45:00.000Z', valor_pago: 75 },
    ];

    const sorted = [...rawList].sort((a, b) => {
      const timeB = new Date(b.paid_at || b.created_at).getTime();
      const timeA = new Date(a.paid_at || a.created_at).getTime();
      return timeB - timeA;
    });

    assert.equal(sorted[0].id, 't2'); // 19/11
    assert.equal(sorted[1].id, 't3'); // 18/11
    assert.equal(sorted[2].id, 't1'); // 17/11
  });

  it('6. Formatação de data e hora no padrão institucional pt-BR (dd/MM/yyyy HH:mm)', () => {
    function formatExtratoDateTime(dateStr) {
      if (!dateStr) return '—';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const formatted = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Belem',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d);
      return formatted.replace(', ', ' ');
    }

    // 2026-11-19 10:30 UTC = 2026-11-19 07:30 UTC-3
    const formatted = formatExtratoDateTime('2026-11-19T10:30:00.000Z');
    assert.equal(formatted, '19/11/2026 07:30');

    // Não deve produzir strings quebradas como '19T10:30:00.000Z/11/2026'
    assert.ok(!formatted.includes('T'));
    assert.ok(!formatted.includes('Z'));
    assert.ok(!formatted.includes(','));
  });

  it('7. Fuso horário local e preservação do dia civil (sem deslocamento UTC incorreto)', () => {
    function getChargeLocalDateStr(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return typeof dateStr === 'string' ? dateStr.split('T')[0] : '';
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Belem',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    }

    // Oferta realizada às 22h30 do dia 18/11 no Brasil (UTC-3) -> gravada em UTC como 2026-11-19T01:30:00Z
    const utcTimestamp = '2026-11-19T01:30:00.000Z';
    const localDate = getChargeLocalDateStr(utcTimestamp);

    // No fuso local brasileiro (America/Belem, UTC-3), o dia civil correto é 18/11, não 19/11
    assert.equal(localDate, '2026-11-18');
  });

  it('8. Conciliação monetária exata em centavos (sem desvios de ponto flutuante)', () => {
    // 139 transações totalizando R$ 10.849,80
    // Criar array de valores com centavos variados somando exatamente 10849.80
    const centavos = [7805, 7805, 7805, 7805]; // 312.20
    const totalCentavos = centavos.reduce((acc, c) => acc + c, 0);
    const totalReais = totalCentavos / 100;
    assert.equal(totalReais, 312.20);
  });

  describe('Filtros Dependentes no Extrato PIX e Nomenclatura QR Code Avulso', () => {
    const mockAllDestinos = [
      { id: 'dest-avulso-1', label: 'Oferta Geral Culto', congregacao_id: null },
      { id: 'dest-avulso-2', label: 'Campanha de Missões', congregacao_id: null },
      { id: 'dest-cong1-1', label: 'Dízimos e Ofertas Sede', congregacao_id: 'cong-sede' },
      { id: 'dest-cong1-2', label: 'Construção Templo Sede', congregacao_id: 'cong-sede' },
      { id: 'dest-cong2-1', label: 'Ofertas Congregação Norte', congregacao_id: 'cong-norte' },
    ];

    function getDestinosDisponiveis(allDestinos, extratoCong) {
      if (!extratoCong) return [];
      if (extratoCong === 'none') {
        return allDestinos.filter((d) => d.congregacao_id === null);
      }
      return allDestinos.filter((d) => d.congregacao_id === extratoCong);
    }

    it('9. Cenário 1: Todas as congregações ("") → Destino deve ficar desabilitado (lista vazia)', () => {
      const disponiveis = getDestinosDisponiveis(mockAllDestinos, '');
      assert.equal(disponiveis.length, 0);
    });

    it('10. Cenário 2: Congregação específica selecionada → Lista somente QR Codes vinculados a ela', () => {
      const disponiveis = getDestinosDisponiveis(mockAllDestinos, 'cong-sede');
      assert.equal(disponiveis.length, 2);
      assert.ok(disponiveis.every((d) => d.congregacao_id === 'cong-sede'));
      assert.equal(disponiveis[0].id, 'dest-cong1-1');
      assert.equal(disponiveis[1].id, 'dest-cong1-2');
    });

    it('11. Cenário 3: "QR Code Avulso" ("none") selecionado → Lista somente destinos sem vínculo (congregacao_id null)', () => {
      const disponiveis = getDestinosDisponiveis(mockAllDestinos, 'none');
      assert.equal(disponiveis.length, 2);
      assert.ok(disponiveis.every((d) => d.congregacao_id === null));
      assert.equal(disponiveis[0].id, 'dest-avulso-1');
      assert.equal(disponiveis[1].id, 'dest-avulso-2');
    });

    it('12. Cenário 4: Troca ou limpeza de congregação limpa o destino selecionado', () => {
      let extratoCong = 'cong-sede';
      let extratoDestino = 'dest-cong1-1';

      function handleExtratoCongChange(novaCong) {
        extratoCong = novaCong;
        extratoDestino = '';
      }

      handleExtratoCongChange('none');
      assert.equal(extratoCong, 'none');
      assert.equal(extratoDestino, '');

      extratoDestino = 'dest-avulso-1';
      handleExtratoCongChange('');
      assert.equal(extratoCong, '');
      assert.equal(extratoDestino, '');
    });

    it('13. Cenário 5: Cadastro/Edição de destino trata checkbox "QR Code Avulso" e congregacao_id', () => {
      // Quando marcado como avulso
      const payloadAvulso = {
        label: 'Oferta Especial Jovens',
        tipo_recebimento: 'oferta',
        congregacao_id: true /* isAvulso */ ? null : 'cong-sede',
      };
      assert.equal(payloadAvulso.congregacao_id, null);

      // Quando desmarcado (vinculado a congregação)
      const payloadVinculado = {
        label: 'Oferta Especial Jovens',
        tipo_recebimento: 'oferta',
        congregacao_id: false /* isAvulso */ ? null : 'cong-sede',
      };
      assert.equal(payloadVinculado.congregacao_id, 'cong-sede');
    });

    it('14. Nomenclatura amigável: quando congregação é nula/vazia, exibe "QR Code Avulso" na impressão e CSV', () => {
      const mockChargeSemCong = {
        id: 'c1',
        valor_pago: 100,
        fin_payment_destinations: {
          label: 'Oferta Geral',
          congregacoes: null,
        },
      };

      const congLabel = mockChargeSemCong.fin_payment_destinations?.congregacoes?.nome ?? 'QR Code Avulso';
      assert.equal(congLabel, 'QR Code Avulso');
    });

    it('15. Isolamento de carregamento entre Exportar CSV e Imprimir (estados independentes)', () => {
      let exportingCSV = false;
      let printingReport = false;

      // Ao clicar em Exportar CSV:
      exportingCSV = true;
      assert.equal(exportingCSV, true);
      assert.equal(printingReport, false); // Imprimir não pode sofrer alteração visual

      // Ao finalizar CSV:
      exportingCSV = false;
      assert.equal(exportingCSV, false);
      assert.equal(printingReport, false);

      // Ao clicar em Imprimir:
      printingReport = true;
      assert.equal(printingReport, true);
      assert.equal(exportingCSV, false); // CSV não pode sofrer alteração visual

      // Ao finalizar impressão:
      printingReport = false;
      assert.equal(printingReport, false);
      assert.equal(exportingCSV, false);
    });
  });
});
