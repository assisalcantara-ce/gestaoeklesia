import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Simulação de Servidor e Lógica de Negócio para as APIs de Eventos e Inscrições Mobile (FASE E.2.4)
 */
class MockMobileEventosService {
  constructor() {
    this.members = [];
    this.eventos = [];
    this.inscricoes = [];
    this.pagamentos = [];
    this.gateways = [];
  }

  // 1. GET /api/v1/mobile/eventos
  async listarEventos(ctx) {
    const member = this.members.find((m) => m.id === ctx.memberId);
    if (!member) throw new Error('MEMBER_NOT_FOUND');

    const eventosFiltrados = this.eventos.filter((ev) => {
      // Pertence ao tenant
      if (ev.ministry_id !== ctx.ministryId) return false;
      // É público e aceita inscrição
      if (!ev.is_publico || !ev.aceita_inscricao) return false;
      // Status compatível
      if (!['programado', 'em_andamento'].includes(ev.status)) return false;
      // Congregação compatível
      if (ev.congregacao_id && ev.congregacao_id !== member.congregacao_id) return false;
      return true;
    });

    return eventosFiltrados.map((ev) => {
      const ocupadas = this.inscricoes.filter(
        (i) => i.evento_id === ev.id && ['confirmado', 'aguardando_pagamento'].includes(i.status)
      ).length;

      const minhaInscricao = this.inscricoes.find(
        (i) => i.evento_id === ev.id && i.member_id === ctx.memberId && !['expirado', 'cancelado'].includes(i.status)
      );

      const vagasRestantes = ev.capacidade != null ? Math.max(0, ev.capacidade - ocupadas) : null;
      const lotado = ev.capacidade != null && ocupadas >= ev.capacidade;

      return {
        id: ev.id,
        titulo: ev.titulo,
        descricao: ev.descricao,
        tipo: ev.tipo,
        data_inicio: ev.data_inicio,
        data_fim: ev.data_fim,
        local_nome: ev.local_nome,
        local_endereco: ev.local_endereco,
        valor_inscricao: Number(ev.valor_inscricao ?? 0),
        capacidade: ev.capacidade,
        vagas_restantes: vagasRestantes,
        lotado,
        inclui_hospedagem: Boolean(ev.inclui_hospedagem),
        slug: ev.slug,
        programacao: ev.programacao,
        minha_inscricao: minhaInscricao ? { id: minhaInscricao.id, status: minhaInscricao.status } : null,
      };
    });
  }

  // 2. GET /api/v1/mobile/eventos/[id]
  async detalharEvento(ctx, eventoId) {
    const member = this.members.find((m) => m.id === ctx.memberId);
    if (!member) throw new Error('MEMBER_NOT_FOUND');

    const ev = this.eventos.find(
      (e) => e.id === eventoId && e.ministry_id === ctx.ministryId && e.is_publico
    );

    // Se for de outro tenant ou congregação incompatível -> 404
    if (!ev) throw new Error('EVENTO_NOT_FOUND');
    if (ev.congregacao_id && member.congregacao_id && ev.congregacao_id !== member.congregacao_id) {
      throw new Error('EVENTO_NOT_FOUND');
    }

    const ocupadas = this.inscricoes.filter(
      (i) => i.evento_id === ev.id && ['confirmado', 'aguardando_pagamento'].includes(i.status)
    ).length;

    const listaEspera = this.inscricoes.filter(
      (i) => i.evento_id === ev.id && i.status === 'lista_espera'
    ).length;

    const minhaInscricao = this.inscricoes.find(
      (i) => i.evento_id === ev.id && i.member_id === ctx.memberId
    );

    let pagamento = null;
    if (minhaInscricao) {
      pagamento = this.pagamentos.find((p) => p.inscricao_id === minhaInscricao.id) || null;
    }

    return {
      id: ev.id,
      titulo: ev.titulo,
      descricao: ev.descricao,
      tipo: ev.tipo,
      data_inicio: ev.data_inicio,
      data_fim: ev.data_fim,
      local_nome: ev.local_nome,
      local_endereco: ev.local_endereco,
      valor_inscricao: Number(ev.valor_inscricao ?? 0),
      capacidade: ev.capacidade,
      vagas_restantes: ev.capacidade != null ? Math.max(0, ev.capacidade - ocupadas) : null,
      lotado: ev.capacidade != null && ocupadas >= ev.capacidade,
      lista_espera_count: listaEspera,
      inclui_hospedagem: Boolean(ev.inclui_hospedagem),
      vagas_hospedagem: ev.vagas_hospedagem,
      descricao_hospedagem: ev.descricao_hospedagem,
      programacao: ev.programacao,
      status: ev.status,
      aceita_inscricao: ev.aceita_inscricao,
      slug: ev.slug,
      minha_inscricao: minhaInscricao ? {
        id: minhaInscricao.id,
        status: minhaInscricao.status,
        com_hospedagem: minhaInscricao.com_hospedagem,
        status_hospedagem: minhaInscricao.status_hospedagem,
        pagamento: pagamento ? {
          id: pagamento.id,
          status: pagamento.status,
          valor: pagamento.valor,
          pix_payload: pagamento.pix_payload,
        } : null,
      } : null,
    };
  }

  // 3. POST /api/v1/mobile/eventos/[id]/inscrever
  async inscreverEvento(ctx, eventoId, body = {}) {
    const member = this.members.find((m) => m.id === ctx.memberId);
    if (!member) throw new Error('MEMBER_NOT_FOUND');

    const ev = this.eventos.find(
      (e) => e.id === eventoId && e.ministry_id === ctx.ministryId && e.is_publico
    );
    if (!ev) throw new Error('EVENTO_NOT_FOUND');

    // Validações de status
    if (!ev.aceita_inscricao) throw new Error('EVENTO_NAO_ACEITA_INSCRICAO');
    if (ev.status === 'cancelado') throw new Error('EVENTO_CANCELADO');
    if (ev.status === 'realizado') throw new Error('EVENTO_REALIZADO');

    // Validação de congregação
    if (ev.congregacao_id && member.congregacao_id && ev.congregacao_id !== member.congregacao_id) {
      throw new Error('EVENTO_CONGREGACAO_INCOMPATIVEL');
    }

    // Duplicidade
    const jaInscrito = this.inscricoes.find(
      (i) => i.evento_id === ev.id && i.member_id === ctx.memberId && !['expirado', 'cancelado'].includes(i.status)
    );
    if (jaInscrito) {
      const err = new Error('ALREADY_REGISTERED');
      err.inscricaoId = jaInscrito.id;
      throw err;
    }

    // Capacidade
    const isPago = Number(ev.valor_inscricao ?? 0) > 0;
    let statusInscricao = 'confirmado';
    let temVaga = true;

    if (ev.capacidade != null) {
      const ocupadas = this.inscricoes.filter(
        (i) => i.evento_id === ev.id && ['confirmado', 'aguardando_pagamento'].includes(i.status)
      ).length;

      if (ocupadas >= ev.capacidade) {
        temVaga = false;
        statusInscricao = 'lista_espera';
      }
    }

    if (temVaga && isPago) {
      statusInscricao = 'aguardando_pagamento';
    }

    // Hospedagem
    const querHospedagem = Boolean(body.com_hospedagem) && Boolean(ev.inclui_hospedagem);
    let statusHospedagem = 'nao_aplicavel';

    if (querHospedagem) {
      if (statusInscricao === 'lista_espera') {
        statusHospedagem = 'lista_espera';
      } else if (ev.vagas_hospedagem != null) {
        const ocupadasHosp = this.inscricoes.filter(
          (i) => i.evento_id === ev.id && i.com_hospedagem && ['solicitada', 'confirmada'].includes(i.status_hospedagem)
        ).length;

        if (ocupadasHosp >= ev.vagas_hospedagem) {
          statusHospedagem = 'lista_espera';
        } else {
          statusHospedagem = isPago ? 'solicitada' : 'confirmada';
        }
      } else {
        statusHospedagem = isPago ? 'solicitada' : 'confirmada';
      }
    }

    // Cria inscrição com identidade estritamente do token
    const inscricaoId = `ins-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const novaInscricao = {
      id: inscricaoId,
      evento_id: ev.id,
      ministry_id: ctx.ministryId, // NUNCA body.ministry_id
      member_id: ctx.memberId,     // NUNCA body.member_id
      nome_externo: member.name,   // Do cadastro server-side
      email_externo: member.email,
      telefone: member.phone,
      status: statusInscricao,
      com_hospedagem: querHospedagem,
      status_hospedagem: statusHospedagem,
      observacoes: body.observacoes || null,
      presente: false,
      created_at: new Date().toISOString(),
    };

    this.inscricoes.push(novaInscricao);

    // Se gratuito ou lista de espera
    if (!isPago || statusInscricao === 'lista_espera') {
      return {
        inscricao_id: novaInscricao.id,
        status: novaInscricao.status,
        com_hospedagem: querHospedagem,
        status_hospedagem: statusHospedagem,
        evento_titulo: ev.titulo,
        data_inicio: ev.data_inicio,
        pago: false,
        valor: 0,
      };
    }

    // Se pago: gerar pagamento ASAAS
    const gw = this.gateways.find((g) => g.ministry_id === ctx.ministryId && g.is_active);
    if (!gw) {
      // Fallback sem gateway
      novaInscricao.status = 'confirmado';
      return {
        inscricao_id: novaInscricao.id,
        status: 'confirmado',
        com_hospedagem: querHospedagem,
        status_hospedagem: statusHospedagem,
        evento_titulo: ev.titulo,
        pago: false,
        aviso: 'Gateway de pagamento não configurado.',
      };
    }

    const pagId = `epag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const novoPagamento = {
      id: pagId,
      ministry_id: ctx.ministryId,
      evento_id: ev.id,
      inscricao_id: novaInscricao.id,
      gateway: 'asaas',
      gateway_charge_id: `pay_${Date.now()}`,
      valor: Number(ev.valor_inscricao),
      status: 'pendente', // NUNCA pago no POST
      pix_payload: `00020126580014br.gov.bcb.pix...${ev.id}`,
      pix_qrcode: 'data:image/png;base64,mockqr',
      expires_at: new Date(Date.now() + 2 * 86400000).toISOString(),
      paid_at: null,
      created_at: new Date().toISOString(),
    };

    this.pagamentos.push(novoPagamento);

    return {
      inscricao_id: novaInscricao.id,
      pagamento_id: novoPagamento.id,
      status: novaInscricao.status,
      com_hospedagem: querHospedagem,
      status_hospedagem: statusHospedagem,
      evento_titulo: ev.titulo,
      pago: true,
      valor: novoPagamento.valor,
      pix: {
        payload: novoPagamento.pix_payload,
        qrcode_base64: novoPagamento.pix_qrcode,
        expira_em: novoPagamento.expires_at,
      },
    };
  }

  // 4. GET /api/v1/mobile/eventos/minhas-inscricoes
  async listarMinhasInscricoes(ctx) {
    const inscricoesMembro = this.inscricoes
      .filter((i) => i.ministry_id === ctx.ministryId && i.member_id === ctx.memberId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return inscricoesMembro.map((ins) => {
      const ev = this.eventos.find((e) => e.id === ins.evento_id) || {};
      const pag = this.pagamentos.find((p) => p.inscricao_id === ins.id);

      return {
        id: ins.id,
        status: ins.status,
        com_hospedagem: ins.com_hospedagem,
        status_hospedagem: ins.status_hospedagem,
        created_at: ins.created_at,
        evento: {
          id: ev.id,
          titulo: ev.titulo,
          tipo: ev.tipo,
          data_inicio: ev.data_inicio,
          local_nome: ev.local_nome,
          valor_inscricao: ev.valor_inscricao,
        },
        pagamento: pag ? {
          id: pag.id,
          status: pag.status,
          valor: pag.valor,
          pix_payload: pag.pix_payload,
        } : null,
      };
    });
  }

  // 5. GET /api/v1/mobile/eventos/pagamento/[id]/status
  async consultarStatusPagamento(ctx, pagamentoId) {
    const pag = this.pagamentos.find(
      (p) => p.id === pagamentoId && p.ministry_id === ctx.ministryId
    );
    if (!pag) throw new Error('PAGAMENTO_NOT_FOUND');

    // Anti-IDOR: Inscrição deve pertencer ao membro autenticado
    const ins = this.inscricoes.find(
      (i) => i.id === pag.inscricao_id && i.member_id === ctx.memberId && i.ministry_id === ctx.ministryId
    );
    if (!ins) throw new Error('PAGAMENTO_NOT_FOUND');

    // Auto-expirar se vencido
    if (pag.status === 'pendente' && pag.expires_at && new Date(pag.expires_at) < new Date()) {
      pag.status = 'expirado';
      ins.status = 'expirado';
    }

    return {
      id: pag.id,
      status: pag.status,
      valor: pag.valor,
      expires_at: pag.expires_at,
      paid_at: pag.paid_at,
      pix: pag.status === 'pendente' ? { payload: pag.pix_payload } : null,
    };
  }
}

describe('FASE E.2.4 — APIs de Eventos e Inscrições do App Mobile', () => {
  const service = new MockMobileEventosService();

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
    { id: 'member-001', name: 'Lucas Silva', email: 'lucas@teste.com', phone: '11999990001', cpf: '111.111.111-11', congregacao_id: CONGREGACAO_A1 },
    { id: 'member-002', name: 'Ana Costa', email: 'ana@teste.com', phone: '11999990002', cpf: '222.222.222-22', congregacao_id: CONGREGACAO_A2 },
    { id: 'member-003', name: 'Paulo Santos', email: 'paulo@teste.com', phone: '11999990003', cpf: '333.333.333-33', congregacao_id: null },
  );

  // Seed Gateway
  service.gateways.push({
    ministry_id: MINISTRY_A,
    gateway: 'asaas',
    is_active: true,
  });

  // Seed Eventos
  service.eventos.push(
    {
      id: 'ev-gratuito-a',
      ministry_id: MINISTRY_A,
      congregacao_id: null,
      titulo: 'Culto da Virada',
      tipo: 'culto_especial',
      data_inicio: '2026-12-31T20:00:00Z',
      local_nome: 'Templo Central',
      is_publico: true,
      aceita_inscricao: true,
      valor_inscricao: 0,
      capacidade: 100,
      inclui_hospedagem: false,
      status: 'programado',
    },
    {
      id: 'ev-pago-a',
      ministry_id: MINISTRY_A,
      congregacao_id: null,
      titulo: 'Retiro Espiritual 2026',
      tipo: 'retiro',
      data_inicio: '2026-10-10T08:00:00Z',
      local_nome: 'Sítio Recanto',
      is_publico: true,
      aceita_inscricao: true,
      valor_inscricao: 250.00,
      capacidade: 50,
      inclui_hospedagem: true,
      vagas_hospedagem: 30,
      descricao_hospedagem: 'Alojamento com ar condicionado e alimentação inclusa.',
      status: 'programado',
    },
    {
      id: 'ev-lotado-a',
      ministry_id: MINISTRY_A,
      congregacao_id: null,
      titulo: 'Workshop de Liderança (Esgotado)',
      tipo: 'treinamento',
      data_inicio: '2026-11-05T09:00:00Z',
      is_publico: true,
      aceita_inscricao: true,
      valor_inscricao: 0,
      capacidade: 2, // Capacidade pequena para teste de fila
      status: 'programado',
    },
    {
      id: 'ev-cong1-a',
      ministry_id: MINISTRY_A,
      congregacao_id: CONGREGACAO_A1,
      titulo: 'Encontro de Casais Congregação Alpha 1',
      tipo: 'social',
      data_inicio: '2026-10-20T19:00:00Z',
      is_publico: true,
      aceita_inscricao: true,
      valor_inscricao: 0,
      status: 'programado',
    },
    {
      id: 'ev-cong2-a',
      ministry_id: MINISTRY_A,
      congregacao_id: CONGREGACAO_A2,
      titulo: 'Chá de Mulheres Congregação Alpha 2',
      tipo: 'social',
      data_inicio: '2026-10-25T16:00:00Z',
      is_publico: true,
      aceita_inscricao: true,
      valor_inscricao: 0,
      status: 'programado',
    },
    {
      id: 'ev-cancelado-a',
      ministry_id: MINISTRY_A,
      titulo: 'Vigília Cancelada',
      is_publico: true,
      aceita_inscricao: true,
      status: 'cancelado',
    },
    {
      id: 'ev-realizado-a',
      ministry_id: MINISTRY_A,
      titulo: 'Conferência Passada',
      is_publico: true,
      aceita_inscricao: true,
      status: 'realizado',
    },
    {
      id: 'ev-privado-a',
      ministry_id: MINISTRY_A,
      titulo: 'Reunião Secreta',
      is_publico: false,
      aceita_inscricao: true,
      status: 'programado',
    },
    {
      id: 'ev-tenant-b',
      ministry_id: MINISTRY_B,
      titulo: 'Congresso Ministério Beta',
      is_publico: true,
      aceita_inscricao: true,
      valor_inscricao: 100,
      status: 'programado',
    },
  );

  it('A. Listar eventos públicos e disponíveis do ministério', async () => {
    const list = await service.listarEventos(CTX_MEMBER_1);
    assert.ok(list.length >= 3);
    assert.ok(list.some((e) => e.id === 'ev-gratuito-a'));
    assert.ok(list.some((e) => e.id === 'ev-pago-a'));
  });

  it('B. Não listar eventos de outro ministry', async () => {
    const list = await service.listarEventos(CTX_MEMBER_1);
    assert.equal(list.some((e) => e.id === 'ev-tenant-b'), false);
  });

  it('C. Não listar eventos indisponíveis (privados, cancelados ou realizados)', async () => {
    const list = await service.listarEventos(CTX_MEMBER_1);
    assert.equal(list.some((e) => e.id === 'ev-privado-a'), false);
    assert.equal(list.some((e) => e.id === 'ev-cancelado-a'), false);
    assert.equal(list.some((e) => e.id === 'ev-realizado-a'), false);
  });

  it('D. Visualizar detalhes completos de um evento autorizado', async () => {
    const det = await service.detalharEvento(CTX_MEMBER_1, 'ev-pago-a');
    assert.equal(det.id, 'ev-pago-a');
    assert.equal(det.titulo, 'Retiro Espiritual 2026');
    assert.equal(det.valor_inscricao, 250.00);
    assert.equal(det.inclui_hospedagem, true);
    assert.equal(det.vagas_hospedagem, 30);
  });

  it('E. Bloquear detalhes de evento de outro tenant com 404', async () => {
    await assert.rejects(
      async () => {
        await service.detalharEvento(CTX_MEMBER_1, 'ev-tenant-b');
      },
      /EVENTO_NOT_FOUND/
    );
  });

  it('F. Inscrição em evento gratuito cria status confirmado e sem cobrança', async () => {
    const res = await service.inscreverEvento(CTX_MEMBER_1, 'ev-gratuito-a');
    assert.ok(res.inscricao_id);
    assert.equal(res.status, 'confirmado');
    assert.equal(res.pago, false);
    assert.equal(res.valor, 0);
  });

  it('G. Inscrição em evento pago gera PIX com status aguardando_pagamento', async () => {
    const res = await service.inscreverEvento(CTX_MEMBER_1, 'ev-pago-a', { com_hospedagem: true });
    assert.ok(res.inscricao_id);
    assert.ok(res.pagamento_id);
    assert.equal(res.status, 'aguardando_pagamento');
    assert.equal(res.com_hospedagem, true);
    assert.equal(res.status_hospedagem, 'solicitada');
    assert.equal(res.pago, true);
    assert.equal(res.valor, 250.00);
    assert.ok(res.pix.payload);
  });

  it('H. Impedir inscrição duplicada do mesmo membro no mesmo evento', async () => {
    await assert.rejects(
      async () => {
        await service.inscreverEvento(CTX_MEMBER_1, 'ev-gratuito-a');
      },
      /ALREADY_REGISTERED/
    );
  });

  it('I. Respeitar capacidade máxima e alocar em lista_espera quando lotado', async () => {
    // Inscreve 2 membros para lotar ev-lotado-a
    await service.inscreverEvento(CTX_MEMBER_1, 'ev-lotado-a');
    await service.inscreverEvento(CTX_MEMBER_2, 'ev-lotado-a');

    // 3º membro tenta se inscrever -> deve ir para lista de espera
    const member3 = { id: 'member-004', name: 'Carla', email: 'carla@teste.com', congregacao_id: null };
    service.members.push(member3);
    const ctx3 = { userId: 'user-004', memberId: 'member-004', ministryId: MINISTRY_A };

    const res = await service.inscreverEvento(ctx3, 'ev-lotado-a');
    assert.equal(res.status, 'lista_espera');
  });

  it('J. Vincular automaticamente member_id e ministry_id extraídos do token', async () => {
    const list = await service.listarMinhasInscricoes(CTX_MEMBER_1);
    const ins = list.find((i) => i.evento.id === 'ev-pago-a');
    assert.ok(ins);

    const dbRecord = service.inscricoes.find((i) => i.id === ins.id);
    assert.equal(dbRecord.member_id, CTX_MEMBER_1.memberId);
    assert.equal(dbRecord.ministry_id, CTX_MEMBER_1.ministryId);
    assert.equal(dbRecord.nome_externo, 'Lucas Silva');
  });

  it('K. Inputs maliciosos de member_id / ministry_id no body são estritamente ignorados', async () => {
    const res = await service.inscreverEvento(CTX_MEMBER_2, 'ev-gratuito-a', {
      member_id: 'HACKER_ID',
      ministry_id: MINISTRY_B,
      status: 'confirmado',
    });
    const dbRecord = service.inscricoes.find((i) => i.id === res.inscricao_id);
    assert.equal(dbRecord.member_id, CTX_MEMBER_2.memberId);
    assert.equal(dbRecord.ministry_id, CTX_MEMBER_2.ministryId);
  });

  it('L. Não marcar pagamento como pago no momento da criação da cobrança', () => {
    const pags = service.pagamentos;
    assert.ok(pags.length > 0);
    pags.forEach((p) => {
      assert.equal(p.status, 'pendente');
      assert.equal(p.paid_at, null);
    });
  });

  it('M. Minhas inscrições retorna somente inscrições do próprio membro autenticado', async () => {
    const listMembro1 = await service.listarMinhasInscricoes(CTX_MEMBER_1);
    const listMembro2 = await service.listarMinhasInscricoes(CTX_MEMBER_2);

    assert.ok(listMembro1.every((i) => {
      const rec = service.inscricoes.find((r) => r.id === i.id);
      return rec.member_id === CTX_MEMBER_1.memberId;
    }));

    assert.ok(listMembro2.every((i) => {
      const rec = service.inscricoes.find((r) => r.id === i.id);
      return rec.member_id === CTX_MEMBER_2.memberId;
    }));
  });

  it('N. Membro não consegue consultar status de pagamento de outro membro (Anti-IDOR)', async () => {
    const listMembro1 = await service.listarMinhasInscricoes(CTX_MEMBER_1);
    const pagMembro1 = listMembro1.find((i) => i.pagamento)?.pagamento;
    assert.ok(pagMembro1);

    await assert.rejects(
      async () => {
        await service.consultarStatusPagamento(CTX_MEMBER_2, pagMembro1.id);
      },
      /PAGAMENTO_NOT_FOUND/
    );
  });

  it('O. Membro consegue consultar status do próprio pagamento', async () => {
    const listMembro1 = await service.listarMinhasInscricoes(CTX_MEMBER_1);
    const pagMembro1 = listMembro1.find((i) => i.pagamento)?.pagamento;
    assert.ok(pagMembro1);

    const statusRes = await service.consultarStatusPagamento(CTX_MEMBER_1, pagMembro1.id);
    assert.equal(statusRes.id, pagMembro1.id);
    assert.equal(statusRes.status, 'pendente');
    assert.equal(statusRes.valor, 250.00);
  });

  it('P. Congregação compatível: membro vê evento de sua congregação e eventos gerais', async () => {
    const list = await service.listarEventos(CTX_MEMBER_1); // Membro da Congregação A1
    assert.ok(list.some((e) => e.id === 'ev-cong1-a'));
    assert.ok(list.some((e) => e.id === 'ev-gratuito-a'));
  });

  it('Q. Congregação incompatível: membro NÃO vê evento exclusivo de outra congregação', async () => {
    const list = await service.listarEventos(CTX_MEMBER_1); // Membro da Congregação A1
    assert.equal(list.some((e) => e.id === 'ev-cong2-a'), false);
  });

  it('R. Evento fechado/cancelado/realizado não aceita nova inscrição', async () => {
    await assert.rejects(
      async () => {
        await service.inscreverEvento(CTX_MEMBER_1, 'ev-cancelado-a');
      },
      /EVENTO_CANCELADO/
    );

    await assert.rejects(
      async () => {
        await service.inscreverEvento(CTX_MEMBER_1, 'ev-realizado-a');
      },
      /EVENTO_REALIZADO/
    );
  });

  it('S. Auto-expiração de pagamento pendente vencido atualiza inscrição e cobrança', async () => {
    // Cria inscrição com pagamento com vencimento no passado
    const ctxTemp = { userId: 'user-005', memberId: 'member-005', ministryId: MINISTRY_A };
    service.members.push({ id: 'member-005', name: 'Vencido', congregacao_id: null });
    const res = await service.inscreverEvento(ctxTemp, 'ev-pago-a');

    // Força data de expiração no passado
    const pagRecord = service.pagamentos.find((p) => p.id === res.pagamento_id);
    pagRecord.expires_at = new Date(Date.now() - 3600000).toISOString();

    // Consulta status
    const statusRes = await service.consultarStatusPagamento(ctxTemp, res.pagamento_id);
    assert.equal(statusRes.status, 'expirado');

    const insRecord = service.inscricoes.find((i) => i.id === res.inscricao_id);
    assert.equal(insRecord.status, 'expirado');
  });
});
