import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCivilDueDate,
  getSaoPauloDateStr,
  calculateCivilDaysDiff,
} from '@/components/financeiro/GlobalFinancialBanner';

describe('GlobalFinancialBanner — Datas Civis e Fuso Horário', () => {
  it('1. formatCivilDueDate preserva exatamente o dia registrado no banco sem recuo UTC', () => {
    assert.equal(formatCivilDueDate('2026-11-10'), '10/11/2026');
    assert.equal(formatCivilDueDate('2026-11-09'), '09/11/2026');
    assert.equal(formatCivilDueDate('2026-11-01'), '01/11/2026');
    assert.equal(formatCivilDueDate('2026-12-31'), '31/12/2026');
    assert.equal(formatCivilDueDate(null), null);
  });

  it('2. getSaoPauloDateStr resolve o dia civil corrente em America/Sao_Paulo', () => {
    // 2026-11-08 às 23:30 em Brasília (UTC-3) -> 2026-11-09T02:30:00Z em UTC
    const dateAtNightSP = new Date('2026-11-09T02:30:00Z');
    assert.equal(getSaoPauloDateStr(dateAtNightSP), '2026-11-08');

    // 2026-11-09 às 00:05 em Brasília (UTC-3) -> 2026-11-09T03:05:00Z em UTC
    const dateJustAfterMidnightSP = new Date('2026-11-09T03:05:00Z');
    assert.equal(getSaoPauloDateStr(dateJustAfterMidnightSP), '2026-11-09');
  });

  it('3. calculateCivilDaysDiff para o caso Assembleia de Deus Ananindeua (vencimento 10/11/2026)', () => {
    // Cenário: domingo 08/11/2026 às 16:30 em São Paulo
    const now08 = new Date('2026-11-08T19:30:00Z');
    const diff08 = calculateCivilDaysDiff('2026-11-10', now08);
    assert.equal(diff08, 2, 'No dia 08/11, uma fatura que vence em 10/11 deve faltar 2 dias');

    // Cenário: segunda-feira 09/11/2026 às 10:00 em São Paulo
    const now09 = new Date('2026-11-09T13:00:00Z');
    const diff09 = calculateCivilDaysDiff('2026-11-10', now09);
    assert.equal(diff09, 1, 'No dia 09/11, uma fatura que vence em 10/11 deve faltar 1 dia ("vence amanhã")');

    // Cenário: terça-feira 10/11/2026 às 08:00 em São Paulo
    const now10 = new Date('2026-11-10T11:00:00Z');
    const diff10 = calculateCivilDaysDiff('2026-11-10', now10);
    assert.equal(diff10, 0, 'No dia 10/11, uma fatura que vence em 10/11 deve ter diff = 0 ("vence hoje")');

    // Cenário: quarta-feira 11/11/2026 às 08:00 em São Paulo
    const now11 = new Date('2026-11-11T11:00:00Z');
    const diff11 = calculateCivilDaysDiff('2026-11-10', now11);
    assert.equal(diff11, -1, 'No dia 11/11, a fatura de 10/11 está vencida há 1 dia');
  });

  it('4. calculateCivilDaysDiff para vencimento 09/11/2026', () => {
    const now08 = new Date('2026-11-08T19:30:00Z');
    const diff = calculateCivilDaysDiff('2026-11-09', now08);
    assert.equal(diff, 1, 'No dia 08/11, vencimento 09/11 falta 1 dia');

    const now09 = new Date('2026-11-09T13:00:00Z');
    const diffToday = calculateCivilDaysDiff('2026-11-09', now09);
    assert.equal(diffToday, 0, 'No dia 09/11, vencimento 09/11 vence hoje');
  });

  it('5. Transições de virada de mês e fim de ano são preservadas', () => {
    const nowNov30 = new Date('2026-11-30T15:00:00Z');
    assert.equal(calculateCivilDaysDiff('2026-12-01', nowNov30), 1, 'De 30/11 para 01/12 falta 1 dia');

    const nowDec31 = new Date('2026-12-31T15:00:00Z');
    assert.equal(calculateCivilDaysDiff('2027-01-01', nowDec31), 1, 'De 31/12 para 01/01 falta 1 dia');
  });
});
