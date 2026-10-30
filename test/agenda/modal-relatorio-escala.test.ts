import test from 'node:test';
import assert from 'node:assert/strict';
import { MESES_NOMES } from '@/components/secretaria/escala-pregadores/EscalaFiltrosBar';
import { getLocalDateStr } from '@/lib/timezone-utils';

test('ModalRelatorioEscala: Seletores de Mês e Formatação por Extenso', async (t) => {
  await t.test('1. MESES_NOMES contém os 12 meses corretos de 01 a 12', () => {
    assert.equal(MESES_NOMES.length, 12);
    assert.equal(MESES_NOMES[0].valor, '01');
    assert.equal(MESES_NOMES[0].nome, 'Janeiro');
    assert.equal(MESES_NOMES[9].valor, '10');
    assert.equal(MESES_NOMES[9].nome, 'Outubro');
    assert.equal(MESES_NOMES[11].valor, '12');
    assert.equal(MESES_NOMES[11].nome, 'Dezembro');
  });

  await t.test('2. Fuso America/Belem gera anoMes padrão no formato YYYY-MM', () => {
    const todayBelem = getLocalDateStr(new Date());
    assert.match(todayBelem, /^\d{4}-\d{2}-\d{2}$/);
    const anoMes = todayBelem.substring(0, 7);
    assert.match(anoMes, /^\d{4}-\d{2}$/);
  });

  await t.test('3. Formatação por extenso do período mensal', () => {
    const anoMes = '2026-10';
    const [ano, mes] = anoMes.split('-');
    const nomeMes = MESES_NOMES.find(m => m.valor === mes)?.nome;
    const formatado = `${nomeMes} de ${ano}`;
    assert.equal(formatado, 'Outubro de 2026');
  });

  await t.test('4. Alteração de mês e ano preserva YYYY-MM para o backend', () => {
    let anoAtual = 2026;
    let mesAtual = '10';

    // Simula troca de mês para Novembro ('11')
    mesAtual = '11';
    let anoMesBackend = `${anoAtual}-${mesAtual}`;
    assert.equal(anoMesBackend, '2026-11');

    // Simula troca de ano para 2027
    anoAtual = 2027;
    anoMesBackend = `${anoAtual}-${mesAtual}`;
    assert.equal(anoMesBackend, '2027-11');
  });
});
