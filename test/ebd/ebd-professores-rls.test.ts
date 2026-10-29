import assert from 'node:assert';

/**
 * Teste unitário e de lógica para validação das funções RLS de EBD:
 * - ebd_user_global_access
 * - ebd_user_local_access
 * 
 * Simula os cenários de autenticação e autorização para os seguintes perfis:
 * 1. Super / Dono do Ministério (auth.uid() = m.user_id)
 * 2. Secretaria-Geral (role='operator', permissions=['SECRETARIO_GERAL'], congregacao_id=null)
 * 3. Presidência (role='presidencia', permissions=['PRESIDENCIA'], congregacao_id=null)
 * 4. Superintendente / Secretaria Local (role='operator', permissions=['SUPERINTENDENTE'], congregacao_id='cong-1')
 * 5. Usuário de Outro Tenant (ministry_id='outro-ministry')
 */

interface MinistryUser {
  user_id: string;
  ministry_id: string;
  role: string | null;
  permissions: string[];
  congregacao_id: string | null;
}

interface Ministry {
  id: string;
  user_id: string;
}

function simulate_ebd_user_global_access(
  authUid: string,
  p_ministry_id: string,
  ministries: Ministry[],
  ministry_users: MinistryUser[]
): boolean {
  // Check 1: Owner of ministry
  const isOwner = ministries.some(m => m.id === p_ministry_id && m.user_id === authUid);
  if (isOwner) return true;

  // Check 2: Global roles/permissions
  const allowedRoles = ['admin', 'administrador', 'manager', 'coordenador', 'coordinator', 'secretario_geral', 'presidencia', 'coordenador_ebd'];
  const allowedPerms = ['ADMINISTRADOR', 'EBD', 'COORDENADOR', 'COORDENADOR_EBD', 'SECRETARIO_GERAL', 'PRESIDENCIA'];

  return ministry_users.some(mu => {
    if (mu.user_id !== authUid || mu.ministry_id !== p_ministry_id) return false;
    const roleNorm = (mu.role || '').toLowerCase();
    const hasRole = allowedRoles.includes(roleNorm);
    const hasPerm = mu.permissions.some(p => allowedPerms.includes(p.toUpperCase()));
    return hasRole || hasPerm;
  });
}

function simulate_ebd_user_local_access(
  authUid: string,
  p_ministry_id: string,
  p_church_id: string | null,
  ministries: Ministry[],
  ministry_users: MinistryUser[]
): boolean {
  // Global access grants access to any church
  if (simulate_ebd_user_global_access(authUid, p_ministry_id, ministries, ministry_users)) {
    return true;
  }

  // Local access requires exact church_id match and local role/permission
  const allowedLocalRoles = ['superintendente', 'superintendent', 'superintendente_ebd'];
  const allowedLocalPerms = ['SUPERINTENDENTE', 'SUPERINTENDENTE_EBD'];

  return ministry_users.some(mu => {
    if (mu.user_id !== authUid || mu.ministry_id !== p_ministry_id) return false;
    if (!mu.congregacao_id || mu.congregacao_id !== p_church_id) return false;
    const roleNorm = (mu.role || '').toLowerCase();
    const hasRole = allowedLocalRoles.includes(roleNorm);
    const hasPerm = mu.permissions.some(p => allowedLocalPerms.includes(p.toUpperCase()));
    return hasRole || hasPerm;
  });
}

function runTests() {
  const ministryIdA = 'min-alpha-1111';
  const ministryIdB = 'min-beta-2222';

  const churchA1 = 'cong-alpha-sede';
  const churchA2 = 'cong-alpha-bairro';
  const churchB1 = 'cong-beta-sede';

  const userSuper = 'user-super-owner';
  const userSecGeral = 'user-secretaria-geral';
  const userPresidencia = 'user-presidencia';
  const userSuperintendenteA1 = 'user-superintendente-a1';
  const userOtherTenant = 'user-other-tenant';

  const ministries: Ministry[] = [
    { id: ministryIdA, user_id: userSuper },
    { id: ministryIdB, user_id: 'user-owner-b' }
  ];

  const ministryUsers: MinistryUser[] = [
    // Super / Owner
    { user_id: userSuper, ministry_id: ministryIdA, role: 'admin', permissions: ['ADMINISTRADOR'], congregacao_id: null },
    // Secretaria Geral
    { user_id: userSecGeral, ministry_id: ministryIdA, role: 'operator', permissions: ['SECRETARIO_GERAL'], congregacao_id: null },
    // Presidência
    { user_id: userPresidencia, ministry_id: ministryIdA, role: 'presidencia', permissions: ['PRESIDENCIA'], congregacao_id: null },
    // Superintendente A1
    { user_id: userSuperintendenteA1, ministry_id: ministryIdA, role: 'operator', permissions: ['SUPERINTENDENTE'], congregacao_id: churchA1 },
    // Usuário de outro ministério
    { user_id: userOtherTenant, ministry_id: ministryIdB, role: 'operator', permissions: ['SECRETARIO_GERAL'], congregacao_id: null },
  ];

  console.log('--- 1. Teste: Super / Dono do Ministério ---');
  assert.strictEqual(simulate_ebd_user_local_access(userSuper, ministryIdA, churchA1, ministries, ministryUsers), true, 'Super deve poder inserir em churchA1');
  assert.strictEqual(simulate_ebd_user_local_access(userSuper, ministryIdA, churchA2, ministries, ministryUsers), true, 'Super deve poder inserir em churchA2');
  assert.strictEqual(simulate_ebd_user_local_access(userSuper, ministryIdA, null, ministries, ministryUsers), true, 'Super deve poder inserir professor geral sem igreja');
  assert.strictEqual(simulate_ebd_user_local_access(userSuper, ministryIdB, churchB1, ministries, ministryUsers), false, 'Super NÃO deve ter acesso ao ministério B');
  console.log('✅ Super aprovado.');

  console.log('--- 2. Teste: Secretaria-Geral (O Caso do Erro) ---');
  assert.strictEqual(simulate_ebd_user_local_access(userSecGeral, ministryIdA, churchA1, ministries, ministryUsers), true, 'Secretaria-Geral deve poder inserir professor em churchA1');
  assert.strictEqual(simulate_ebd_user_local_access(userSecGeral, ministryIdA, churchA2, ministries, ministryUsers), true, 'Secretaria-Geral deve poder inserir professor em churchA2');
  assert.strictEqual(simulate_ebd_user_local_access(userSecGeral, ministryIdA, null, ministries, ministryUsers), true, 'Secretaria-Geral deve poder inserir professor sem church_id');
  assert.strictEqual(simulate_ebd_user_local_access(userSecGeral, ministryIdB, churchB1, ministries, ministryUsers), false, 'Secretaria-Geral NÃO deve acessar ministério B');
  console.log('✅ Secretaria-Geral aprovado com escopo global no próprio ministério.');

  console.log('--- 3. Teste: Presidência ---');
  assert.strictEqual(simulate_ebd_user_local_access(userPresidencia, ministryIdA, churchA1, ministries, ministryUsers), true, 'Presidência deve poder inserir professor');
  assert.strictEqual(simulate_ebd_user_local_access(userPresidencia, ministryIdB, churchB1, ministries, ministryUsers), false, 'Presidência NÃO deve acessar ministério B');
  console.log('✅ Presidência aprovada.');

  console.log('--- 4. Teste: Superintendente Local ---');
  assert.strictEqual(simulate_ebd_user_local_access(userSuperintendenteA1, ministryIdA, churchA1, ministries, ministryUsers), true, 'Superintendente deve poder inserir na sua própria igreja (A1)');
  assert.strictEqual(simulate_ebd_user_local_access(userSuperintendenteA1, ministryIdA, churchA2, ministries, ministryUsers), false, 'Superintendente NÃO pode inserir em outra igreja (A2)');
  assert.strictEqual(simulate_ebd_user_local_access(userSuperintendenteA1, ministryIdA, null, ministries, ministryUsers), false, 'Superintendente NÃO pode inserir registro global sem church_id');
  console.log('✅ Superintendente Local isolado com sucesso na própria congregação.');

  console.log('--- 5. Teste: Usuário de Outro Tenant ---');
  assert.strictEqual(simulate_ebd_user_local_access(userOtherTenant, ministryIdA, churchA1, ministries, ministryUsers), false, 'Tenant B NÃO pode inserir no Tenant A');
  assert.strictEqual(simulate_ebd_user_local_access(userOtherTenant, ministryIdB, churchB1, ministries, ministryUsers), true, 'Tenant B acessa normalmente seu próprio tenant B');
  console.log('✅ Isolamento multi-tenant garantido.');

  console.log('\n=============================================');
  console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO! 🎉');
  console.log('=============================================');
}

runTests();
