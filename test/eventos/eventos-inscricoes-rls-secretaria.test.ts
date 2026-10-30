import test from 'node:test';
import assert from 'node:assert/strict';

interface MinistryUser {
  user_id: string;
  ministry_id: string;
  role: string;
  permissions: string[];
  is_active: boolean;
}

interface Ministry {
  id: string;
  user_id: string;
  name: string;
}

/**
 * Simula a política RLS SQL de 'inscricoes_insert' e 'inscricoes_update' da migration:
 * 20261030110000_fix_eventos_inscricoes_rls_secretaria.sql
 */
function checkInscricaoRls(params: {
  authUid: string;
  targetMinistryId: string;
  ministryUsers: MinistryUser[];
  ministries: Ministry[];
}): boolean {
  const { authUid, targetMinistryId, ministryUsers, ministries } = params;

  // 1. Checa ministry_users
  const hasUserPerm = ministryUsers.some(mu => {
    if (mu.user_id !== authUid) return false;
    if (mu.ministry_id !== targetMinistryId) return false;
    if (!mu.is_active) return false;

    const roleLower = (mu.role || '').toLowerCase();
    const isRoleMatch = ['admin', 'administrador', 'manager', 'gestor'].includes(roleLower);

    const perms = mu.permissions || [];
    const isPermMatch =
      perms.includes('ADMINISTRADOR') ||
      perms.includes('SECRETARIO') ||
      perms.includes('SECRETARIO_GERAL') ||
      perms.includes('AUXILIAR_SECRETARIA') ||
      perms.includes('SECRETARIA_LOCAL') ||
      perms.includes('ADMIN_LOCAL') ||
      perms.includes('FINANCEIRO') ||
      perms.includes('TESOUREIRO_GERAL') ||
      perms.includes('PRESIDENCIA');

    return isRoleMatch || isPermMatch;
  });

  if (hasUserPerm) return true;

  // 2. Checa se é dono do ministério
  const isOwner = ministries.some(m => m.id === targetMinistryId && m.user_id === authUid);
  return isOwner;
}

test('RLS eventos_inscricoes: Permissões de Secretaria e Administrador', async (t) => {
  const ministryId = '11111111-1111-1111-1111-111111111111';
  const otherMinistryId = '99999999-9999-9999-9999-999999999999';

  const mockMinistries: Ministry[] = [
    { id: ministryId, user_id: 'user-dono', name: 'Igreja Central' },
  ];

  const mockUsers: MinistryUser[] = [
    // Operador da Secretaria Geral (Caso relatado na imagem)
    {
      user_id: 'user-sec-geral',
      ministry_id: ministryId,
      role: 'operator',
      permissions: ['SECRETARIO_GERAL'],
      is_active: true,
    },
    // Operador Auxiliar de Secretaria
    {
      user_id: 'user-aux-sec',
      ministry_id: ministryId,
      role: 'operator',
      permissions: ['AUXILIAR_SECRETARIA'],
      is_active: true,
    },
    // Administrador
    {
      user_id: 'user-admin',
      ministry_id: ministryId,
      role: 'admin',
      permissions: ['ADMINISTRADOR'],
      is_active: true,
    },
    // Membro Comum (sem permissões de secretaria)
    {
      user_id: 'user-comum',
      ministry_id: ministryId,
      role: 'user',
      permissions: ['MEMBRO'],
      is_active: true,
    },
    // Secretário inativo
    {
      user_id: 'user-inativo',
      ministry_id: ministryId,
      role: 'operator',
      permissions: ['SECRETARIO_GERAL'],
      is_active: false,
    },
  ];

  await t.test('1. Permite inserção para usuário SECRETARIO_GERAL (role=operator)', () => {
    const allowed = checkInscricaoRls({
      authUid: 'user-sec-geral',
      targetMinistryId: ministryId,
      ministryUsers: mockUsers,
      ministries: mockMinistries,
    });
    assert.equal(allowed, true, 'SECRETARIO_GERAL deve ter permissão de inserção');
  });

  await t.test('2. Permite inserção para usuário AUXILIAR_SECRETARIA', () => {
    const allowed = checkInscricaoRls({
      authUid: 'user-aux-sec',
      targetMinistryId: ministryId,
      ministryUsers: mockUsers,
      ministries: mockMinistries,
    });
    assert.equal(allowed, true, 'AUXILIAR_SECRETARIA deve ter permissão de inserção');
  });

  await t.test('3. Permite inserção para usuário ADMINISTRADOR', () => {
    const allowed = checkInscricaoRls({
      authUid: 'user-admin',
      targetMinistryId: ministryId,
      ministryUsers: mockUsers,
      ministries: mockMinistries,
    });
    assert.equal(allowed, true, 'ADMINISTRADOR deve ter permissão de inserção');
  });

  await t.test('4. Bloqueia inserção para usuário comum sem cargo/permissão de secretaria', () => {
    const allowed = checkInscricaoRls({
      authUid: 'user-comum',
      targetMinistryId: ministryId,
      ministryUsers: mockUsers,
      ministries: mockMinistries,
    });
    assert.equal(allowed, false, 'Usuário comum sem papel de secretaria deve ser bloqueado pela RLS');
  });

  await t.test('5. Bloqueia inserção para usuário com cargo mas inativo no ministério', () => {
    const allowed = checkInscricaoRls({
      authUid: 'user-inativo',
      targetMinistryId: ministryId,
      ministryUsers: mockUsers,
      ministries: mockMinistries,
    });
    assert.equal(allowed, false, 'Usuário inativo deve ser bloqueado pela RLS');
  });

  await t.test('6. Bloqueia inserção para ministério diferente (isolamento multi-tenant)', () => {
    const allowed = checkInscricaoRls({
      authUid: 'user-sec-geral',
      targetMinistryId: otherMinistryId,
      ministryUsers: mockUsers,
      ministries: mockMinistries,
    });
    assert.equal(allowed, false, 'Deve bloquear tentativa de inserção em ministério terceiro');
  });
});
