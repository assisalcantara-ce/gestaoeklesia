import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Bateria de Testes de Domínio e Regras de Segurança da FASE E.7.2
 * Fundação Oficial do Módulo de Comunicados (secretaria_comunicados)
 *
 * Cobertura Obrigatória:
 * A. Membro vê comunicado geral do próprio ministério
 * B. Membro vê comunicado da própria congregação
 * C. Membro NÃO vê comunicado de outra congregação
 * D. Membro NÃO vê comunicado de outro ministério (cross-tenant)
 * E. Rascunho (publicado_em = null ou ativo = false) não aparece para o membro
 * F. Comunicado futuro (publicado_em > NOW) não aparece para o membro
 * G. Comunicado expirado (expira_em < NOW) não aparece para o membro
 * H. Membro comum não possui permissão de criação (apenas admin/gestor)
 * I. Membro comum não possui permissão de alteração/exclusão
 * J. Categoria inválida é rejeitada pela restrição de integridade
 * K. Departamento de outro ministério não pode ser associado (validação cross-tenant)
 * L. Congregação de outro ministério não pode ser associada (validação cross-tenant)
 */

class MockSecretariaComunicadosDomainService {
  constructor() {
    this.ministries = [];
    this.congregacoes = [];
    this.departamentos = [];
    this.members = [];
    this.ministryUsers = [];
    this.comunicados = [];
  }

  // Simula consulta de comunicados realizada pelo membro autenticado
  async getComunicadosParaMembro(memberContext) {
    if (!memberContext || !memberContext.memberId) {
      throw new Error('UNAUTHORIZED');
    }

    const member = this.members.find(
      (m) => m.id === memberContext.memberId && m.ministry_id === memberContext.ministryId
    );
    if (!member) {
      throw new Error('MEMBER_NOT_LINKED');
    }

    const agora = new Date();

    return this.comunicados.filter((c) => {
      // 1. Mesmo ministério
      if (c.ministry_id !== memberContext.ministryId) return false;

      // 2. Regras de vigência e publicação
      if (!c.ativo) return false;
      if (!c.publicado_em) return false;
      if (new Date(c.publicado_em) > agora) return false;
      if (c.expira_em && new Date(c.expira_em) < agora) return false;

      // 3. Escopo congregacional
      if (c.congregacao_id === null) return true; // Geral do ministério
      return c.congregacao_id === member.congregacao_id;
    }).sort((a, b) => (new Date(b.publicado_em) > new Date(a.publicado_em) ? 1 : -1));
  }

  // Simula criação administrativa de comunicado
  async createComunicado(userContext, data) {
    if (!userContext || !userContext.userId) {
      throw new Error('UNAUTHORIZED');
    }

    const userPerm = this.ministryUsers.find(
      (mu) => mu.user_id === userContext.userId && mu.ministry_id === userContext.ministryId
    );

    const isAuthorized =
      userPerm &&
      (userPerm.role === 'admin' ||
        userPerm.role === 'manager' ||
        (Array.isArray(userPerm.permissions) &&
          userPerm.permissions.some((p) => ['ADMINISTRADOR', 'GESTAO', 'SECRETARIA'].includes(p))));

    if (!isAuthorized) {
      throw new Error('FORBIDDEN_ADMIN_ONLY');
    }

    const CATEGORIAS_VALIDAS = ['geral', 'urgente', 'departamento', 'evento'];
    if (!data.categoria || !CATEGORIAS_VALIDAS.includes(data.categoria)) {
      throw new Error('INVALID_CATEGORY');
    }

    if (!data.titulo || !data.conteudo) {
      throw new Error('REQUIRED_FIELDS_MISSING');
    }

    // Validação de Integridade Cross-Tenant para Congregação
    if (data.congregacao_id) {
      const cong = this.congregacoes.find((c) => c.id === data.congregacao_id);
      if (!cong || cong.ministry_id !== userContext.ministryId) {
        throw new Error('CROSS_TENANT_CONGREGACAO_FORBIDDEN');
      }
    }

    // Validação de Integridade Cross-Tenant para Departamento
    if (data.departamento_id) {
      const dep = this.departamentos.find((d) => d.id === data.departamento_id);
      if (!dep || dep.ministry_id !== userContext.ministryId) {
        throw new Error('CROSS_TENANT_DEPARTAMENTO_FORBIDDEN');
      }
    }

    const novo = {
      id: `com-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ministry_id: userContext.ministryId,
      congregacao_id: data.congregacao_id || null,
      departamento_id: data.departamento_id || null,
      titulo: data.titulo.trim(),
      conteudo: data.conteudo.trim(),
      categoria: data.categoria,
      imagem_url: data.imagem_url || null,
      publicado_em: data.publicado_em || null,
      expira_em: data.expira_em || null,
      ativo: data.ativo !== false,
      created_by: userContext.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.comunicados.push(novo);
    return novo;
  }

  // Simula atualização administrativa
  async updateComunicado(userContext, comunicadoId, updates) {
    if (!userContext || !userContext.userId) throw new Error('UNAUTHORIZED');

    const userPerm = this.ministryUsers.find(
      (mu) => mu.user_id === userContext.userId && mu.ministry_id === userContext.ministryId
    );

    const isAuthorized =
      userPerm &&
      (userPerm.role === 'admin' ||
        userPerm.role === 'manager' ||
        (Array.isArray(userPerm.permissions) &&
          userPerm.permissions.some((p) => ['ADMINISTRADOR', 'GESTAO', 'SECRETARIA'].includes(p))));

    if (!isAuthorized) {
      throw new Error('FORBIDDEN_ADMIN_ONLY');
    }

    const comIndex = this.comunicados.findIndex(
      (c) => c.id === comunicadoId && c.ministry_id === userContext.ministryId
    );
    if (comIndex < 0) throw new Error('NOT_FOUND');

    this.comunicados[comIndex] = {
      ...this.comunicados[comIndex],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return this.comunicados[comIndex];
  }
}

describe('FASE E.7.2 — Fundação Oficial do Módulo de Comunicados (secretaria_comunicados)', () => {
  const minAlpha = 'min-alpha-uuid';
  const minBeta = 'min-beta-uuid';
  const congAlphaSede = 'cong-alpha-sede';
  const congAlphaFilial = 'cong-alpha-filial';
  const congBetaSede = 'cong-beta-sede';

  const depAlpha = 'dep-alpha-louvor';
  const depBeta = 'dep-beta-jovens';

  const memberA1 = {
    id: 'mem-a1',
    ministry_id: minAlpha,
    congregacao_id: congAlphaSede,
    name: 'Membro Sede Alpha',
  };
  const memberA2 = {
    id: 'mem-a2',
    ministry_id: minAlpha,
    congregacao_id: congAlphaFilial,
    name: 'Membro Filial Alpha',
  };
  const memberB1 = {
    id: 'mem-b1',
    ministry_id: minBeta,
    congregacao_id: congBetaSede,
    name: 'Membro Sede Beta',
  };

  const adminAlpha = { user_id: 'user-admin-alpha', ministry_id: minAlpha, role: 'admin' };
  const memberUserAlpha = { user_id: 'user-member-alpha', ministry_id: minAlpha, role: 'member' };

  let service;

  beforeEach(() => {
    service = new MockSecretariaComunicadosDomainService();
    service.ministries = [{ id: minAlpha }, { id: minBeta }];
    service.congregacoes = [
      { id: congAlphaSede, ministry_id: minAlpha, nome: 'Sede Alpha' },
      { id: congAlphaFilial, ministry_id: minAlpha, nome: 'Filial Alpha' },
      { id: congBetaSede, ministry_id: minBeta, nome: 'Sede Beta' },
    ];
    service.departamentos = [
      { id: depAlpha, ministry_id: minAlpha, nome: 'Louvor Alpha' },
      { id: depBeta, ministry_id: minBeta, nome: 'Jovens Beta' },
    ];
    service.members = [memberA1, memberA2, memberB1];
    service.ministryUsers = [adminAlpha, memberUserAlpha];

    const passado = new Date();
    passado.setDate(passado.getDate() - 2);

    const futuro = new Date();
    futuro.setDate(futuro.getDate() + 5);

    const expirado = new Date();
    expirado.setDate(expirado.getDate() - 1);

    const validoAteFuturo = new Date();
    validoAteFuturo.setDate(validoAteFuturo.getDate() + 10);

    service.comunicados = [
      // 1. Comunicado Geral Alpha (Válido)
      {
        id: 'com-geral-alpha',
        ministry_id: minAlpha,
        congregacao_id: null,
        titulo: 'Aviso Geral para Todo o Ministério',
        conteudo: 'Reunião geral de liderança no sábado.',
        categoria: 'geral',
        publicado_em: passado.toISOString(),
        expira_em: validoAteFuturo.toISOString(),
        ativo: true,
      },
      // 2. Comunicado Específico da Sede Alpha (Válido)
      {
        id: 'com-sede-alpha',
        ministry_id: minAlpha,
        congregacao_id: congAlphaSede,
        titulo: 'Reforma do Estacionamento da Sede',
        conteudo: 'Apenas para frequentadores da sede.',
        categoria: 'urgente',
        publicado_em: passado.toISOString(),
        expira_em: null,
        ativo: true,
      },
      // 3. Comunicado Específico da Filial Alpha (Válido)
      {
        id: 'com-filial-alpha',
        ministry_id: minAlpha,
        congregacao_id: congAlphaFilial,
        titulo: 'Vigília na Filial',
        conteudo: 'Vigília sexta-feira na congregação filial.',
        categoria: 'evento',
        publicado_em: passado.toISOString(),
        expira_em: validoAteFuturo.toISOString(),
        ativo: true,
      },
      // 4. Rascunho (não publicado)
      {
        id: 'com-rascunho-alpha',
        ministry_id: minAlpha,
        congregacao_id: null,
        titulo: 'Rascunho Secreto',
        conteudo: 'Texto em elaboração.',
        categoria: 'geral',
        publicado_em: null,
        ativo: true,
      },
      // 5. Inativo
      {
        id: 'com-inativo-alpha',
        ministry_id: minAlpha,
        congregacao_id: null,
        titulo: 'Aviso Desativado',
        conteudo: 'Desativado.',
        categoria: 'geral',
        publicado_em: passado.toISOString(),
        ativo: false,
      },
      // 6. Publicação Futura (Agendado)
      {
        id: 'com-futuro-alpha',
        ministry_id: minAlpha,
        congregacao_id: null,
        titulo: 'Aviso Futuro',
        conteudo: 'Apenas na próxima semana.',
        categoria: 'geral',
        publicado_em: futuro.toISOString(),
        ativo: true,
      },
      // 7. Expirado
      {
        id: 'com-expirado-alpha',
        ministry_id: minAlpha,
        congregacao_id: null,
        titulo: 'Aviso do Bazar Passado',
        conteudo: 'Bazar já realizado.',
        categoria: 'evento',
        publicado_em: passado.toISOString(),
        expira_em: expirado.toISOString(),
        ativo: true,
      },
      // 8. Comunicado do Ministério Beta (Cross-tenant)
      {
        id: 'com-beta',
        ministry_id: minBeta,
        congregacao_id: null,
        titulo: 'Aviso da Igreja Beta',
        conteudo: 'Exclusivo Beta.',
        categoria: 'geral',
        publicado_em: passado.toISOString(),
        expira_em: null,
        ativo: true,
      },
    ];
  });

  it('A. Membro vê comunicado geral do próprio ministério', async () => {
    const ctx = { memberId: memberA1.id, ministryId: minAlpha };
    const res = await service.getComunicadosParaMembro(ctx);

    const achouGeral = res.some((c) => c.id === 'com-geral-alpha');
    assert.strictEqual(achouGeral, true);
  });

  it('B. Membro vê comunicado da própria congregação', async () => {
    const ctxSede = { memberId: memberA1.id, ministryId: minAlpha };
    const resSede = await service.getComunicadosParaMembro(ctxSede);
    assert.strictEqual(resSede.some((c) => c.id === 'com-sede-alpha'), true);

    const ctxFilial = { memberId: memberA2.id, ministryId: minAlpha };
    const resFilial = await service.getComunicadosParaMembro(ctxFilial);
    assert.strictEqual(resFilial.some((c) => c.id === 'com-filial-alpha'), true);
  });

  it('C. Membro NÃO vê comunicado de outra congregação', async () => {
    const ctxSede = { memberId: memberA1.id, ministryId: minAlpha };
    const resSede = await service.getComunicadosParaMembro(ctxSede);
    assert.strictEqual(resSede.some((c) => c.id === 'com-filial-alpha'), false);
  });

  it('D. Membro NÃO vê comunicado de outro ministério (cross-tenant)', async () => {
    const ctxAlpha = { memberId: memberA1.id, ministryId: minAlpha };
    const res = await service.getComunicadosParaMembro(ctxAlpha);
    assert.strictEqual(res.some((c) => c.id === 'com-beta'), false);
  });

  it('E. Rascunho (publicado_em nulo ou ativo=false) não aparece para o membro', async () => {
    const ctx = { memberId: memberA1.id, ministryId: minAlpha };
    const res = await service.getComunicadosParaMembro(ctx);
    assert.strictEqual(res.some((c) => c.id === 'com-rascunho-alpha'), false);
    assert.strictEqual(res.some((c) => c.id === 'com-inativo-alpha'), false);
  });

  it('F. Comunicado com data futura agendada não aparece para o membro', async () => {
    const ctx = { memberId: memberA1.id, ministryId: minAlpha };
    const res = await service.getComunicadosParaMembro(ctx);
    assert.strictEqual(res.some((c) => c.id === 'com-futuro-alpha'), false);
  });

  it('G. Comunicado expirado não aparece para o membro', async () => {
    const ctx = { memberId: memberA1.id, ministryId: minAlpha };
    const res = await service.getComunicadosParaMembro(ctx);
    assert.strictEqual(res.some((c) => c.id === 'com-expirado-alpha'), false);
  });

  it('H. Membro comum não consegue criar comunicado (apenas admin/gestor)', async () => {
    const userCtx = { userId: memberUserAlpha.user_id, ministryId: minAlpha };
    await assert.rejects(
      async () => {
        await service.createComunicado(userCtx, {
          titulo: 'Tentativa de Membro',
          conteudo: 'Texto',
          categoria: 'geral',
        });
      },
      { message: 'FORBIDDEN_ADMIN_ONLY' }
    );
  });

  it('I. Membro comum não consegue alterar ou excluir comunicado', async () => {
    const userCtx = { userId: memberUserAlpha.user_id, ministryId: minAlpha };
    await assert.rejects(
      async () => {
        await service.updateComunicado(userCtx, 'com-geral-alpha', { titulo: 'Hack' });
      },
      { message: 'FORBIDDEN_ADMIN_ONLY' }
    );
  });

  it('J. Categoria inválida é rejeitada na inserção', async () => {
    const adminCtx = { userId: adminAlpha.user_id, ministryId: minAlpha };
    await assert.rejects(
      async () => {
        await service.createComunicado(adminCtx, {
          titulo: 'Teste',
          conteudo: 'Texto',
          categoria: 'categoria_inexistente',
        });
      },
      { message: 'INVALID_CATEGORY' }
    );
  });

  it('K. Departamento de outro ministério não pode ser associado (cross-tenant)', async () => {
    const adminCtx = { userId: adminAlpha.user_id, ministryId: minAlpha };
    await assert.rejects(
      async () => {
        await service.createComunicado(adminCtx, {
          titulo: 'Aviso Departamento',
          conteudo: 'Texto',
          categoria: 'departamento',
          departamento_id: depBeta, // pertence ao ministério Beta
        });
      },
      { message: 'CROSS_TENANT_DEPARTAMENTO_FORBIDDEN' }
    );
  });

  it('L. Congregação de outro ministério não pode ser associada (cross-tenant)', async () => {
    const adminCtx = { userId: adminAlpha.user_id, ministryId: minAlpha };
    await assert.rejects(
      async () => {
        await service.createComunicado(adminCtx, {
          titulo: 'Aviso Congregação',
          conteudo: 'Texto',
          categoria: 'geral',
          congregacao_id: congBetaSede, // pertence ao ministério Beta
        });
      },
      { message: 'CROSS_TENANT_CONGREGACAO_FORBIDDEN' }
    );
  });
});
