import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MESES_NOMES,
  getInstitutionalYearMonth,
  getVisibleMonthsForEdition,
  filterPublicEventsForEdition,
  resolveTargetPageIndex,
  paginateDepartmentsForRevista,
  type PaginaRevistaBase,
  type DepartamentoRevistaPublico,
} from '../../src/lib/revista-digital-utils.js';

function buildTestPages(editionYear: number, now: Date): PaginaRevistaBase[] {
  const lista: PaginaRevistaBase[] = [
    { id: 'capa', tipo: 'capa', titulo: 'Capa Oficial', numeroPagina: 1 },
  ];
  let num = 2;
  for (const m of getVisibleMonthsForEdition(editionYear, now, 'America/Belem')) {
    lista.push({
      id: `mes-${m}`,
      tipo: 'mes',
      titulo: MESES_NOMES[m],
      mesIndex: m,
      numeroPagina: num++,
    });
  }
  return lista;
}

describe('Revista Digital Pública Dinâmica — Ocultação de Meses Encerrados', () => {
  it('1. Em Novembro/2026 exibe Capa (p.1), Novembro (p.2) e Dezembro (p.3)', () => {
    const nov2026 = new Date('2026-11-25T15:00:00.000Z');
    const paginas = buildTestPages(2026, nov2026);

    assert.equal(paginas.length, 3);
    assert.deepEqual(
      paginas.map((p) => ({ titulo: p.titulo, num: p.numeroPagina })),
      [
        { titulo: 'Capa Oficial', num: 1 },
        { titulo: 'Novembro', num: 2 },
        { titulo: 'Dezembro', num: 3 },
      ]
    );
  });

  it('2. Em Dezembro/2026 exibe apenas Capa (p.1) e Dezembro (p.2)', () => {
    const dez2026 = new Date('2026-12-01T03:00:00.000Z'); // 00:00 America/Belem
    const paginas = buildTestPages(2026, dez2026);

    assert.equal(paginas.length, 2);
    assert.deepEqual(
      paginas.map((p) => ({ titulo: p.titulo, num: p.numeroPagina })),
      [
        { titulo: 'Capa Oficial', num: 1 },
        { titulo: 'Dezembro', num: 2 },
      ]
    );
  });

  it('3. Após encerramento do ano (Jan/2027), edição 2026 mantém apenas a Capa Oficial', () => {
    const jan2027 = new Date('2027-01-01T03:00:00.000Z');
    const paginas2026 = buildTestPages(2026, jan2027);

    assert.equal(paginas2026.length, 1);
    assert.equal(paginas2026[0].tipo, 'capa');
    assert.equal(paginas2026[0].numeroPagina, 1);

    // Nova edição 2027 exibe todos os 12 meses + capa = 13 páginas
    const paginas2027 = buildTestPages(2027, jan2027);
    assert.equal(paginas2027.length, 13);
  });

  it('4. Navegação por parâmetro ?mes= de mês encerrado direciona para o mês vigente', () => {
    const nov2026 = new Date('2026-11-25T15:00:00.000Z');
    const paginas = buildTestPages(2026, nov2026);

    // Mês encerrado (?mes=10 ou ?mes=outubro) -> direciona para Novembro (índice 1)
    assert.equal(resolveTargetPageIndex(paginas, '10', 2026, nov2026), 1);
    assert.equal(resolveTargetPageIndex(paginas, 'outubro', 2026, nov2026), 1);

    // Mês futuro (?mes=12 ou ?mes=dezembro) -> direciona para Dezembro (índice 2)
    assert.equal(resolveTargetPageIndex(paginas, '12', 2026, nov2026), 2);
    assert.equal(resolveTargetPageIndex(paginas, 'dezembro', 2026, nov2026), 2);
  });

  it('5. filterPublicEventsForEdition oculta eventos de meses encerrados preservando vigentes e futuros', () => {
    const nov2026 = new Date('2026-11-25T15:00:00.000Z');
    const eventos = [
      { id: '1', data_inicio: '2026-10-15T19:00:00.000Z' }, // Outubro (encerrado)
      { id: '2', data_inicio: '2026-11-28T19:00:00.000Z' }, // Novembro (vigente)
      { id: '3', data_inicio: '2026-12-25T19:00:00.000Z' }, // Dezembro (futuro)
    ];

    const visiveis = filterPublicEventsForEdition(eventos, 2026, nov2026, 'America/Belem');
    assert.deepEqual(
      visiveis.map((e) => e.id),
      ['2', '3']
    );
  });

  it('6. Respeita o fuso horário institucional America/Belem na virada de mês', () => {
    // 2026-12-01T02:30:00Z = 2026-11-30 23:30:00 em America/Belem (ainda Novembro)
    const antesMeiaNoiteBelem = new Date('2026-12-01T02:30:00.000Z');
    const { year, month0 } = getInstitutionalYearMonth(antesMeiaNoiteBelem, 'America/Belem');
    assert.equal(year, 2026);
    assert.equal(month0, 10); // Novembro
  });

  it('7. Paginação de Nossos Departamentos suporta 0, 1, 4, 5, 12 e 20 departamentos sem páginas vazias', () => {
    const makeDeps = (n: number): DepartamentoRevistaPublico[] =>
      Array.from({ length: n }, (_, i) => ({
        id: `dep-${i + 1}`,
        sigla: `D${i + 1}`,
        nome: `Departamento ${i + 1}`,
        logo_url: i % 2 === 0 ? `https://example.com/logo-${i + 1}.png` : null,
        lideranca: [{ cargo: 'Líder', nome: `Responsável ${i + 1}` }],
      }));

    assert.equal(paginateDepartmentsForRevista(makeDeps(0), 4).length, 0);
    assert.equal(paginateDepartmentsForRevista(makeDeps(1), 4).length, 1);
    assert.equal(paginateDepartmentsForRevista(makeDeps(4), 4).length, 1);
    assert.equal(paginateDepartmentsForRevista(makeDeps(5), 4).length, 2);
    assert.equal(paginateDepartmentsForRevista(makeDeps(12), 4).length, 3);

    const pages20 = paginateDepartmentsForRevista(makeDeps(20), 4);
    assert.equal(pages20.length, 5);
    assert.equal(pages20[4].length, 4);
    // Preserva ordenação exata
    assert.equal(pages20[0][0].id, 'dep-1');
    assert.equal(pages20[4][3].id, 'dep-20');
  });
});
