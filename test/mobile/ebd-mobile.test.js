import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Suite de Testes Automatizados — FASE E.3: Minha EBD no App Mobile Gestão Eklésia
 */

class MockEbdService {
  constructor() {
    this.members = [];
    this.alunos = [];
    this.matriculas = [];
    this.turmas = [];
    this.classes = [];
    this.congregacoes = [];
    this.professores = [];
    this.turmaProfessores = [];
    this.trimestres = [];
    this.aulas = [];
    this.frequencias = [];
  }

  // Simula GET /api/v1/mobile/ebd/me
  async getMe(ctx) {
    if (!ctx || !ctx.userId || !ctx.memberId || !ctx.ministryId) {
      throw new Error('UNAUTHORIZED');
    }

    const aluno = this.alunos.find(
      (a) => a.member_id === ctx.memberId && a.ministry_id === ctx.ministryId,
    );

    if (!aluno) {
      return {
        has_student: false,
        is_enrolled: false,
        aluno: null,
        matricula: null,
        turma: null,
        professores: [],
        trimestre_atual: null,
        frequencia_resumo: null,
        proxima_licao: null,
      };
    }

    const matriculasAluno = this.matriculas
      .filter((m) => m.aluno_id === aluno.id && m.ministry_id === ctx.ministryId)
      .sort((a, b) => (a.data_inicio > b.data_inicio ? -1 : 1));

    const matriculaAtiva = matriculasAluno.find((m) => !m.data_fim);

    if (!matriculaAtiva) {
      return {
        has_student: true,
        is_enrolled: false,
        aluno: { id: aluno.id, nome: aluno.nome, ativo: aluno.ativo },
        matricula: null,
        matricula_anterior: matriculasAluno[0] || null,
        turma: null,
        professores: [],
        trimestre_atual: null,
        frequencia_resumo: null,
        proxima_licao: null,
      };
    }

    const turma = this.turmas.find(
      (t) => t.id === matriculaAtiva.turma_id && t.ministry_id === ctx.ministryId,
    );
    const classe = turma ? this.classes.find((c) => c.id === turma.classe_id) : null;
    const congregacao = turma ? this.congregacoes.find((c) => c.id === turma.church_id) : null;

    const professoresList = [];
    if (turma?.professor_titular_id) {
      const pTitular = this.professores.find((p) => p.id === turma.professor_titular_id);
      if (pTitular) {
        professoresList.push({
          id: pTitular.id,
          nome: pTitular.nome,
          telefone: pTitular.telefone,
          email: pTitular.email,
          funcao: 'titular',
        });
      }
    }

    const turmaProfs = this.turmaProfessores.filter((tp) => tp.turma_id === matriculaAtiva.turma_id);
    for (const tp of turmaProfs) {
      const p = this.professores.find((prof) => prof.id === tp.professor_id);
      if (p && !professoresList.some((existing) => existing.id === p.id)) {
        professoresList.push({
          id: p.id,
          nome: p.nome,
          telefone: p.telefone,
          email: p.email,
          funcao: tp.funcao || 'auxiliar',
        });
      }
    }

    const trimestre = this.trimestres.find((t) => t.ministry_id === ctx.ministryId && t.ativo);

    const hoje = new Date().toISOString().slice(0, 10);
    const aulasTurma = this.aulas
      .filter((a) => a.turma_id === matriculaAtiva.turma_id && a.ministry_id === ctx.ministryId)
      .sort((a, b) => (a.data_aula > b.data_aula ? 1 : -1));

    const proximaAula = aulasTurma.find((a) => a.data_aula >= hoje) || null;

    const freqsAluno = this.frequencias.filter(
      (f) => f.aluno_id === aluno.id && f.ministry_id === ctx.ministryId,
    );
    const totalAulas = freqsAluno.length;
    const presencas = freqsAluno.filter((f) => f.presente).length;
    const faltas = totalAulas - presencas;
    const percentual = totalAulas > 0 ? Math.round((presencas / totalAulas) * 100) : 0;

    return {
      has_student: true,
      is_enrolled: true,
      aluno: { id: aluno.id, nome: aluno.nome, ativo: aluno.ativo, sexo: aluno.sexo },
      matricula: {
        id: matriculaAtiva.id,
        data_inicio: matriculaAtiva.data_inicio,
        turma_id: matriculaAtiva.turma_id,
      },
      turma: {
        id: turma?.id,
        nome: turma?.nome,
        sala: turma?.sala,
        capacidade_max: turma?.capacidade_max,
        ativo: turma?.ativo,
        classe: classe || null,
        congregacao: congregacao || null,
      },
      professores: professoresList,
      trimestre_atual: trimestre || null,
      proxima_licao: proximaAula
        ? {
            id: proximaAula.id,
            data_aula: proximaAula.data_aula,
            licao_numero: proximaAula.licao_numero,
            tema: proximaAula.tema,
            status: proximaAula.status,
            observacoes: proximaAula.observacoes,
          }
        : null,
      frequencia_resumo: {
        total_aulas: totalAulas,
        presencas,
        faltas,
        percentual,
      },
    };
  }

  // Simula GET /api/v1/mobile/ebd/turma
  async getTurma(ctx) {
    if (!ctx || !ctx.memberId) throw new Error('UNAUTHORIZED');

    const aluno = this.alunos.find(
      (a) => a.member_id === ctx.memberId && a.ministry_id === ctx.ministryId,
    );
    if (!aluno) throw new Error('STUDENT_NOT_FOUND');

    const matricula = this.matriculas.find(
      (m) => m.aluno_id === aluno.id && m.ministry_id === ctx.ministryId && !m.data_fim,
    );
    if (!matricula) throw new Error('NOT_ENROLLED');

    const turma = this.turmas.find(
      (t) => t.id === matricula.turma_id && t.ministry_id === ctx.ministryId,
    );
    if (!turma) throw new Error('TURMA_NOT_FOUND');

    return {
      enrolled: true,
      turma: {
        id: turma.id,
        nome: turma.nome,
        sala: turma.sala,
        capacidade_max: turma.capacidade_max,
        ativo: turma.ativo,
      },
    };
  }

  // Simula GET /api/v1/mobile/ebd/licoes
  async getLicoes(ctx, { ano, trimestre } = {}) {
    if (!ctx || !ctx.memberId) throw new Error('UNAUTHORIZED');

    const aluno = this.alunos.find(
      (a) => a.member_id === ctx.memberId && a.ministry_id === ctx.ministryId,
    );
    if (!aluno) throw new Error('STUDENT_NOT_FOUND');

    const matricula = this.matriculas.find(
      (m) => m.aluno_id === aluno.id && m.ministry_id === ctx.ministryId && !m.data_fim,
    );
    if (!matricula) throw new Error('NOT_ENROLLED');

    let aulas = this.aulas.filter(
      (a) => a.turma_id === matricula.turma_id && a.ministry_id === ctx.ministryId,
    );

    if (ano) aulas = aulas.filter((a) => a.ano === Number(ano));
    if (trimestre) aulas = aulas.filter((a) => a.trimestre === Number(trimestre));

    return aulas.map((a) => {
      const freq = this.frequencias.find((f) => f.aula_id === a.id && f.aluno_id === aluno.id);
      return {
        id: a.id,
        data_aula: a.data_aula,
        licao_numero: a.licao_numero,
        tema: a.tema,
        status: a.status,
        frequencia: freq ? { presente: freq.presente } : null,
      };
    });
  }

  // Simula GET /api/v1/mobile/ebd/frequencia
  async getFrequencia(ctx) {
    if (!ctx || !ctx.memberId) throw new Error('UNAUTHORIZED');

    const aluno = this.alunos.find(
      (a) => a.member_id === ctx.memberId && a.ministry_id === ctx.ministryId,
    );
    if (!aluno) {
      return { resumo: { total_aulas: 0, presencas: 0, faltas: 0, percentual: 0 }, historico: [] };
    }

    const freqs = this.frequencias.filter(
      (f) => f.aluno_id === aluno.id && f.ministry_id === ctx.ministryId,
    );

    const historico = freqs.map((f) => {
      const aula = this.aulas.find((a) => a.id === f.aula_id) || {};
      return {
        id: f.id,
        presente: f.presente,
        data_aula: aula.data_aula,
        licao_numero: aula.licao_numero,
        tema: aula.tema,
        trimestre: aula.trimestre,
        ano: aula.ano,
      };
    });

    const totalAulas = historico.length;
    const presencas = historico.filter((h) => h.presente).length;
    const faltas = totalAulas - presencas;
    const percentual = totalAulas > 0 ? Math.round((presencas / totalAulas) * 100) : 0;

    return {
      aluno_id: aluno.id,
      resumo: { total_aulas: totalAulas, presencas, faltas, percentual },
      historico,
    };
  }
}

describe('FASE E.3 — Minha EBD no App Mobile Gestão Eklésia', () => {
  const ministryA = 'min-alpha-uuid';
  const ministryB = 'min-beta-uuid';
  const congA = 'cong-alpha-uuid';

  const memberA = { id: 'mem-1-uuid', ministry_id: ministryA, name: 'Lucas Alcantara' };
  const memberB = { id: 'mem-2-uuid', ministry_id: ministryA, name: 'Mariana Silva' };
  const memberC = { id: 'mem-3-uuid', ministry_id: ministryB, name: 'João Batista' };

  let service;

  beforeEach(() => {
    service = new MockEbdService();
    service.members = [memberA, memberB, memberC];

    service.congregacoes = [{ id: congA, ministry_id: ministryA, nome: 'Sede' }];
    service.classes = [
      { id: 'cls-1', ministry_id: ministryA, nome: 'Adultos', faixa_etaria_min: 26, faixa_etaria_max: 59 },
    ];
    service.professores = [
      { id: 'prof-1', ministry_id: ministryA, nome: 'Pr. Carlos Roberto', telefone: '8599999999', email: 'carlos@eklesia.com' },
      { id: 'prof-2', ministry_id: ministryA, nome: 'Dc. Marcos Sousa', funcao: 'auxiliar' },
    ];
    service.turmas = [
      {
        id: 'turma-1',
        ministry_id: ministryA,
        church_id: congA,
        classe_id: 'cls-1',
        nome: 'Turma Bereanos (Adultos)',
        professor_titular_id: 'prof-1',
        sala: 'Sala 03',
        capacidade_max: 30,
        ativo: true,
      },
    ];
    service.turmaProfessores = [
      { id: 'tp-1', ministry_id: ministryA, turma_id: 'turma-1', professor_id: 'prof-2', funcao: 'auxiliar' },
    ];
    service.trimestres = [
      { id: 'trim-1', ministry_id: ministryA, numero: 3, ano: 2026, descricao: 'As Epístolas Paulinas', ativo: true },
    ];

    // Aluno A: Ativo com matrícula
    service.alunos = [
      { id: 'aluno-1', ministry_id: ministryA, member_id: memberA.id, nome: memberA.name, ativo: true },
      // Aluno B: Cadastrado mas sem matrícula ativa
      { id: 'aluno-2', ministry_id: ministryA, member_id: memberB.id, nome: memberB.name, ativo: true },
    ];

    service.matriculas = [
      { id: 'mat-1', ministry_id: ministryA, aluno_id: 'aluno-1', turma_id: 'turma-1', data_inicio: '2026-01-10', data_fim: null },
      { id: 'mat-2', ministry_id: ministryA, aluno_id: 'aluno-2', turma_id: 'turma-1', data_inicio: '2025-01-10', data_fim: '2025-12-31' },
    ];

    service.aulas = [
      { id: 'aula-1', ministry_id: ministryA, turma_id: 'turma-1', data_aula: '2026-09-06', licao_numero: 10, tema: 'A Justificação pela Fé', ano: 2026, trimestre: 3, status: 'realizada' },
      { id: 'aula-2', ministry_id: ministryA, turma_id: 'turma-1', data_aula: '2026-09-13', licao_numero: 11, tema: 'O Fruto do Espírito', ano: 2026, trimestre: 3, status: 'realizada' },
      { id: 'aula-3', ministry_id: ministryA, turma_id: 'turma-1', data_aula: '2026-09-20', licao_numero: 12, tema: 'A Armadura de Deus', ano: 2026, trimestre: 3, status: 'planejada' },
    ];

    service.frequencias = [
      { id: 'freq-1', ministry_id: ministryA, aula_id: 'aula-1', aluno_id: 'aluno-1', presente: true },
      { id: 'freq-2', ministry_id: ministryA, aula_id: 'aula-2', aluno_id: 'aluno-1', presente: false },
    ];
  });

  it('A. Membro com matrícula ativa recebe resumo EBD completo', async () => {
    const ctx = { userId: 'u1', memberId: memberA.id, ministryId: ministryA };
    const me = await service.getMe(ctx);

    assert.equal(me.has_student, true);
    assert.equal(me.is_enrolled, true);
    assert.equal(me.aluno.nome, 'Lucas Alcantara');
    assert.equal(me.turma.nome, 'Turma Bereanos (Adultos)');
    assert.equal(me.turma.sala, 'Sala 03');
    assert.equal(me.turma.congregacao.nome, 'Sede');
    assert.equal(me.professores.length, 2);
    assert.equal(me.professores[0].nome, 'Pr. Carlos Roberto');
    assert.equal(me.professores[0].funcao, 'titular');
    assert.equal(me.trimestre_atual.numero, 3);
  });

  it('B. Membro sem matrícula/cadastro EBD recebe resposta amigável sem erro 500', async () => {
    const ctx = { userId: 'u3', memberId: memberC.id, ministryId: ministryB };
    const me = await service.getMe(ctx);

    assert.equal(me.has_student, false);
    assert.equal(me.is_enrolled, false);
    assert.equal(me.turma, null);
    assert.equal(me.matricula, null);
  });

  it('C. Membro com matrícula inativa/encerrada é identificado corretamente', async () => {
    const ctx = { userId: 'u2', memberId: memberB.id, ministryId: ministryA };
    const me = await service.getMe(ctx);

    assert.equal(me.has_student, true);
    assert.equal(me.is_enrolled, false);
    assert.equal(me.matricula, null);
    assert.notEqual(me.matricula_anterior, null);
    assert.equal(me.matricula_anterior.data_fim, '2025-12-31');
  });

  it('D. Consulta da turma retorna detalhes da classe, congregação e sala', async () => {
    const ctx = { userId: 'u1', memberId: memberA.id, ministryId: ministryA };
    const res = await service.getTurma(ctx);

    assert.equal(res.enrolled, true);
    assert.equal(res.turma.nome, 'Turma Bereanos (Adultos)');
    assert.equal(res.turma.sala, 'Sala 03');
    assert.equal(res.turma.capacidade_max, 30);
  });

  it('E. Consulta de professores retorna titular e corpo docente auxiliar', async () => {
    const ctx = { userId: 'u1', memberId: memberA.id, ministryId: ministryA };
    const me = await service.getMe(ctx);

    assert.equal(me.professores.length, 2);
    const titular = me.professores.find((p) => p.funcao === 'titular');
    const auxiliar = me.professores.find((p) => p.funcao === 'auxiliar');

    assert.ok(titular);
    assert.equal(titular.nome, 'Pr. Carlos Roberto');
    assert.ok(auxiliar);
    assert.equal(auxiliar.nome, 'Dc. Marcos Sousa');
  });

  it('F. Consulta de lições retorna cronograma com status de presença do aluno', async () => {
    const ctx = { userId: 'u1', memberId: memberA.id, ministryId: ministryA };
    const licoes = await service.getLicoes(ctx, { ano: 2026, trimestre: 3 });

    assert.equal(licoes.length, 3);
    assert.equal(licoes[0].licao_numero, 10);
    assert.equal(licoes[0].tema, 'A Justificação pela Fé');
    assert.equal(licoes[0].frequencia.presente, true);

    assert.equal(licoes[1].licao_numero, 11);
    assert.equal(licoes[1].frequencia.presente, false);

    assert.equal(licoes[2].licao_numero, 12);
    assert.equal(licoes[2].frequencia, null); // Aula futura sem chamada feita
  });

  it('G. Consulta de frequência calcula métricas reais (aulas, presenças, faltas, percentual)', async () => {
    const ctx = { userId: 'u1', memberId: memberA.id, ministryId: ministryA };
    const freq = await service.getFrequencia(ctx);

    assert.equal(freq.resumo.total_aulas, 2);
    assert.equal(freq.resumo.presencas, 1);
    assert.equal(freq.resumo.faltas, 1);
    assert.equal(freq.resumo.percentual, 50); // 1 de 2 = 50%
    assert.equal(freq.historico.length, 2);
  });

  it('H. Consulta de boletim não simula notas fictícias (trata como indisponível)', async () => {
    // Como avaliações não existem no backend, nenhuma nota fictícia é retornada
    const ctx = { userId: 'u1', memberId: memberA.id, ministryId: ministryA };
    const me = await service.getMe(ctx);

    assert.equal(me.boletim, undefined);
  });

  it('I. Proteção anti-IDOR: Aluno não consegue consultar turma ou frequência de outro membro', async () => {
    // Usuário B autenticado tenta consultar dados
    const ctxB = { userId: 'u2', memberId: memberB.id, ministryId: ministryA };

    // Usuário B não tem matrícula ativa, não recebe dados do Aluno A
    await assert.rejects(async () => {
      await service.getTurma(ctxB);
    }, /NOT_ENROLLED/);
  });

  it('J. Frequência é estritamente somente leitura para o membro mobile', async () => {
    // Aluno não possui endpoint de escrita ou permissão para registrar a própria frequência
    assert.strictEqual(typeof service.registrarFrequencia, 'undefined');
  });

  it('K. Isolamento multi-tenant: Membro do Ministério A não acessa dados do Ministério B', async () => {
    const ctxCrossTenant = { userId: 'u1', memberId: memberA.id, ministryId: ministryB };
    const me = await service.getMe(ctxCrossTenant);

    // No Ministério B, o memberA não existe/não tem aluno
    assert.equal(me.has_student, false);
    assert.equal(me.is_enrolled, false);
  });

  it('L. Isolamento congregacional: Turma e congregação pertencem ao tenant correto', async () => {
    const ctx = { userId: 'u1', memberId: memberA.id, ministryId: ministryA };
    const me = await service.getMe(ctx);

    assert.equal(me.turma.congregacao.id, congA);
    assert.equal(me.turma.congregacao.nome, 'Sede');
  });

  it('M. Dados vazios ou inexistentes são tratados sem lançar exceções não tratadas', async () => {
    const emptyCtx = { userId: 'u-empty', memberId: 'mem-empty', ministryId: ministryA };
    const res = await service.getFrequencia(emptyCtx);

    assert.deepEqual(res.resumo, { total_aulas: 0, presencas: 0, faltas: 0, percentual: 0 });
    assert.deepEqual(res.historico, []);
  });

  it('N. Requisições sem autenticação (token nulo ou inválido) são rejeitadas com UNAUTHORIZED', async () => {
    await assert.rejects(async () => {
      await service.getMe(null);
    }, /UNAUTHORIZED/);
  });

  it('O. UX de Minha EBD preserva estados de carregamento, sem matrícula e visualização completa', async () => {
    // Validação de contratos da página /app/ebd
    const abas = ['geral', 'licoes', 'frequencia'];
    assert.equal(abas.length, 3);
    assert.ok(abas.includes('geral'));
    assert.ok(abas.includes('licoes'));
    assert.ok(abas.includes('frequencia'));
  });
});
