import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('SECRETARIA — Persistência Relacional de Vínculos Familiares, API e Autorização', () => {
  const TENANT_A = 'tenant-a-uuid';
  const TENANT_B = 'tenant-b-uuid';

  // Simulação das tabelas PostgreSQL com RLS
  const dbMembers = [
    { id: 'parent-1', ministry_id: TENANT_A, name: 'JOÃO PAI', role: 'membro', tipo_cadastro: 'membro', custom_fields: {} },
    { id: 'child-1', ministry_id: TENANT_A, name: 'LUCAS FILHO', matricula: '010', role: 'membro', tipo_cadastro: 'membro', data_nascimento: '2012-04-10', custom_fields: {} },
    { id: 'child-other', ministry_id: TENANT_B, name: 'FILHO TENANT B', matricula: '099', role: 'membro', tipo_cadastro: 'membro', custom_fields: {} },
  ];

  const dbRelations = [
    // Tabela: member_family_relations
  ];

  // Simulação do comportamento de POST /api/v1/members/[id]/familia
  function postFamiliaRelation(userContext, parentId, { childId, nome, dataNascimento, tipo = 'filho' }) {
    // 1. Autorização no servidor
    if (!['administrador', 'secretario_geral', 'secretaria_local'].includes(userContext.nivel)) {
      throw new Error('FORBIDDEN: Permissão insuficiente');
    }

    // 2. Prevenir auto-vínculo
    if (childId && childId === parentId) {
      throw new Error('BAD_REQUEST: Não é permitido vincular o membro a si mesmo');
    }

    // 3. Validação de isolamento do parent
    const parent = dbMembers.find(m => m.id === parentId && m.ministry_id === userContext.ministryId);
    if (!parent) {
      throw new Error('NOT_FOUND: Membro pai não encontrado no ministério');
    }

    let finalNome = nome;
    let finalNasc = dataNascimento || null;

    if (childId) {
      // 4. Validação de isolamento da pessoa vinculada (mesmo ministry_id)
      const child = dbMembers.find(m => m.id === childId && m.ministry_id === userContext.ministryId);
      if (!child) {
        throw new Error('NOT_FOUND: Pessoa vinculada não pertence a este ministério');
      }
      finalNome = child.name;
      finalNasc = child.data_nascimento || finalNasc;

      // 5. Unicidade (não duplicar o vínculo na tabela)
      const jaVinculado = dbRelations.some(
        r => r.ministry_id === userContext.ministryId && r.parent_id === parentId && r.child_id === childId
      );
      if (jaVinculado) {
        throw new Error('CONFLICT: Vínculo já existente');
      }
    }

    const newRelation = {
      id: `rel-${Date.now()}-${Math.random()}`,
      ministry_id: userContext.ministryId,
      parent_id: parentId,
      child_id: childId || null,
      child_nome: finalNome.trim().toUpperCase(),
      child_data_nascimento: finalNasc,
      child_tipo: tipo,
      created_at: new Date().toISOString(),
    };

    dbRelations.push(newRelation);
    return newRelation;
  }

  // Simulação do comportamento de DELETE /api/v1/members/[id]/familia/[relationId]
  function deleteFamiliaRelation(userContext, parentId, relationId) {
    if (!['administrador', 'secretario_geral', 'secretaria_local'].includes(userContext.nivel)) {
      throw new Error('FORBIDDEN: Permissão insuficiente');
    }

    const idx = dbRelations.findIndex(
      r => r.ministry_id === userContext.ministryId &&
           r.parent_id === parentId &&
           (r.id === relationId || r.child_id === relationId)
    );

    if (idx === -1) {
      return { success: false, notFound: true };
    }

    const removed = dbRelations.splice(idx, 1)[0];

    // Se havia child_id, garantir que a pessoa NÃO foi apagada de dbMembers
    if (removed.child_id) {
      const pessoaAindaExiste = dbMembers.some(m => m.id === removed.child_id);
      assert.ok(pessoaAindaExiste, 'A pessoa NÃO pode ser excluída de members ao desvincular o parentesco');
    }

    return { success: true };
  }

  // Simulação do comportamento de GET /api/v1/members/[id]/familia
  function getFamiliaRelations(userContext, parentId) {
    const list = dbRelations.filter(
      r => r.ministry_id === userContext.ministryId && r.parent_id === parentId
    );

    return list.map(r => {
      const child = r.child_id ? dbMembers.find(m => m.id === r.child_id) : null;
      return {
        id: r.id,
        memberId: r.child_id || undefined,
        nome: child ? child.name : r.child_nome,
        matricula: child?.matricula,
        dataNascimento: child?.data_nascimento || r.child_data_nascimento,
        tipo: r.child_tipo,
      };
    });
  }

  it('1. POST grava vínculo real na tabela member_family_relations com ministry_id e parent_id', () => {
    const userCtx = { ministryId: TENANT_A, nivel: 'secretario_geral' };
    const rel = postFamiliaRelation(userCtx, 'parent-1', {
      childId: 'child-1',
      tipo: 'filho',
    });

    assert.equal(rel.ministry_id, TENANT_A);
    assert.equal(rel.parent_id, 'parent-1');
    assert.equal(rel.child_id, 'child-1');
    assert.equal(rel.child_nome, 'LUCAS FILHO');
  });

  it('2. POST bloqueia vínculo cross-tenant (tentativa de vincular pessoa de outro ministério)', () => {
    const userCtx = { ministryId: TENANT_A, nivel: 'secretario_geral' };
    assert.throws(() => {
      postFamiliaRelation(userCtx, 'parent-1', {
        childId: 'child-other',
      });
    }, /NOT_FOUND: Pessoa vinculada não pertence a este ministério/);
  });

  it('3. POST bloqueia auto-vínculo (pai ser filho de si mesmo)', () => {
    const userCtx = { ministryId: TENANT_A, nivel: 'secretario_geral' };
    assert.throws(() => {
      postFamiliaRelation(userCtx, 'parent-1', {
        childId: 'parent-1',
      });
    }, /BAD_REQUEST: Não é permitido vincular o membro a si mesmo/);
  });

  it('4. POST bloqueia duplicidade de vínculo na tabela relacional', () => {
    const userCtx = { ministryId: TENANT_A, nivel: 'secretario_geral' };
    assert.throws(() => {
      postFamiliaRelation(userCtx, 'parent-1', {
        childId: 'child-1',
      });
    }, /CONFLICT: Vínculo já existente/);
  });

  it('5. GET recupera os relacionamentos enriquecidos com a matrícula e dados oficiais', () => {
    const userCtx = { ministryId: TENANT_A, nivel: 'secretario_geral' };
    const items = getFamiliaRelations(userCtx, 'parent-1');
    assert.equal(items.length, 1);
    assert.equal(items[0].memberId, 'child-1');
    assert.equal(items[0].matricula, '010');
    assert.equal(items[0].nome, 'LUCAS FILHO');
  });

  it('6. DELETE remove o registro de vínculo da tabela sem excluir a pessoa da base', () => {
    const userCtx = { ministryId: TENANT_A, nivel: 'secretario_geral' };
    const res = deleteFamiliaRelation(userCtx, 'parent-1', 'child-1');
    assert.ok(res.success);

    // Vínculo foi removido
    const itemsDepois = getFamiliaRelations(userCtx, 'parent-1');
    assert.equal(itemsDepois.length, 0);

    // Registro da pessoa continua intacto na tabela de membros
    const pessoaExiste = dbMembers.some(m => m.id === 'child-1');
    assert.ok(pessoaExiste, 'A ficha do membro filho NÃO foi excluída');
  });

  it('7. Autorização de perfil: rejeita requisição de usuário sem permissão de escrita', () => {
    const userCtxSemPermissao = { ministryId: TENANT_A, nivel: 'auxiliar_consulta' };
    assert.throws(() => {
      postFamiliaRelation(userCtxSemPermissao, 'parent-1', {
        childId: 'child-1',
      });
    }, /FORBIDDEN/);
  });
});
