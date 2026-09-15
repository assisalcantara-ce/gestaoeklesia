import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Bateria de Testes Automatizados da FASE E.7.3 — API Mobile Oficial de Comunicados
 *
 * Cobertura de Testes:
 * A. GET lista autenticado retorna lista formatada
 * B. 401 sem autenticação (token nulo/inválido)
 * C. Comunicado geral aparece para membro de qualquer congregação do ministério
 * D. Comunicado da própria congregação aparece
 * E. Outra congregação não aparece
 * F. Outro ministry não aparece (cross-tenant)
 * G. Rascunho não aparece
 * H. Futuro agendado não aparece
 * I. Expirado não aparece
 * J. Inativo não aparece
 * K. Detalhe por ID autorizado retorna conteúdo completo e seguro
 * L. Detalhe por ID de outro tenant ou congregação alheia retorna 404
 * M. Cliente não consegue ampliar escopo enviando ministry_id arbitrário
 * N. Cliente não consegue ampliar escopo enviando congregacao_id arbitrário
 * O. Paginação funciona e respeita limite máximo seguro
 */

class MockMobileComunicadosApiService {
  constructor() {
    this.members = [];
    this.congregacoes = [];
    this.departamentos = [];
    this.comunicados = [];
  }

  // Simula GET /api/v1/mobile/comunicados
  async getComunicados(ctx, queryParams = {}) {
    if (!ctx || !ctx.memberId) throw new Error('UNAUTHORIZED');

    const member = this.members.find(
      (m) => m.id === ctx.memberId && m.ministry_id === ctx.ministryId
    );
    if (!member) throw new Error('MEMBER_NOT_LINKED');

    const page = Math.max(1, parseInt(queryParams.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(queryParams.limit || '20', 10)));
    const offset = (page - 1) * limit;

    const agora = new Date();

    const filtrados = this.comunicados.filter((c) => {
      // 1. Multi-tenant
      if (c.ministry_id !== ctx.ministryId) return false;

      // 2. Vigência e status
      if (!c.ativo) return false;
      if (!c.publicado_em) return false;
      if (new Date(c.publicado_em) > agora) return false;
      if (c.expira_em && new Date(c.expira_em) < agora) return false;

      // 3. Escopo congregacional (derivado do membro, nunca da query do cliente)
      if (c.congregacao_id === null) return true;
      return c.congregacao_id === member.congregacao_id;
    }).sort((a, b) => (new Date(b.publicado_em) > new Date(a.publicado_em) ? 1 : -1));

    const paginados = filtrados.slice(offset, offset + limit);

    const items = paginados.map((c) => {
      const dep = this.departamentos.find((d) => d.id === c.departamento_id);
      const cong = this.congregacoes.find((cg) => cg.id === c.congregacao_id);
      return {
        id: c.id,
        titulo: c.titulo,
        conteudo: c.conteudo,
        categoria: c.categoria,
        imagem_url: c.imagem_url,
        publicado_em: c.publicado_em,
        expira_em: c.expira_em,
        escopo: c.congregacao_id ? 'congregacao' : 'geral',
        congregacao_nome: cong?.nome || null,
        departamento: dep
          ? { id: dep.id, nome: dep.nome, sigla: dep.sigla, logo_url: dep.logo_url }
          : null,
      };
    });

    return {
      comunicados: items,
      total: filtrados.length,
      page,
      limit,
      total_paginas: Math.ceil(filtrados.length / limit),
    };
  }

  // Simula GET /api/v1/mobile/comunicados/[id]
  async getComunicadoDetalhe(ctx, id) {
    if (!ctx || !ctx.memberId) throw new Error('UNAUTHORIZED');

    const member = this.members.find(
      (m) => m.id === ctx.memberId && m.ministry_id === ctx.ministryId
    );
    if (!member) throw new Error('MEMBER_NOT_LINKED');

    const com = this.comunicados.find((c) => c.id === id && c.ministry_id === ctx.ministryId);
    if (!com) throw new Error('COMUNICADO_NOT_FOUND');

    const agora = new Date();
    if (!com.ativo || !com.publicado_em) throw new Error('COMUNICADO_NOT_FOUND');
    if (new Date(com.publicado_em) > agora) throw new Error('COMUNICADO_NOT_FOUND');
    if (com.expira_em && new Date(com.expira_em) < agora) throw new Error('COMUNICADO_NOT_FOUND');

    if (com.congregacao_id !== null && com.congregacao_id !== member.congregacao_id) {
      throw new Error('COMUNICADO_NOT_FOUND');
    }

    const dep = this.departamentos.find((d) => d.id === com.departamento_id);
    const cong = this.congregacoes.find((cg) => cg.id === com.congregacao_id);

    return {
      id: com.id,
      titulo: com.titulo,
      conteudo: com.conteudo,
      categoria: com.categoria,
      imagem_url: com.imagem_url,
      publicado_em: com.publicado_em,
      expira_em: com.expira_em,
      escopo: com.congregacao_id ? 'congregacao' : 'geral',
      congregacao_nome: cong?.nome || null,
      departamento: dep
        ? { id: dep.id, nome: dep.nome, sigla: dep.sigla, logo_url: dep.logo_url }
        : null,
    };
  }
}

describe('FASE E.7.3 — API Mobile Oficial de Comunicados', () => {
  const minAlpha = 'min-alpha-uuid';
  const minBeta = 'min-beta-uuid';
  const congSede = 'cong-alpha-sede';
  const congFilial = 'cong-alpha-filial';
  const congBeta = 'cong-beta-sede';

  const memberA1 = {
    id: 'mem-1',
    ministry_id: minAlpha,
    congregacao_id: congSede,
    name: 'Membro Sede',
  };
  const memberA2 = {
    id: 'mem-2',
    ministry_id: minAlpha,
    congregacao_id: congFilial,
    name: 'Membro Filial',
  };
  const memberB = {
    id: 'mem-3',
    ministry_id: minBeta,
    congregacao_id: congBeta,
    name: 'Membro Beta',
  };

  let service;

  beforeEach(() => {
    service = new MockMobileComunicadosApiService();
    service.members = [memberA1, memberA2, memberB];
    service.congregacoes = [
      { id: congSede, ministry_id: minAlpha, nome: 'Congregação Central Sede' },
      { id: congFilial, ministry_id: minAlpha, nome: 'Congregação Filial Norte' },
      { id: congBeta, ministry_id: minBeta, nome: 'Igreja Beta' },
    ];
    service.departamentos = [
      { id: 'dep-1', ministry_id: minAlpha, nome: 'Juventude Aliança', sigla: 'JA', logo_url: 'https://cdn.test/ja.png' },
    ];

    const passadoAntigo = new Date(); passadoAntigo.setDate(passadoAntigo.getDate() - 3);
    const passadoRecente = new Date(); passadoRecente.setDate(passadoRecente.getDate() - 1);
    const futuro = new Date(); futuro.setDate(futuro.getDate() + 3);
    const expirado = new Date(); expirado.setDate(expirado.getDate() - 5);
    const validoFuturo = new Date(); validoFuturo.setDate(validoFuturo.getDate() + 10);

    service.comunicados = [
      {
        id: 'com-geral',
        ministry_id: minAlpha,
        congregacao_id: null,
        departamento_id: 'dep-1',
        titulo: 'Congresso Geral da Juventude',
        conteudo: 'Convidamos toda a igreja para o grande congresso anual.',
        categoria: 'evento',
        imagem_url: 'https://cdn.test/banner.jpg',
        publicado_em: passadoRecente.toISOString(),
        expira_em: validoFuturo.toISOString(),
        ativo: true,
      },
      {
        id: 'com-sede',
        ministry_id: minAlpha,
        congregacao_id: congSede,
        titulo: 'Aviso da Sede: Mutirão de Pintura',
        conteudo: 'Neste sábado na sede central.',
        categoria: 'geral',
        publicado_em: passadoAntigo.toISOString(),
        ativo: true,
      },
      {
        id: 'com-filial',
        ministry_id: minAlpha,
        congregacao_id: congFilial,
        titulo: 'Aviso Exclusivo Filial Norte',
        conteudo: 'Reunião de obreiros locais na filial.',
        categoria: 'urgente',
        publicado_em: passadoRecente.toISOString(),
        ativo: true,
      },
      {
        id: 'com-rascunho',
        ministry_id: minAlpha,
        congregacao_id: null,
        titulo: 'Rascunho não publicado',
        conteudo: 'Rascunho.',
        categoria: 'geral',
        publicado_em: null,
        ativo: true,
      },
      {
        id: 'com-futuro',
        ministry_id: minAlpha,
        congregacao_id: null,
        titulo: 'Comunicado Agendado Futuro',
        conteudo: 'Aviso futuro.',
        categoria: 'geral',
        publicado_em: futuro.toISOString(),
        ativo: true,
      },
      {
        id: 'com-expirado',
        ministry_id: minAlpha,
        congregacao_id: null,
        titulo: 'Aviso Expirado',
        conteudo: 'Expirou.',
        categoria: 'geral',
        publicado_em: passadoRecente.toISOString(),
        expira_em: expirado.toISOString(),
        ativo: true,
      },
      {
        id: 'com-inativo',
        ministry_id: minAlpha,
        congregacao_id: null,
        titulo: 'Aviso Desativado',
        conteudo: 'Inativo.',
        categoria: 'geral',
        publicado_em: passadoRecente.toISOString(),
        ativo: false,
      },
      {
        id: 'com-beta',
        ministry_id: minBeta,
        congregacao_id: null,
        titulo: 'Aviso Ministério Beta',
        conteudo: 'Exclusivo Beta.',
        categoria: 'geral',
        publicado_em: passadoRecente.toISOString(),
        ativo: true,
      },
    ];
  });

  it('A. GET lista autenticado retorna lista formatada', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: minAlpha };
    const res = await service.getComunicados(ctx);

    assert.ok(Array.isArray(res.comunicados));
    assert.strictEqual(res.total, 2); // com-geral e com-sede
    assert.strictEqual(res.comunicados[0].id, 'com-geral');
    assert.strictEqual(res.comunicados[0].departamento.sigla, 'JA');
  });

  it('B. 401 sem autenticação (token nulo)', async () => {
    await assert.rejects(
      async () => {
        await service.getComunicados(null);
      },
      { message: 'UNAUTHORIZED' }
    );
  });

  it('C. Comunicado geral aparece para membros de qualquer congregação', async () => {
    const ctxSede = { userId: 'u1', memberId: memberA1.id, ministryId: minAlpha };
    const resSede = await service.getComunicados(ctxSede);
    assert.ok(resSede.comunicados.some((c) => c.id === 'com-geral'));

    const ctxFilial = { userId: 'u2', memberId: memberA2.id, ministryId: minAlpha };
    const resFilial = await service.getComunicados(ctxFilial);
    assert.ok(resFilial.comunicados.some((c) => c.id === 'com-geral'));
  });

  it('D. Comunicado da própria congregação aparece', async () => {
    const ctxSede = { userId: 'u1', memberId: memberA1.id, ministryId: minAlpha };
    const resSede = await service.getComunicados(ctxSede);
    assert.ok(resSede.comunicados.some((c) => c.id === 'com-sede'));
  });

  it('E. Outra congregação NÃO aparece', async () => {
    const ctxSede = { userId: 'u1', memberId: memberA1.id, ministryId: minAlpha };
    const resSede = await service.getComunicados(ctxSede);
    assert.strictEqual(resSede.comunicados.some((c) => c.id === 'com-filial'), false);
  });

  it('F. Outro ministry NÃO aparece (cross-tenant)', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: minAlpha };
    const res = await service.getComunicados(ctx);
    assert.strictEqual(res.comunicados.some((c) => c.id === 'com-beta'), false);
  });

  it('G. Rascunho não aparece', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: minAlpha };
    const res = await service.getComunicados(ctx);
    assert.strictEqual(res.comunicados.some((c) => c.id === 'com-rascunho'), false);
  });

  it('H. Futuro agendado não aparece', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: minAlpha };
    const res = await service.getComunicados(ctx);
    assert.strictEqual(res.comunicados.some((c) => c.id === 'com-futuro'), false);
  });

  it('I. Expirado não aparece', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: minAlpha };
    const res = await service.getComunicados(ctx);
    assert.strictEqual(res.comunicados.some((c) => c.id === 'com-expirado'), false);
  });

  it('J. Inativo não aparece', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: minAlpha };
    const res = await service.getComunicados(ctx);
    assert.strictEqual(res.comunicados.some((c) => c.id === 'com-inativo'), false);
  });

  it('K. Detalhe por ID autorizado retorna conteúdo completo e seguro', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: minAlpha };
    const doc = await service.getComunicadoDetalhe(ctx, 'com-geral');

    assert.strictEqual(doc.id, 'com-geral');
    assert.strictEqual(doc.titulo, 'Congresso Geral da Juventude');
    assert.strictEqual(doc.escopo, 'geral');
    assert.strictEqual(doc.departamento.nome, 'Juventude Aliança');
  });

  it('L. Detalhe por ID de outro tenant ou congregação alheia retorna 404 (COMUNICADO_NOT_FOUND)', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: minAlpha };

    // Tentar acessar comunicado de outra congregação
    await assert.rejects(
      async () => {
        await service.getComunicadoDetalhe(ctx, 'com-filial');
      },
      { message: 'COMUNICADO_NOT_FOUND' }
    );

    // Tentar acessar comunicado de outro ministério
    await assert.rejects(
      async () => {
        await service.getComunicadoDetalhe(ctx, 'com-beta');
      },
      { message: 'COMUNICADO_NOT_FOUND' }
    );
  });

  it('M. Cliente não consegue ampliar escopo enviando ministry_id forjado', async () => {
    // Mesmo enviando parâmetros no queryParams, a autoridade é sempre ctx.ministryId
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: minAlpha };
    const res = await service.getComunicados(ctx, { ministry_id: minBeta });
    assert.strictEqual(res.comunicados.some((c) => c.id === 'com-beta'), false);
  });

  it('N. Cliente não consegue ampliar escopo enviando congregacao_id forjado', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: minAlpha };
    const res = await service.getComunicados(ctx, { congregacao_id: congFilial });
    assert.strictEqual(res.comunicados.some((c) => c.id === 'com-filial'), false);
  });

  it('O. Paginação funciona e respeita limite máximo de 50', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: minAlpha };
    const res = await service.getComunicados(ctx, { page: '1', limit: '1000' });
    assert.strictEqual(res.limit, 50); // Clamped a 50
  });
});
