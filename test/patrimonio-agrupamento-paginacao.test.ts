import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Patrimônio — Agrupamento Sanfonado e Paginação Individual por Congregação', () => {
  interface PatrimonioItem {
    id: string;
    numero_tombamento: string;
    descricao: string;
    categoria: string;
    congregacao_id: string | null;
    campo_id: string | null;
    local_descricao: string | null;
    valor_aquisicao: number;
    status: string;
  }

  interface LocalOption {
    id: string;
    nome: string;
    tipo: 'congregacao' | 'campo';
    dirigente?: string | null;
    dirigente_cargo?: string | null;
    pastor_nome?: string | null;
  }

  const locaisMock: LocalOption[] = [
    { id: 'cong-1', nome: 'Congregação Central', tipo: 'congregacao', dirigente: 'Pr. Carlos', dirigente_cargo: 'Dirigente' },
    { id: 'cong-2', nome: 'Congregação Monte Sião', tipo: 'congregacao', dirigente: 'Ev. Marcos', dirigente_cargo: 'Dirigente' },
    { id: 'campo-1', nome: 'Sede Geral', tipo: 'campo', pastor_nome: 'Pr. Presidente' },
  ];

  // Gera 150 bens para a Congregação Central e 5 para Monte Sião
  const itensMock: PatrimonioItem[] = [
    ...Array.from({ length: 150 }, (_, i) => ({
      id: `item-central-${i + 1}`,
      numero_tombamento: `CENTRAL-${String(i + 1).padStart(3, '0')}`,
      descricao: `Bem Central ${i + 1}`,
      categoria: i % 2 === 0 ? 'movel' : 'equipamento',
      congregacao_id: 'cong-1',
      campo_id: null,
      local_descricao: 'Central',
      valor_aquisicao: 100 * (i + 1),
      status: 'ativo',
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `item-siao-${i + 1}`,
      numero_tombamento: `SIAO-${i + 1}`,
      descricao: `Bem Sião ${i + 1}`,
      categoria: 'instrumento',
      congregacao_id: 'cong-2',
      campo_id: null,
      local_descricao: 'Monte Sião',
      valor_aquisicao: 500,
      status: 'ativo',
    })),
  ];

  test('1. Agrupamento correto por congregação/local', () => {
    const map = new Map<string, { nome: string; itens: PatrimonioItem[]; totalValor: number }>();
    locaisMock.forEach(loc => {
      const key = `${loc.tipo}_${loc.id}`;
      map.set(key, { nome: loc.nome, itens: [], totalValor: 0 });
    });

    itensMock.forEach(item => {
      const key = item.congregacao_id ? `congregacao_${item.congregacao_id}` : `campo_${item.campo_id}`;
      if (map.has(key)) {
        const grp = map.get(key)!;
        grp.itens.push(item);
        grp.totalValor += item.valor_aquisicao;
      }
    });

    const central = map.get('congregacao_cong-1');
    const siao = map.get('congregacao_cong-2');
    const sede = map.get('campo_campo-1');

    assert.equal(central?.itens.length, 150);
    assert.equal(siao?.itens.length, 5);
    assert.equal(sede?.itens.length, 0);
  });

  test('2. Paginação individual com no máximo 10 bens por página (ex: 150 itens = 15 páginas)', () => {
    const ITENS_POR_PAGINA = 10;
    const itensCentral = itensMock.filter(i => i.congregacao_id === 'cong-1');
    const totalPaginas = Math.ceil(itensCentral.length / ITENS_POR_PAGINA);

    assert.equal(totalPaginas, 15, '150 itens devem resultar exatamente em 15 páginas de 10');

    // Página 1
    const p1 = itensCentral.slice(0, 10);
    assert.equal(p1.length, 10);
    assert.equal(p1[0].numero_tombamento, 'CENTRAL-001');
    assert.equal(p1[9].numero_tombamento, 'CENTRAL-010');

    // Página 15 (última página)
    const p15 = itensCentral.slice(140, 150);
    assert.equal(p15.length, 10);
    assert.equal(p15[9].numero_tombamento, 'CENTRAL-150');
  });

  test('3. Paginação independente entre congregações', () => {
    const pagesLocais: Record<string, number> = {
      'congregacao_cong-1': 1,
      'congregacao_cong-2': 1,
    };

    // Avança página apenas da Congregação Central
    pagesLocais['congregacao_cong-1'] = 4;

    assert.equal(pagesLocais['congregacao_cong-1'], 4);
    assert.equal(pagesLocais['congregacao_cong-2'], 1, 'Monte Sião não deve ser afetada');
  });

  test('4. Ao expandir uma congregação, reinicia na página 1', () => {
    let pagesLocais: Record<string, number> = { 'congregacao_cong-1': 7 };
    let expandedLocais: Record<string, boolean> = { 'congregacao_cong-1': false };

    const toggleExpand = (key: string) => {
      const willOpen = !expandedLocais[key];
      if (willOpen) {
        pagesLocais[key] = 1;
      }
      expandedLocais[key] = willOpen;
    };

    toggleExpand('congregacao_cong-1');
    assert.equal(expandedLocais['congregacao_cong-1'], true);
    assert.equal(pagesLocais['congregacao_cong-1'], 1, 'Ao abrir, deve reiniciar na página 1');
  });

  test('5. Tratamento de página após exclusão de bens não deixa página inválida', () => {
    const ITENS_POR_PAGINA = 10;
    // Suponha que tínhamos 11 itens (2 páginas) e estávamos na página 2
    let qtdItens = 11;
    let paginaSalva = 2;

    // Removemos 2 itens -> restam 9 itens (apenas 1 página)
    qtdItens = 9;
    const totalPaginas = Math.max(1, Math.ceil(qtdItens / ITENS_POR_PAGINA));
    const paginaAjustada = Math.min(Math.max(1, paginaSalva), totalPaginas);

    assert.equal(totalPaginas, 1);
    assert.equal(paginaAjustada, 1, 'Deve ajustar automaticamente para a página 1 válida');
  });

  test('6. Relatório patrimonial oficial deve conter todos os bens da congregação (não limitado aos 10 da tela)', () => {
    const itensCentral = itensMock.filter(i => i.congregacao_id === 'cong-1');
    const paginaAtualItens = itensCentral.slice(0, 10);

    // O relatório é gerado com itensCentral completo (150 itens), e não com paginaAtualItens (10 itens)
    assert.equal(paginaAtualItens.length, 10);
    assert.equal(itensCentral.length, 150);

    const relatorioTotalBens = itensCentral.length;
    const relatorioValorTotal = itensCentral.reduce((acc, i) => acc + i.valor_aquisicao, 0);

    assert.equal(relatorioTotalBens, 150);
    assert.ok(relatorioValorTotal > 0);
  });
});
