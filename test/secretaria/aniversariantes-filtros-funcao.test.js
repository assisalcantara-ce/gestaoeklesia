import test from 'node:test';
import assert from 'node:assert/strict';

// Importação das funções utilitárias ou redefinição pura em JS para execução pelo runner do Node
function normalizarCpfDigits(cpf) {
  if (!cpf) return '';
  return cpf.replace(/\D/g, '');
}

function normalizarTexto(txt) {
  if (!txt) return '';
  return txt
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const CARGOS_MINISTERIAIS_PADRAO = [
  'Auxiliar',
  'Obreiro(a)',
  'Diácono',
  'Diaconisa',
  'Presbítero',
  'Missionário(a)',
  'Evangelista',
  'Pastor'
];

function isMembroMinistro(item, cargosAtivosNomes) {
  if (!item) return false;

  const tc = normalizarTexto(item.tipoCadastro || item.tipo_cadastro);
  if (tc === 'ministro' || tc.includes('ministro')) {
    return true;
  }

  const role = normalizarTexto(item.role);
  if (role === 'ministro') {
    return true;
  }

  const cargo = normalizarTexto(item.cargoMinisterial || item.cargo_ministerial);
  if (!cargo || cargo === 'membro' || cargo === 'congregado' || cargo === 'crianca' || cargo === 'visitante') {
    return false;
  }

  const listaCargos = cargosAtivosNomes && cargosAtivosNomes.length > 0
    ? cargosAtivosNomes.map(normalizarTexto)
    : CARGOS_MINISTERIAIS_PADRAO.map(normalizarTexto);

  if (listaCargos.includes(cargo)) {
    return true;
  }

  const termosReconhecidos = [
    'pastor', 'pastora', 'presbitero', 'evangelista', 'missionario', 'missionaria',
    'diacono', 'diaconisa', 'obreiro', 'obreira', 'auxiliar', 'ministro', 'ministra', 'bispo'
  ];

  return termosReconhecidos.some(t => cargo.includes(t));
}

function isMembroDirigente(item, dirigentesMap) {
  if (!item || !dirigentesMap) return false;

  if (item.id && dirigentesMap.memberIds.has(item.id)) {
    return true;
  }

  const cpfNorm = normalizarCpfDigits(item.cpf);
  if (cpfNorm && cpfNorm.length === 11 && dirigentesMap.cpfs.has(cpfNorm)) {
    return true;
  }

  const matNorm = normalizarTexto(item.matricula);
  if (matNorm && dirigentesMap.matriculas.has(matNorm)) {
    return true;
  }

  const nomeNorm = normalizarTexto(item.name || item.nome);
  if (nomeNorm && dirigentesMap.nomes.has(nomeNorm)) {
    return true;
  }

  return false;
}

function extrairMapaDirigentes(designacoes = [], congregacoes = []) {
  const memberIds = new Set();
  const cpfs = new Set();
  const matriculas = new Set();
  const nomes = new Set();

  designacoes.forEach((d) => {
    if (!d) return;
    const status = String(d.status || 'ativo').toLowerCase();
    if (status !== 'ativo') return;

    if (d.member_id) memberIds.add(String(d.member_id));

    const c = normalizarCpfDigits(d.cpf_dirigente || d.cpf);
    if (c.length === 11) cpfs.add(c);

    const m = normalizarTexto(d.matricula_dirigente || d.matricula);
    if (m) matriculas.add(m);

    const n = normalizarTexto(d.nome_dirigente || d.nome);
    if (n) nomes.add(n);
  });

  congregacoes.forEach((c) => {
    if (!c) return;
    if (c.is_active === false) return;

    if (c.dirigente_member_id) memberIds.add(String(c.dirigente_member_id));

    const cpf = normalizarCpfDigits(c.dirigente_cpf);
    if (cpf.length === 11) cpfs.add(cpf);

    const mat = normalizarTexto(c.dirigente_matricula);
    if (mat) matriculas.add(mat);

    const nome = normalizarTexto(c.dirigente);
    if (nome) nomes.add(nome);
  });

  return { memberIds, cpfs, matriculas, nomes };
}

function filtrarPorFuncaoMinisterial(item, filtro, dirigentesMap, cargosAtivosNomes) {
  if (filtro === 'todos') {
    return true;
  }
  if (filtro === 'ministros') {
    return isMembroMinistro(item, cargosAtivosNomes);
  }
  if (filtro === 'dirigentes') {
    return isMembroDirigente(item, dirigentesMap);
  }
  return true;
}

test('Filtros de Aniversariantes — Função Ministerial e Vínculos Oficiais', async (t) => {
  const mockDesignacoes = [
    {
      id: 'desig-1',
      member_id: 'mem-dirigente-1',
      nome_dirigente: 'PASTOR CARLOS ALBERTO',
      cpf_dirigente: '111.222.333-44',
      matricula_dirigente: 'DIR-001',
      cargo_ministerial: 'Pastor',
      status: 'ativo',
    },
    {
      id: 'desig-2',
      member_id: 'mem-dirigente-antigo',
      nome_dirigente: 'EX DIRIGENTE',
      cpf_dirigente: '999.888.777-66',
      status: 'concluido', // inativo, não deve entrar
    },
  ];

  const mockCongregacoes = [
    {
      id: 'cong-1',
      nome: 'Congregação Canaã',
      dirigente: 'EVANGELISTA MARCOS SILVA',
      dirigente_cpf: '222.333.444-55',
      dirigente_matricula: 'DIR-002',
      is_active: true,
    },
    {
      id: 'cong-2',
      nome: 'Congregação Filial Inativa',
      dirigente: 'DIRIGENTE DESATIVADO',
      dirigente_cpf: '000.000.000-00',
      is_active: false, // inativa, não deve entrar
    },
  ];

  const mapaDirigentes = extrairMapaDirigentes(mockDesignacoes, mockCongregacoes);

  await t.test('1. extrairMapaDirigentes compila IDs, CPFs, matrículas e nomes ativos', () => {
    assert.ok(mapaDirigentes.memberIds.has('mem-dirigente-1'));
    assert.ok(!mapaDirigentes.memberIds.has('mem-dirigente-antigo'));

    assert.ok(mapaDirigentes.cpfs.has('11122233344'));
    assert.ok(mapaDirigentes.cpfs.has('22233344455'));
    assert.ok(!mapaDirigentes.cpfs.has('99988877766'));
    assert.ok(!mapaDirigentes.cpfs.has('00000000000'));

    assert.ok(mapaDirigentes.matriculas.has('dir-001'));
    assert.ok(mapaDirigentes.matriculas.has('dir-002'));

    assert.ok(mapaDirigentes.nomes.has('pastor carlos alberto'));
    assert.ok(mapaDirigentes.nomes.has('evangelista marcos silva'));
  });

  await t.test('2. isMembroMinistro identifica ministros por tipoCadastro, role e cargo oficial', () => {
    // Caso 1: tipoCadastro === 'ministro'
    assert.equal(
      isMembroMinistro({ tipoCadastro: 'ministro', nome: 'Irmão A' }),
      true
    );

    // Caso 2: role === 'ministro'
    assert.equal(
      isMembroMinistro({ role: 'ministro', nome: 'Irmão B' }),
      true
    );

    // Caso 3: cargo ministerial reconhecido (Pastor, Diácono, Presbítero, etc.)
    assert.equal(
      isMembroMinistro({ cargoMinisterial: 'Pastor', nome: 'Irmão C' }),
      true
    );
    assert.equal(
      isMembroMinistro({ cargo_ministerial: 'Diácono', nome: 'Irmão D' }),
      true
    );
    assert.equal(
      isMembroMinistro({ cargo_ministerial: 'Missionária', nome: 'Irmã E' }),
      true
    );

    // Caso 4: Membro comum ou congregado sem cargo ministerial
    assert.equal(
      isMembroMinistro({ tipoCadastro: 'membro', cargoMinisterial: '', nome: 'Membro Comum' }),
      false
    );
    assert.equal(
      isMembroMinistro({ tipoCadastro: 'congregado', cargoMinisterial: 'Membro', nome: 'Congregado' }),
      false
    );
  });

  await t.test('3. isMembroDirigente identifica dirigentes com base nos vínculos oficiais', () => {
    // Identificado por member_id
    assert.equal(
      isMembroDirigente({ id: 'mem-dirigente-1', nome: 'Outro Nome' }, mapaDirigentes),
      true
    );

    // Identificado por CPF normalizado
    assert.equal(
      isMembroDirigente({ id: 'outro-id', cpf: '222.333.444-55', nome: 'Marcos' }, mapaDirigentes),
      true
    );

    // Identificado por Matrícula
    assert.equal(
      isMembroDirigente({ id: 'outro-id-2', matricula: 'DIR-001', nome: 'Carlos' }, mapaDirigentes),
      true
    );

    // Identificado por Nome exato normalizado
    assert.equal(
      isMembroDirigente({ id: 'outro-id-3', nome: 'Pastor Carlos Alberto' }, mapaDirigentes),
      true
    );

    // Membro sem vínculo de direção
    assert.equal(
      isMembroDirigente({ id: 'mem-comum', nome: 'José da Silva', cpf: '123.456.789-00' }, mapaDirigentes),
      false
    );
  });

  await t.test('4. filtrarPorFuncaoMinisterial aplica os três estados: todos, ministros e dirigentes', () => {
    const membroComum = { id: '1', nome: 'Membro Comum', tipoCadastro: 'membro' };
    const ministroNaoDirigente = { id: '2', nome: 'Pastor A', tipoCadastro: 'ministro', cargoMinisterial: 'Pastor' };
    const dirigenteAtivo = { id: 'mem-dirigente-1', nome: 'Pastor Carlos Alberto', tipoCadastro: 'ministro', cargoMinisterial: 'Pastor' };

    // Filtro 'todos': aceita todos os 3
    assert.equal(filtrarPorFuncaoMinisterial(membroComum, 'todos', mapaDirigentes), true);
    assert.equal(filtrarPorFuncaoMinisterial(ministroNaoDirigente, 'todos', mapaDirigentes), true);
    assert.equal(filtrarPorFuncaoMinisterial(dirigenteAtivo, 'todos', mapaDirigentes), true);

    // Filtro 'ministros': apenas ministros (tanto dirigente quanto não-dirigente)
    assert.equal(filtrarPorFuncaoMinisterial(membroComum, 'ministros', mapaDirigentes), false);
    assert.equal(filtrarPorFuncaoMinisterial(ministroNaoDirigente, 'ministros', mapaDirigentes), true);
    assert.equal(filtrarPorFuncaoMinisterial(dirigenteAtivo, 'ministros', mapaDirigentes), true);

    // Filtro 'dirigentes': apenas quem tem vínculo oficial de direção
    assert.equal(filtrarPorFuncaoMinisterial(membroComum, 'dirigentes', mapaDirigentes), false);
    assert.equal(filtrarPorFuncaoMinisterial(ministroNaoDirigente, 'dirigentes', mapaDirigentes), false);
    assert.equal(filtrarPorFuncaoMinisterial(dirigenteAtivo, 'dirigentes', mapaDirigentes), true);
  });
});
