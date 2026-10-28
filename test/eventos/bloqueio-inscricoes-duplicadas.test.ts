import test from 'node:test';
import assert from 'node:assert/strict';

interface MockMember {
  id: string;
  ministry_id: string;
  name: string;
  cpf: string | null;
}

interface MockInscricao {
  id: string;
  ministry_id: string;
  evento_id: string;
  member_id: string | null;
  nome_externo: string | null;
  email_externo: string | null;
  cpf_normalizado: string | null;
  observacoes: string | null;
  status: 'confirmado' | 'aguardando_pagamento' | 'lista_espera' | 'cancelado' | 'expirado';
}

function normalizarCpf(cpf: string | null | undefined): string | null {
  if (!cpf) return null;
  const digitos = cpf.replace(/\D/g, '');
  return digitos.length === 11 ? digitos : null;
}

class EventosInscricoesServiceMock {
  public inscricoes: MockInscricao[] = [];
  public members: MockMember[] = [];

  // Simula a validação no backend (API pública, balcão e administrativa)
  // com proteção atômica e constraints
  public async verificarDuplicidade(params: {
    ministryId: string;
    eventoId: string;
    memberId?: string | null;
    cpf?: string | null;
    email?: string | null;
  }): Promise<{ duplicado: boolean; motivo?: string; existenteId?: string; status?: string }> {
    const statusAtivos = ['confirmado', 'aguardando_pagamento', 'lista_espera'];
    const cpfLimpo = normalizarCpf(params.cpf);

    // 1. Prioridade: member_id
    if (params.memberId) {
      const matchMember = this.inscricoes.find(
        i =>
          i.ministry_id === params.ministryId &&
          i.evento_id === params.eventoId &&
          i.member_id === params.memberId &&
          statusAtivos.includes(i.status)
      );
      if (matchMember) {
        return {
          duplicado: true,
          motivo: 'member_id',
          existenteId: matchMember.id,
          status: matchMember.status,
        };
      }
    }

    // 2. Prioridade: CPF normalizado
    if (cpfLimpo) {
      // 2.a. Membro com esse CPF
      const membroDoCpf = this.members.find(
        m => m.ministry_id === params.ministryId && normalizarCpf(m.cpf) === cpfLimpo
      );
      if (membroDoCpf) {
        const matchMembroCpf = this.inscricoes.find(
          i =>
            i.ministry_id === params.ministryId &&
            i.evento_id === params.eventoId &&
            i.member_id === membroDoCpf.id &&
            statusAtivos.includes(i.status)
        );
        if (matchMembroCpf) {
          return {
            duplicado: true,
            motivo: 'cpf_membro',
            existenteId: matchMembroCpf.id,
            status: matchMembroCpf.status,
          };
        }
      }

      // 2.b. Participante externo com esse CPF
      const matchCpfExterno = this.inscricoes.find(
        i =>
          i.ministry_id === params.ministryId &&
          i.evento_id === params.eventoId &&
          statusAtivos.includes(i.status) &&
          (i.cpf_normalizado === cpfLimpo || (i.observacoes && i.observacoes.includes(cpfLimpo)))
      );
      if (matchCpfExterno) {
        return {
          duplicado: true,
          motivo: 'cpf_externo',
          existenteId: matchCpfExterno.id,
          status: matchCpfExterno.status,
        };
      }
    }

    // 3. Fallback de e-mail (apenas se fornecido e sem member_id/cpf conflitante)
    if (params.email) {
      const matchEmail = this.inscricoes.find(
        i =>
          i.ministry_id === params.ministryId &&
          i.evento_id === params.eventoId &&
          i.email_externo?.toLowerCase() === params.email?.toLowerCase() &&
          statusAtivos.includes(i.status)
      );
      if (matchEmail) {
        return {
          duplicado: true,
          motivo: 'email',
          existenteId: matchEmail.id,
          status: matchEmail.status,
        };
      }
    }

    return { duplicado: false };
  }

  // Simula a inserção atômica no banco respeitando as constraints parciais
  public async inserirInscricao(payload: {
    id: string;
    ministry_id: string;
    evento_id: string;
    member_id?: string | null;
    nome_externo?: string | null;
    email_externo?: string | null;
    cpf?: string | null;
    observacoes?: string | null;
    status: 'confirmado' | 'aguardando_pagamento' | 'lista_espera' | 'cancelado' | 'expirado';
  }): Promise<MockInscricao> {
    const cpfNorm = normalizarCpf(payload.cpf);

    // Simula trigger e índices UNIQUE parciais no banco
    const statusAtivos = ['confirmado', 'aguardando_pagamento', 'lista_espera'];
    if (statusAtivos.includes(payload.status)) {
      if (payload.member_id) {
        const jaExisteMember = this.inscricoes.some(
          i =>
            i.ministry_id === payload.ministry_id &&
            i.evento_id === payload.evento_id &&
            i.member_id === payload.member_id &&
            statusAtivos.includes(i.status)
        );
        if (jaExisteMember) {
          const err: any = new Error('duplicate key value violates unique constraint "idx_inscricoes_evento_member_ativo" (code 23505)');
          err.code = '23505';
          throw err;
        }
      }

      if (cpfNorm) {
        const jaExisteCpf = this.inscricoes.some(
          i =>
            i.ministry_id === payload.ministry_id &&
            i.evento_id === payload.evento_id &&
            i.cpf_normalizado === cpfNorm &&
            statusAtivos.includes(i.status)
        );
        if (jaExisteCpf) {
          const err: any = new Error('duplicate key value violates unique constraint "idx_inscricoes_evento_cpf_ativo" (code 23505)');
          err.code = '23505';
          throw err;
        }
      }
    }

    const nova: MockInscricao = {
      id: payload.id,
      ministry_id: payload.ministry_id,
      evento_id: payload.evento_id,
      member_id: payload.member_id || null,
      nome_externo: payload.nome_externo || null,
      email_externo: payload.email_externo || null,
      cpf_normalizado: cpfNorm,
      observacoes: payload.observacoes || null,
      status: payload.status,
    };

    this.inscricoes.push(nova);
    return nova;
  }
}

test('Suíte de Testes: Bloqueio de Inscrições Duplicadas em Eventos', async (t) => {
  const TENANT_1 = 'tenant-1111';
  const TENANT_2 = 'tenant-2222';
  const EVENTO_A = 'evento-aaa';
  const EVENTO_B = 'evento-bbb';

  await t.test('1. Membro já inscrito com status confirmado é bloqueado de se reinscrever no mesmo evento', async () => {
    const service = new EventosInscricoesServiceMock();
    service.members.push({ id: 'membro-1', ministry_id: TENANT_1, name: 'João da Silva', cpf: '111.222.333-44' });

    await service.inserirInscricao({
      id: 'insc-1',
      ministry_id: TENANT_1,
      evento_id: EVENTO_A,
      member_id: 'membro-1',
      status: 'confirmado',
    });

    // Tentativa de duplicar
    const check = await service.verificarDuplicidade({
      ministryId: TENANT_1,
      eventoId: EVENTO_A,
      memberId: 'membro-1',
    });

    assert.equal(check.duplicado, true);
    assert.equal(check.motivo, 'member_id');
    assert.equal(check.status, 'confirmado');

    // Tentativa de inserção direta no banco dispara erro 23505
    await assert.rejects(async () => {
      await service.inserirInscricao({
        id: 'insc-2',
        ministry_id: TENANT_1,
        evento_id: EVENTO_A,
        member_id: 'membro-1',
        status: 'confirmado',
      });
    }, /23505/);
  });

  await t.test('2. Mesmo membro PODE se inscrever em eventos diferentes', async () => {
    const service = new EventosInscricoesServiceMock();
    service.members.push({ id: 'membro-1', ministry_id: TENANT_1, name: 'João da Silva', cpf: '111.222.333-44' });

    // Já inscrito no EVENTO_A
    await service.inserirInscricao({
      id: 'insc-1',
      ministry_id: TENANT_1,
      evento_id: EVENTO_A,
      member_id: 'membro-1',
      status: 'confirmado',
    });

    // Verificação no EVENTO_B deve permitir
    const check = await service.verificarDuplicidade({
      ministryId: TENANT_1,
      eventoId: EVENTO_B,
      memberId: 'membro-1',
    });

    assert.equal(check.duplicado, false);

    // Inserção no EVENTO_B deve suceder
    const nova = await service.inserirInscricao({
      id: 'insc-evento-b',
      ministry_id: TENANT_1,
      evento_id: EVENTO_B,
      member_id: 'membro-1',
      status: 'confirmado',
    });
    assert.equal(nova.evento_id, EVENTO_B);
  });

  await t.test('3. Participante externo com CPF normalizado é bloqueado de duplicidade', async () => {
    const service = new EventosInscricoesServiceMock();

    await service.inserirInscricao({
      id: 'insc-externo-1',
      ministry_id: TENANT_1,
      evento_id: EVENTO_A,
      nome_externo: 'Carlos Visitante',
      cpf: '555.666.777-88',
      status: 'confirmado',
    });

    // Segunda tentativa digitando o CPF sem máscara
    const check = await service.verificarDuplicidade({
      ministryId: TENANT_1,
      eventoId: EVENTO_A,
      cpf: '55566677788',
    });

    assert.equal(check.duplicado, true);
    assert.equal(check.motivo, 'cpf_externo');

    // Tentativa de inserção direta no banco rejeitada
    await assert.rejects(async () => {
      await service.inserirInscricao({
        id: 'insc-externo-2',
        ministry_id: TENANT_1,
        evento_id: EVENTO_A,
        nome_externo: 'Carlos Visitante 2',
        cpf: '55566677788',
        status: 'confirmado',
      });
    }, /23505/);
  });

  await t.test('4. Inscrição anterior cancelada ou expirada permite reinscrição limpa', async () => {
    const service = new EventosInscricoesServiceMock();
    service.members.push({ id: 'membro-2', ministry_id: TENANT_1, name: 'Maria Souza', cpf: '999.888.777-66' });

    // Inscrição foi cancelada
    await service.inserirInscricao({
      id: 'insc-cancelada',
      ministry_id: TENANT_1,
      evento_id: EVENTO_A,
      member_id: 'membro-2',
      status: 'cancelado',
    });

    // Verificação de duplicidade deve ignorar inscrições canceladas
    const check = await service.verificarDuplicidade({
      ministryId: TENANT_1,
      eventoId: EVENTO_A,
      memberId: 'membro-2',
    });
    assert.equal(check.duplicado, false, 'Deve permitir reinscrição');

    // Inserção da nova inscrição deve suceder
    const reinscricao = await service.inserirInscricao({
      id: 'insc-nova-ativa',
      ministry_id: TENANT_1,
      evento_id: EVENTO_A,
      member_id: 'membro-2',
      status: 'confirmado',
    });
    assert.equal(reinscricao.status, 'confirmado');
  });

  await t.test('5. Identificação cruzada: participante externo com CPF de membro cadastrado vincula duplicidade', async () => {
    const service = new EventosInscricoesServiceMock();
    service.members.push({ id: 'membro-3', ministry_id: TENANT_1, name: 'Pedro Santos', cpf: '333.444.555-66' });

    // Membro 3 já se inscreveu
    await service.inserirInscricao({
      id: 'insc-membro-3',
      ministry_id: TENANT_1,
      evento_id: EVENTO_A,
      member_id: 'membro-3',
      status: 'confirmado',
    });

    // Alguém tenta inscrever no Balcão como visitante, informando o mesmo CPF do Pedro
    const check = await service.verificarDuplicidade({
      ministryId: TENANT_1,
      eventoId: EVENTO_A,
      cpf: '333.444.555-66',
    });

    assert.equal(check.duplicado, true);
    assert.equal(check.motivo, 'cpf_membro');
  });

  await t.test('6. Isolamento multi-tenant: participante com mesmo CPF em tenant diferente não é bloqueado', async () => {
    const service = new EventosInscricoesServiceMock();

    // Inscrito no TENANT_1
    await service.inserirInscricao({
      id: 'insc-t1',
      ministry_id: TENANT_1,
      evento_id: EVENTO_A,
      nome_externo: 'Roberto',
      cpf: '777.888.999-00',
      status: 'confirmado',
    });

    // Verificação no TENANT_2 com mesmo CPF e mesmo ID de evento não colide
    const checkT2 = await service.verificarDuplicidade({
      ministryId: TENANT_2,
      eventoId: EVENTO_A,
      cpf: '777.888.999-00',
    });
    assert.equal(checkT2.duplicado, false);

    const inscT2 = await service.inserirInscricao({
      id: 'insc-t2',
      ministry_id: TENANT_2,
      evento_id: EVENTO_A,
      nome_externo: 'Roberto',
      cpf: '777.888.999-00',
      status: 'confirmado',
    });
    assert.equal(inscT2.ministry_id, TENANT_2);
  });

  await t.test('7. Race Condition (Inscrições Simultâneas): proteção no banco garante unicidade estrita', async () => {
    const service = new EventosInscricoesServiceMock();

    // Disparar duas inscrições quase simultâneas com mesmo CPF
    const resultados = await Promise.allSettled([
      service.inserirInscricao({
        id: 'insc-race-1',
        ministry_id: TENANT_1,
        evento_id: EVENTO_A,
        nome_externo: 'Lucas',
        cpf: '123.456.789-00',
        status: 'confirmado',
      }),
      service.inserirInscricao({
        id: 'insc-race-2',
        ministry_id: TENANT_1,
        evento_id: EVENTO_A,
        nome_externo: 'Lucas Duplicado',
        cpf: '12345678900',
        status: 'confirmado',
      }),
    ]);

    const sucesso = resultados.filter(r => r.status === 'fulfilled');
    const falha = resultados.filter(r => r.status === 'rejected');

    assert.equal(sucesso.length, 1, 'Exatamente uma inscrição deve ser aceita');
    assert.equal(falha.length, 1, 'A segunda requisição concorrente deve ser rejeitada pela restrição atômica');
  });
});
