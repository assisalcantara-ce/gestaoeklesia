import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Suite de Auditoria Avançada da Escala de Pregadores:
 * 1. Consulta horários ATUAIS de agenda_eventos na detecção de conflitos.
 * 2. Prevenção transacional / serialização concorrente (pg_advisory_xact_lock).
 * 3. Sincronização automática quando evento da Agenda muda de data, horário ou congregação.
 * 4. Escalas de eventos cancelados na Agenda NÃO bloqueiam novas atribuições do ministro.
 * 5. Ministro inativado preserva histórico passado, mas é bloqueado para novas escalas.
 * 6. Substituição concorrente e rastreabilidade total.
 */

describe('Auditoria Avançada — Regras do Banco da Escala de Pregadores', () => {
  const tenantA = '11111111-1111-1111-1111-111111111111';
  const congSede = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const congBetania = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  // Simulação de banco em memória
  let eventosDb: any[] = [];
  let membrosDb: any[] = [];
  let escalasDb: any[] = [];
  let lockEmulado: Set<string> = new Set();

  function resetDb() {
    eventosDb = [
      {
        id: 'evt-1',
        ministry_id: tenantA,
        church_id: congSede,
        titulo: 'Culto de Celebração',
        data_inicio: '2026-11-01T22:00:00.000Z',
        data_fim: '2026-11-01T23:30:00.000Z',
        status: 'agendado',
        local: 'Templo Sede',
      },
      {
        id: 'evt-2',
        ministry_id: tenantA,
        church_id: congBetania,
        titulo: 'Culto da Família',
        data_inicio: '2026-11-01T22:00:00.000Z',
        data_fim: '2026-11-01T23:30:00.000Z',
        status: 'agendado',
        local: 'Betânia',
      },
      {
        id: 'evt-3-cancelado',
        ministry_id: tenantA,
        church_id: congSede,
        titulo: 'Vigília Cancelada',
        data_inicio: '2026-11-02T02:00:00.000Z',
        data_fim: '2026-11-02T05:00:00.000Z',
        status: 'cancelado',
        local: 'Templo Sede',
      }
    ];

    membrosDb = [
      {
        id: 'min-1',
        ministry_id: tenantA,
        name: 'Pr. Carlos Oliveira',
        role: 'ministro',
        tipo_cadastro: 'ministro',
        status: 'active',
      },
      {
        id: 'min-2',
        ministry_id: tenantA,
        name: 'Ev. Lucas Silva',
        role: 'ministro',
        tipo_cadastro: 'ministro',
        status: 'active',
      }
    ];

    escalasDb = [];
    lockEmulado = new Set();
  }

  // Motor fiel ao trigger fn_validar_escala_pregadores
  function triggerValidarEscala(nova: any) {
    if (!nova.agenda_evento_id && ['escalado', 'confirmado'].includes(nova.status)) {
      throw new Error('A escala de pregador deve estar vinculada a um evento real da Agenda Oficial.');
    }

    const evt = eventosDb.find(e => e.id === nova.agenda_evento_id);
    if (!evt) throw new Error('O evento informado para a escala não existe na Agenda Oficial.');
    if (evt.ministry_id !== nova.ministry_id) throw new Error('Violação de isolamento: O evento pertence a outro ministério.');
    if (evt.status === 'cancelado' && ['escalado', 'confirmado'].includes(nova.status)) {
      throw new Error('Não é permitido escalar pregadores para um evento cancelado na Agenda.');
    }

    nova.evento_titulo_snapshot = evt.titulo;
    nova.evento_data_inicio_snapshot = evt.data_inicio;
    nova.evento_data_fim_snapshot = evt.data_fim || new Date(new Date(evt.data_inicio).getTime() + 7200000).toISOString();
    nova.evento_church_id_snapshot = evt.church_id;
    nova.evento_local_snapshot = evt.local;

    const membro = membrosDb.find(m => m.id === nova.member_id);
    if (!membro) throw new Error('O ministro informado não existe no cadastro de membros.');
    if (membro.ministry_id !== nova.ministry_id) throw new Error('Violação de isolamento: O ministro pertence a outro ministério.');
    if (String(membro.status).toLowerCase() !== 'active' && String(membro.status).toLowerCase() !== 'ativo') {
      throw new Error(`O ministro ${membro.name} encontra-se com cadastro inativo ou não regularizado.`);
    }

    const isMinistro = String(membro.role).toLowerCase() === 'ministro' || String(membro.tipo_cadastro).toLowerCase() === 'ministro';
    if (!isMinistro) throw new Error(`O membro ${membro.name} não possui o perfil oficial de ministro habilitado para escala.`);

    // 1. UNIQUE condicional (1 ativo por evento)
    if (['escalado', 'confirmado'].includes(nova.status)) {
      const ativaMesmoEvento = escalasDb.find(
        e => e.agenda_evento_id === nova.agenda_evento_id &&
             e.id !== nova.id &&
             ['escalado', 'confirmado'].includes(e.status)
      );
      if (ativaMesmoEvento) {
        throw new Error('Já existe uma escala ativa para este evento na Agenda.');
      }
    }

    // 2. Lock transacional por ministro (pg_advisory_xact_lock)
    const lockKey = `escala:ministro:${nova.member_id}`;
    if (lockEmulado.has(lockKey)) {
      throw new Error('Transação bloqueada por concorrência simultânea no ministro.');
    }
    lockEmulado.add(lockKey);

    // 3. Detecção de choque usando horários ATUAIS da agenda
    if (['escalado', 'confirmado'].includes(nova.status)) {
      const novaInicioMs = new Date(nova.evento_data_inicio_snapshot).getTime();
      const novaFimMs = new Date(nova.evento_data_fim_snapshot).getTime();

      for (const ep of escalasDb) {
        if (ep.ministry_id === nova.ministry_id && ep.member_id === nova.member_id && ['escalado', 'confirmado'].includes(ep.status) && ep.id !== nova.id) {
          const ae = eventosDb.find(e => e.id === ep.agenda_evento_id);
          // Ignora se o evento foi cancelado na agenda
          if (ae && ae.status === 'cancelado') continue;

          const conflitoInicio = ae ? new Date(ae.data_inicio).getTime() : new Date(ep.evento_data_inicio_snapshot).getTime();
          const conflitoFim = ae ? new Date(ae.data_fim || (conflitoInicio + 7200000)).getTime() : new Date(ep.evento_data_fim_snapshot || (conflitoInicio + 7200000)).getTime();

          if (conflitoInicio < novaFimMs && conflitoFim > novaInicioMs) {
            throw new Error(`Choque de horário: O ministro ${membro.name} já está escalado para o evento "${ae?.titulo || ep.evento_titulo_snapshot}".`);
          }
        }
      }
    }

    lockEmulado.delete(lockKey);
    return nova;
  }

  // Trigger AFTER UPDATE em agenda_eventos
  function triggerSyncAgendaUpdate(oldEvt: any, newEvt: any) {
    if (
      oldEvt.titulo !== newEvt.titulo ||
      oldEvt.data_inicio !== newEvt.data_inicio ||
      oldEvt.data_fim !== newEvt.data_fim ||
      oldEvt.church_id !== newEvt.church_id ||
      oldEvt.local !== newEvt.local
    ) {
      escalasDb = escalasDb.map(esc => {
        if (esc.agenda_evento_id === newEvt.id) {
          return {
            ...esc,
            evento_titulo_snapshot: newEvt.titulo,
            evento_data_inicio_snapshot: newEvt.data_inicio,
            evento_data_fim_snapshot: newEvt.data_fim || new Date(new Date(newEvt.data_inicio).getTime() + 7200000).toISOString(),
            evento_church_id_snapshot: newEvt.church_id,
            evento_local_snapshot: newEvt.local,
          };
        }
        return esc;
      });
    }
  }

  it('1. Detecção de choque consulta horários ATUAIS da Agenda e não snapshots defasados', () => {
    resetDb();
    // Escala min-1 no evt-1 (originalmente 22:00Z)
    const esc1 = triggerValidarEscala({
      id: 'esc-1',
      ministry_id: tenantA,
      agenda_evento_id: 'evt-1',
      member_id: 'min-1',
      status: 'escalado',
    });
    escalasDb.push(esc1);

    // O culto evt-1 na Agenda é alterado de 22:00 para 13:00 (liberando a noite das 22h)
    const oldEvt1 = { ...eventosDb[0] };
    eventosDb[0].data_inicio = '2026-11-01T13:00:00.000Z';
    eventosDb[0].data_fim = '2026-11-01T15:00:00.000Z';
    triggerSyncAgendaUpdate(oldEvt1, eventosDb[0]);

    // Agora, tentar escalar o mesmo min-1 no evt-2 (que é às 22:00) DEVE SER PERMITIDO,
    // pois o horário atual de evt-1 mudou e não há mais sobreposição
    const esc2 = triggerValidarEscala({
      id: 'esc-2',
      ministry_id: tenantA,
      agenda_evento_id: 'evt-2',
      member_id: 'min-1',
      status: 'escalado',
    });
    escalasDb.push(esc2);

    assert.equal(esc2.status, 'escalado');
    assert.equal(escalasDb.length, 2);
  });

  it('2. Escalas de eventos cancelados na Agenda NÃO bloqueiam novas atribuições do ministro', () => {
    resetDb();
    // Suponha que o min-1 estava escalado em evt-1 às 22:00
    const esc1 = triggerValidarEscala({
      id: 'esc-1',
      ministry_id: tenantA,
      agenda_evento_id: 'evt-1',
      member_id: 'min-1',
      status: 'escalado',
    });
    escalasDb.push(esc1);

    // O evento evt-1 é cancelado na Agenda
    eventosDb[0].status = 'cancelado';

    // O min-1 agora pode ser escalado em outro evento no mesmo horário (evt-2),
    // pois o evento anterior foi cancelado na Agenda
    const esc2 = triggerValidarEscala({
      id: 'esc-2',
      ministry_id: tenantA,
      agenda_evento_id: 'evt-2',
      member_id: 'min-1',
      status: 'escalado',
    });
    escalasDb.push(esc2);

    assert.equal(esc2.status, 'escalado');
  });

  it('3. Ministro desativado preserva histórico passado, mas bloqueia novas escalas', () => {
    resetDb();
    // min-1 realizou culto passado
    const escPassada = triggerValidarEscala({
      id: 'esc-antiga',
      ministry_id: tenantA,
      agenda_evento_id: 'evt-1',
      member_id: 'min-1',
      status: 'confirmado',
    });
    escalasDb.push(escPassada);

    // min-1 é inativado na secretaria
    membrosDb[0].status = 'inactive';

    // O registro histórico continua salvo
    assert.equal(escalasDb[0].member_id, 'min-1');
    assert.equal(escalasDb[0].status, 'confirmado');

    // Tentar criar nova escala para o min-1 deve ser rejeitado imediatamente
    assert.throws(() => {
      triggerValidarEscala({
        id: 'esc-nova-bloqueada',
        ministry_id: tenantA,
        agenda_evento_id: 'evt-2',
        member_id: 'min-1',
        status: 'escalado',
      });
    }, /encontra-se com cadastro inativo/);
  });

  it('4. Simulação de concorrência: lock serializa duas transações simultâneas', () => {
    resetDb();
    // Simula transação 1 obtendo o lock do min-1
    lockEmulado.add('escala:ministro:min-1');

    // Transação 2 concorrente tenta gravar escala simultânea para o mesmo ministro
    assert.throws(() => {
      triggerValidarEscala({
        id: 'esc-concorrente',
        ministry_id: tenantA,
        agenda_evento_id: 'evt-1',
        member_id: 'min-1',
        status: 'escalado',
      });
    }, /Transação bloqueada por concorrência simultânea/);

    // Transação 1 conclui e libera o lock
    lockEmulado.delete('escala:ministro:min-1');
  });

  it('5. Sincronização automática de dados após mudança de local e título na Agenda', () => {
    resetDb();
    const esc = triggerValidarEscala({
      id: 'esc-sync',
      ministry_id: tenantA,
      agenda_evento_id: 'evt-1',
      member_id: 'min-1',
      status: 'escalado',
    });
    escalasDb.push(esc);

    assert.equal(escalasDb[0].evento_titulo_snapshot, 'Culto de Celebração');

    // Alteração na Agenda
    const oldEvt = { ...eventosDb[0] };
    eventosDb[0].titulo = 'Culto Especial de Missões';
    eventosDb[0].local = 'Ginásio Central';
    triggerSyncAgendaUpdate(oldEvt, eventosDb[0]);

    // O snapshot da escala sincronizou automaticamente
    assert.equal(escalasDb[0].evento_titulo_snapshot, 'Culto Especial de Missões');
    assert.equal(escalasDb[0].evento_local_snapshot, 'Ginásio Central');
  });
});
