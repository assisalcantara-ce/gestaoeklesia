import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('PROMPT 52 — Filtro Cargo e Tipo de Cadastro em Membros', () => {
  const TENANT_A = 'tenant-a-uuid';
  const TENANT_B = 'tenant-b-uuid';

  const MOCK_MEMBERS = [
    // Membros regulares (tipo_cadastro = membro)
    { id: '1', ministry_id: TENANT_A, name: 'Membro com Cargo MEMBRO', tipo_cadastro: 'membro', role: 'membro', cargo_ministerial: 'MEMBRO' },
    { id: '2', ministry_id: TENANT_A, name: 'Membro com Cargo NULL', tipo_cadastro: 'membro', role: 'membro', cargo_ministerial: null },
    { id: '3', ministry_id: TENANT_A, name: 'Membro com Cargo Vazio', tipo_cadastro: 'membro', role: null, cargo_ministerial: '' },
    // Congregados (tipo_cadastro = congregado)
    { id: '4', ministry_id: TENANT_A, name: 'Congregado Comum', tipo_cadastro: 'congregado', role: 'congregado', cargo_ministerial: null },
    { id: '5', ministry_id: TENANT_A, name: 'Congregado com Profissao Legada', tipo_cadastro: 'congregado', role: 'congregado', cargo_ministerial: 'ESTILISTA' },
    // Ministros (tipo_cadastro = ministro)
    { id: '6', ministry_id: TENANT_A, name: 'Pastor João', tipo_cadastro: 'ministro', role: 'ministro', cargo_ministerial: 'PASTOR' },
    { id: '7', ministry_id: TENANT_A, name: 'Presbítero Carlos', tipo_cadastro: 'ministro', role: 'ministro', cargo_ministerial: 'PRESBÍTERO' },
    { id: '8', ministry_id: TENANT_A, name: 'Diácono Lucas', tipo_cadastro: 'ministro', role: 'ministro', cargo_ministerial: 'DIÁCONO' },
    { id: '9', ministry_id: TENANT_A, name: 'Auxiliar Mateus', tipo_cadastro: 'ministro', role: 'ministro', cargo_ministerial: 'AUXILIAR' },
    // Outro Tenant
    { id: '10', ministry_id: TENANT_B, name: 'Membro Tenant B', tipo_cadastro: 'membro', role: 'membro', cargo_ministerial: 'MEMBRO' },
  ];

  // Simulação da query backend implementada em GET /api/v1/members
  function executeMembersQuery(members, { ministryId, cargoParam, page = 1, limit = 10 }) {
    let list = members.filter(m => m.ministry_id === ministryId);

    if (cargoParam && cargoParam.toUpperCase() !== 'TODOS') {
      const cargoUpper = cargoParam.toUpperCase().trim();
      if (cargoUpper === 'MEMBRO') {
        list = list.filter(m => 
          (m.tipo_cadastro && m.tipo_cadastro.toLowerCase() === 'membro') ||
          (m.role && m.role.toLowerCase() === 'membro') ||
          (m.cargo_ministerial && m.cargo_ministerial.toUpperCase().includes('MEMBRO'))
        );
      } else if (cargoUpper === 'CONGREGADO') {
        list = list.filter(m => 
          (m.tipo_cadastro && m.tipo_cadastro.toLowerCase() === 'congregado') ||
          (m.role && m.role.toLowerCase() === 'congregado') ||
          (m.cargo_ministerial && m.cargo_ministerial.toUpperCase().includes('CONGREGADO'))
        );
      } else {
        list = list.filter(m => 
          m.cargo_ministerial && m.cargo_ministerial.toUpperCase().includes(cargoUpper)
        );
      }
    }

    const total = list.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const paginated = list.slice(offset, offset + limit);

    return { data: paginated, total, totalPages, page, limit };
  }

  // Simulação da lista de opções do Toolbar
  function getToolbarCargoOptions(cargosMinisteriais) {
    const list = ['TODOS', 'MEMBRO', 'CONGREGADO'];
    for (const c of cargosMinisteriais.filter(cg => cg.ativo)) {
      list.push(c.nome.toUpperCase());
    }
    return list;
  }

  it('1. Filtro MEMBRO retorna todos os membros legítimos (com cargo "MEMBRO", NULL ou vazio)', () => {
    const result = executeMembersQuery(MOCK_MEMBERS, { ministryId: TENANT_A, cargoParam: 'MEMBRO' });
    assert.equal(result.total, 3);
    assert.deepEqual(result.data.map(m => m.id).sort(), ['1', '2', '3']);
    assert.ok(result.data.every(m => m.tipo_cadastro === 'membro'));
  });

  it('2. Filtro CONGREGADO retorna todos os congregados classificados por tipo_cadastro', () => {
    const result = executeMembersQuery(MOCK_MEMBERS, { ministryId: TENANT_A, cargoParam: 'CONGREGADO' });
    assert.equal(result.total, 2);
    assert.deepEqual(result.data.map(m => m.id).sort(), ['4', '5']);
    assert.ok(result.data.every(m => m.tipo_cadastro === 'congregado'));
  });

  it('3. Filtros de cargos ministeriais (PASTOR, PRESBÍTERO, DIÁCONO, AUXILIAR) continuam funcionando', () => {
    const resultPastor = executeMembersQuery(MOCK_MEMBERS, { ministryId: TENANT_A, cargoParam: 'PASTOR' });
    assert.equal(resultPastor.total, 1);
    assert.equal(resultPastor.data[0].id, '6');

    const resultPresb = executeMembersQuery(MOCK_MEMBERS, { ministryId: TENANT_A, cargoParam: 'PRESBÍTERO' });
    assert.equal(resultPresb.total, 1);
    assert.equal(resultPresb.data[0].id, '7');

    const resultDiac = executeMembersQuery(MOCK_MEMBERS, { ministryId: TENANT_A, cargoParam: 'DIÁCONO' });
    assert.equal(resultDiac.total, 1);
    assert.equal(resultDiac.data[0].id, '8');

    const resultAux = executeMembersQuery(MOCK_MEMBERS, { ministryId: TENANT_A, cargoParam: 'AUXILIAR' });
    assert.equal(resultAux.total, 1);
    assert.equal(resultAux.data[0].id, '9');
  });

  it('4. Filtro TODOS retorna todos os 9 registros do Tenant A sem filtrar cargo', () => {
    const resultTodos = executeMembersQuery(MOCK_MEMBERS, { ministryId: TENANT_A, cargoParam: 'TODOS' });
    assert.equal(resultTodos.total, 9);
    assert.ok(!resultTodos.data.some(m => m.ministry_id === TENANT_B));
  });

  it('5. Paginação e contagem funcionam com o filtro ativo', () => {
    const resultPage1 = executeMembersQuery(MOCK_MEMBERS, { ministryId: TENANT_A, cargoParam: 'MEMBRO', page: 1, limit: 2 });
    assert.equal(resultPage1.data.length, 2);
    assert.equal(resultPage1.total, 3);
    assert.equal(resultPage1.totalPages, 2);

    const resultPage2 = executeMembersQuery(MOCK_MEMBERS, { ministryId: TENANT_A, cargoParam: 'MEMBRO', page: 2, limit: 2 });
    assert.equal(resultPage2.data.length, 1);
    assert.equal(resultPage2.data[0].id, '3');
  });

  it('6. Isolamento multi-tenant: registros de outros ministérios nunca vazam', () => {
    const resultTenantA = executeMembersQuery(MOCK_MEMBERS, { ministryId: TENANT_A, cargoParam: 'MEMBRO' });
    assert.ok(!resultTenantA.data.some(m => m.id === '10'));

    const resultTenantB = executeMembersQuery(MOCK_MEMBERS, { ministryId: TENANT_B, cargoParam: 'MEMBRO' });
    assert.equal(resultTenantB.total, 1);
    assert.equal(resultTenantB.data[0].id, '10');
  });

  it('7. Opções do toolbar apresentam a lista correta sem poluição de profissões legadas', () => {
    const CARGOS_PADRAO = [
      { id: 1, nome: 'Auxiliar', ativo: true },
      { id: 2, nome: 'Diácono', ativo: true },
      { id: 3, nome: 'Diaconisa', ativo: true },
      { id: 4, nome: 'Presbítero', ativo: true },
      { id: 5, nome: 'Missionário', ativo: true },
      { id: 6, nome: 'Missionária', ativo: true },
      { id: 7, nome: 'Evangelista', ativo: true },
      { id: 8, nome: 'Pastor', ativo: true }
    ];

    const options = getToolbarCargoOptions(CARGOS_PADRAO);
    assert.deepEqual(options, [
      'TODOS',
      'MEMBRO',
      'CONGREGADO',
      'AUXILIAR',
      'DIÁCONO',
      'DIACONISA',
      'PRESBÍTERO',
      'MISSIONÁRIO',
      'MISSIONÁRIA',
      'EVANGELISTA',
      'PASTOR'
    ]);

    assert.ok(!options.includes('ESTILISTA'));
    assert.ok(!options.includes('PSICOLOGA'));
    assert.ok(!options.includes('.'));
  });
});
