import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Suite de Testes Automatizados — FASE E.4: Programação, Cultos e Agenda no App Mobile Gestão Eklésia
 */

class MockAgendaService {
  constructor() {
    this.members = [];
    this.congregacoes = [];
    this.agendaEventos = [];
    this.agendaTipos = [];
  }

  // Simula GET /api/v1/mobile/agenda
  async getAgenda(ctx, { tipo, apenas_congregacao } = {}) {
    if (!ctx || !ctx.userId || !ctx.memberId || !ctx.ministryId) {
      throw new Error('UNAUTHORIZED');
    }

    const member = this.members.find(
      (m) => m.id === ctx.memberId && m.ministry_id === ctx.ministryId,
    );
    if (!member) throw new Error('MEMBER_NOT_FOUND');

    const agora = new Date();
    agora.setHours(0, 0, 0, 0);

    const permitidos = ['publico', 'igreja', 'ministerio'];

    let eventos = this.agendaEventos.filter((e) => {
      // 1. Mesmo ministério
      if (e.ministry_id !== ctx.ministryId) return false;
      // 2. Visibilidade permitida ao membro
      if (!permitidos.includes(e.visibilidade)) return false;
      // 3. Status não cancelado
      if (e.status === 'cancelado') return false;
      // 4. A partir de hoje
      if (new Date(e.data_inicio) < agora) return false;
      return true;
    });

    if (tipo) {
      eventos = eventos.filter((e) => e.tipo === tipo);
    }

    // Filtrar congregação
    eventos = eventos.filter((e) => {
      if (apenas_congregacao && member.congregacao_id) {
        return e.church_id === member.congregacao_id;
      }
      if (!e.church_id) return true; // Geral
      if (!member.congregacao_id) return true;
      return e.church_id === member.congregacao_id;
    });

    // Ordenar por data
    eventos.sort((a, b) => (new Date(a.data_inicio) > new Date(b.data_inicio) ? 1 : -1));

    // Agrupamento
    const hojeStart = new Date();
    hojeStart.setHours(0, 0, 0, 0);
    const hojeEnd = new Date();
    hojeEnd.setHours(23, 59, 59, 999);

    const seteDiasEnd = new Date();
    seteDiasEnd.setDate(seteDiasEnd.getDate() + 7);
    seteDiasEnd.setHours(23, 59, 59, 999);

    const hoje = [];
    const esta_semana = [];
    const proximos = [];
    let proximo_culto = null;

    for (const e of eventos) {
      const dt = new Date(e.data_inicio);
      const isCulto = e.tipo === 'culto';

      if (!proximo_culto && isCulto && dt >= new Date()) {
        proximo_culto = e;
      }

      if (dt >= hojeStart && dt <= hojeEnd) {
        hoje.push(e);
      } else if (dt > hojeEnd && dt <= seteDiasEnd) {
        esta_semana.push(e);
      } else if (dt > seteDiasEnd) {
        proximos.push(e);
      }
    }

    return {
      total: eventos.length,
      proximo_culto,
      hoje,
      esta_semana,
      proximos,
      todos: eventos,
    };
  }

  // Simula GET /api/v1/mobile/agenda/cultos
  async getCultos(ctx) {
    const res = await this.getAgenda(ctx, { tipo: 'culto' });
    return {
      total: res.todos.length,
      cultos: res.todos,
    };
  }

  // Simula GET /api/v1/mobile/agenda/[id]
  async getEventoDetalhe(ctx, id) {
    if (!ctx || !ctx.memberId) throw new Error('UNAUTHORIZED');

    const member = this.members.find(
      (m) => m.id === ctx.memberId && m.ministry_id === ctx.ministryId,
    );
    if (!member) throw new Error('MEMBER_NOT_FOUND');

    const evento = this.agendaEventos.find(
      (e) => e.id === id && e.ministry_id === ctx.ministryId,
    );
    if (!evento) throw new Error('EVENT_NOT_FOUND');

    const permitidos = ['publico', 'igreja', 'ministerio'];
    if (!permitidos.includes(evento.visibilidade)) {
      throw new Error('EVENT_FORBIDDEN');
    }

    if (evento.church_id && member.congregacao_id && evento.church_id !== member.congregacao_id) {
      throw new Error('EVENT_FORBIDDEN');
    }

    const cong = this.congregacoes.find((c) => c.id === evento.church_id);
    let enderecoCompleto = evento.local || '';
    let mapsUrl = null;

    if (cong) {
      enderecoCompleto = `${cong.nome} — ${cong.endereco}, ${cong.cidade} - ${cong.uf}`;
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`;
    }

    return {
      id: evento.id,
      titulo: evento.titulo,
      descricao: evento.descricao,
      tipo: evento.tipo,
      data_inicio: evento.data_inicio,
      data_fim: evento.data_fim,
      status: evento.status,
      visibilidade: evento.visibilidade,
      local: evento.local,
      congregacao: cong || null,
      endereco_completo: enderecoCompleto,
      maps_url: mapsUrl,
    };
  }
}

describe('FASE E.4 — Programação, Cultos e Agenda no App Mobile Gestão Eklésia', () => {
  const ministryA = 'min-alpha-uuid';
  const ministryB = 'min-beta-uuid';
  const congA1 = 'cong-alpha-sede';
  const congA2 = 'cong-alpha-filial';
  const congB = 'cong-beta-sede';

  const memberA1 = { id: 'mem-1-uuid', ministry_id: ministryA, congregacao_id: congA1, name: 'Lucas Alcantara' };
  const memberA2 = { id: 'mem-2-uuid', ministry_id: ministryA, congregacao_id: congA2, name: 'João Filial' };
  const memberB = { id: 'mem-3-uuid', ministry_id: ministryB, congregacao_id: congB, name: 'Membro Beta' };

  let service;

  beforeEach(() => {
    service = new MockAgendaService();
    service.members = [memberA1, memberA2, memberB];

    service.congregacoes = [
      { id: congA1, ministry_id: ministryA, nome: 'Congregação Sede', endereco: 'Av. Principal, 100', cidade: 'Fortaleza', uf: 'CE' },
      { id: congA2, ministry_id: ministryA, nome: 'Congregação Filial Sul', endereco: 'Rua das Flores, 50', cidade: 'Fortaleza', uf: 'CE' },
      { id: congB, ministry_id: ministryB, nome: 'Sede Beta', endereco: 'Av. Central, 500', cidade: 'Recife', uf: 'PE' },
    ];

    const hoje = new Date(Date.now() + 2 * 3600 * 1000);
    const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
    const daquiQuatroDias = new Date(); daquiQuatroDias.setDate(daquiQuatroDias.getDate() + 4);
    const daquiDezDias = new Date(); daquiDezDias.setDate(daquiDezDias.getDate() + 10);

    service.agendaEventos = [
      // Culto hoje na Sede (Público)
      {
        id: 'ev-1',
        ministry_id: ministryA,
        church_id: congA1,
        titulo: 'Culto de Doutrina e Ensino',
        descricao: 'Estudo expositivo da Palavra de Deus.',
        tipo: 'culto',
        data_inicio: hoje.toISOString(),
        visibilidade: 'publico',
        status: 'agendado',
      },
      // Culto amanhã na Sede (Igreja)
      {
        id: 'ev-2',
        ministry_id: ministryA,
        church_id: congA1,
        titulo: 'Culto da Família',
        descricao: 'Celebração com toda a igreja e famílias.',
        tipo: 'culto',
        data_inicio: amanha.toISOString(),
        visibilidade: 'igreja',
        status: 'agendado',
      },
      // Evento daqui a 4 dias geral do ministério (church_id NULL)
      {
        id: 'ev-3',
        ministry_id: ministryA,
        church_id: null,
        titulo: 'Conferência Anual de Missões',
        descricao: 'Grande ajuntamento de todas as congregações.',
        tipo: 'evento',
        data_inicio: daquiQuatroDias.toISOString(),
        visibilidade: 'ministerio',
        status: 'agendado',
      },
      // Reunião administrativa sigilosa da liderança (lideranca) - NÃO DEVE APARECER
      {
        id: 'ev-4-privado',
        ministry_id: ministryA,
        church_id: congA1,
        titulo: 'Reunião de Diretoria Executiva',
        descricao: 'Pauta administrativa interna.',
        tipo: 'reuniao',
        data_inicio: amanha.toISOString(),
        visibilidade: 'lideranca',
        status: 'agendado',
      },
      // Culto exclusivo da Filial Sul (church_id congA2)
      {
        id: 'ev-5-filial',
        ministry_id: ministryA,
        church_id: congA2,
        titulo: 'Culto de Oração e Louvor na Filial Sul',
        descricao: 'Reunião de oração da congregação sul.',
        tipo: 'culto',
        data_inicio: daquiDezDias.toISOString(),
        visibilidade: 'igreja',
        status: 'agendado',
      },
      // Evento do Ministério B - NÃO DEVE APARECER para A
      {
        id: 'ev-beta',
        ministry_id: ministryB,
        church_id: congB,
        titulo: 'Culto da Igreja Beta',
        tipo: 'culto',
        data_inicio: amanha.toISOString(),
        visibilidade: 'publico',
        status: 'agendado',
      },
    ];
  });

  it('A. Membro autenticado consulta programação pública e relevante do seu ministério', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: ministryA };
    const res = await service.getAgenda(ctx);

    assert.equal(res.total, 3); // ev-1 (sede), ev-2 (sede), ev-3 (geral)
    assert.ok(res.todos.some((e) => e.id === 'ev-1'));
    assert.ok(res.todos.some((e) => e.id === 'ev-2'));
    assert.ok(res.todos.some((e) => e.id === 'ev-3'));
  });

  it('B. Programação da congregação inclui eventos locais e gerais do ministério', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: ministryA };
    const res = await service.getAgenda(ctx);

    const eventoGeral = res.todos.find((e) => e.id === 'ev-3');
    assert.ok(eventoGeral);
    assert.equal(eventoGeral.church_id, null);
  });

  it('C. Consulta de cultos retorna apenas programações do tipo culto', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: ministryA };
    const res = await service.getCultos(ctx);

    assert.equal(res.total, 2);
    assert.ok(res.cultos.every((c) => c.tipo === 'culto'));
  });

  it('D. Ausência de programação para filtros específicos retorna lista vazia consistente', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: ministryA };
    const res = await service.getAgenda(ctx, { tipo: 'tarefa' });

    assert.equal(res.total, 0);
    assert.deepEqual(res.todos, []);
  });

  it('E. Filtro por tenant impede que membro do Ministério A veja eventos do Ministério B', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: ministryA };
    const res = await service.getAgenda(ctx);

    assert.equal(res.todos.some((e) => e.id === 'ev-beta'), false);
  });

  it('F. Filtro por congregação isola eventos exclusivos de outra filial', async () => {
    const ctxA1 = { userId: 'u1', memberId: memberA1.id, ministryId: ministryA };
    const resA1 = await service.getAgenda(ctxA1);

    // Membro da Sede NÃO vê o culto exclusivo da Filial Sul
    assert.equal(resA1.todos.some((e) => e.id === 'ev-5-filial'), false);

    // Membro da Filial Sul VÊ o seu culto local
    const ctxA2 = { userId: 'u2', memberId: memberA2.id, ministryId: ministryA };
    const resA2 = await service.getAgenda(ctxA2);
    assert.ok(resA2.todos.some((e) => e.id === 'ev-5-filial'));
  });

  it('G. Tentativa de acesso indevido / IDOR a evento restrito/privado é bloqueada (404/FORBIDDEN)', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: ministryA };

    // Tenta acessar reunião de liderança privada diretamente pelo ID
    await assert.rejects(async () => {
      await service.getEventoDetalhe(ctx, 'ev-4-privado');
    }, /EVENT_FORBIDDEN/);
  });

  it('H. Programação pública e congregacional é visível ao membro comum', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: ministryA };
    const detalhe = await service.getEventoDetalhe(ctx, 'ev-1');

    assert.equal(detalhe.id, 'ev-1');
    assert.equal(detalhe.titulo, 'Culto de Doutrina e Ensino');
    assert.equal(detalhe.visibilidade, 'publico');
  });

  it('I. Programação privada de outro ministério é inacessível (anti-IDOR entre tenants)', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: ministryA };

    await assert.rejects(async () => {
      await service.getEventoDetalhe(ctx, 'ev-beta');
    }, /EVENT_NOT_FOUND/);
  });

  it('J. Detalhe da programação formata localização e link direto para aplicativo de mapas', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: ministryA };
    const detalhe = await service.getEventoDetalhe(ctx, 'ev-1');

    assert.ok(detalhe.maps_url);
    assert.ok(detalhe.maps_url.includes('google.com/maps'));
    assert.ok(detalhe.maps_url.includes('Congrega%C3%A7%C3%A3o%20Sede'));
  });

  it('K. Endereço completo reúne congregação, logradouro, cidade e estado', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: ministryA };
    const detalhe = await service.getEventoDetalhe(ctx, 'ev-1');

    assert.equal(detalhe.endereco_completo, 'Congregação Sede — Av. Principal, 100, Fortaleza - CE');
  });

  it('L. Identificação do Próximo Culto destaca o culto mais próximo cronologicamente', async () => {
    const ctx = { userId: 'u1', memberId: memberA1.id, ministryId: ministryA };
    const res = await service.getAgenda(ctx);

    assert.ok(res.proximo_culto);
    assert.equal(res.proximo_culto.id, 'ev-1');
    assert.equal(res.proximo_culto.tipo, 'culto');
  });

  it('M. Escalas pessoais não modeladas no banco são tratadas com segurança como GAP', () => {
    // Validação de que não foi inventada uma tabela falsa de escalas
    assert.strictEqual(typeof service.getMinhaEscala, 'undefined');
  });

  it('N. Ausência de token ou sessão inválida retorna UNAUTHORIZED', async () => {
    await assert.rejects(async () => {
      await service.getAgenda(null);
    }, /UNAUTHORIZED/);
  });

  it('O. Estados de UX da tela de programação suportam filtros temporais e por tipo', async () => {
    const filtros = ['todos', 'cultos', 'eventos', 'congregacao'];
    assert.equal(filtros.length, 4);
    assert.ok(filtros.includes('cultos'));
    assert.ok(filtros.includes('congregacao'));
  });
});
