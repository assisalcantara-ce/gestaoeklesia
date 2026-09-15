import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Bateria de Testes Automatizados da FASE E.6 — Central de Documentos do Membro Mobile
 *
 * Cobertura de Regras:
 * A. Listagem dos próprios documentos emitidos e disponíveis
 * B. Visualização de documento emitido com HTML oficial autêntico
 * C. Proteção anti-IDOR: Membro A não consegue acessar documento do Membro B
 * D. Isolamento Multi-tenant: Membro do Ministério A não acessa documentos do Ministério B
 * E. Bloqueio de documentos não liberados (status != 'emitida')
 * F. Criação de solicitação de documento com autoridade server-side
 * G. Tentativa de forjar member_id ou solicitante_id é ignorada pelo servidor
 * H. Validação de tipo de documento rejeita valores inválidos (erro 400)
 * I. Acompanhamento de solicitações do membro (pendente, autorizado, rejeitado)
 * J. Requisições sem autenticação (token nulo) retornam UNAUTHORIZED
 * K. Membro sem documentos recebe lista vazia sem erro técnico
 */

class MockDocumentosService {
  constructor() {
    this.members = [];
    this.cartasRegistros = [];
    this.cartaPedidos = [];
  }

  // Simula GET /api/v1/mobile/documentos
  async getDocumentos(ctx) {
    if (!ctx || !ctx.memberId) throw new Error('UNAUTHORIZED');

    const member = this.members.find(
      (m) => m.id === ctx.memberId && m.ministry_id === ctx.ministryId
    );
    if (!member) throw new Error('MEMBER_NOT_LINKED');

    const docs = this.cartasRegistros
      .filter(
        (d) =>
          d.ministry_id === ctx.ministryId &&
          d.member_id === ctx.memberId &&
          d.status === 'emitida'
      )
      .sort((a, b) => (new Date(b.issued_at) > new Date(a.issued_at) ? 1 : -1));

    const sols = this.cartaPedidos
      .filter(
        (p) =>
          p.ministry_id === ctx.ministryId &&
          (p.member_id === ctx.memberId || p.solicitante_id === ctx.userId)
      )
      .sort((a, b) => (new Date(b.created_at) > new Date(a.created_at) ? 1 : -1));

    const docsFormatados = docs.map((d) => {
      const isDeclaracao =
        d.categoria === 'declaracao' ||
        (d.template_title || '').toLowerCase().includes('declara');
      return {
        id: d.id,
        titulo: d.template_title || (isDeclaracao ? 'Declaração Oficial' : 'Carta Ministerial'),
        tipo: isDeclaracao ? 'declaracao' : 'carta',
        categoria: d.categoria || (isDeclaracao ? 'declaracao' : 'carta'),
        status: d.status,
        data_emissao: d.issued_at,
      };
    });

    return {
      documentos: docsFormatados,
      solicitacoes: sols,
      total_documentos: docsFormatados.length,
      total_solicitacoes: sols.length,
    };
  }

  // Simula GET /api/v1/mobile/documentos/[id]
  async getDocumentoDetalhe(ctx, docId) {
    if (!ctx || !ctx.memberId) throw new Error('UNAUTHORIZED');

    const member = this.members.find(
      (m) => m.id === ctx.memberId && m.ministry_id === ctx.ministryId
    );
    if (!member) throw new Error('MEMBER_NOT_LINKED');

    const doc = this.cartasRegistros.find((d) => d.id === docId);
    if (!doc) throw new Error('DOCUMENT_NOT_FOUND');

    // Anti-IDOR & Multi-tenant
    if (doc.ministry_id !== ctx.ministryId || doc.member_id !== ctx.memberId) {
      throw new Error('FORBIDDEN_IDOR');
    }

    if (doc.status !== 'emitida') {
      throw new Error('DOCUMENT_NOT_RELEASED');
    }

    const isDeclaracao =
      doc.categoria === 'declaracao' ||
      (doc.template_title || '').toLowerCase().includes('declara');

    return {
      id: doc.id,
      titulo: doc.template_title || (isDeclaracao ? 'Declaração Oficial' : 'Carta Ministerial'),
      tipo: isDeclaracao ? 'declaracao' : 'carta',
      categoria: doc.categoria || (isDeclaracao ? 'declaracao' : 'carta'),
      status: doc.status,
      rendered_html: doc.rendered_html,
      data_emissao: doc.issued_at,
    };
  }

  // Simula POST /api/v1/mobile/documentos/solicitacoes
  async createSolicitacao(ctx, body) {
    if (!ctx || !ctx.memberId) throw new Error('UNAUTHORIZED');

    const member = this.members.find(
      (m) => m.id === ctx.memberId && m.ministry_id === ctx.ministryId
    );
    if (!member) throw new Error('MEMBER_NOT_LINKED');

    const tipo_carta = (body.tipo_carta || '').trim().toLowerCase();
    const validos = ['mudanca', 'transito', 'desligamento', 'recomendacao'];
    if (!tipo_carta || !validos.includes(tipo_carta)) {
      throw new Error('INVALID_DOCUMENT_TYPE');
    }

    // Autoridade do Servidor: ignora member_id e solicitante_id enviados no body
    const novoPedido = {
      id: `ped-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ministry_id: ctx.ministryId,
      congregacao_id: member.congregacao_id || null,
      solicitante_id: ctx.userId,
      solicitante_nome: member.name,
      member_id: ctx.memberId,
      membro_nome: member.name,
      membro_cargo: member.cargo_ministerial || null,
      tipo_carta,
      destino: body.destino ? body.destino.trim() : null,
      observacoes: body.observacoes ? body.observacoes.trim() : null,
      status: 'pendente',
      created_at: new Date().toISOString(),
    };

    this.cartaPedidos.push(novoPedido);

    return {
      message: 'Solicitação de documento enviada com sucesso.',
      solicitacao: novoPedido,
    };
  }
}

describe('FASE E.6 — Central de Documentos do Membro no App Mobile Gestão Eklésia', () => {
  const ministryA = 'min-alpha-uuid';
  const ministryB = 'min-beta-uuid';
  const congA = 'cong-alpha-sede';

  const memberA1 = {
    id: 'mem-1-uuid',
    ministry_id: ministryA,
    congregacao_id: congA,
    name: 'Lucas Alcantara',
    cargo_ministerial: 'Membro',
  };
  const memberA2 = {
    id: 'mem-2-uuid',
    ministry_id: ministryA,
    congregacao_id: congA,
    name: 'João Membro A2',
    cargo_ministerial: 'Diácono',
  };
  const memberB = {
    id: 'mem-3-uuid',
    ministry_id: ministryB,
    name: 'Membro Igreja Beta',
    cargo_ministerial: 'Membro',
  };

  let service;

  beforeEach(() => {
    service = new MockDocumentosService();
    service.members = [memberA1, memberA2, memberB];

    service.cartasRegistros = [
      {
        id: 'doc-1',
        ministry_id: ministryA,
        member_id: memberA1.id,
        template_title: 'Carta de Recomendação Oficial',
        categoria: 'carta',
        status: 'emitida',
        rendered_html: '<div><h1>Recomendação Pastoral</h1><p>Recomendamos o irmão Lucas</p></div>',
        issued_at: '2026-09-01T10:00:00Z',
      },
      {
        id: 'doc-2',
        ministry_id: ministryA,
        member_id: memberA1.id,
        template_title: 'Declaração de Membro Ativo',
        categoria: 'declaracao',
        status: 'emitida',
        rendered_html: '<div><h1>Declaração de Membro</h1><p>Declaramos que Lucas é membro ativo</p></div>',
        issued_at: '2026-09-10T14:30:00Z',
      },
      {
        id: 'doc-draft-a1',
        ministry_id: ministryA,
        member_id: memberA1.id,
        template_title: 'Rascunho de Carta Cancelada',
        categoria: 'carta',
        status: 'cancelada',
        rendered_html: '<div>Rascunho</div>',
        issued_at: '2026-08-01T10:00:00Z',
      },
      {
        id: 'doc-outro-membro',
        ministry_id: ministryA,
        member_id: memberA2.id,
        template_title: 'Carta Confidencial de João A2',
        categoria: 'carta',
        status: 'emitida',
        rendered_html: '<div>Carta de João</div>',
        issued_at: '2026-09-12T10:00:00Z',
      },
      {
        id: 'doc-beta',
        ministry_id: ministryB,
        member_id: memberB.id,
        template_title: 'Declaração Beta',
        categoria: 'declaracao',
        status: 'emitida',
        rendered_html: '<div>Declaração Beta</div>',
        issued_at: '2026-09-14T10:00:00Z',
      },
    ];

    service.cartaPedidos = [
      {
        id: 'ped-1',
        ministry_id: ministryA,
        member_id: memberA1.id,
        solicitante_id: 'user-a1',
        membro_nome: 'Lucas Alcantara',
        tipo_carta: 'transito',
        destino: 'Igreja Central - Fortaleza/CE',
        observacoes: 'Viagem a trabalho',
        status: 'pendente',
        created_at: '2026-09-14T08:00:00Z',
      },
      {
        id: 'ped-2',
        ministry_id: ministryA,
        member_id: memberA1.id,
        solicitante_id: 'user-a1',
        membro_nome: 'Lucas Alcantara',
        tipo_carta: 'recomendacao',
        status: 'autorizado',
        data_autorizacao: '2026-09-15T09:00:00Z',
        created_at: '2026-09-13T10:00:00Z',
      },
    ];
  });

  it('A. Listagem retorna apenas documentos emitidos pertencentes ao próprio membro autenticado', async () => {
    const ctx = { userId: 'user-a1', memberId: memberA1.id, ministryId: ministryA };
    const res = await service.getDocumentos(ctx);

    assert.equal(res.total_documentos, 2);
    assert.equal(res.documentos[0].id, 'doc-2');
    assert.equal(res.documentos[1].id, 'doc-1');
  });

  it('B. Visualização de documento disponível entrega o HTML oficial para visualização e impressão', async () => {
    const ctx = { userId: 'user-a1', memberId: memberA1.id, ministryId: ministryA };
    const doc = await service.getDocumentoDetalhe(ctx, 'doc-1');

    assert.equal(doc.id, 'doc-1');
    assert.ok(doc.rendered_html.includes('Recomendação Pastoral'));
    assert.equal(doc.status, 'emitida');
  });

  it('C. Proteção anti-IDOR: Membro A NÃO consegue acessar documento do Membro B', async () => {
    const ctx = { userId: 'user-a1', memberId: memberA1.id, ministryId: ministryA };

    await assert.rejects(
      async () => {
        await service.getDocumentoDetalhe(ctx, 'doc-outro-membro');
      },
      { message: 'FORBIDDEN_IDOR' }
    );
  });

  it('D. Isolamento Cross-tenant: Membro do Ministério A não acessa documentos do Ministério B', async () => {
    const ctx = { userId: 'user-a1', memberId: memberA1.id, ministryId: ministryA };

    await assert.rejects(
      async () => {
        await service.getDocumentoDetalhe(ctx, 'doc-beta');
      },
      { message: 'FORBIDDEN_IDOR' }
    );
  });

  it('E. Documentos com status cancelado ou não liberado não podem ser abertos pelo membro', async () => {
    const ctx = { userId: 'user-a1', memberId: memberA1.id, ministryId: ministryA };

    await assert.rejects(
      async () => {
        await service.getDocumentoDetalhe(ctx, 'doc-draft-a1');
      },
      { message: 'DOCUMENT_NOT_RELEASED' }
    );
  });

  it('F. Criação de solicitação vincula com autoridade server-side os dados do membro', async () => {
    const ctx = { userId: 'user-a1', memberId: memberA1.id, ministryId: ministryA };
    const body = {
      tipo_carta: 'mudanca',
      destino: 'Congregação Sul - SP',
      observacoes: 'Mudança de endereço residencial',
    };

    const res = await service.createSolicitacao(ctx, body);
    assert.ok(res.solicitacao);
    assert.equal(res.solicitacao.tipo_carta, 'mudanca');
    assert.equal(res.solicitacao.membro_nome, 'Lucas Alcantara');
    assert.equal(res.solicitacao.solicitante_id, 'user-a1');
    assert.equal(res.solicitacao.status, 'pendente');
  });

  it('G. Tentativa do cliente forjar member_id ou ministry_id no body da solicitação é ignorada', async () => {
    const ctx = { userId: 'user-a1', memberId: memberA1.id, ministryId: ministryA };
    const body = {
      tipo_carta: 'recomendacao',
      member_id: 'fake-member-id',
      ministry_id: 'fake-ministry-id',
      solicitante_id: 'fake-user-id',
    };

    const res = await service.createSolicitacao(ctx, body);
    assert.equal(res.solicitacao.member_id, memberA1.id);
    assert.equal(res.solicitacao.ministry_id, ministryA);
    assert.equal(res.solicitacao.solicitante_id, 'user-a1');
  });

  it('H. Validação de dados rejeita tipo de carta inválido com erro 400', async () => {
    const ctx = { userId: 'user-a1', memberId: memberA1.id, ministryId: ministryA };
    const body = {
      tipo_carta: 'tipo_falso_inexistente',
    };

    await assert.rejects(
      async () => {
        await service.createSolicitacao(ctx, body);
      },
      { message: 'INVALID_DOCUMENT_TYPE' }
    );
  });

  it('I. Acompanhamento de solicitações exibe status pendente e autorizado', async () => {
    const ctx = { userId: 'user-a1', memberId: memberA1.id, ministryId: ministryA };
    const res = await service.getDocumentos(ctx);

    assert.equal(res.solicitacoes.length, 2);
    assert.equal(res.solicitacoes[0].status, 'pendente');
    assert.equal(res.solicitacoes[1].status, 'autorizado');
  });

  it('J. Requisições sem autenticação (token nulo) são bloqueadas com UNAUTHORIZED', async () => {
    await assert.rejects(
      async () => {
        await service.getDocumentos(null);
      },
      { message: 'UNAUTHORIZED' }
    );
  });

  it('K. Membro sem documentos anteriores recebe lista vazia sem erro técnico', async () => {
    const ctx = { userId: 'user-b', memberId: memberB.id, ministryId: ministryB };
    // remove o doc do membro B para testar lista vazia
    service.cartasRegistros = [];
    service.cartaPedidos = [];

    const res = await service.getDocumentos(ctx);
    assert.equal(res.total_documentos, 0);
    assert.deepEqual(res.documentos, []);
    assert.equal(res.total_solicitacoes, 0);
    assert.deepEqual(res.solicitacoes, []);
  });
});
