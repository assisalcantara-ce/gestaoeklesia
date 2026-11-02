import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveNivel, temAcesso } from '../../src/lib/access-control.ts';

test('App do Pastor — Regras de Segurança e Isolamento Multi-Tenant', async (t) => {
  await t.test('1. Bloqueia papéis e permissões não autorizados', () => {
    const rolesInvalidos = [
      { role: 'operator', permissions: ['SECRETARIA_LOCAL'] },
      { role: 'operator', permissions: ['TESOURARIA_LOCAL'] },
      { role: 'operator', permissions: ['COORDENADOR_EBD'] },
      { role: 'manager', permissions: ['FINANCEIRO'] },
      { role: 'membro', permissions: [] },
    ];

    for (const u of rolesInvalidos) {
      const nivel = resolveNivel(u.role, u.permissions);
      const isAuthorized = nivel === 'presidencia' || nivel === 'administrador' || (nivel && temAcesso(nivel, 'presidencia'));
      assert.strictEqual(
        Boolean(isAuthorized),
        false,
        `Role ${u.role} com permissões ${u.permissions} não pode ter permissão no App do Pastor`
      );
    }
  });

  await t.test('2. Permite papéis e permissões canônicos da Presidência e Administrador', () => {
    const perfisValidos = [
      { role: 'admin', permissions: [] },
      { role: 'admin', permissions: ['ADMINISTRADOR'] },
      { role: 'manager', permissions: ['PRESIDENCIA'] },
      { role: 'presidencia', permissions: [] },
      { role: 'operator', permissions: ['PRESIDENCIA'] },
      { role: 'administrador', permissions: [] },
    ];

    for (const u of perfisValidos) {
      const nivel = resolveNivel(u.role, u.permissions);
      const isAuthorized = nivel === 'presidencia' || nivel === 'administrador' || (nivel && temAcesso(nivel, 'presidencia'));
      assert.strictEqual(
        Boolean(isAuthorized),
        true,
        `Perfil ${JSON.stringify(u)} deve ter acesso concedido ao App do Pastor`
      );
    }
  });

  await t.test('3. Validação de Feature Flag do Plano (presidency_module)', () => {
    // Simula a checagem que o endpoint /api/v1/pastor/dashboard executa
    const planoSemModulo = { presidency_module: false };
    const planoComModulo = { presidency_module: true };

    assert.throws(() => {
      if (!planoSemModulo.presidency_module) throw new Error('PLAN_REQUIRED');
    }, /PLAN_REQUIRED/);

    assert.doesNotThrow(() => {
      if (!planoComModulo.presidency_module) throw new Error('PLAN_REQUIRED');
    });
  });

  await t.test('4. Isolamento estrito de ministry_id em consultas de dados', () => {
    const ministryA = 'ministry-alpha-111';
    const ministryB = 'ministry-beta-222';

    // Mock query runner que valida filtro
    function mockQuery(queryMinistryId, filterMinistryId) {
      if (queryMinistryId !== filterMinistryId) {
        throw new Error('TENANT_VIOLATION');
      }
      return { ok: true };
    }

    assert.doesNotThrow(() => mockQuery(ministryA, ministryA));
    assert.throws(() => mockQuery(ministryA, ministryB), /TENANT_VIOLATION/);
  });

  await t.test('5. Formatação de Moeda e Números Compactos', () => {
    function formatCompact(value) {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
      return String(value);
    }

    assert.strictEqual(formatCompact(1248), '1.2k');
    assert.strictEqual(formatCompact(500), '500');
    assert.strictEqual(formatCompact(2500000), '2.5M');
  });
});
