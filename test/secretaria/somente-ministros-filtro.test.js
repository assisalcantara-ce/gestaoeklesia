import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('SECRETARIA — Filtro Somente Ministros e Validação de Tipos de Cadastro', () => {
  const TENANT_A = 'tenant-a-uuid';
  const TENANT_B = 'tenant-b-uuid';

  const MOCK_MEMBERS = [
    // Membros regulares
    { id: '1', ministry_id: TENANT_A, name: 'Membro Comum 1', tipo_cadastro: 'membro', role: 'membro', cargo_ministerial: 'MEMBRO' },
    { id: '2', ministry_id: TENANT_A, name: 'Membro Comum 2', tipo_cadastro: 'membro', role: 'membro', cargo_ministerial: null },
    // Congregados
    { id: '3', ministry_id: TENANT_A, name: 'Congregado Visitante', tipo_cadastro: 'congregado', role: 'congregado', cargo_ministerial: null },
    // Ministros legítimos
    { id: '4', ministry_id: TENANT_A, name: 'Pastor Carlos', tipo_cadastro: 'ministro', role: 'ministro', cargo_ministerial: 'PASTOR' },
    { id: '5', ministry_id: TENANT_A, name: 'Presbítero João', tipo_cadastro: 'ministro', role: 'ministro', cargo_ministerial: 'PRESBÍTERO' },
    { id: '6', ministry_id: TENANT_A, name: 'Diaconisa Maria', tipo_cadastro: 'ministro', role: 'ministro', cargo_ministerial: 'DIACONISA' },
    { id: '7', ministry_id: TENANT_A, name: 'Evangelista Marcos', tipo_cadastro: 'ministro', role: 'ministro', cargo_ministerial: 'EVANGELISTA' },
    // Criança
    { id: '8', ministry_id: TENANT_A, name: 'Criança Ana', tipo_cadastro: 'crianca', role: 'crianca', cargo_ministerial: null },
    // Outro Tenant
    { id: '9', ministry_id: TENANT_B, name: 'Pastor do Tenant B', tipo_cadastro: 'ministro', role: 'ministro', cargo_ministerial: 'PASTOR' },
  ];

  // Simulação da lógica de filtro no backend/frontend
  function filtrarMembros(members, { ministryId, somenteMinistros, status, search, cargo }) {
    let list = members.filter(m => m.ministry_id === ministryId);

    if (somenteMinistros) {
      list = list.filter(m => {
        const tipo = String(m.tipo_cadastro || m.role || '').toLowerCase();
        return tipo === 'ministro';
      });
    }

    if (cargo && cargo !== 'TODOS') {
      list = list.filter(m => m.cargo_ministerial === cargo);
    }

    if (search) {
      const term = search.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(term));
    }

    return list;
  }

  it('1. Filtro "Somente Ministros" desmarcado lista todos os tipos de cadastro do ministério', () => {
    const res = filtrarMembros(MOCK_MEMBERS, { ministryId: TENANT_A, somenteMinistros: false });
    assert.equal(res.length, 8);
    const tipos = new Set(res.map(m => m.tipo_cadastro));
    assert.ok(tipos.has('membro'));
    assert.ok(tipos.has('congregado'));
    assert.ok(tipos.has('ministro'));
    assert.ok(tipos.has('crianca'));
  });

  it('2. Filtro "Somente Ministros" marcado retorna EXCLUSIVAMENTE ministros', () => {
    const res = filtrarMembros(MOCK_MEMBERS, { ministryId: TENANT_A, somenteMinistros: true });
    assert.equal(res.length, 4);
    assert.ok(res.every(m => m.tipo_cadastro === 'ministro'));
    assert.ok(!res.some(m => m.tipo_cadastro === 'membro'));
    assert.ok(!res.some(m => m.tipo_cadastro === 'congregado'));
    assert.ok(!res.some(m => m.tipo_cadastro === 'crianca'));
  });

  it('3. Combinação de "Somente Ministros" com busca textual', () => {
    const res = filtrarMembros(MOCK_MEMBERS, { ministryId: TENANT_A, somenteMinistros: true, search: 'Carlos' });
    assert.equal(res.length, 1);
    assert.equal(res[0].name, 'Pastor Carlos');
  });

  it('4. Combinação de "Somente Ministros" com cargo específico', () => {
    const res = filtrarMembros(MOCK_MEMBERS, { ministryId: TENANT_A, somenteMinistros: true, cargo: 'PRESBÍTERO' });
    assert.equal(res.length, 1);
    assert.equal(res[0].name, 'Presbítero João');
  });

  it('5. Isolamento Multi-tenant: ministros de outros ministérios nunca vazam', () => {
    const resA = filtrarMembros(MOCK_MEMBERS, { ministryId: TENANT_A, somenteMinistros: true });
    assert.ok(!resA.some(m => m.ministry_id === TENANT_B));
    
    const resB = filtrarMembros(MOCK_MEMBERS, { ministryId: TENANT_B, somenteMinistros: true });
    assert.equal(resB.length, 1);
    assert.equal(resB[0].name, 'Pastor do Tenant B');
  });
});
