/**
 * Teste de Regressão: Sincronização de Cards com Filtro de Período no Extrato PIX
 *
 * BUG REPORTADO:
 *   - Período 15/11/2026 a 22/11/2026: 4 transações, total R$ 901,00 ✅
 *   - Período 16/11/2026 a 22/11/2026:
 *       - Tabela exibia 3 transações (R$ 320 + R$ 310 + R$ 261 = R$ 891)
 *       - Cards continuavam mostrando 4 transações e R$ 901,00 ❌
 *
 * CAUSA RAIZ:
 *   O summaryQuery no backend filtrava por `created_at`, enquanto a tabela
 *   do frontend filtrava por `paid_at`. Como o gateway ASAAS grava `paid_at`
 *   como meia-noite UTC (ex: 2026-11-16T00:00:00+00:00 = 2026-11-15 no fuso
 *   local UTC-3), uma transação com paid_at=16/11T00:00Z ficava no dia 15/11
 *   para o filtro da tabela, mas no dia 16/11 para o filtro do backend.
 *
 * CORREÇÃO APLICADA:
 *   1. Backend (route.ts): summaryQuery agora filtra por `paid_at` (igual à tabela)
 *   2. Frontend (ArrecadacaoDigitalContent.tsx): `hasLocalFilters` passa a incluir
 *      `extratoDataInicio` e `extratoDataFim` como camada de segurança adicional.
 *
 * DADOS REAIS USADOS (tenant de teste 835069e8-4131-4633-b185-aeb4d0450847):
 *   c273684f — R$ 10,  paid_at: 2026-11-16T00:00:00+00:00, created_at: 2026-11-16T23:59:31Z
 *   b0921d57 — R$ 261, paid_at: 2026-11-22T00:00:00+00:00, created_at: 2026-11-22T22:19:38Z
 *   b0fae19e — R$ 310, paid_at: 2026-11-22T00:00:00+00:00, created_at: 2026-11-22T22:20:40Z
 *   be4c144d — R$ 320, paid_at: 2026-11-22T00:00:00+00:00, created_at: 2026-11-23T00:34:49Z
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Helpers replicados do sistema (mesma lógica de ArrecadacaoDigitalContent.tsx)
// ---------------------------------------------------------------------------

/**
 * Converte um timestamp ISO para a data civil no fuso America/Belem (UTC-3),
 * retornando "YYYY-MM-DD".
 */
function getChargeLocalDateStr(isoStr) {
  if (!isoStr) return '';
  try {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Belem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(isoStr));
  } catch {
    return '';
  }
}

/**
 * Simula o filtro de período da tabela do frontend (usa paid_at quando disponível).
 */
function filtrarTabelaFrontend(charges, dataInicio, dataFim) {
  return charges.filter((c) => {
    const chargeDate = getChargeLocalDateStr(c.paid_at || c.created_at);
    if (dataInicio && chargeDate && chargeDate < dataInicio) return false;
    if (dataFim && chargeDate && chargeDate > dataFim) return false;
    return true;
  });
}

/**
 * Simula o summaryQuery do backend COM A CORREÇÃO (filtra por paid_at).
 */
function summaryQueryCorrigido(charges, dataInicio, dataFim) {
  const PAID_STATUSES = new Set(['pago', 'paid', 'concluida', 'received', 'confirmed']);
  return charges.filter((c) => {
    if (!PAID_STATUSES.has((c.status || '').toLowerCase())) return false;
    // Registros sem paid_at não são considerados no summary (expirados/pendentes)
    if (!c.paid_at) return false;
    const paidDate = getChargeLocalDateStr(c.paid_at);
    if (dataInicio && paidDate < dataInicio) return false;
    if (dataFim && paidDate > dataFim) return false;
    return true;
  });
}

/**
 * Simula o summaryQuery do backend COM O BUG (filtrava por created_at).
 * Mantido para documentar a regressão.
 */
function summaryQueryBugado(charges, dataInicio, dataFim) {
  const PAID_STATUSES = new Set(['pago', 'paid', 'concluida', 'received', 'confirmed']);
  return charges.filter((c) => {
    if (!PAID_STATUSES.has((c.status || '').toLowerCase())) return false;
    const createdDate = getChargeLocalDateStr(c.created_at);
    if (dataInicio && createdDate < dataInicio) return false;
    if (dataFim && createdDate > dataFim) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Dataset replicando os dados reais do banco de teste
// ---------------------------------------------------------------------------
const CHARGES_REAIS = [
  {
    id: 'c273684f',
    status: 'pago',
    // paid_at meia-noite UTC = 15/11 no fuso UTC-3 (2026-11-15T21:00:00-03:00)
    paid_at: '2026-11-16T00:00:00+00:00',
    created_at: '2026-11-16T23:59:31.2+00:00',
    valor_pago: 10,
    destination_id: 'dest-dizimos',
  },
  {
    id: 'b0921d57',
    status: 'pago',
    // paid_at meia-noite UTC = 21/11 no fuso UTC-3 (2026-11-21T21:00:00-03:00)
    paid_at: '2026-11-22T00:00:00+00:00',
    created_at: '2026-11-22T22:19:38.901+00:00',
    valor_pago: 261,
    destination_id: 'dest-dizimos',
  },
  {
    id: 'b0fae19e',
    status: 'pago',
    paid_at: '2026-11-22T00:00:00+00:00',
    created_at: '2026-11-22T22:20:40.69+00:00',
    valor_pago: 310,
    destination_id: 'dest-dizimos',
  },
  {
    id: 'be4c144d',
    status: 'pago',
    // paid_at meia-noite UTC = 21/11 no fuso UTC-3 (2026-11-21T21:00:00-03:00)
    paid_at: '2026-11-22T00:00:00+00:00',
    // created_at = 22/11T21:34:49-03:00 = 23/11 00:34:49 UTC
    created_at: '2026-11-23T00:34:49.886+00:00',
    valor_pago: 320,
    destination_id: 'dest-dizimos',
  },
];

// ---------------------------------------------------------------------------
// Helpers para agregar os resultados
// ---------------------------------------------------------------------------
function somarValores(charges) {
  return charges.reduce((acc, c) => acc + Number(c.valor_pago ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Suite de testes
// ---------------------------------------------------------------------------
test('Regressão: filtro de período no Extrato PIX deve sincronizar tabela e cards', async (t) => {

  // -------------------------------------------------------------------------
  await t.test('1. Período 15/11 a 22/11 — deve incluir todas as 4 transações (R$ 901)', () => {
    const tabela = filtrarTabelaFrontend(CHARGES_REAIS, '2026-11-15', '2026-11-22');
    // c273684f: paid_at=15/11 local ✅ | b0921d57: paid_at=21/11 local ✅
    // b0fae19e: paid_at=21/11 local ✅ | be4c144d: paid_at=21/11 local ✅
    assert.equal(tabela.length, 4, 'Tabela deve exibir 4 transações no período 15-22/11');
    assert.equal(somarValores(tabela), 901, 'Total deve ser R$ 901,00');
  });

  // -------------------------------------------------------------------------
  await t.test('2. Período 16/11 a 22/11 — tabela deve exibir 3 transações (R$ 891)', () => {
    const tabela = filtrarTabelaFrontend(CHARGES_REAIS, '2026-11-16', '2026-11-22');
    // c273684f: paid_at=15/11 local ❌ excluída (meia-noite UTC = véspera no fuso local)
    // b0921d57: paid_at=21/11 local ✅
    // b0fae19e: paid_at=21/11 local ✅
    // be4c144d: paid_at=21/11 local ✅
    assert.equal(tabela.length, 3, 'Tabela deve exibir 3 transações no período 16-22/11');
    assert.equal(somarValores(tabela), 891, 'Total deve ser R$ 891,00');
    const ids = tabela.map((c) => c.id);
    assert.ok(!ids.includes('c273684f'), 'Transação c273684f (R$10, paid_at=15/11 local) deve ser excluída');
    assert.ok(ids.includes('b0921d57'), 'Transação b0921d57 (R$261) deve estar incluída');
    assert.ok(ids.includes('b0fae19e'), 'Transação b0fae19e (R$310) deve estar incluída');
    assert.ok(ids.includes('be4c144d'), 'Transação be4c144d (R$320) deve estar incluída');
  });

  // -------------------------------------------------------------------------
  await t.test('3. CORREÇÃO: summaryQuery corrigido (paid_at) — período 16/11 a 22/11 retorna 3 tx e R$ 891', () => {
    const summary = summaryQueryCorrigido(CHARGES_REAIS, '2026-11-16', '2026-11-22');
    assert.equal(summary.length, 3, 'Summary corrigido deve retornar 3 transações');
    assert.equal(somarValores(summary), 891, 'Summary corrigido deve totalizar R$ 891,00');
  });

  // -------------------------------------------------------------------------
  await t.test('4. REGRESSÃO BUG: summaryQuery bugado (created_at) — retornava 4 tx e R$ 901 (errado)', () => {
    const summaryBug = summaryQueryBugado(CHARGES_REAIS, '2026-11-16', '2026-11-22');
    // O bug fazia o summary retornar 4 (incluindo c273684f cujo created_at é 16/11 local)
    // enquanto a tabela mostrava 3 (excluindo com base em paid_at=15/11 local)
    assert.equal(summaryBug.length, 4, 'Bug: summary com created_at retornava 4 (documentação da regressão)');
    assert.equal(somarValores(summaryBug), 901, 'Bug: summary com created_at totalizava R$ 901 (documentação da regressão)');
  });

  // -------------------------------------------------------------------------
  await t.test('5. Verificar que paid_at meia-noite UTC é convertido corretamente para fuso local (UTC-3)', () => {
    // 2026-11-16T00:00:00+00:00 = 2026-11-15T21:00:00-03:00 → data local = 15/11
    const dataPaidAt = getChargeLocalDateStr('2026-11-16T00:00:00+00:00');
    assert.equal(dataPaidAt, '2026-11-15', 'paid_at meia-noite UTC deve ser 15/11 no fuso UTC-3');

    // 2026-11-16T23:59:31Z = 2026-11-16T20:59:31-03:00 → data local = 16/11
    const dataCreatedAt = getChargeLocalDateStr('2026-11-16T23:59:31.2+00:00');
    assert.equal(dataCreatedAt, '2026-11-16', 'created_at às 23:59 UTC deve ser 16/11 no fuso UTC-3');
  });

  // -------------------------------------------------------------------------
  await t.test('6. Verificar conversão de paid_at da transação be4c144d (R$320)', () => {
    // paid_at = 2026-11-22T00:00:00+00:00 = 2026-11-21T21:00:00-03:00 → data local = 21/11
    const dataPaidAt = getChargeLocalDateStr('2026-11-22T00:00:00+00:00');
    assert.equal(dataPaidAt, '2026-11-21', 'paid_at da be4c144d deve ser 21/11 no fuso UTC-3');

    // created_at = 2026-11-23T00:34:49Z = 2026-11-22T21:34:49-03:00 → data local = 22/11
    const dataCreatedAt = getChargeLocalDateStr('2026-11-23T00:34:49.886+00:00');
    assert.equal(dataCreatedAt, '2026-11-22', 'created_at da be4c144d deve ser 22/11 no fuso UTC-3');
  });

  // -------------------------------------------------------------------------
  await t.test('7. Período 15/11 a 22/11 — summary corrigido retorna 4 tx e R$ 901 (cenário original)', () => {
    const summary = summaryQueryCorrigido(CHARGES_REAIS, '2026-11-15', '2026-11-22');
    // c273684f: paid_at=15/11 local ✅
    // b0921d57, b0fae19e, be4c144d: paid_at=21/11 local ✅
    assert.equal(summary.length, 4, 'Summary deve retornar 4 transações no período 15-22/11');
    assert.equal(somarValores(summary), 901, 'Total deve ser R$ 901,00');
  });

  // -------------------------------------------------------------------------
  await t.test('8. Cards e tabela sincronizados: período 16/11 a 22/11 — ambos devem retornar 3 tx e R$ 891', () => {
    const tabela = filtrarTabelaFrontend(CHARGES_REAIS, '2026-11-16', '2026-11-22');
    const summary = summaryQueryCorrigido(CHARGES_REAIS, '2026-11-16', '2026-11-22');

    // Com a correção, tabela e cards devem estar sincronizados
    assert.equal(tabela.length, summary.length, 'Tabela e summary devem ter o mesmo número de transações');
    assert.equal(somarValores(tabela), somarValores(summary), 'Tabela e summary devem ter o mesmo total');
    assert.equal(tabela.length, 3, 'Ambos devem exibir 3 transações');
    assert.equal(somarValores(tabela), 891, 'Ambos devem totalizar R$ 891,00');
  });

  // -------------------------------------------------------------------------
  await t.test('9. hasLocalFilters inclui filtros de data (proteção adicional frontend)', () => {
    // Simula a lógica de hasLocalFilters corrigida
    function hasLocalFilters(buscaExtrato, extratoTipoMovimento, extratoDataInicio, extratoDataFim) {
      return Boolean(
        buscaExtrato.trim() ||
        extratoTipoMovimento === 'saidas' ||
        extratoDataInicio ||
        extratoDataFim
      );
    }

    // Sem nenhum filtro → false (cards usam summary do backend)
    assert.equal(hasLocalFilters('', 'entradas', '', ''), false, 'Sem filtros: hasLocalFilters deve ser false');

    // Com filtro de data início → true (cards usam valores locais)
    assert.equal(hasLocalFilters('', 'entradas', '2026-11-16', ''), true, 'Com dataInicio: hasLocalFilters deve ser true');

    // Com filtro de data fim → true
    assert.equal(hasLocalFilters('', 'entradas', '', '2026-11-22'), true, 'Com dataFim: hasLocalFilters deve ser true');

    // Com busca textual → true (comportamento anterior mantido)
    assert.equal(hasLocalFilters('maria', 'entradas', '', ''), true, 'Com busca: hasLocalFilters deve ser true');
  });

  // -------------------------------------------------------------------------
  await t.test('10. Sem filtro de data — período completo retorna todas as transações (R$ 901)', () => {
    const tabela = filtrarTabelaFrontend(CHARGES_REAIS, '', '');
    const summary = summaryQueryCorrigido(CHARGES_REAIS, '', '');
    assert.equal(tabela.length, 4, 'Sem filtro de data: tabela deve retornar 4 transações');
    assert.equal(summary.length, 4, 'Sem filtro de data: summary deve retornar 4 transações');
    assert.equal(somarValores(tabela), 901, 'Total sem filtro deve ser R$ 901,00');
  });
});
