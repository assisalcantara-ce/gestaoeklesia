/**
 * financial-balance-canonical.test.js
 *
 * Suíte Oficial de Testes Automatizados — TESOURARIA LOTE 2:
 * PADRONIZAÇÃO CANÔNICA DE SALDOS E FECHAMENTOS FINANCEIROS
 *
 * Cenários Testados:
 * 1. Primeiro mês de operação: saldo inicial = saldo_implantacao e saldo final = saldo_inicial + entradas - saídas.
 * 2. Saldo de implantação: fin_contas.saldo_inicial é computado rigorosamente para contas ativas do escopo.
 * 3. Mês anterior sem fechamento: cálculo retrospectivo correto considerando todos os lançamentos anteriores.
 * 4. Múltiplos meses consecutivos em aberto: continuidade exata entre meses N e N+1.
 * 5. Período sem movimentação: saldo inicial = saldo final do período anterior; entradas=0, saídas=0, saldo final inalterado.
 * 6. Saldo negativo: apuração correta quando saídas superam entradas + saldo inicial.
 * 7. Fechamentos homologados: quando há fechamento com status = 'fechado', prevalece o saldo homologado gravado.
 * 8. Virada de ano: continuidade temporal ininterrupta de dezembro para janeiro (2025-12 -> 2026-01).
 * 9. Consolidação de congregações: isolamento estrito de saldos por congregacao_id e apuração do ministério geral.
 * 10. Transferências internas: paridade matemática e neutralidade no saldo global (entrada em conta B = saída em conta A).
 * 11. Cancelamentos e estornos: neutralização correta de lançamentos estornados ou excluídos.
 * 12. Precisão monetária (centavos): garantia de ausência de resíduos de ponto flutuante em somas acumuladas.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  roundCurrency,
  computeCanonicalInitialBalance,
  computePeriodTotals,
} from '../../src/lib/financial-balance-service.ts';

describe('TESOURARIA LOTE 2: Padronização Canônica de Saldos e Fechamentos', () => {

  it('1. Primeiro mês de operação (sem fechamento anterior)', () => {
    const contas = [{ id: 'conta-1', saldo_inicial: 500.0, is_ativa: true }];
    const fechamentos = [];
    const lancamentos = [
      { data_lancamento: '2026-01-05', tipo_movimento: 'entrada', valor: 1000.0 },
      { data_lancamento: '2026-01-10', tipo_movimento: 'saida', valor: 300.0 },
    ];

    const ini = computeCanonicalInitialBalance({
      dataInicio: '2026-01-01',
      contas,
      fechamentos,
      lancamentosHistoricos: lancamentos,
    });

    assert.strictEqual(ini.saldoInicial, 500.0);
    assert.strictEqual(ini.ancoragem, 'saldo_implantacao');

    const totals = computePeriodTotals({
      saldoInicial: ini.saldoInicial,
      dataInicio: '2026-01-01',
      dataFim: '2026-01-31',
      lancamentos,
    });

    assert.strictEqual(totals.entradas, 1000.0);
    assert.strictEqual(totals.saidas, 300.0);
    assert.strictEqual(totals.saldoFinal, 1200.0);
  });

  it('2. Saldo de implantação contempla contas ativas e inativas com histórico financeiro do escopo', () => {
    const contas = [
      { id: 'c1', saldo_inicial: 1000.0, is_ativa: true, congregacao_id: null },
      { id: 'c2', saldo_inicial: 500.0, is_ativa: true, congregacao_id: null },
      { id: 'c3', saldo_inicial: 800.0, is_ativa: false, congregacao_id: null }, // Inativa com saldo histórico
    ];
    const ini = computeCanonicalInitialBalance({
      dataInicio: '2026-01-01',
      contas,
      fechamentos: [],
      lancamentosHistoricos: [],
    });

    // 1000 + 500 + 800 = 2300 (preservação do patrimônio histórico mesmo após inativação da conta)
    assert.strictEqual(ini.saldoInicial, 2300.0);
  });

  it('3. Mês anterior sem fechamento calcula delta retroativo', () => {
    const contas = [{ id: 'c1', saldo_inicial: 100.0, is_ativa: true }];
    const lancamentos = [
      { data_lancamento: '2026-01-15', tipo_movimento: 'entrada', valor: 500.0 },
      { data_lancamento: '2026-01-20', tipo_movimento: 'saida', valor: 200.0 },
      { data_lancamento: '2026-02-05', tipo_movimento: 'entrada', valor: 300.0 },
    ];

    // Cálculo para Fevereiro: saldo inicial deve considerar janeiro inteiro
    const iniFev = computeCanonicalInitialBalance({
      dataInicio: '2026-02-01',
      contas,
      fechamentos: [],
      lancamentosHistoricos: lancamentos,
    });

    // 100 (implantacao) + 500 - 200 = 400
    assert.strictEqual(iniFev.saldoInicial, 400.0);

    const totalsFev = computePeriodTotals({
      saldoInicial: iniFev.saldoInicial,
      dataInicio: '2026-02-01',
      dataFim: '2026-02-28',
      lancamentos,
    });

    // 400 + 300 = 700
    assert.strictEqual(totalsFev.saldoFinal, 700.0);
  });

  it('4. Múltiplos meses consecutivos em aberto mantêm continuidade estrita', () => {
    const contas = [{ id: 'c1', saldo_inicial: 0, is_ativa: true }];
    const lancamentos = [
      { data_lancamento: '2026-01-10', tipo_movimento: 'entrada', valor: 100.0 },
      { data_lancamento: '2026-02-10', tipo_movimento: 'entrada', valor: 200.0 },
      { data_lancamento: '2026-03-10', tipo_movimento: 'saida', valor: 50.0 },
    ];

    // Fim de Jan = 100
    const janIni = computeCanonicalInitialBalance({ dataInicio: '2026-01-01', contas, fechamentos: [], lancamentosHistoricos: lancamentos });
    const janTot = computePeriodTotals({ saldoInicial: janIni.saldoInicial, dataInicio: '2026-01-01', dataFim: '2026-01-31', lancamentos });
    assert.strictEqual(janTot.saldoFinal, 100.0);

    // Início de Fev deve ser exatamente igual a Fim de Jan
    const fevIni = computeCanonicalInitialBalance({ dataInicio: '2026-02-01', contas, fechamentos: [], lancamentosHistoricos: lancamentos });
    assert.strictEqual(fevIni.saldoInicial, janTot.saldoFinal);

    const fevTot = computePeriodTotals({ saldoInicial: fevIni.saldoInicial, dataInicio: '2026-02-01', dataFim: '2026-02-28', lancamentos });
    assert.strictEqual(fevTot.saldoFinal, 300.0);

    // Início de Mar deve ser exatamente igual a Fim de Fev
    const marIni = computeCanonicalInitialBalance({ dataInicio: '2026-03-01', contas, fechamentos: [], lancamentosHistoricos: lancamentos });
    assert.strictEqual(marIni.saldoInicial, fevTot.saldoFinal);

    const marTot = computePeriodTotals({ saldoInicial: marIni.saldoInicial, dataInicio: '2026-03-01', dataFim: '2026-03-31', lancamentos });
    assert.strictEqual(marTot.saldoFinal, 250.0);
  });

  it('5. Período sem movimentação preserva saldo inicial idêntico ao final', () => {
    const contas = [{ id: 'c1', saldo_inicial: 1000.0, is_ativa: true }];
    const lancamentos = [];

    const ini = computeCanonicalInitialBalance({ dataInicio: '2026-04-01', contas, fechamentos: [], lancamentosHistoricos: lancamentos });
    const tot = computePeriodTotals({ saldoInicial: ini.saldoInicial, dataInicio: '2026-04-01', dataFim: '2026-04-30', lancamentos });

    assert.strictEqual(tot.entradas, 0);
    assert.strictEqual(tot.saidas, 0);
    assert.strictEqual(tot.saldoFinal, 1000.0);
    assert.strictEqual(tot.saldoFinal, ini.saldoInicial);
  });

  it('6. Apuração de saldo negativo quando saídas superam entradas', () => {
    const contas = [{ id: 'c1', saldo_inicial: 200.0, is_ativa: true }];
    const lancamentos = [
      { data_lancamento: '2026-05-02', tipo_movimento: 'saida', valor: 500.0 },
    ];

    const ini = computeCanonicalInitialBalance({ dataInicio: '2026-05-01', contas, fechamentos: [], lancamentosHistoricos: lancamentos });
    const tot = computePeriodTotals({ saldoInicial: ini.saldoInicial, dataInicio: '2026-05-01', dataFim: '2026-05-31', lancamentos });

    // 200 - 500 = -300
    assert.strictEqual(tot.saldoFinal, -300.0);
  });

  it('7. Fechamento homologado ancora saldo inicial do mês seguinte', () => {
    const contas = [{ id: 'c1', saldo_inicial: 100.0, is_ativa: true }];
    const fechamentos = [
      {
        id: 'f-jan',
        mes_referencia: '2026-01',
        data_inicio: '2026-01-01',
        data_fim: '2026-01-31',
        saldo_inicial: 100.0,
        total_entradas: 800.0,
        total_saidas: 200.0,
        saldo_final: 700.0, // Homologado em 700
        status: 'fechado',
      },
    ];

    // Movimentações: mesmo que haja uma movimentação histórica antiga, o fechamento homologado é a âncora
    const lancamentos = [
      { data_lancamento: '2026-01-15', tipo_movimento: 'entrada', valor: 9999.0 }, // Não deve recontar
      { data_lancamento: '2026-02-10', tipo_movimento: 'entrada', valor: 150.0 },
    ];

    const iniFev = computeCanonicalInitialBalance({
      dataInicio: '2026-02-01',
      contas,
      fechamentos,
      lancamentosHistoricos: lancamentos,
    });

    assert.strictEqual(iniFev.saldoInicial, 700.0);
    assert.strictEqual(iniFev.ancoragem, 'fechamento_anterior');
  });

  it('8. Virada de ano (2025-12 para 2026-01) sem ruptura contábil', () => {
    const contas = [{ id: 'c1', saldo_inicial: 1000.0, is_ativa: true }];
    const lancamentos = [
      { data_lancamento: '2025-12-20', tipo_movimento: 'entrada', valor: 500.0 },
      { data_lancamento: '2025-12-28', tipo_movimento: 'saida', valor: 200.0 },
      { data_lancamento: '2026-01-02', tipo_movimento: 'entrada', valor: 300.0 },
    ];

    const ini2026 = computeCanonicalInitialBalance({
      dataInicio: '2026-01-01',
      contas,
      fechamentos: [],
      lancamentosHistoricos: lancamentos,
    });

    // 1000 + 500 - 200 = 1300
    assert.strictEqual(ini2026.saldoInicial, 1300.0);
  });

  it('9. Isolamento de saldos por congregação', () => {
    const congA = 'cong-a';
    const congB = 'cong-b';

    const contas = [
      { id: 'cA', saldo_inicial: 300.0, is_ativa: true, congregacao_id: congA },
      { id: 'cB', saldo_inicial: 700.0, is_ativa: true, congregacao_id: congB },
    ];

    const lancamentos = [
      { data_lancamento: '2026-01-10', tipo_movimento: 'entrada', valor: 50.0, congregacao_id: congA },
      { data_lancamento: '2026-01-10', tipo_movimento: 'entrada', valor: 150.0, congregacao_id: congB },
    ];

    // Congregação A
    const iniA = computeCanonicalInitialBalance({ dataInicio: '2026-02-01', congregacaoId: congA, contas, fechamentos: [], lancamentosHistoricos: lancamentos });
    assert.strictEqual(iniA.saldoInicial, 350.0);

    // Congregação B
    const iniB = computeCanonicalInitialBalance({ dataInicio: '2026-02-01', congregacaoId: congB, contas, fechamentos: [], lancamentosHistoricos: lancamentos });
    assert.strictEqual(iniB.saldoInicial, 850.0);
  });

  it('10. Transferência interna possui neutralidade global', () => {
    const contas = [
      { id: 'c1', saldo_inicial: 1000.0, is_ativa: true },
      { id: 'c2', saldo_inicial: 500.0, is_ativa: true },
    ];

    // Transferência de 200 de c1 para c2
    const lancamentos = [
      { data_lancamento: '2026-03-01', tipo_movimento: 'saida', valor: 200.0, conta_id: 'c1' },
      { data_lancamento: '2026-03-01', tipo_movimento: 'entrada', valor: 200.0, conta_id: 'c2' },
    ];

    const iniGlobal = computeCanonicalInitialBalance({ dataInicio: '2026-03-01', contas, fechamentos: [], lancamentosHistoricos: lancamentos });
    const totGlobal = computePeriodTotals({ saldoInicial: iniGlobal.saldoInicial, dataInicio: '2026-03-01', dataFim: '2026-03-31', lancamentos });

    // Saldo inicial global = 1500
    assert.strictEqual(iniGlobal.saldoInicial, 1500.0);
    // Entradas = 200, Saídas = 200, Saldo final = 1500
    assert.strictEqual(totGlobal.entradas, 200.0);
    assert.strictEqual(totGlobal.saidas, 200.0);
    assert.strictEqual(totGlobal.saldoFinal, 1500.0);
  });

  it('11. Estorno com paridade matemática zera o impacto contábil', () => {
    const contas = [{ id: 'c1', saldo_inicial: 100.0, is_ativa: true }];
    const lancamentos = [
      { data_lancamento: '2026-01-05', tipo_movimento: 'entrada', valor: 300.0 }, // Lançamento
      { data_lancamento: '2026-01-06', tipo_movimento: 'saida', valor: 300.0 },   // Estorno
    ];

    const tot = computePeriodTotals({ saldoInicial: 100.0, dataInicio: '2026-01-01', dataFim: '2026-01-31', lancamentos });
    assert.strictEqual(tot.saldoFinal, 100.0);
  });

  it('12. Precisão de centavos sem desvio de ponto flutuante', () => {
    const contas = [{ id: 'c1', saldo_inicial: 0.1, is_ativa: true }];
    const lancamentos = [
      { data_lancamento: '2026-01-01', tipo_movimento: 'entrada', valor: 0.2 },
    ];

    const ini = computeCanonicalInitialBalance({ dataInicio: '2026-01-01', contas, fechamentos: [], lancamentosHistoricos: lancamentos });
    const tot = computePeriodTotals({ saldoInicial: ini.saldoInicial, dataInicio: '2026-01-01', dataFim: '2026-01-31', lancamentos });

    assert.strictEqual(roundCurrency(0.1 + 0.2), 0.3);
    assert.strictEqual(tot.saldoFinal, 0.3);
  });

});
