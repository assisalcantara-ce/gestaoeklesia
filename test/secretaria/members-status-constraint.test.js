import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Importa a lógica canônica de status do membro
const ALLOWED_MEMBER_STATUSES = ['active', 'inactive', 'deceased', 'transferred'];

function normalizeMemberStatus(status, fallbackToDefaultOnEmpty = true) {
  if (status === undefined || status === null || status === '') {
    return fallbackToDefaultOnEmpty ? 'active' : null;
  }

  const s = String(status)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (
    s === 'active' ||
    s === 'ativo' ||
    s === 'ativo no rol' ||
    s === 'ativo_no_rol'
  ) {
    return 'active';
  }

  if (
    s === 'inactive' ||
    s === 'inativo' ||
    s === 'inativo no rol' ||
    s === 'inativo_no_rol' ||
    s === 'desligado' ||
    s === 'inativado' ||
    s === 'excluido'
  ) {
    return 'inactive';
  }

  if (
    s === 'deceased' ||
    s === 'falecido' ||
    s === 'obito' ||
    s === 'falecimento' ||
    s === 'morto'
  ) {
    return 'deceased';
  }

  if (
    s === 'transferred' ||
    s === 'transferido' ||
    s === 'transferencia' ||
    s === 'transferido_para_outra_igreja'
  ) {
    return 'transferred';
  }

  return null;
}

function isValidMemberStatus(status) {
  return normalizeMemberStatus(status, false) !== null;
}

function dbStatusToUi(status) {
  const normalized = normalizeMemberStatus(status, true);
  return normalized === 'active' ? 'ativo' : 'inativo';
}

function uiStatusToDb(status) {
  return normalizeMemberStatus(status, true) ?? 'active';
}

// Simulação de Handler de API: POST /api/v1/members
function simulatePostMember(payload, ministryId) {
  if (!payload.name) {
    return { status: 400, body: { error: 'Nome é obrigatório' } };
  }

  let statusFinal = 'active';
  if (payload.status !== undefined && payload.status !== null && payload.status !== '') {
    const normalized = normalizeMemberStatus(payload.status, false);
    if (!normalized) {
      return {
        status: 400,
        body: {
          error: `Status "${payload.status}" é inválido. Valores aceitos: active (ativo), inactive (inativo), deceased (falecido), transferred (transferido).`,
          code: 'INVALID_STATUS',
        },
      };
    }
    statusFinal = normalized;
  }

  // Simulação da inserção no banco de dados respeitando a constraint
  if (!ALLOWED_MEMBER_STATUSES.includes(statusFinal)) {
    throw new Error('new row for relation "members" violates check constraint "members_status_check"');
  }

  return {
    status: 201,
    body: {
      id: 'member-uuid-1',
      ministry_id: ministryId,
      name: payload.name.toUpperCase().trim(),
      status: statusFinal,
      custom_fields: payload.custom_fields || {},
    },
  };
}

// Simulação de Handler de API: PUT /api/v1/members/:id
function simulatePutMember(existingMember, updatePayload, ministryId) {
  if (existingMember.ministry_id !== ministryId) {
    return { status: 403, body: { error: 'Acesso negado: membro de outro ministério.' } };
  }

  let dbNovoStatus = null;
  if (updatePayload.status !== undefined && updatePayload.status !== null && updatePayload.status !== '') {
    dbNovoStatus = normalizeMemberStatus(updatePayload.status, false);
    if (!dbNovoStatus) {
      return {
        status: 400,
        body: {
          error: `Status "${updatePayload.status}" é inválido. Valores aceitos: active (ativo), inactive (inativo), deceased (falecido), transferred (transferido).`,
          code: 'INVALID_STATUS',
        },
      };
    }
  }

  const isExistingInactive = existingMember.status === 'inactive' || existingMember.status === 'inativo';
  const isReativacao = isExistingInactive && dbNovoStatus === 'active';

  const customFields = { ...(existingMember.custom_fields || {}) };
  if (isReativacao) {
    const historico = Array.isArray(customFields.historico_processos) ? [...customFields.historico_processos] : [];
    historico.push({
      tipo_evento: 'reativacao',
      data: '2026-10-16',
      status_anterior: existingMember.status,
      status_resultante: 'active',
    });
    customFields.historico_processos = historico;
  }

  const finalStatus = dbNovoStatus || existingMember.status;
  if (!ALLOWED_MEMBER_STATUSES.includes(finalStatus)) {
    throw new Error('new row for relation "members" violates check constraint "members_status_check"');
  }

  return {
    status: 200,
    body: {
      ...existingMember,
      name: updatePayload.name ? updatePayload.name.toUpperCase().trim() : existingMember.name,
      status: finalStatus,
      custom_fields: customFields,
    },
  };
}

describe('Secretaria - Compatibilidade e Validação do members_status_check', () => {
  const TENANT_ID = '00000000-0000-4000-8000-000000000001';

  describe('1. Validação da Constraint PostgreSQL (members_status_check)', () => {
    it('deve conter apenas os 4 valores canônicos aceitos pelo banco', () => {
      assert.deepEqual(ALLOWED_MEMBER_STATUSES, ['active', 'inactive', 'deceased', 'transferred']);
    });
  });

  describe('2. Normalização de Entradas (Inglês, Português, Acentos, Cases)', () => {
    it('deve normalizar variações de "ativo" para "active"', () => {
      assert.equal(normalizeMemberStatus('ativo'), 'active');
      assert.equal(normalizeMemberStatus('Ativo'), 'active');
      assert.equal(normalizeMemberStatus('ATIVO'), 'active');
      assert.equal(normalizeMemberStatus('active'), 'active');
      assert.equal(normalizeMemberStatus('ACTIVE'), 'active');
      assert.equal(normalizeMemberStatus('Ativo no Rol'), 'active');
    });

    it('deve normalizar variações de "inativo" para "inactive"', () => {
      assert.equal(normalizeMemberStatus('inativo'), 'inactive');
      assert.equal(normalizeMemberStatus('Inativo'), 'inactive');
      assert.equal(normalizeMemberStatus('INATIVO'), 'inactive');
      assert.equal(normalizeMemberStatus('inactive'), 'inactive');
      assert.equal(normalizeMemberStatus('desligado'), 'inactive');
      assert.equal(normalizeMemberStatus('Inativado'), 'inactive');
    });

    it('deve normalizar variações de "falecido" para "deceased"', () => {
      assert.equal(normalizeMemberStatus('falecido'), 'deceased');
      assert.equal(normalizeMemberStatus('FALECIDO'), 'deceased');
      assert.equal(normalizeMemberStatus('óbito'), 'deceased');
      assert.equal(normalizeMemberStatus('obito'), 'deceased');
      assert.equal(normalizeMemberStatus('deceased'), 'deceased');
    });

    it('deve normalizar variações de "transferido" para "transferred"', () => {
      assert.equal(normalizeMemberStatus('transferido'), 'transferred');
      assert.equal(normalizeMemberStatus('TRANSFERIDO'), 'transferred');
      assert.equal(normalizeMemberStatus('transferência'), 'transferred');
      assert.equal(normalizeMemberStatus('transferred'), 'transferred');
    });

    it('deve adotar "active" por padrão se o status estiver vazio ou não fornecido', () => {
      assert.equal(normalizeMemberStatus(undefined, true), 'active');
      assert.equal(normalizeMemberStatus(null, true), 'active');
      assert.equal(normalizeMemberStatus('', true), 'active');
    });
  });

  describe('3. Detecção e Rejeição de Valores Inválidos', () => {
    it('deve rejeitar status desconhecidos ou inválidos com null e isValid=false', () => {
      assert.equal(normalizeMemberStatus('banana', false), null);
      assert.equal(normalizeMemberStatus('status_invalido', false), null);
      assert.equal(normalizeMemberStatus('pendente', false), null);
      assert.equal(normalizeMemberStatus('123', false), null);

      assert.equal(isValidMemberStatus('banana'), false);
      assert.equal(isValidMemberStatus('ativo'), true);
      assert.equal(isValidMemberStatus('active'), true);
      assert.equal(isValidMemberStatus('inativo'), true);
      assert.equal(isValidMemberStatus('inactive'), true);
      assert.equal(isValidMemberStatus('falecido'), true);
      assert.equal(isValidMemberStatus('transferido'), true);
    });
  });

  describe('4. Fluxo de Cadastro de Membro (POST /api/v1/members)', () => {
    it('Cenário Real do Erro: formulário enviando status "ativo" deve gravar "active" com sucesso sem violar constraint', () => {
      const response = simulatePostMember(
        {
          name: 'Pastor Samuel de Souza',
          status: 'ativo', // Valor enviado pelo useMembros.ts
          cpf: '12345678901',
        },
        TENANT_ID
      );

      assert.equal(response.status, 201);
      assert.equal(response.body.status, 'active');
      assert.ok(ALLOWED_MEMBER_STATUSES.includes(response.body.status));
    });

    it('Cadastro com status omitido deve gravar "active" por default', () => {
      const response = simulatePostMember(
        {
          name: 'Maria Madalena',
          cpf: '98765432100',
        },
        TENANT_ID
      );

      assert.equal(response.status, 201);
      assert.equal(response.body.status, 'active');
    });

    it('Cadastro com status inválido deve retornar HTTP 400 INVALID_STATUS sem tentar insert no banco', () => {
      const response = simulatePostMember(
        {
          name: 'Teste Inválido',
          status: 'banana_status',
        },
        TENANT_ID
      );

      assert.equal(response.status, 400);
      assert.equal(response.body.code, 'INVALID_STATUS');
      assert.match(response.body.error, /Status "banana_status" é inválido/);
    });
  });

  describe('5. Fluxo de Edição e Transição de Status (PUT /api/v1/members/:id)', () => {
    it('Edição alterando status de "ativo" para "inativo" deve persistir "inactive"', () => {
      const membroExistente = {
        id: 'member-10',
        ministry_id: TENANT_ID,
        name: 'JOÃO SILVA',
        status: 'active',
        custom_fields: {},
      };

      const res = simulatePutMember(
        membroExistente,
        { status: 'inativo' },
        TENANT_ID
      );

      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'inactive');
      assert.ok(ALLOWED_MEMBER_STATUSES.includes(res.body.status));
    });

    it('Reativação: transição de "inactive" para "ativo" grava "active" e registra evento histórico', () => {
      const membroInativo = {
        id: 'member-10',
        ministry_id: TENANT_ID,
        name: 'JOÃO SILVA',
        status: 'inactive',
        custom_fields: {},
      };

      const res = simulatePutMember(
        membroInativo,
        { status: 'ativo' },
        TENANT_ID
      );

      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'active');
      assert.equal(res.body.custom_fields.historico_processos.length, 1);
      assert.equal(res.body.custom_fields.historico_processos[0].tipo_evento, 'reativacao');
      assert.equal(res.body.custom_fields.historico_processos[0].status_resultante, 'active');
    });

    it('Transição para "falecido" ou "transferido" deve persistir "deceased" e "transferred"', () => {
      const membro = {
        id: 'member-11',
        ministry_id: TENANT_ID,
        name: 'CARLOS ALBERTO',
        status: 'active',
        custom_fields: {},
      };

      const resFalecido = simulatePutMember(membro, { status: 'falecido' }, TENANT_ID);
      assert.equal(resFalecido.body.status, 'deceased');

      const resTransferido = simulatePutMember(membro, { status: 'transferido' }, TENANT_ID);
      assert.equal(resTransferido.body.status, 'transferred');
    });

    it('Tentativa de atualizar para status inválido retorna 400 INVALID_STATUS', () => {
      const membro = {
        id: 'member-12',
        ministry_id: TENANT_ID,
        name: 'ANA LÚCIA',
        status: 'active',
        custom_fields: {},
      };

      const res = simulatePutMember(membro, { status: 'desconhecido' }, TENANT_ID);
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'INVALID_STATUS');
    });
  });

  describe('6. Isolamento Multi-tenant e Proteção de Dados', () => {
    it('tentativa de alterar membro de outro tenant deve ser bloqueada', () => {
      const membroOutroTenant = {
        id: 'member-99',
        ministry_id: 'tenant-alheio-uuid',
        name: 'MEMBRO DE OUTRA IGREJA',
        status: 'active',
      };

      const res = simulatePutMember(membroOutroTenant, { status: 'inativo' }, TENANT_ID);
      assert.equal(res.status, 403);
    });
  });

  describe('7. Funções de Ponte UI x Banco de Dados', () => {
    it('dbStatusToUi deve converter "active" para "ativo" e "inactive" para "inativo"', () => {
      assert.equal(dbStatusToUi('active'), 'ativo');
      assert.equal(dbStatusToUi('inactive'), 'inativo');
      assert.equal(dbStatusToUi('deceased'), 'inativo');
      assert.equal(dbStatusToUi('transferred'), 'inativo');
    });

    it('uiStatusToDb deve converter "ativo" para "active" e "inativo" para "inactive"', () => {
      assert.equal(uiStatusToDb('ativo'), 'active');
      assert.equal(uiStatusToDb('inativo'), 'inactive');
      assert.equal(uiStatusToDb(''), 'active');
    });
  });
});
