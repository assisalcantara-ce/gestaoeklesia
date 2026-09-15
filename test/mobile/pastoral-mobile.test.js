import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Suite de Testes Automatizados — FASE E.5: Cuidado Pastoral e Pedidos de Oração no App Mobile
 */

class MockPastoralService {
  constructor() {
    this.members = [];
    this.pedidos = [];
  }

  // Simula POST /api/v1/mobile/pastoral/oracao
  async criarPedido(ctx, body) {
    if (!ctx || !ctx.userId || !ctx.memberId || !ctx.ministryId) {
      throw new Error('UNAUTHORIZED');
    }

    const member = this.members.find(
      (m) => m.id === ctx.memberId && m.ministry_id === ctx.ministryId,
    );
    if (!member) throw new Error('MEMBER_NOT_FOUND');

    const { assunto, descricao, tipo, sigiloso, data_preferencial } = body || {};

    if (!assunto || typeof assunto !== 'string' || !assunto.trim()) {
      throw new Error('INVALID_ASSUNTO');
    }
    if (!descricao || typeof descricao !== 'string' || !descricao.trim()) {
      throw new Error('INVALID_DESCRICAO');
    }

    const novo = {
      id: `ped-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ministry_id: ctx.ministryId, // Forçado pelo contexto autenticado
      member_id: ctx.memberId,     // Forçado pelo contexto autenticado
      congregacao_id: member.congregacao_id || null,
      assunto: assunto.trim(),
      descricao: descricao.trim(),
      tipo: ['oracao', 'atendimento', 'visita', 'outro'].includes(tipo) ? tipo : 'oracao',
      sigiloso: sigiloso !== false,
      data_preferencial: data_preferencial || null,
      status: 'recebido', // Inicializado obrigatoriamente
      observacoes_internas: null, // Nunca definido pelo cliente
      atendido_por: null,
      atendido_em: null,
      created_at: new Date().toISOString(),
    };

    this.pedidos.push(novo);

    // Retorno sanitizado (sem campos internos)
    return {
      id: novo.id,
      assunto: novo.assunto,
      descricao: novo.descricao,
      tipo: novo.tipo,
      sigiloso: novo.sigiloso,
      status: novo.status,
      data_preferencial: novo.data_preferencial,
      created_at: novo.created_at,
    };
  }

  // Simula GET /api/v1/mobile/pastoral/oracao
  async listarMeusPedidos(ctx) {
    if (!ctx || !ctx.userId || !ctx.memberId || !ctx.ministryId) {
      throw new Error('UNAUTHORIZED');
    }

    const meus = this.pedidos
      .filter((p) => p.member_id === ctx.memberId && p.ministry_id === ctx.ministryId)
      .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));

    // Sanitização rigorosa: nunca expõe observacoes_internas nem atendido_por
    return meus.map((p) => ({
      id: p.id,
      assunto: p.assunto,
      descricao: p.descricao,
      tipo: p.tipo,
      sigiloso: p.sigiloso,
      status: p.status,
      data_preferencial: p.data_preferencial,
      created_at: p.created_at,
      atendido_em: p.atendido_em,
    }));
  }
}

describe('FASE E.5 — Cuidado Pastoral e Pedidos de Oração no App Mobile', () => {
  const ministryA = 'min-alpha-uuid';
  const ministryB = 'min-beta-uuid';
  const congA1 = 'cong-alpha-sede';

  const memberA = { id: 'mem-1-uuid', ministry_id: ministryA, congregacao_id: congA1, name: 'Lucas Alcantara' };
  const memberB = { id: 'mem-2-uuid', ministry_id: ministryA, congregacao_id: congA1, name: 'Mariana Silva' };
  const memberC = { id: 'mem-3-uuid', ministry_id: ministryB, congregacao_id: 'cong-b', name: 'João Beta' };

  let service;

  beforeEach(() => {
    service = new MockPastoralService();
    service.members = [memberA, memberB, memberC];

    // Pedido prévio do membro B com observações internas do pastor
    service.pedidos = [
      {
        id: 'ped-previo-b',
        ministry_id: ministryA,
        member_id: memberB.id,
        congregacao_id: congA1,
        assunto: 'Pedido Confidencial da Mariana',
        descricao: 'Assunto delicado pessoal...',
        tipo: 'oracao',
        sigiloso: true,
        status: 'em_oracao',
        observacoes_internas: 'Anotação interna do pastor: ligar na terça-feira.',
        atendido_por: 'user-pastor-uuid',
        atendido_em: null,
        created_at: '2026-09-10T10:00:00Z',
      },
    ];
  });

  it('A. Membro autenticado consegue enviar um pedido de oração com sucesso', async () => {
    const ctx = { userId: 'u1', memberId: memberA.id, ministryId: ministryA };
    const res = await service.criarPedido(ctx, {
      assunto: 'Saúde da Família',
      descricao: 'Peço oração pela recuperação cirúrgica do meu pai.',
      tipo: 'oracao',
      sigiloso: true,
    });

    assert.ok(res.id);
    assert.equal(res.assunto, 'Saúde da Família');
    assert.equal(res.status, 'recebido');
    assert.strictEqual(res.observacoes_internas, undefined);
  });

  it('B. Tentativa do cliente forjar member_id ou ministry_id no body é ignorada (server authority)', async () => {
    const ctx = { userId: 'u1', memberId: memberA.id, ministryId: ministryA };
    const res = await service.criarPedido(ctx, {
      member_id: memberB.id,         // Tentando forjar autoria da Mariana
      ministry_id: ministryB,        // Tentando forjar outro tenant
      status: 'concluido',           // Tentando forjar status
      assunto: 'Oração por Trabalho',
      descricao: 'Novo emprego.',
    });

    const salvoNoBanco = service.pedidos.find((p) => p.id === res.id);
    assert.equal(salvoNoBanco.member_id, memberA.id);
    assert.equal(salvoNoBanco.ministry_id, ministryA);
    assert.equal(salvoNoBanco.status, 'recebido');
  });

  it('C. Validação de dados rejeita assunto ou descrição vazios com erro 400', async () => {
    const ctx = { userId: 'u1', memberId: memberA.id, ministryId: ministryA };

    await assert.rejects(async () => {
      await service.criarPedido(ctx, { assunto: '', descricao: 'Teste' });
    }, /INVALID_ASSUNTO/);

    await assert.rejects(async () => {
      await service.criarPedido(ctx, { assunto: 'Teste', descricao: '  ' });
    }, /INVALID_DESCRICAO/);
  });

  it('D. Listagem retorna estritamente os pedidos do próprio membro autenticado', async () => {
    const ctxA = { userId: 'u1', memberId: memberA.id, ministryId: ministryA };
    await service.criarPedido(ctxA, { assunto: 'Pedido A1', descricao: 'Desc 1' });
    await service.criarPedido(ctxA, { assunto: 'Pedido A2', descricao: 'Desc 2' });

    const listaA = await service.listarMeusPedidos(ctxA);
    assert.equal(listaA.length, 2);
    assert.ok(listaA.every((p) => p.assunto.startsWith('Pedido A')));
  });

  it('E. Proteção anti-IDOR: Membro A NÃO consegue ver pedidos ou dados do Membro B', async () => {
    const ctxA = { userId: 'u1', memberId: memberA.id, ministryId: ministryA };
    const listaA = await service.listarMeusPedidos(ctxA);

    // O pedido prévio da Mariana (ped-previo-b) NUNCA aparece para o Lucas
    assert.equal(listaA.some((p) => p.id === 'ped-previo-b'), false);
  });

  it('F. Observações pastorais internas e IDs de atendentes NUNCA vazam na API do membro', async () => {
    const ctxB = { userId: 'u2', memberId: memberB.id, ministryId: ministryA };
    const listaB = await service.listarMeusPedidos(ctxB);

    assert.equal(listaB.length, 1);
    const item = listaB[0];
    assert.equal(item.id, 'ped-previo-b');
    assert.equal(item.assunto, 'Pedido Confidencial da Mariana');

    // Campos confidenciais ocultos
    assert.strictEqual(item.observacoes_internas, undefined);
    assert.strictEqual(item.atendido_por, undefined);
  });

  it('G. Isolamento multi-tenant: Membro do Ministério A não acessa pedidos do Ministério B', async () => {
    const ctxC = { userId: 'u3', memberId: memberC.id, ministryId: ministryB };
    await service.criarPedido(ctxC, { assunto: 'Pedido Beta', descricao: 'No Ministério Beta' });

    const ctxA = { userId: 'u1', memberId: memberA.id, ministryId: ministryA };
    const listaA = await service.listarMeusPedidos(ctxA);

    assert.equal(listaA.some((p) => p.assunto === 'Pedido Beta'), false);
  });

  it('H. Suporte a tipos de cuidado: oração, atendimento, visita pastoral', async () => {
    const ctx = { userId: 'u1', memberId: memberA.id, ministryId: ministryA };
    const res = await service.criarPedido(ctx, {
      assunto: 'Visita aos enfermos',
      descricao: 'Solicito uma visita pastoral no hospital.',
      tipo: 'visita',
      data_preferencial: '2026-09-20',
    });

    assert.equal(res.tipo, 'visita');
    assert.equal(res.data_preferencial, '2026-09-20');
  });

  it('I. Requisições sem autenticação (token nulo) são bloqueadas com UNAUTHORIZED', async () => {
    await assert.rejects(async () => {
      await service.listarMeusPedidos(null);
    }, /UNAUTHORIZED/);
  });

  it('J. Membro sem pedidos anteriores recebe lista vazia sem erro técnico', async () => {
    const ctxSemPedidos = { userId: 'u-novo', memberId: 'mem-novo-uuid', ministryId: ministryA };
    service.members.push({ id: 'mem-novo-uuid', ministry_id: ministryA, name: 'Novo Membro' });

    const res = await service.listarMeusPedidos(ctxSemPedidos);
    assert.deepEqual(res, []);
  });
});
