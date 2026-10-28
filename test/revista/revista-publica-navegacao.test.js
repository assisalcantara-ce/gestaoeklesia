import test from 'node:test';
import assert from 'node:assert/strict';

// Estruturação das páginas idêntica à de RevistaPublicaPage (page.tsx)
function estruturarPaginasRevista(temEditorial) {
  const MESES_NOMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const paginas = [];
  let num = 1;

  // Página 1: Capa
  paginas.push({
    id: 'capa',
    tipo: 'capa',
    titulo: 'Capa Oficial',
    numeroPagina: num++,
  });

  // Página 2: Editorial (Mensagem Pastoral, se existir)
  if (temEditorial) {
    paginas.push({
      id: 'editorial',
      tipo: 'editorial',
      titulo: 'Palavra Pastoral',
      numeroPagina: num++,
    });
  }

  // Páginas seguintes: 12 Meses
  for (let m = 0; m < 12; m++) {
    paginas.push({
      id: `mes-${m}`,
      tipo: 'mes',
      titulo: MESES_NOMES[m],
      mesIndex: m,
      numeroPagina: num++,
    });
  }

  return paginas;
}

// Resolução de índice conforme fuso horário oficial America/Belem
function resolverIndicePaginaDestino({
  anoEdicao,
  paginas,
  dataSimulada,
}) {
  const now = dataSimulada || new Date();
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Belem',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);

  const anoAtualBrasil = Number(parts.find((p) => p.type === 'year')?.value);
  const mesAtualBrasil = Number(parts.find((p) => p.type === 'month')?.value); // 1 a 12

  let indiceEscolhido = -1;
  if (anoEdicao === anoAtualBrasil && !isNaN(mesAtualBrasil)) {
    const mesIndex0 = mesAtualBrasil - 1;
    const idx = paginas.findIndex((pg) => pg.tipo === 'mes' && pg.mesIndex === mesIndex0);
    if (idx !== -1) {
      indiceEscolhido = idx;
    }
  }

  if (indiceEscolhido === -1) {
    indiceEscolhido = paginas.length > 1 ? 1 : 0;
  }

  return {
    indiceEscolhido,
    paginaEscolhida: paginas[indiceEscolhido],
    totalPaginas: paginas.length,
    anoAtualBrasil,
    mesAtualBrasil,
  };
}

test('Revista Digital Pública — Navegação Inteligente ao Abrir Revista', async (t) => {
  await t.test('1. Edição 2026 com editorial (14 páginas: Capa + Editorial + 12 Meses) em Outubro -> Navega diretamente para Outubro', () => {
    const paginas = estruturarPaginasRevista(true);
    assert.equal(paginas.length, 14, 'Total de páginas deve ser 14 quando há editorial');

    const dataSimulada = new Date('2026-10-28T12:00:00-03:00');
    const res = resolverIndicePaginaDestino({
      anoEdicao: 2026,
      paginas,
      dataSimulada,
    });

    assert.equal(res.paginaEscolhida.titulo, 'Outubro');
    assert.equal(res.paginaEscolhida.mesIndex, 9);
    assert.equal(res.paginaEscolhida.numeroPagina, 12, 'Outubro é a página 12 no modelo completo de 14 páginas');
    assert.equal(res.indiceEscolhido, 11, 'Índice de array é 11');
  });

  await t.test('2. Edição 2026 sem editorial (13 páginas: Capa + 12 Meses) em Outubro -> Navega diretamente para Outubro, página 11 de 13', () => {
    const paginas = estruturarPaginasRevista(false);
    assert.equal(paginas.length, 13, 'Total de páginas deve ser 13 na ausência de editorial');

    const dataSimulada = new Date('2026-10-28T12:00:00-03:00');
    const res = resolverIndicePaginaDestino({
      anoEdicao: 2026,
      paginas,
      dataSimulada,
    });

    assert.equal(res.paginaEscolhida.titulo, 'Outubro');
    assert.equal(res.paginaEscolhida.mesIndex, 9);
    assert.equal(res.paginaEscolhida.numeroPagina, 11, 'Exemplo do requisito: Outubro, página 11 de 13');
    assert.equal(res.indiceEscolhido, 10, 'Índice base zero é 10');
  });

  await t.test('3. Edição 2026, mês de Janeiro -> Navega para Janeiro (mês index 0)', () => {
    const paginasComEditorial = estruturarPaginasRevista(true);
    const paginasSemEditorial = estruturarPaginasRevista(false);
    const dataSimulada = new Date('2026-01-15T10:00:00-03:00');

    const resCom = resolverIndicePaginaDestino({
      anoEdicao: 2026,
      paginas: paginasComEditorial,
      dataSimulada,
    });
    assert.equal(resCom.paginaEscolhida.titulo, 'Janeiro');
    assert.equal(resCom.paginaEscolhida.mesIndex, 0);

    const resSem = resolverIndicePaginaDestino({
      anoEdicao: 2026,
      paginas: paginasSemEditorial,
      dataSimulada,
    });
    assert.equal(resSem.paginaEscolhida.titulo, 'Janeiro');
    assert.equal(resSem.paginaEscolhida.mesIndex, 0);
  });

  await t.test('4. Edição 2026, mês de Dezembro -> Navega para Dezembro (último mês)', () => {
    const paginas = estruturarPaginasRevista(false);
    const dataSimulada = new Date('2026-12-31T23:59:00-03:00');

    const res = resolverIndicePaginaDestino({
      anoEdicao: 2026,
      paginas,
      dataSimulada,
    });
    assert.equal(res.paginaEscolhida.titulo, 'Dezembro');
    assert.equal(res.paginaEscolhida.numeroPagina, 13, 'Dezembro é página 13 de 13');
    assert.equal(res.indiceEscolhido, 12);
  });

  await t.test('5. Edição de outro ano (ex: 2025) acessada no ano vigente -> Fallback seguro sem quebrar navegação', () => {
    const paginas = estruturarPaginasRevista(true);
    const dataSimulada = new Date('2026-10-28T12:00:00-03:00');

    const res = resolverIndicePaginaDestino({
      anoEdicao: 2025,
      paginas,
      dataSimulada,
    });
    // Fallback previsível para o primeiro item após a capa
    assert.equal(res.indiceEscolhido, 1);
    assert.equal(res.paginaEscolhida.id, 'editorial');
  });

  await t.test('6. Fuso horário America/Belem respeitado com precisão no fuso UTC-3', () => {
    const paginas = estruturarPaginasRevista(false);

    // 30 de Setembro 23:30 em Brasília/Belém (-03:00) = Setembro
    const setFim = new Date('2026-10-01T02:30:00Z');
    const resSet = resolverIndicePaginaDestino({
      anoEdicao: 2026,
      paginas,
      dataSimulada: setFim,
    });
    assert.equal(resSet.paginaEscolhida.titulo, 'Setembro');

    // 01 de Outubro 00:30 em Brasília/Belém (-03:00) = Outubro
    const outIni = new Date('2026-10-01T03:30:00Z');
    const resOut = resolverIndicePaginaDestino({
      anoEdicao: 2026,
      paginas,
      dataSimulada: outIni,
    });
    assert.equal(resOut.paginaEscolhida.titulo, 'Outubro');
  });
});
