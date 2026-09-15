import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Bateria de Testes Automatizados da FASE E.8.2 — API Mobile Oficial de Aniversariantes
 *
 * Cobertura de Testes:
 * A. GET lista autenticado retorna lista formatada
 * B. 401 sem autenticação (token nulo/inválido)
 * C. Período default é 'mes'
 * D. Período 'hoje' retorna apenas aniversariantes do dia corrente
 * E. Período 'proximos_30' retorna aniversariantes nos próximos 30 dias
 * F. Período inválido retorna 400
 * G. Escopo default é 'minha_congregacao' e filtra pela congregação do membro
 * H. Escopo 'todas' retorna aniversariantes de todas as congregações do tenant
 * I. Escopo inválido retorna 400
 * J. Rigorosa privacidade: Não expõe idade, idadeAtual, idadeCompletara nem ano de nascimento
 * K. Rigorosa privacidade: Não expõe CPF, RG, telefone, celular, whatsapp, endereço nem e-mail
 * L. Membro inativo (status != 'active') NÃO aparece
 * M. Membro sem data de nascimento (null) NÃO causa erro e é ignorado
 * N. Membro de outro ministério (cross-tenant) NÃO aparece
 * O. Tentativa de forjar ministry_id ou congregacao_id pelo cliente é ignorada
 * P. Membro autenticado sem congregação (congregacao_id = null) funciona corretamente
 * Q. Ordenação correta (dia crescente para mês/hoje e proximidade para proximos_30)
 */

function isBirthdayInNextDays(birthDateStr, daysCount, referenceDate = new Date()) {
  if (!birthDateStr) return false;
  const parts = birthDateStr.split('T')[0].split('-');
  if (parts.length !== 3) return false;
  const birthMonth = parseInt(parts[1], 10) - 1;
  const birthDay = parseInt(parts[2], 10);

  const refYear = referenceDate.getFullYear();
  let nextBday = new Date(refYear, birthMonth, birthDay);
  const refMidnight = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  if (nextBday < refMidnight) {
    nextBday = new Date(refYear + 1, birthMonth, birthDay);
  }

  const diffTime = nextBday.getTime() - refMidnight.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  return diffDays >= 0 && diffDays <= daysCount;
}

class MockMobileAniversariantesApiService {
  constructor() {
    this.members = [];
    this.congregacoes = [];
  }

  // Simula GET /api/v1/mobile/aniversariantes
  async getAniversariantes(ctx, searchParams = {}, refDate = new Date()) {
    if (!ctx || !ctx.memberId) throw new Error('UNAUTHORIZED');

    const authMember = this.members.find(
      (m) => m.id === ctx.memberId && m.ministry_id === ctx.ministryId
    );
    if (!authMember) throw new Error('MEMBER_NOT_FOUND');

    const periodo = (searchParams.periodo || 'mes').toLowerCase();
    const escopo = (searchParams.escopo || 'minha_congregacao').toLowerCase();

    if (!['hoje', 'mes', 'proximos_30'].includes(periodo)) {
      throw new Error('INVALID_PERIODO');
    }

    if (!['minha_congregacao', 'todas'].includes(escopo)) {
      throw new Error('INVALID_ESCOPO');
    }

    const currentMonth = refDate.getMonth() + 1;
    const currentDay = refDate.getDate();

    // Filtra membros por ministry e status ativo
    let filtrados = this.members.filter((m) => {
      if (m.ministry_id !== ctx.ministryId) return false;
      if (m.status !== 'active') return false;
      if (!m.data_nascimento) return false;

      // Escopo
      if (escopo === 'minha_congregacao') {
        if (authMember.congregacao_id) {
          return m.congregacao_id === authMember.congregacao_id;
        } else {
          return m.congregacao_id === null || m.congregacao_id === undefined;
        }
      }

      return true;
    });

    const resultado = [];

    for (const m of filtrados) {
      const parts = m.data_nascimento.split('T')[0].split('-');
      if (parts.length !== 3) continue;

      const birthMonth = parseInt(parts[1], 10);
      const birthDay = parseInt(parts[2], 10);

      const isHoje = birthMonth === currentMonth && birthDay === currentDay;

      let match = false;
      if (periodo === 'hoje') {
        match = isHoje;
      } else if (periodo === 'mes') {
        match = birthMonth === currentMonth;
      } else if (periodo === 'proximos_30') {
        match = isBirthdayInNextDays(m.data_nascimento, 30, refDate);
      }

      if (match) {
        const cong = this.congregacoes.find((cg) => cg.id === m.congregacao_id);
        // Payload estritamente sanitizado
        resultado.push({
          id: m.id,
          nome: m.name || 'Sem Nome',
          dia: birthDay,
          mes: birthMonth,
          isHoje,
          foto_url: m.foto_url || null,
          cargo_ministerial: m.cargo_ministerial || null,
          congregacao_nome: cong?.nome || null,
        });
      }
    }

    if (periodo === 'proximos_30') {
      resultado.sort((a, b) => {
        const getDiffDays = (item) => {
          let bday = new Date(refDate.getFullYear(), item.mes - 1, item.dia);
          const ref = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
          if (bday < ref) bday = new Date(refDate.getFullYear() + 1, item.mes - 1, item.dia);
          return bday.getTime() - ref.getTime();
        };
        const diff = getDiffDays(a) - getDiffDays(b);
        if (diff !== 0) return diff;
        return a.nome.localeCompare(b.nome);
      });
    } else {
      resultado.sort((a, b) => {
        if (a.dia !== b.dia) return a.dia - b.dia;
        return a.nome.localeCompare(b.nome);
      });
    }

    return {
      aniversariantes: resultado,
      total: resultado.length,
      periodo,
      escopo,
    };
  }
}

describe('FASE E.8.2 — API Mobile Oficial de Aniversariantes', () => {
  const minAlpha = 'min-alpha-uuid';
  const minBeta = 'min-beta-uuid';
  const congSede = 'cong-alpha-sede';
  const congFilial = 'cong-alpha-filial';
  const congBeta = 'cong-beta-sede';

  // Fixar data de referência para testes reprodutíveis (ex: 15 de Setembro de 2026)
  const fixedDate = new Date(2026, 8, 15); // 15/09/2026

  let service;

  beforeEach(() => {
    service = new MockMobileAniversariantesApiService();
    service.congregacoes = [
      { id: congSede, ministry_id: minAlpha, nome: 'Congregação Central Sede' },
      { id: congFilial, ministry_id: minAlpha, nome: 'Congregação Filial Norte' },
      { id: congBeta, ministry_id: minBeta, nome: 'Igreja Beta' },
    ];

    service.members = [
      // Membro 1: Sede, faz aniversário hoje (15/09)
      {
        id: 'mem-1',
        ministry_id: minAlpha,
        congregacao_id: congSede,
        name: 'Membro Aniversariante Hoje Sede',
        status: 'active',
        data_nascimento: '1990-09-15',
        foto_url: 'https://cdn.test/foto1.jpg',
        cargo_ministerial: 'Diácono',
        cpf: '123.456.789-00',
        phone: '1199999999',
        whatsapp: '1199999999',
        logradouro: 'Rua A',
      },
      // Membro 2: Sede, faz aniversário dia 25/09 (mesmo mês)
      {
        id: 'mem-2',
        ministry_id: minAlpha,
        congregacao_id: congSede,
        name: 'Membro Fim do Mês Sede',
        status: 'active',
        data_nascimento: '1985-09-25',
        foto_url: null,
        cargo_ministerial: null,
      },
      // Membro 3: Sede, faz aniversário dia 05/10 (próximos 30 dias, mas mês seguinte)
      {
        id: 'mem-3',
        ministry_id: minAlpha,
        congregacao_id: congSede,
        name: 'Membro Outubro Sede',
        status: 'active',
        data_nascimento: '1995-10-05',
      },
      // Membro 4: Filial, faz aniversário dia 15/09 (hoje, mas outra congregação)
      {
        id: 'mem-4',
        ministry_id: minAlpha,
        congregacao_id: congFilial,
        name: 'Membro Hoje Filial',
        status: 'active',
        data_nascimento: '1992-09-15',
        cargo_ministerial: 'Pastor',
      },
      // Membro 5: Filial, faz aniversário dia 20/09 (mesmo mês, filial)
      {
        id: 'mem-5',
        ministry_id: minAlpha,
        congregacao_id: congFilial,
        name: 'Membro Mês Filial',
        status: 'active',
        data_nascimento: '1988-09-20',
      },
      // Membro 6: Inativo na Sede (não deve aparecer)
      {
        id: 'mem-6',
        ministry_id: minAlpha,
        congregacao_id: congSede,
        name: 'Membro Inativo',
        status: 'inactive',
        data_nascimento: '1990-09-15',
      },
      // Membro 7: Sede sem data de nascimento
      {
        id: 'mem-7',
        ministry_id: minAlpha,
        congregacao_id: congSede,
        name: 'Membro Sem Data',
        status: 'active',
        data_nascimento: null,
      },
      // Membro 8: Outro ministério Beta (cross-tenant)
      {
        id: 'mem-8',
        ministry_id: minBeta,
        congregacao_id: congBeta,
        name: 'Membro Beta',
        status: 'active',
        data_nascimento: '1990-09-15',
      },
      // Membro 9: Sem congregação definida (congregacao_id = null)
      {
        id: 'mem-9',
        ministry_id: minAlpha,
        congregacao_id: null,
        name: 'Membro Sem Congregacao',
        status: 'active',
        data_nascimento: '1990-09-15',
      },
    ];
  });

  it('A. GET lista autenticado retorna lista formatada', async () => {
    const ctx = { userId: 'u1', memberId: 'mem-1', ministryId: minAlpha };
    const res = await service.getAniversariantes(ctx, {}, fixedDate);

    assert.ok(Array.isArray(res.aniversariantes));
    assert.strictEqual(res.periodo, 'mes');
    assert.strictEqual(res.escopo, 'minha_congregacao');
    assert.strictEqual(res.total, 2); // mem-1 (dia 15) e mem-2 (dia 25) da Sede
    assert.strictEqual(res.aniversariantes[0].id, 'mem-1');
    assert.strictEqual(res.aniversariantes[0].nome, 'Membro Aniversariante Hoje Sede');
    assert.strictEqual(res.aniversariantes[0].dia, 15);
    assert.strictEqual(res.aniversariantes[0].mes, 9);
    assert.strictEqual(res.aniversariantes[0].isHoje, true);
    assert.strictEqual(res.aniversariantes[0].cargo_ministerial, 'Diácono');
    assert.strictEqual(res.aniversariantes[0].congregacao_nome, 'Congregação Central Sede');
  });

  it('B. 401 sem autenticação (token nulo)', async () => {
    await assert.rejects(
      async () => {
        await service.getAniversariantes(null, {}, fixedDate);
      },
      { message: 'UNAUTHORIZED' }
    );
  });

  it('C. Período default é "mes"', async () => {
    const ctx = { userId: 'u1', memberId: 'mem-1', ministryId: minAlpha };
    const res = await service.getAniversariantes(ctx, {}, fixedDate);
    assert.strictEqual(res.periodo, 'mes');
    // mem-1 (15/09) e mem-2 (25/09)
    assert.strictEqual(res.aniversariantes.length, 2);
  });

  it('D. Período "hoje" retorna apenas aniversariantes do dia de hoje', async () => {
    const ctx = { userId: 'u1', memberId: 'mem-1', ministryId: minAlpha };
    const res = await service.getAniversariantes(ctx, { periodo: 'hoje' }, fixedDate);

    assert.strictEqual(res.periodo, 'hoje');
    assert.strictEqual(res.aniversariantes.length, 1);
    assert.strictEqual(res.aniversariantes[0].id, 'mem-1');
    assert.strictEqual(res.aniversariantes[0].isHoje, true);
  });

  it('E. Período "proximos_30" retorna aniversariantes nos próximos 30 dias', async () => {
    const ctx = { userId: 'u1', memberId: 'mem-1', ministryId: minAlpha };
    const res = await service.getAniversariantes(ctx, { periodo: 'proximos_30' }, fixedDate);

    assert.strictEqual(res.periodo, 'proximos_30');
    // Na Sede: mem-1 (15/09), mem-2 (25/09) e mem-3 (05/10 - 20 dias depois)
    assert.strictEqual(res.aniversariantes.length, 3);
    assert.strictEqual(res.aniversariantes[0].id, 'mem-1'); // 0 dias
    assert.strictEqual(res.aniversariantes[1].id, 'mem-2'); // 10 dias
    assert.strictEqual(res.aniversariantes[2].id, 'mem-3'); // 20 dias
  });

  it('F. Período inválido retorna 400 (INVALID_PERIODO)', async () => {
    const ctx = { userId: 'u1', memberId: 'mem-1', ministryId: minAlpha };
    await assert.rejects(
      async () => {
        await service.getAniversariantes(ctx, { periodo: 'ano_inteiro' }, fixedDate);
      },
      { message: 'INVALID_PERIODO' }
    );
  });

  it('G. Escopo default é "minha_congregacao" e filtra pela congregação do membro', async () => {
    const ctx = { userId: 'u1', memberId: 'mem-1', ministryId: minAlpha };
    const res = await service.getAniversariantes(ctx, {}, fixedDate);

    // mem-4 e mem-5 são da filial e NÃO devem aparecer
    assert.strictEqual(res.escopo, 'minha_congregacao');
    assert.strictEqual(res.aniversariantes.some((a) => a.id === 'mem-4'), false);
    assert.strictEqual(res.aniversariantes.some((a) => a.id === 'mem-5'), false);
  });

  it('H. Escopo "todas" retorna aniversariantes de todas as congregações do ministério', async () => {
    const ctx = { userId: 'u1', memberId: 'mem-1', ministryId: minAlpha };
    const res = await service.getAniversariantes(ctx, { escopo: 'todas', periodo: 'mes' }, fixedDate);

    assert.strictEqual(res.escopo, 'todas');
    // Membros do mês em todas as congregações do Alpha: mem-1 (Sede), mem-2 (Sede), mem-4 (Filial), mem-5 (Filial), mem-9 (Sem cong)
    assert.strictEqual(res.total, 5);
    assert.ok(res.aniversariantes.some((a) => a.id === 'mem-1'));
    assert.ok(res.aniversariantes.some((a) => a.id === 'mem-4'));
  });

  it('I. Escopo inválido retorna 400 (INVALID_ESCOPO)', async () => {
    const ctx = { userId: 'u1', memberId: 'mem-1', ministryId: minAlpha };
    await assert.rejects(
      async () => {
        await service.getAniversariantes(ctx, { escopo: 'global' }, fixedDate);
      },
      { message: 'INVALID_ESCOPO' }
    );
  });

  it('J. Rigorosa privacidade: Não expõe idade, idadeAtual, idadeCompletara nem ano de nascimento', async () => {
    const ctx = { userId: 'u1', memberId: 'mem-1', ministryId: minAlpha };
    const res = await service.getAniversariantes(ctx, {}, fixedDate);

    const item = res.aniversariantes[0];
    assert.strictEqual(item.data_nascimento, undefined);
    assert.strictEqual(item.idade, undefined);
    assert.strictEqual(item.idadeAtual, undefined);
    assert.strictEqual(item.idadeCompletara, undefined);
    assert.strictEqual(item.ano, undefined);
  });

  it('K. Rigorosa privacidade: Não expõe CPF, RG, telefone, celular, whatsapp, endereço nem e-mail', async () => {
    const ctx = { userId: 'u1', memberId: 'mem-1', ministryId: minAlpha };
    const res = await service.getAniversariantes(ctx, {}, fixedDate);

    const item = res.aniversariantes[0];
    assert.strictEqual(item.cpf, undefined);
    assert.strictEqual(item.rg, undefined);
    assert.strictEqual(item.phone, undefined);
    assert.strictEqual(item.celular, undefined);
    assert.strictEqual(item.whatsapp, undefined);
    assert.strictEqual(item.logradouro, undefined);
    assert.strictEqual(item.email, undefined);
  });

  it('L. Membro inativo (status != "active") NÃO aparece', async () => {
    const ctx = { userId: 'u1', memberId: 'mem-1', ministryId: minAlpha };
    const res = await service.getAniversariantes(ctx, { escopo: 'todas' }, fixedDate);

    assert.strictEqual(res.aniversariantes.some((a) => a.id === 'mem-6'), false);
  });

  it('M. Membro sem data de nascimento (null) é ignorado e não gera erro', async () => {
    const ctx = { userId: 'u1', memberId: 'mem-1', ministryId: minAlpha };
    const res = await service.getAniversariantes(ctx, { escopo: 'todas' }, fixedDate);

    assert.strictEqual(res.aniversariantes.some((a) => a.id === 'mem-7'), false);
  });

  it('N. Membro de outro ministério (cross-tenant) NÃO aparece', async () => {
    const ctx = { userId: 'u1', memberId: 'mem-1', ministryId: minAlpha };
    const res = await service.getAniversariantes(ctx, { escopo: 'todas' }, fixedDate);

    assert.strictEqual(res.aniversariantes.some((a) => a.id === 'mem-8'), false);
  });

  it('O. Tentativa de forjar ministry_id ou congregacao_id pelo cliente é ignorada', async () => {
    const ctx = { userId: 'u1', memberId: 'mem-1', ministryId: minAlpha };
    const res = await service.getAniversariantes(
      ctx,
      { ministry_id: minBeta, congregacao_id: congFilial },
      fixedDate
    );

    // Escopo default respeita a congregação do token (Sede), não do queryParam
    assert.strictEqual(res.aniversariantes.some((a) => a.id === 'mem-4'), false);
    assert.strictEqual(res.aniversariantes.some((a) => a.id === 'mem-8'), false);
  });

  it('P. Membro autenticado sem congregação (congregacao_id = null) funciona com segurança', async () => {
    const ctx = { userId: 'u9', memberId: 'mem-9', ministryId: minAlpha };
    const res = await service.getAniversariantes(ctx, {}, fixedDate);

    assert.strictEqual(res.total, 1);
    assert.strictEqual(res.aniversariantes[0].id, 'mem-9');
    assert.strictEqual(res.aniversariantes[0].congregacao_nome, null);
  });

  it('Q. Ordenação correta: dia crescente para mês e proximidade em dias para próximos 30', async () => {
    const ctx = { userId: 'u1', memberId: 'mem-1', ministryId: minAlpha };
    const resMes = await service.getAniversariantes(ctx, { periodo: 'mes' }, fixedDate);

    assert.strictEqual(resMes.aniversariantes[0].dia, 15);
    assert.strictEqual(resMes.aniversariantes[1].dia, 25);

    const resProx = await service.getAniversariantes(ctx, { periodo: 'proximos_30' }, fixedDate);
    assert.strictEqual(resProx.aniversariantes[0].id, 'mem-1'); // hoje (dia 15/09)
    assert.strictEqual(resProx.aniversariantes[1].id, 'mem-2'); // +10 dias (dia 25/09)
    assert.strictEqual(resProx.aniversariantes[2].id, 'mem-3'); // +20 dias (dia 05/10)
  });
});
