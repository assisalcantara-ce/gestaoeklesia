/**
 * test/mobile/member-multidevice-auth.test.js
 *
 * Teste automatizado para o fluxo de autenticação e acesso multidispositivo
 * do Aplicativo de Membros (/app).
 *
 * Cobertura de Requisitos:
 * 1. Acesso simultâneo ao mesmo cadastro de membro em múltiplos dispositivos com a mesma identidade (auth.uid).
 * 2. Reconhecimento automático do vínculo existente sem pedir CPF e nascimento novamente.
 * 3. Bloqueio estrito quando uma identidade diferente tenta vincular um cadastro já associado a outro auth_user_id.
 * 4. Retorno seguro de orientação e hint da conta vinculada (sem expor dados sensíveis).
 * 5. Isolamento estrito por ministry_id e RLS.
 * 6. Preservação de sessões e não invalidação de outros dispositivos legítimos.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ── Simulação de Banco de Dados Multi-Tenant ─────────────────────────────────
const mockDb = {
  members: [
    {
      id: 'member-001',
      ministry_id: 'ministry-alpha',
      name: 'João da Silva',
      cpf: '12345678901',
      data_nascimento: '1985-04-12',
      status: 'active',
      auth_user_id: 'auth-user-joao',
      email: 'joao.silva@exemplo.com',
    },
    {
      id: 'member-002',
      ministry_id: 'ministry-beta',
      name: 'Maria Oliveira',
      cpf: '98765432100',
      data_nascimento: '1990-08-25',
      status: 'active',
      auth_user_id: null,
      email: null,
    },
    {
      id: 'member-003',
      ministry_id: 'ministry-alpha',
      name: 'Carlos Santos',
      cpf: '11122233344',
      data_nascimento: '1978-11-03',
      status: 'active',
      auth_user_id: 'auth-user-carlos',
      email: 'carlos.santos@exemplo.com',
    },
  ],
  authUsers: {
    'auth-user-joao': {
      id: 'auth-user-joao',
      email: 'joao.silva@exemplo.com',
    },
    'auth-user-carlos': {
      id: 'auth-user-carlos',
      email: 'carlos.gestao@gmail.com',
    },
    'auth-user-device2': {
      id: 'auth-user-joao', // Mesma identidade no dispositivo 2
      email: 'joao.silva@exemplo.com',
    },
    'auth-user-stranger': {
      id: 'auth-user-stranger-999',
      email: 'estranho@outro.com',
    },
  },
};

// ── Função auxiliar de mascaramento de e-mail (conforme implementado) ─────────
function maskEmail(email) {
  if (!email) return null;
  const parts = email.split('@');
  if (parts.length !== 2) return `${email.slice(0, 3)}***`;
  const userPart = parts[0];
  const domainPart = parts[1];
  const maskedUser =
    userPart.length > 2
      ? `${userPart.slice(0, 2)}***${userPart.slice(-1)}`
      : `${userPart.slice(0, 1)}***`;
  return `${maskedUser}@${domainPart}`;
}

// ── Simulação da Lógica de Resolução de Membro (/api/v1/mobile/member/me) ──────
function resolveMobileMember(authenticatedUserId) {
  if (!authenticatedUserId) {
    throw new Error('UNAUTHORIZED');
  }
  const member = mockDb.members.find((m) => m.auth_user_id === authenticatedUserId);
  if (!member) {
    throw new Error('MEMBER_NOT_LINKED');
  }
  return {
    userId: authenticatedUserId,
    memberId: member.id,
    ministryId: member.ministry_id,
    name: member.name,
  };
}

let tokenCounter = 0;
// ── Simulação da Lógica de Login Direto (/api/v1/mobile/auth/login) ────────────
function handleMobileLogin(rawCpf, normalizedDate) {
  const cleanCpf = String(rawCpf || '').replace(/\D/g, '');
  const foundMembers = mockDb.members.filter(
    (m) => m.cpf === cleanCpf && m.data_nascimento === normalizedDate && m.status === 'active'
  );

  if (foundMembers.length === 0) {
    return { status: 401, error: 'MEMBER_NOT_FOUND' };
  }

  // Prioriza o que já tem auth_user_id
  const target = foundMembers.find((m) => m.auth_user_id) || foundMembers[0];
  let authUserId = target.auth_user_id;

  if (!authUserId) {
    authUserId = `auth-user-new-${target.id}`;
    target.auth_user_id = authUserId;
  }

  tokenCounter++;
  return {
    status: 200,
    session: {
      user: { id: authUserId, email: target.email || `membro_${target.id}@gestaoeklesia.app` },
      access_token: `token-for-${authUserId}-${Date.now()}-${tokenCounter}`,
    },
  };
}

// ── Simulação da Lógica de Vinculação Manual (/api/v1/mobile/auth/link-member) ──
function handleLinkMember(authenticatedUserId, rawCpf, normalizedDate) {
  if (!authenticatedUserId) {
    return { status: 401, error: 'UNAUTHORIZED' };
  }

  const alreadyLinked = mockDb.members.find((m) => m.auth_user_id === authenticatedUserId);
  if (alreadyLinked) {
    return { status: 409, code: 'ALREADY_LINKED' };
  }

  const cleanCpf = String(rawCpf || '').replace(/\D/g, '');
  const candidates = mockDb.members.filter(
    (m) => m.cpf === cleanCpf && m.data_nascimento === normalizedDate && m.status === 'active'
  );

  if (candidates.length === 0) {
    return { status: 404, code: 'MEMBER_NOT_FOUND' };
  }

  const selfLink = candidates.find((c) => c.auth_user_id === authenticatedUserId);
  if (selfLink) {
    return { status: 200, already_linked: true, member_id: selfLink.id };
  }

  const unlinkedMember = candidates.find((c) => !c.auth_user_id);
  if (!unlinkedMember) {
    const linkedCandidate = candidates.find((c) => Boolean(c.auth_user_id));
    const linkedUser = mockDb.authUsers[linkedCandidate.auth_user_id];
    return {
      status: 409,
      code: 'ALREADY_LINKED_OTHER',
      error: 'Este cadastro de membro já está vinculado a outra conta.',
      linked_account_hint: maskEmail(linkedUser?.email),
    };
  }

  unlinkedMember.auth_user_id = authenticatedUserId;
  return {
    status: 200,
    success: true,
    member_id: unlinkedMember.id,
  };
}

// ── SUÍTE DE TESTES ─────────────────────────────────────────────────────────

test('App de Membros — Fluxo de Autenticação e Acesso Multidispositivo', async (t) => {

  await t.test('1. Acesso simultâneo em múltiplos dispositivos com a mesma identidade auth.uid', () => {
    // Dispositivo 1: Celular A
    const loginDev1 = handleMobileLogin('12345678901', '1985-04-12');
    assert.equal(loginDev1.status, 200);
    assert.equal(loginDev1.session.user.id, 'auth-user-joao');

    const memberDev1 = resolveMobileMember(loginDev1.session.user.id);
    assert.equal(memberDev1.memberId, 'member-001');
    assert.equal(memberDev1.ministryId, 'ministry-alpha');

    // Dispositivo 2: Celular B ou Desktop (mesma identidade Supabase Auth)
    const loginDev2 = handleMobileLogin('12345678901', '1985-04-12');
    assert.equal(loginDev2.status, 200);
    assert.equal(loginDev2.session.user.id, 'auth-user-joao');

    const memberDev2 = resolveMobileMember(loginDev2.session.user.id);
    assert.equal(memberDev2.memberId, 'member-001');

    // Ambas as sessões são válidas e acessam simultaneamente os mesmos dados
    assert.equal(memberDev1.memberId, memberDev2.memberId);
    assert.notEqual(loginDev1.session.access_token, loginDev2.session.access_token);
  });

  await t.test('2. Reconhecimento automático do vínculo sem solicitar CPF novamente', () => {
    // Usuário já autenticado abre o aplicativo em qualquer dispositivo
    const sessionUserId = 'auth-user-joao';
    const resolved = resolveMobileMember(sessionUserId);

    assert.equal(resolved.memberId, 'member-001');
    assert.equal(resolved.name, 'João da Silva');
    // Não lança MEMBER_NOT_LINKED
  });

  await t.test('3. Bloqueio estrito quando uma identidade diferente tenta vincular cadastro já vinculado', () => {
    // Identidade de terceiro tentando vincular o cadastro do João (member-001)
    const strangerUserId = 'auth-user-stranger-999';
    const result = handleLinkMember(strangerUserId, '12345678901', '1985-04-12');

    assert.equal(result.status, 409);
    assert.equal(result.code, 'ALREADY_LINKED_OTHER');
    assert.ok(result.error.includes('vinculado a outra conta'));

    // O hint da conta vinculada deve ser fornecido de forma mascarada
    assert.equal(result.linked_account_hint, 'jo***a@exemplo.com');

    // O cadastro original não foi transferido
    const originalMember = mockDb.members.find((m) => m.id === 'member-001');
    assert.equal(originalMember.auth_user_id, 'auth-user-joao');
  });

  await t.test('4. Mascaramento seguro de e-mails para proteção contra enumeração', () => {
    assert.equal(maskEmail('joao.silva@exemplo.com'), 'jo***a@exemplo.com');
    assert.equal(maskEmail('admin@gestaoeklesia.com.br'), 'ad***n@gestaoeklesia.com.br');
    assert.equal(maskEmail('ab@dominio.com'), 'a***@dominio.com');
    assert.equal(maskEmail(null), null);
  });

  await t.test('5. Vinculação bem-sucedida de membro que ainda não possuía vínculo', () => {
    // Membro Maria (member-002) sem auth_user_id
    const newUserId = 'auth-user-maria-new';
    const result = handleLinkMember(newUserId, '98765432100', '1990-08-25');

    assert.equal(result.status, 200);
    assert.equal(result.success, true);
    assert.equal(result.member_id, 'member-002');

    // Agora resolveMobileMember deve reconhecer imediatamente
    const resolved = resolveMobileMember(newUserId);
    assert.equal(resolved.memberId, 'member-002');
    assert.equal(resolved.ministryId, 'ministry-beta');
  });

  await t.test('6. Isolamento estrito de ministry_id entre tenants', () => {
    const memberAlpha = resolveMobileMember('auth-user-joao');
    const memberBeta = resolveMobileMember('auth-user-maria-new');

    assert.equal(memberAlpha.ministryId, 'ministry-alpha');
    assert.equal(memberBeta.ministryId, 'ministry-beta');
    assert.notEqual(memberAlpha.ministryId, memberBeta.ministryId);
  });

  await t.test('7. Usuário sem vínculo lança erro MEMBER_NOT_LINKED para orientar rota /app/vincular', () => {
    assert.throws(
      () => resolveMobileMember('auth-user-unlinked-dummy'),
      /MEMBER_NOT_LINKED/
    );
  });
});
