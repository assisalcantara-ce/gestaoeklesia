import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Simulação de Servidor e Lógica de Negócio para as APIs de Contribuição Mobile (FASE E.2.2)
 */
class MockMobileFinanceiroService {
  constructor() {
    this.members = [];
    this.destinations = [];
    this.charges = [];
    this.lancamentos = [];
  }

  // 1. Simulação de GET /api/v1/mobile/financeiro/destinos
  async listarDestinos(ctx) {
    const member = this.members.find((m) => m.id === ctx.memberId);
    if (!member) throw new Error('MEMBER_NOT_FOUND');

    const now = new Date();
    return this.destinations.filter((d) => {
      // Pertence ao mesmo ministério
      if (d.ministry_id !== ctx.ministryId) return false;
      // Está ativo
      if (!d.is_ativo) return false;
      // Não expirado
      if (d.expires_at && new Date(d.expires_at) <= now) return false;
      // Congregação geral (null) ou da congregação do membro
      if (d.congregacao_id && d.congregacao_id !== member.congregacao_id) return false;
      return true;
    }).map((d) => ({
      id: d.id,
      label: d.label,
      descricao: d.descricao,
      tipo_recebimento: d.tipo_recebimento,
      valor_fixo: d.valor_fixo,
      pix_payload: d.pix_payload,
      congregacao_id: d.congregacao_id,
    }));
  }

  // 2. Simulação de POST /api/v1/mobile/financeiro/pix
  async criarPix(ctx, body) {
    const member = this.members.find((m) => m.id === ctx.memberId);
    if (!member) throw new Error('MEMBER_NOT_FOUND');

    const { destinationId, valor, anonimo } = body;
    const dest = this.destinations.find(
      (d) => d.id === destinationId && d.ministry_id === ctx.ministryId && d.is_ativo,
    );
    if (!dest) throw new Error('DESTINATION_NOT_FOUND');

    // Validação de congregação
    if (dest.congregacao_id && member.congregacao_id && dest.congregacao_id !== member.congregacao_id) {
      throw new Error('DESTINATION_FORBIDDEN_CONGREGATION');
    }

    // Validação de valor
    const numValor = Number(valor);
    if (isNaN(numValor) || numValor < 1.00 || numValor > 100000.00) {
      throw new Error('INVALID_VALUE');
    }

    // Identidade derivada exclusivamente do servidor (ignora inputs maliciosos de member_id / ministry_id no body)
    const isAnon = anonimo === true;
    const chargeId = `charge-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newCharge = {
      id: chargeId,
      ministry_id: ctx.ministryId, // NUNCA body.ministry_id
      destination_id: dest.id,
      member_id: isAnon ? null : ctx.memberId, // NUNCA body.member_id
      valor_solicitado: numValor,
      valor_pago: null, // NUNCA aceito do cliente
      status: 'pendente', // NUNCA aceito do cliente
      payer_name: isAnon ? 'Doador Anônimo' : member.name,
      payer_document: isAnon ? null : member.cpf,
      pix_payload: `00020126580014br.gov.bcb.pix0136${dest.id}520400005303986540${numValor}5802BR`,
      created_at: new Date().toISOString(),
    };

    this.charges.push(newCharge);
    return {
      chargeId: newCharge.id,
      status: newCharge.status,
      valor: newCharge.valor_solicitado,
      pixPayload: newCharge.pix_payload,
    };
  }

  // 3. Simulação de GET /api/v1/mobile/financeiro/pix/[chargeId]/status
  async consultarStatusPix(ctx, chargeId) {
    const charge = this.charges.find(
      (c) => c.id === chargeId && c.ministry_id === ctx.ministryId && c.member_id === ctx.memberId,
    );
    if (!charge) throw new Error('CHARGE_NOT_FOUND');

    return {
      id: charge.id,
      status: charge.status,
      valor_solicitado: charge.valor_solicitado,
      valor_pago: charge.valor_pago,
      pix_payload: charge.pix_payload,
    };
  }

  // 4. Simulação de GET /api/v1/mobile/financeiro/extrato
  async consultarExtrato(ctx) {
    return this.lancamentos
      .filter((l) => l.ministry_id === ctx.ministryId && l.member_id === ctx.memberId)
      .sort((a, b) => new Date(b.data_lancamento) - new Date(a.data_lancamento))
      .map((l) => ({
        id: l.id,
        tipo_recebimento: l.tipo_recebimento,
        valor: l.valor,
        data_lancamento: l.data_lancamento,
        descricao: l.descricao,
        forma_pagamento: l.forma_pagamento,
      }));
  }

  // Simulação de Webhook Oficial (assíncrono)
  async simularWebhookPagamentoConfirmado(chargeId, valorPago) {
    const charge = this.charges.find((c) => c.id === chargeId);
    if (!charge) return;
    charge.status = 'pago';
    charge.valor_pago = valorPago;
    charge.paid_at = new Date().toISOString();

    // Cria lançamento na tesouraria
    if (charge.member_id) {
      this.lancamentos.push({
        id: `lanc-${Date.now()}`,
        ministry_id: charge.ministry_id,
        member_id: charge.member_id,
        tipo_recebimento: 'dizimo',
        valor: valorPago,
        data_lancamento: new Date().toISOString().slice(0, 10),
        descricao: 'PIX Recebido App Mobile',
        forma_pagamento: 'pix',
        origem_modulo: 'gateway',
        origem_id: charge.id,
      });
    }
  }
}

describe('FASE E.2.2 — APIs de Contribuições e PIX do App Mobile', () => {
  const service = new MockMobileFinanceiroService();

  const MINISTRY_A = 'min-alpha-1111';
  const MINISTRY_B = 'min-beta-2222';
  const CONGREGACAO_A1 = 'cong-alpha-1';
  const CONGREGACAO_A2 = 'cong-alpha-2';

  const CTX_MEMBER_1 = {
    userId: 'user-001',
    memberId: 'member-001',
    ministryId: MINISTRY_A,
  };

  const CTX_MEMBER_2 = {
    userId: 'user-002',
    memberId: 'member-002',
    ministryId: MINISTRY_A,
  };

  const CTX_MEMBER_B = {
    userId: 'user-003',
    memberId: 'member-003',
    ministryId: MINISTRY_B,
  };

  // Seed Membros
  service.members.push(
    { id: 'member-001', name: 'Lucas Silva', cpf: '111.111.111-11', congregacao_id: CONGREGACAO_A1 },
    { id: 'member-002', name: 'Ana Costa', cpf: '222.222.222-22', congregacao_id: CONGREGACAO_A2 },
    { id: 'member-003', name: 'Paulo Santos', cpf: '333.333.333-33', congregacao_id: null },
  );

  // Seed Destinos
  service.destinations.push(
    {
      id: 'dest-geral-a',
      ministry_id: MINISTRY_A,
      congregacao_id: null,
      label: 'Dízimo Geral',
      is_ativo: true,
      expires_at: null,
      tipo_recebimento: 'dizimo',
      pix_payload: '00020126580014br.gov.bcb.pix...',
    },
    {
      id: 'dest-cong1-a',
      ministry_id: MINISTRY_A,
      congregacao_id: CONGREGACAO_A1,
      label: 'Oferta Congregação Alpha 1',
      is_ativo: true,
      expires_at: null,
      tipo_recebimento: 'oferta',
    },
    {
      id: 'dest-cong2-a',
      ministry_id: MINISTRY_A,
      congregacao_id: CONGREGACAO_A2,
      label: 'Oferta Congregação Alpha 2',
      is_ativo: true,
      expires_at: null,
      tipo_recebimento: 'oferta',
    },
    {
      id: 'dest-expirado-a',
      ministry_id: MINISTRY_A,
      congregacao_id: null,
      label: 'Campanha Antiga Expirada',
      is_ativo: true,
      expires_at: new Date(Date.now() - 86400000).toISOString(), // Ontem
      tipo_recebimento: 'campanha',
    },
    {
      id: 'dest-inativo-a',
      ministry_id: MINISTRY_A,
      congregacao_id: null,
      label: 'Destino Desativado',
      is_ativo: false,
      expires_at: null,
      tipo_recebimento: 'doacao',
    },
    {
      id: 'dest-geral-b',
      ministry_id: MINISTRY_B,
      congregacao_id: null,
      label: 'Dízimo Ministério Beta',
      is_ativo: true,
      expires_at: null,
      tipo_recebimento: 'dizimo',
    },
  );

  it('A. Membro autenticado lista seus destinos autorizados', async () => {
    const destinos = await service.listarDestinos(CTX_MEMBER_1);
    assert.ok(destinos.some((d) => d.id === 'dest-geral-a'));
    assert.ok(destinos.some((d) => d.id === 'dest-cong1-a'));
  });

  it('B. Membro não consegue visualizar destino de outro ministry', async () => {
    const destinos = await service.listarDestinos(CTX_MEMBER_1);
    assert.equal(destinos.some((d) => d.id === 'dest-geral-b'), false);
  });

  it('C. Destino expirado ou inativo não aparece', async () => {
    const destinos = await service.listarDestinos(CTX_MEMBER_1);
    assert.equal(destinos.some((d) => d.id === 'dest-expirado-a'), false);
    assert.equal(destinos.some((d) => d.id === 'dest-inativo-a'), false);
  });

  it('D. Destino de congregação incompatível não aparece', async () => {
    const destinos = await service.listarDestinos(CTX_MEMBER_1);
    // Membro 1 é da Congregação A1 -> Não deve ver destino exclusivo da Congregação A2
    assert.equal(destinos.some((d) => d.id === 'dest-cong2-a'), false);
  });

  let createdChargeId = '';

  it('E. Membro consegue criar cobrança válida', async () => {
    const res = await service.criarPix(CTX_MEMBER_1, {
      destinationId: 'dest-geral-a',
      valor: 150.00,
      anonimo: false,
    });
    assert.ok(res.chargeId);
    assert.equal(res.status, 'pendente');
    assert.equal(res.valor, 150.00);
    assert.ok(res.pixPayload);
    createdChargeId = res.chargeId;
  });

  it('F. member_id da cobrança é sempre o membro autenticado', () => {
    const charge = service.charges.find((c) => c.id === createdChargeId);
    assert.equal(charge.member_id, CTX_MEMBER_1.memberId);
  });

  it('G. ministry_id da cobrança é sempre o tenant autenticado', () => {
    const charge = service.charges.find((c) => c.id === createdChargeId);
    assert.equal(charge.ministry_id, CTX_MEMBER_1.ministryId);
  });

  it('H. Cliente tentando forjar outro member_id no body é ignorado', async () => {
    const res = await service.criarPix(CTX_MEMBER_1, {
      destinationId: 'dest-geral-a',
      valor: 50.00,
      member_id: 'HACKED_MEMBER_ID',
      anonimo: false,
    });
    const charge = service.charges.find((c) => c.id === res.chargeId);
    assert.equal(charge.member_id, CTX_MEMBER_1.memberId, 'member_id foi extraído do token e não do body');
  });

  it('I. Cliente tentando forjar outro ministry_id no body é ignorado', async () => {
    const res = await service.criarPix(CTX_MEMBER_1, {
      destinationId: 'dest-geral-a',
      valor: 50.00,
      ministry_id: MINISTRY_B,
    });
    const charge = service.charges.find((c) => c.id === res.chargeId);
    assert.equal(charge.ministry_id, CTX_MEMBER_1.ministryId);
  });

  it('J. Cliente não consegue definir status=pago no momento da criação', async () => {
    const res = await service.criarPix(CTX_MEMBER_1, {
      destinationId: 'dest-geral-a',
      valor: 50.00,
      status: 'pago',
    });
    const charge = service.charges.find((c) => c.id === res.chargeId);
    assert.equal(charge.status, 'pendente');
  });

  it('K. Cliente não consegue definir valor_pago no momento da criação', async () => {
    const res = await service.criarPix(CTX_MEMBER_1, {
      destinationId: 'dest-geral-a',
      valor: 50.00,
      valor_pago: 50.00,
    });
    const charge = service.charges.find((c) => c.id === res.chargeId);
    assert.equal(charge.valor_pago, null);
  });

  it('L. Membro NÃO consegue consultar status de chargeId de outro membro', async () => {
    await assert.rejects(
      async () => {
        await service.consultarStatusPix(CTX_MEMBER_2, createdChargeId);
      },
      /CHARGE_NOT_FOUND/,
    );
  });

  it('M. Membro consegue consultar status da própria cobrança', async () => {
    const statusRes = await service.consultarStatusPix(CTX_MEMBER_1, createdChargeId);
    assert.equal(statusRes.id, createdChargeId);
    assert.equal(statusRes.status, 'pendente');
  });

  it('N. Extrato retorna somente lançamentos do próprio membro', async () => {
    // Insere lançamentos
    service.lancamentos.push(
      {
        id: 'lanc-1',
        ministry_id: MINISTRY_A,
        member_id: CTX_MEMBER_1.memberId,
        tipo_recebimento: 'dizimo',
        valor: 200,
        data_lancamento: '2026-09-01',
        descricao: 'Dízimo Setembro',
      },
      {
        id: 'lanc-2',
        ministry_id: MINISTRY_A,
        member_id: CTX_MEMBER_2.memberId,
        tipo_recebimento: 'oferta',
        valor: 100,
        data_lancamento: '2026-09-02',
        descricao: 'Oferta Membro 2',
      },
    );

    const extrato = await service.consultarExtrato(CTX_MEMBER_1);
    assert.equal(extrato.length, 1);
    assert.equal(extrato[0].id, 'lanc-1');
  });

  it('O. Extrato não retorna lançamentos de outro ministry', async () => {
    service.lancamentos.push({
      id: 'lanc-beta',
      ministry_id: MINISTRY_B,
      member_id: CTX_MEMBER_B.memberId,
      tipo_recebimento: 'dizimo',
      valor: 300,
      data_lancamento: '2026-09-01',
    });

    const extrato = await service.consultarExtrato(CTX_MEMBER_1);
    assert.equal(extrato.some((l) => l.ministry_id === MINISTRY_B), false);
  });

  it('P. Cobrança anônima não vincula member_id e protege privacidade', async () => {
    const res = await service.criarPix(CTX_MEMBER_1, {
      destinationId: 'dest-geral-a',
      valor: 80.00,
      anonimo: true,
    });
    const charge = service.charges.find((c) => c.id === res.chargeId);
    assert.equal(charge.member_id, null);
    assert.equal(charge.payer_name, 'Doador Anônimo');
    assert.equal(charge.payer_document, null);
  });

  it('Q. Cobrança continua pendente até confirmação pelo webhook oficial', async () => {
    const statusAntes = await service.consultarStatusPix(CTX_MEMBER_1, createdChargeId);
    assert.equal(statusAntes.status, 'pendente');

    // Simula chegada do webhook oficial do ASAAS
    await service.simularWebhookPagamentoConfirmado(createdChargeId, 150.00);

    const statusDepois = await service.consultarStatusPix(CTX_MEMBER_1, createdChargeId);
    assert.equal(statusDepois.status, 'pago');
    assert.equal(statusDepois.valor_pago, 150.00);
  });

  it('R. Webhook existente adiciona lançamento na tesouraria após pagamento', async () => {
    const extratoAtualizado = await service.consultarExtrato(CTX_MEMBER_1);
    assert.ok(extratoAtualizado.some((l) => l.descricao === 'PIX Recebido App Mobile' && l.valor === 150.00));
  });
});
