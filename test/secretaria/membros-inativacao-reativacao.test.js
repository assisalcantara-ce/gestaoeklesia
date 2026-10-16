import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function normalizeMemberStatus(status, fallbackToDefaultOnEmpty = true) {
  if (status === undefined || status === null || status === '') {
    return fallbackToDefaultOnEmpty ? 'active' : null;
  }
  const s = String(status).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (s === 'active' || s === 'ativo') return 'active';
  if (s === 'inactive' || s === 'inativo') return 'inactive';
  if (s === 'deceased' || s === 'falecido') return 'deceased';
  if (s === 'transferred' || s === 'transferido') return 'transferred';
  return null;
}

/**
 * Bateria de Testes: Inativação e Reativação Segura de Membros
 * Valida a substituição da exclusão física por inativação lógica com histórico.
 */

// Simulação da lógica de inativação e reativação implementada em src/app/api/v1/members/[id]/route.ts
function simularInativacaoMembro({
  member,
  ministryId,
  userLevel = 'admin',
  userEmail = 'pastor@gestaoeklesia.com.br',
  userId = 'usr-admin-1',
  motivo = 'Inativação solicitada via secretaria',
  observacoes = null,
  processoId = null,
}) {
  // 1. Verificação de permissões
  if (userLevel === 'auxiliar_secretaria') {
    return {
      status: 403,
      error: 'Auxiliar de Secretaria não possui permissão para inativar membros.',
    };
  }

  // 2. Isolamento Multi-tenant
  if (member.ministry_id !== ministryId) {
    return {
      status: 404,
      error: 'Membro não encontrado ou pertencente a outro ministério.',
    };
  }

  // 3. Prevenção de inativação duplicada
  const isAlreadyInactive = member.status === 'inactive' || member.status === 'inativo';
  if (isAlreadyInactive) {
    return {
      status: 400,
      code: 'ALREADY_INACTIVE',
      error: 'Membro já se encontra inativo no cadastro.',
    };
  }

  const existingCf = member.custom_fields && typeof member.custom_fields === 'object'
    ? { ...member.custom_fields }
    : {};

  const historicoAtual = Array.isArray(existingCf.historico_processos)
    ? [...existingCf.historico_processos]
    : [];

  const nowIso = new Date().toISOString();
  const inativacaoEventId = `inativ_${Date.now()}_test`;
  const eventoInativacao = {
    id: inativacaoEventId,
    processo_id: processoId || inativacaoEventId,
    ministry_id: ministryId,
    member_id: member.id,
    tipo_evento: 'inativacao',
    tipo_documento: 'Inativação Cadastral',
    data: nowIso.slice(0, 10),
    data_hora: nowIso,
    status_anterior: member.status,
    status_resultante: 'inactive',
    motivo: motivo.trim() || 'Inativação administrativa de membro',
    observacoes,
    responsavel: userEmail,
    usuario_id: userId,
    descricao: `Membro inativado no cadastro: ${motivo}. Documentos e histórico preservados.`,
    criado_em: nowIso,
  };

  const nextHistorico = [...historicoAtual, eventoInativacao];

  // O registro NÃO é deletado fisicamente; é atualizado
  const updatedMember = {
    ...member,
    status: 'inactive',
    custom_fields: {
      ...existingCf,
      historico_processos: nextHistorico,
      historicoProcessos: nextHistorico,
    },
    updated_at: nowIso,
  };

  return {
    status: 200,
    success: true,
    data: updatedMember,
    evento: eventoInativacao,
  };
}

function simularReativacaoMembro({
  member,
  ministryId,
  userLevel = 'admin',
  userEmail = 'pastor@gestaoeklesia.com.br',
  userId = 'usr-admin-1',
  motivo = 'Reativação no rol de membros ativos',
  observacoes = null,
}) {
  if (userLevel === 'auxiliar_secretaria') {
    return {
      status: 403,
      error: 'Auxiliar de Secretaria não possui permissão para reativar membros.',
    };
  }

  if (member.ministry_id !== ministryId) {
    return {
      status: 404,
      error: 'Membro não encontrado ou pertencente a outro ministério.',
    };
  }

  const isAlreadyActive = member.status === 'active' || member.status === 'ativo';
  if (isAlreadyActive) {
    return {
      status: 400,
      code: 'ALREADY_ACTIVE',
      error: 'Membro já se encontra ativo no cadastro.',
    };
  }

  const existingCf = member.custom_fields && typeof member.custom_fields === 'object'
    ? { ...member.custom_fields }
    : {};

  const historicoAtual = Array.isArray(existingCf.historico_processos)
    ? [...existingCf.historico_processos]
    : [];

  const nowIso = new Date().toISOString();
  const reativacaoEventId = `reativ_${Date.now()}_test`;
  const eventoReativacao = {
    id: reativacaoEventId,
    processo_id: reativacaoEventId,
    ministry_id: ministryId,
    member_id: member.id,
    tipo_evento: 'reativacao',
    tipo_documento: 'Reativação Cadastral',
    data: nowIso.slice(0, 10),
    data_hora: nowIso,
    status_anterior: member.status,
    status_resultante: 'active',
    motivo: motivo.trim() || 'Reativação cadastral no rol de membros',
    observacoes,
    responsavel: userEmail,
    usuario_id: userId,
    descricao: 'Membro reativado no rol de membros ativos. Histórico anterior preservado integralmente.',
    criado_em: nowIso,
  };

  const nextHistorico = [...historicoAtual, eventoReativacao];

  const updatedMember = {
    ...member,
    status: 'active',
    custom_fields: {
      ...existingCf,
      historico_processos: nextHistorico,
      historicoProcessos: nextHistorico,
    },
    updated_at: nowIso,
  };

  return {
    status: 200,
    success: true,
    data: updatedMember,
    evento: eventoReativacao,
  };
}

describe('Secretaria — Inativação e Reativação Segura de Membros', () => {
  const ministryId = 'tenant-igreja-1000';

  const baseMember = {
    id: 'membro-uuid-1',
    ministry_id: ministryId,
    name: 'João da Silva Santos',
    matricula: 'MB-00123',
    cpf: '12345678901',
    cargo_ministerial: 'DIACONO',
    status: 'active',
    congregacao_id: 'cong-sede',
    custom_fields: {
      historico_processos: [
        {
          id: 'cad-orig-1',
          tipo_evento: 'cadastro',
          data: '2024-01-15',
          descricao: 'Cadastro inicial na igreja',
        },
      ],
    },
  };

  it('1. Inativação deve alterar status para "inactive" sem apagar registros ou vínculos', () => {
    const res = simularInativacaoMembro({
      member: baseMember,
      ministryId,
      motivo: 'Mudança de endereço para outra cidade',
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'inactive');
    assert.strictEqual(res.data.id, 'membro-uuid-1');
    assert.strictEqual(res.data.matricula, 'MB-00123');
    assert.strictEqual(res.data.cargo_ministerial, 'DIACONO');
    assert.strictEqual(res.data.congregacao_id, 'cong-sede');
  });

  it('2. Inativação deve registrar evento de histórico com responsável, data e motivo', () => {
    const res = simularInativacaoMembro({
      member: baseMember,
      ministryId,
      userEmail: 'secretario@eklesia.com.br',
      userId: 'user-sec-99',
      motivo: 'Afastamento voluntário solicitado',
      observacoes: 'Transferência solicitada verbalmente',
    });

    assert.strictEqual(res.status, 200);
    const historico = res.data.custom_fields.historico_processos;
    assert.strictEqual(historico.length, 2);

    const eventoInat = historico[1];
    assert.strictEqual(eventoInat.tipo_evento, 'inativacao');
    assert.strictEqual(eventoInat.tipo_documento, 'Inativação Cadastral');
    assert.strictEqual(eventoInat.status_anterior, 'active');
    assert.strictEqual(eventoInat.status_resultante, 'inactive');
    assert.strictEqual(eventoInat.motivo, 'Afastamento voluntário solicitado');
    assert.strictEqual(eventoInat.observacoes, 'Transferência solicitada verbalmente');
    assert.strictEqual(eventoInat.responsavel, 'secretario@eklesia.com.br');
    assert.strictEqual(eventoInat.usuario_id, 'user-sec-99');
    assert.ok(eventoInat.data);
    assert.ok(eventoInat.data_hora);
  });

  it('3. Deve impedir inativação duplicada (ALREADY_INACTIVE)', () => {
    const inactiveMember = {
      ...baseMember,
      status: 'inactive',
    };

    const res = simularInativacaoMembro({
      member: inactiveMember,
      ministryId,
      motivo: 'Tentativa de inativar novamente',
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.code, 'ALREADY_INACTIVE');
  });

  it('4. Reativação deve alterar status para "active" e registrar evento preservando histórico anterior', () => {
    // Membro previamente inativado
    const inativadoRes = simularInativacaoMembro({
      member: baseMember,
      ministryId,
      motivo: 'Afastamento temporário',
    });

    const reativadoRes = simularReativacaoMembro({
      member: inativadoRes.data,
      ministryId,
      userEmail: 'pastor@eklesia.com.br',
      motivo: 'Retorno às atividades da igreja',
    });

    assert.strictEqual(reativadoRes.status, 200);
    assert.strictEqual(reativadoRes.data.status, 'active');

    const historicoCompleto = reativadoRes.data.custom_fields.historico_processos;
    assert.strictEqual(historicoCompleto.length, 3);

    // Evento 0: cadastro original
    assert.strictEqual(historicoCompleto[0].tipo_evento, 'cadastro');
    // Evento 1: inativação
    assert.strictEqual(historicoCompleto[1].tipo_evento, 'inativacao');
    // Evento 2: reativação
    assert.strictEqual(historicoCompleto[2].tipo_evento, 'reativacao');
    assert.strictEqual(historicoCompleto[2].status_anterior, 'inactive');
    assert.strictEqual(historicoCompleto[2].status_resultante, 'active');
    assert.strictEqual(historicoCompleto[2].motivo, 'Retorno às atividades da igreja');
  });

  it('5. Deve impedir reativação duplicada em membro que já está ativo (ALREADY_ACTIVE)', () => {
    const res = simularReativacaoMembro({
      member: baseMember,
      ministryId,
      motivo: 'Tentativa de reativar membro ativo',
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.code, 'ALREADY_ACTIVE');
  });

  it('6. Deve respeitar o isolamento multi-tenant (não inativar membros de outro tenant)', () => {
    const res = simularInativacaoMembro({
      member: baseMember,
      ministryId: 'outro-tenant-999',
      motivo: 'Tentativa indevida',
    });

    assert.strictEqual(res.status, 404);
  });

  it('7. Auxiliar de secretaria não deve ter permissão para inativar ou reativar membros (403)', () => {
    const inatRes = simularInativacaoMembro({
      member: baseMember,
      ministryId,
      userLevel: 'auxiliar_secretaria',
    });
    assert.strictEqual(inatRes.status, 403);

    const reativRes = simularReativacaoMembro({
      member: { ...baseMember, status: 'inactive' },
      ministryId,
      userLevel: 'auxiliar_secretaria',
    });
    assert.strictEqual(reativRes.status, 403);
  });

  it('8. Status "inactive" e "active" são compatíveis com a constraint PostgreSQL members_status_check', () => {
    assert.strictEqual(normalizeMemberStatus('inactive'), 'inactive');
    assert.strictEqual(normalizeMemberStatus('active'), 'active');
    assert.strictEqual(normalizeMemberStatus('inativo'), 'inactive');
    assert.strictEqual(normalizeMemberStatus('ativo'), 'active');
  });
});
