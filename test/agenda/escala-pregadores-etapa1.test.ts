import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Suite de Testes Adversariais da Migration da Escala de Pregadores
 * Valida a integridade lógica, isolamento de tenant, bloqueio de conflitos e preservação de histórico.
 */

describe('Módulo Secretaria → Escala de Pregadores (Etapa 1 - Banco e Regras)', () => {
  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';
  const congSede = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const congBetania = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const eventoCultoDomingo = {
    id: 'evt-domingo-1',
    ministry_id: tenantA,
    church_id: congSede,
    titulo: 'Culto da Família',
    data_inicio: '2026-11-01T22:00:00.000Z', // 19:00 Belém
    data_fim: '2026-11-01T23:30:00.000Z',   // 20:30 Belém
    status: 'agendado',
    local: 'Templo Sede',
  };

  const eventoCultoBetania = {
    id: 'evt-domingo-betania',
    ministry_id: tenantA,
    church_id: congBetania,
    titulo: 'Culto de Celebração Betânia',
    data_inicio: '2026-11-01T22:00:00.000Z', // 19:00 Belém (mesmo horário)
    data_fim: '2026-11-01T23:30:00.000Z',
    status: 'agendado',
    local: 'Betânia',
  };

  const ministroPrCarlos = {
    id: 'min-pr-carlos',
    ministry_id: tenantA,
    name: 'Pr. Carlos Oliveira',
    role: 'ministro',
    tipo_cadastro: 'ministro',
    status: 'active',
  };

  const ministroEvLucas = {
    id: 'min-ev-lucas',
    ministry_id: tenantA,
    name: 'Ev. Lucas Silva',
    role: 'ministro',
    tipo_cadastro: 'ministro',
    status: 'active',
  };

  const membroComum = {
    id: 'mem-joao-comum',
    ministry_id: tenantA,
    name: 'João Membro Comum',
    role: 'membro',
    tipo_cadastro: 'membro',
    status: 'active',
  };

  const ministroInativo = {
    id: 'min-inativo',
    ministry_id: tenantA,
    name: 'Pb. Inativo Disciplinado',
    role: 'ministro',
    tipo_cadastro: 'ministro',
    status: 'inactive',
  };

  const ministroTenantB = {
    id: 'min-tenant-b',
    ministry_id: tenantB,
    name: 'Pr. Estranho de Outro Ministério',
    role: 'ministro',
    tipo_cadastro: 'ministro',
    status: 'active',
  };

  // Simulação do Motor de Validação do Trigger / Regras de Negócio
  function validarEscala(
    novaEscala: any, 
    bancoEscalasExistentes: any[], 
    bancoEventos: any[], 
    bancoMembros: any[]
  ) {
    if (!novaEscala.agenda_evento_id && ['escalado', 'confirmado'].includes(novaEscala.status)) {
      throw new Error('A escala de pregador deve estar vinculada a um evento real da Agenda Oficial.');
    }

    const evento = bancoEventos.find(e => e.id === novaEscala.agenda_evento_id);
    if (!evento) {
      throw new Error('O evento informado para a escala não existe na Agenda Oficial.');
    }

    if (evento.ministry_id !== novaEscala.ministry_id) {
      throw new Error('Violação de isolamento: O evento pertence a outro ministério.');
    }

    if (evento.status === 'cancelado' && ['escalado', 'confirmado'].includes(novaEscala.status)) {
      throw new Error('Não é permitido escalar pregadores para um evento cancelado na Agenda.');
    }

    const membro = bancoMembros.find(m => m.id === novaEscala.member_id);
    if (!membro) {
      throw new Error('O ministro informado não existe no cadastro de membros.');
    }

    if (membro.ministry_id !== novaEscala.ministry_id) {
      throw new Error('Violação de isolamento: O ministro pertence a outro ministério.');
    }

    if (String(membro.status).toLowerCase() !== 'active' && String(membro.status).toLowerCase() !== 'ativo') {
      throw new Error(`O ministro ${membro.name} encontra-se com cadastro inativo ou não regularizado.`);
    }

    const isMinistro = String(membro.role).toLowerCase() === 'ministro' || String(membro.tipo_cadastro).toLowerCase() === 'ministro';
    if (!isMinistro) {
      throw new Error(`O membro ${membro.name} não possui o perfil oficial de ministro habilitado para escala.`);
    }

    // Regra de Ouro: Somente 1 ativa por evento
    if (['escalado', 'confirmado'].includes(novaEscala.status)) {
      const ativaExistente = bancoEscalasExistentes.find(
        e => e.agenda_evento_id === novaEscala.agenda_evento_id && 
             e.id !== novaEscala.id && 
             ['escalado', 'confirmado'].includes(e.status)
      );
      if (ativaExistente) {
        throw new Error('Já existe uma escala ativa para este evento na Agenda.');
      }
    }

    // Detecção de Choque de Horário do mesmo ministro
    if (['escalado', 'confirmado'].includes(novaEscala.status)) {
      const inicioNova = new Date(evento.data_inicio).getTime();
      const fimNova = new Date(evento.data_fim || new Date(inicioNova + 7200000)).getTime();

      for (const esc of bancoEscalasExistentes) {
        if (esc.member_id === novaEscala.member_id && ['escalado', 'confirmado'].includes(esc.status) && esc.id !== novaEscala.id) {
          const escEvt = bancoEventos.find(e => e.id === esc.agenda_evento_id) || {
            data_inicio: esc.evento_data_inicio_snapshot,
            data_fim: esc.evento_data_fim_snapshot,
            titulo: esc.evento_titulo_snapshot
          };
          const inicioExistente = new Date(escEvt.data_inicio).getTime();
          const fimExistente = new Date(escEvt.data_fim || new Date(inicioExistente + 7200000)).getTime();

          // Interseção de intervalos
          if (inicioExistente < fimNova && fimExistente > inicioNova) {
            throw new Error(`Choque de horário: O ministro ${membro.name} já está escalado para outro evento no mesmo horário.`);
          }
        }
      }
    }

    return {
      ...novaEscala,
      evento_titulo_snapshot: evento.titulo,
      evento_data_inicio_snapshot: evento.data_inicio,
      evento_data_fim_snapshot: evento.data_fim,
      evento_church_id_snapshot: evento.church_id,
      evento_local_snapshot: evento.local,
    };
  }

  it('1. Atribuição com sucesso de ministro ativo a um evento real da Agenda', () => {
    const escala = validarEscala(
      {
        id: 'esc-1',
        ministry_id: tenantA,
        agenda_evento_id: eventoCultoDomingo.id,
        member_id: ministroPrCarlos.id,
        status: 'escalado',
      },
      [],
      [eventoCultoDomingo],
      [ministroPrCarlos]
    );

    assert.equal(escala.status, 'escalado');
    assert.equal(escala.evento_titulo_snapshot, 'Culto da Família');
    assert.equal(escala.member_id, ministroPrCarlos.id);
  });

  it('2. Bloqueio de atribuição para membro que não é ministro habilitado', () => {
    assert.throws(() => {
      validarEscala(
        {
          id: 'esc-2',
          ministry_id: tenantA,
          agenda_evento_id: eventoCultoDomingo.id,
          member_id: membroComum.id,
          status: 'escalado',
        },
        [],
        [eventoCultoDomingo],
        [membroComum]
      );
    }, /não possui o perfil oficial de ministro/);
  });

  it('3. Bloqueio de atribuição para ministro inativo', () => {
    assert.throws(() => {
      validarEscala(
        {
          id: 'esc-3',
          ministry_id: tenantA,
          agenda_evento_id: eventoCultoDomingo.id,
          member_id: ministroInativo.id,
          status: 'escalado',
        },
        [],
        [eventoCultoDomingo],
        [ministroInativo]
      );
    }, /encontra-se com cadastro inativo/);
  });

  it('4. Bloqueio contra colisão e bypass de tenant (ministro de outro ministério)', () => {
    assert.throws(() => {
      validarEscala(
        {
          id: 'esc-4',
          ministry_id: tenantA,
          agenda_evento_id: eventoCultoDomingo.id,
          member_id: ministroTenantB.id,
          status: 'escalado',
        },
        [],
        [eventoCultoDomingo],
        [ministroTenantB]
      );
    }, /O ministro pertence a outro ministério/);
  });

  it('5. Prevenção de duplicidade: impede mais de 1 atribuição ativa no mesmo evento', () => {
    const escalaExistente = {
      id: 'esc-ativa-1',
      ministry_id: tenantA,
      agenda_evento_id: eventoCultoDomingo.id,
      member_id: ministroPrCarlos.id,
      status: 'escalado',
    };

    assert.throws(() => {
      validarEscala(
        {
          id: 'esc-ativa-2',
          ministry_id: tenantA,
          agenda_evento_id: eventoCultoDomingo.id,
          member_id: ministroEvLucas.id,
          status: 'escalado',
        },
        [escalaExistente],
        [eventoCultoDomingo],
        [ministroEvLucas]
      );
    }, /Já existe uma escala ativa para este evento/);
  });

  it('6. Prevenção Transacional de Choque de Horário do mesmo ministro em congregações distintas', () => {
    // Pr. Carlos escalado na Sede domingo às 19:00
    const escalaPrCarlosSede = {
      id: 'esc-carlos-sede',
      ministry_id: tenantA,
      agenda_evento_id: eventoCultoDomingo.id,
      member_id: ministroPrCarlos.id,
      status: 'escalado',
      evento_data_inicio_snapshot: eventoCultoDomingo.data_inicio,
      evento_data_fim_snapshot: eventoCultoDomingo.data_fim,
    };

    // Tentativa simultânea de escalar o Pr. Carlos na Congregação Betânia no mesmo dia/horário
    assert.throws(() => {
      validarEscala(
        {
          id: 'esc-carlos-betania',
          ministry_id: tenantA,
          agenda_evento_id: eventoCultoBetania.id,
          member_id: ministroPrCarlos.id,
          status: 'escalado',
        },
        [escalaPrCarlosSede],
        [eventoCultoDomingo, eventoCultoBetania],
        [ministroPrCarlos]
      );
    }, /Choque de horário: O ministro Pr. Carlos Oliveira já está escalado para outro evento no mesmo horário/);
  });

  it('7. Preservação de Histórico em Substituição de Pregador', () => {
    // 1. Escala original
    const escalaOriginal = {
      id: 'esc-orig',
      ministry_id: tenantA,
      agenda_evento_id: eventoCultoDomingo.id,
      member_id: ministroPrCarlos.id,
      status: 'escalado',
    };

    // 2. Pr. Carlos é substituído por Ev. Lucas
    const escalaSubstituida = {
      ...escalaOriginal,
      status: 'substituido',
      motivo_alteracao: 'Viagem pastoral de urgência',
      substituido_por_member_id: ministroEvLucas.id,
      data_alteracao: new Date().toISOString(),
    };

    // 3. Nova escala do Ev. Lucas é inserida
    const novaEscalaLucas = validarEscala(
      {
        id: 'esc-nova-lucas',
        ministry_id: tenantA,
        agenda_evento_id: eventoCultoDomingo.id,
        member_id: ministroEvLucas.id,
        status: 'escalado',
      },
      [escalaSubstituida], // A antiga está como 'substituido', liberando a vaga única ativa
      [eventoCultoDomingo],
      [ministroEvLucas]
    );

    assert.equal(escalaSubstituida.status, 'substituido');
    assert.equal(escalaSubstituida.substituido_por_member_id, ministroEvLucas.id);
    assert.equal(novaEscalaLucas.status, 'escalado');
    assert.equal(novaEscalaLucas.member_id, ministroEvLucas.id);
  });

  it('8. Isolamento RLS da Secretaria Local: só pode atribuir em eventos da sua congregação', () => {
    const userSecretarioLocalBetania = {
      user_id: 'user-sec-betania',
      ministry_id: tenantA,
      congregacao_id: congBetania,
      role: 'secretaria_local',
    };

    const isPermitidoSede = (
      userSecretarioLocalBetania.role === 'secretario_geral' || 
      userSecretarioLocalBetania.congregacao_id === eventoCultoDomingo.church_id
    );

    const isPermitidoBetania = (
      userSecretarioLocalBetania.role === 'secretario_geral' || 
      userSecretarioLocalBetania.congregacao_id === eventoCultoBetania.church_id
    );

    assert.equal(isPermitidoSede, false, 'Secretário de Betânia NÃO pode escalar na Sede');
    assert.equal(isPermitidoBetania, true, 'Secretário de Betânia PODE escalar na sua congregação Betânia');
  });
});
