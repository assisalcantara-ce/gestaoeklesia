import test from 'node:test';
import assert from 'node:assert/strict';

test('Validação de RBAC para Administrador do Gestão Eklésia', () => {
  // Simulação exata das funções hasRole e temAcessoEscrita do access-control.ts
  const MODULOS_ESCRITA = {
    administrador: ['secretaria', 'financeiro', 'tesouraria', 'gestao', 'configuracoes'],
    secretario_geral: ['secretaria', 'secretaria_local', 'gestao', 'agenda'],
    auxiliar_secretaria: ['secretaria', 'secretaria_local'],
    presidencia: ['presidencia', 'secretaria'],
    tesouraria_local: ['tesouraria']
  };

  function hasRole(roles, required) {
    const requiredList = Array.isArray(required) ? required : [required];
    const set = new Set(roles.map(r => r.toUpperCase()));
    return requiredList.some(r => set.has(String(r).toUpperCase())) || set.has('ADMINISTRADOR');
  }

  function temAcessoEscrita(nivel, modulo) {
    return MODULOS_ESCRITA[nivel]?.includes(modulo) ?? false;
  }

  function checkAdmin(auth) {
    return (
      auth.isOwner ||
      hasRole(auth.roles, ['ADMINISTRADOR', 'ADMIN', 'SECRETARIO_GERAL', 'PRESIDENCIA']) ||
      temAcessoEscrita(auth.nivel, 'secretaria')
    );
  }

  // 1. Owner do tenant
  assert.equal(checkAdmin({ isOwner: true, roles: ['OPERADOR'], nivel: 'operador' }), true);

  // 2. Administrador padrão com role ADMINISTRADOR e nivel administrador
  assert.equal(checkAdmin({ isOwner: false, roles: ['ADMINISTRADOR'], nivel: 'administrador' }), true);

  // 3. Secretário Geral
  assert.equal(checkAdmin({ isOwner: false, roles: ['SECRETARIO_GERAL'], nivel: 'secretario_geral' }), true);

  // 4. Presidência
  assert.equal(checkAdmin({ isOwner: false, roles: ['PRESIDENCIA'], nivel: 'presidencia' }), true);

  // 5. Auxiliar de Secretaria (possui escrita em secretaria)
  assert.equal(checkAdmin({ isOwner: false, roles: ['AUXILIAR_SECRETARIA'], nivel: 'auxiliar_secretaria' }), true);

  // 6. Usuário sem permissão (ex: Tesouraria Local)
  assert.equal(checkAdmin({ isOwner: false, roles: ['TESOURARIA_LOCAL'], nivel: 'tesouraria_local' }), false);

  // 7. Usuário sem permissão (ex: Membro/Visitante)
  assert.equal(checkAdmin({ isOwner: false, roles: ['VIEWER'], nivel: 'viewer' }), false);
});
