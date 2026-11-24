/**
 * financial-date-utils.test.ts
 * Suíte de testes automatizados para os utilitários canônicos de datas financeiras.
 * Testa conformidade rigorosa com:
 * 1. Distinção entre data civil, timestamp real e paymentDate ASAAS.
 * 2. Preservação de data civil em paymentDate ASAAS (sem deslocamento de fuso de 1 dia para trás).
 * 3. Conversão de timestamps reais com horário para o fuso institucional America/Belem (UTC-3).
 * 4. Geração canônica de limites de período (buildPeriodFilterBounds).
 * 5. Reconciliação dos cenários reais da Assembleia de Deus Ananindeua.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  isAsaasCivilDateTimestamp,
  getFinancialCivilDateStr,
  formatFinancialDateTime,
  buildPeriodFilterBounds,
  isDateInCivilPeriod,
  FINANCIAL_TIMEZONE,
} from '../../src/lib/financial-date-utils.ts';

describe('Financial Date Utilities — Padronização Temporal Canônica', () => {
  it('1. Deve identificar corretamente strings ISO de data civil pura do ASAAS (paymentDate)', () => {
    assert.strictEqual(isAsaasCivilDateTimestamp('2026-11-22T00:00:00Z'), true);
    assert.strictEqual(isAsaasCivilDateTimestamp('2026-11-22T00:00:00+00:00'), true);
    assert.strictEqual(isAsaasCivilDateTimestamp('2026-11-22T00:00:00.000Z'), true);
    assert.strictEqual(isAsaasCivilDateTimestamp('2026-11-22T00:00:00.000+00:00'), true);

    // Não deve classificar timestamps reais com horário como data civil pura
    assert.strictEqual(isAsaasCivilDateTimestamp('2026-11-22T22:19:38.901+00:00'), false);
    assert.strictEqual(isAsaasCivilDateTimestamp('2026-11-23T00:34:49.886+00:00'), false);
    assert.strictEqual(isAsaasCivilDateTimestamp('2026-11-22'), true); // data civil pura
    assert.strictEqual(isAsaasCivilDateTimestamp(null), false);

    // Suporte a opções semânticas explícitas
    assert.strictEqual(isAsaasCivilDateTimestamp('qualquer-valor', { sourceField: 'asaas_payment_date' }), true);
  });

  it('2. Deve extrair data civil sem subtrair 1 dia em timestamps de pagamento do ASAAS', () => {
    // ASAAS paymentDate '2026-11-22T00:00:00+00:00' deve permanecer '2026-11-22'
    const civilDateAsaas = getFinancialCivilDateStr('2026-11-22T00:00:00+00:00');
    assert.strictEqual(civilDateAsaas, '2026-11-22');

    // Data pura já 'YYYY-MM-DD'
    assert.strictEqual(getFinancialCivilDateStr('2026-11-22'), '2026-11-22');
  });

  it('3. Deve converter timestamps reais para o dia civil correto em America/Belem (UTC-3)', () => {
    // Timestamp criado em 23/11 às 00:34:49 UTC corresponde a 22/11 às 21:34:49 em Belém (UTC-3)
    const civilFromRealTimestamp = getFinancialCivilDateStr('2026-11-23T00:34:49.886+00:00');
    assert.strictEqual(civilFromRealTimestamp, '2026-11-22');

    // Timestamp criado em 22/11 às 22:19:38 UTC corresponde a 22/11 às 19:19:38 em Belém
    assert.strictEqual(getFinancialCivilDateStr('2026-11-22T22:19:38.901+00:00'), '2026-11-22');

    // Timestamp criado em 01/11 às 01:00:00 UTC corresponde a 31/10 às 22:00:00 em Belém
    assert.strictEqual(getFinancialCivilDateStr('2026-11-01T01:00:00.000Z'), '2026-10-31');

    // Timestamp criado em 01/11 às 03:00:00 UTC corresponde a 01/11 às 00:00:00 em Belém
    assert.strictEqual(getFinancialCivilDateStr('2026-11-01T03:00:00.000Z'), '2026-11-01');
  });

  it('4. Deve formatar datas civis e timestamps reais sem distorção visual', () => {
    // Data pura
    assert.strictEqual(formatFinancialDateTime('2026-11-22'), '22/11/2026');
    // ASAAS paymentDate
    assert.strictEqual(formatFinancialDateTime('2026-11-22T00:00:00+00:00'), '22/11/2026');
    // Timestamp real com hora em Belém
    assert.strictEqual(formatFinancialDateTime('2026-11-22T22:19:38.901+00:00'), '22/11/2026 19:19');
    assert.strictEqual(formatFinancialDateTime('2026-11-23T00:34:49.886+00:00'), '22/11/2026 21:34');
  });

  it('5. buildPeriodFilterBounds deve gerar limites ISO estritos com timezone UTC-3', () => {
    // Período com início e fim definidos
    const bounds = buildPeriodFilterBounds('2026-11-07', '2026-11-23');
    assert.strictEqual(bounds.startIso, '2026-11-07T00:00:00.000-03:00');
    assert.strictEqual(bounds.endIso, '2026-11-23T23:59:59.999-03:00');

    // Datas inicial e final iguais (mesmo dia)
    const sameDayBounds = buildPeriodFilterBounds('2026-11-22', '2026-11-22');
    assert.strictEqual(sameDayBounds.startIso, '2026-11-22T00:00:00.000-03:00');
    assert.strictEqual(sameDayBounds.endIso, '2026-11-22T23:59:59.999-03:00');

    // Mês de referência (virada de ano)
    const dezBounds = buildPeriodFilterBounds(null, null, '2026-12');
    assert.strictEqual(dezBounds.startIso, '2026-12-01T00:00:00.000-03:00');
    assert.ok(dezBounds.endIso?.startsWith('2026-12-31T23:59:59'));
  });

  it('6. Reconciliação do Cenário Orvalho de Hermon com os 4 períodos exigidos', () => {
    // 3 cobranças legítimas do dia 22/11:
    const cobrancas22 = [
      { id: 'b0921d57', valor: 261, paid_at: '2026-11-22T00:00:00+00:00', created_at: '2026-11-22T22:19:38.901+00:00' },
      { id: 'b0fae19e', valor: 310, paid_at: '2026-11-22T00:00:00+00:00', created_at: '2026-11-22T22:20:40.69+00:00' },
      { id: 'be4c144d', valor: 320, paid_at: '2026-11-22T00:00:00+00:00', created_at: '2026-11-23T00:34:49.886+00:00' },
    ];
    // Cobrança de 16/11:
    const cobranca16 = { id: 'c273684f', valor: 10, paid_at: '2026-11-16T00:00:00+00:00', created_at: '2026-11-16T23:59:31.2+00:00' };
    const dataset = [...cobrancas22, cobranca16];

    // Período A: 15/11 a 22/11 → Esperado: 4 transações e R$ 901,00
    const p15a22 = dataset.filter(c => isDateInCivilPeriod(c.paid_at, '2026-11-15', '2026-11-22'));
    assert.strictEqual(p15a22.length, 4, '15/11 a 22/11 deve conter 4 transações');
    assert.strictEqual(p15a22.reduce((acc, c) => acc + c.valor, 0), 901.00, '15/11 a 22/11 deve somar R$ 901,00');

    // Período B: 16/11 a 22/11 → Com a semântica canônica de data civil (paid_at='2026-11-16' preservado sem recuar para 15/11):
    // Esperado: 4 transações e R$ 901,00
    const p16a22 = dataset.filter(c => isDateInCivilPeriod(c.paid_at, '2026-11-16', '2026-11-22'));
    assert.strictEqual(p16a22.length, 4, '16/11 a 22/11 deve conter 4 transações');
    assert.strictEqual(p16a22.reduce((acc, c) => acc + c.valor, 0), 901.00, '16/11 a 22/11 deve somar R$ 901,00');

    // Período C: 17/11 a 22/11 → Esperado: 3 transações e R$ 891,00 (exclui 16/11)
    const p17a22 = dataset.filter(c => isDateInCivilPeriod(c.paid_at, '2026-11-17', '2026-11-22'));
    assert.strictEqual(p17a22.length, 3, '17/11 a 22/11 deve conter 3 transações');
    assert.strictEqual(p17a22.reduce((acc, c) => acc + c.valor, 0), 891.00, '17/11 a 22/11 deve somar R$ 891,00');

    // Período D: Somente 22/11 → Esperado: 3 transações e R$ 891,00
    const pSomente22 = dataset.filter(c => isDateInCivilPeriod(c.paid_at, '2026-11-22', '2026-11-22'));
    assert.strictEqual(pSomente22.length, 3, 'Somente 22/11 deve conter 3 transações');
    assert.strictEqual(pSomente22.reduce((acc, c) => acc + c.valor, 0), 891.00, 'Somente 22/11 deve somar R$ 891,00');
  });

  it('7. Reconciliação do Cenário Missão Mulheres (07/11/2026 a 23/11/2026)', () => {
    // Simulação com amostra representativa dos pagamentos do período
    const sampleCharges = [
      { id: '1', valor: 200, paid_at: '2026-11-07T00:00:00+00:00' },
      { id: '2', valor: 50,  paid_at: '2026-11-12T00:00:00+00:00' },
      { id: '3', valor: 100, paid_at: '2026-11-23T00:00:00+00:00' },
      { id: '4', valor: 300, paid_at: '2026-11-06T00:00:00+00:00' }, // Fora (anterior)
      { id: '5', valor: 80,  paid_at: '2026-11-24T00:00:00+00:00' }, // Fora (posterior)
    ];

    const filtradas = sampleCharges.filter(c => isDateInCivilPeriod(c.paid_at, '2026-11-07', '2026-11-23'));
    assert.strictEqual(filtradas.length, 3);
    const total = filtradas.reduce((acc, c) => acc + c.valor, 0);
    assert.strictEqual(total, 350);
  });
});
