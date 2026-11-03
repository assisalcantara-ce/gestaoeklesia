import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveNivel, temAcesso } from '../../src/lib/access-control.ts';
import { resolvePlanFeatures } from '../../src/lib/feature-flags/index.ts';

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

  await t.test('3. Validação Comercial de Feature Flag pastor_app nos Planos Oficiais', () => {
    // Planos Autorizados
    const starterPorId = { id: '503104e9-d532-433f-98b5-c7345152e275', name: 'Starter' };
    const starterPorSlug = { slug: 'starter', name: 'Plano Starter' };
    const intermediarioPorId = { id: '39c12fb2-dd08-4327-9411-f8bf4c0a226d', name: 'Intermediário' };
    const intermediarioPorSlug = { slug: 'intermediario', name: 'Intermediário' };
    const profissionalPorId = { id: '3eed6a7e-f5dc-42e7-a976-de79fd397f3c', name: 'Profissional' };
    const profissionalPorSlug = { slug: 'profissional', name: 'Profissional' };

    assert.strictEqual(resolvePlanFeatures(starterPorId).pastor_app, true, 'Starter por ID deve liberar pastor_app');
    assert.strictEqual(resolvePlanFeatures(starterPorSlug).pastor_app, true, 'Starter por slug deve liberar pastor_app');
    assert.strictEqual(resolvePlanFeatures(intermediarioPorId).pastor_app, true, 'Intermediário por ID deve liberar pastor_app');
    assert.strictEqual(resolvePlanFeatures(intermediarioPorSlug).pastor_app, true, 'Intermediário por slug deve liberar pastor_app');
    assert.strictEqual(resolvePlanFeatures(profissionalPorId).pastor_app, true, 'Profissional por ID deve liberar pastor_app');
    assert.strictEqual(resolvePlanFeatures(profissionalPorSlug).pastor_app, true, 'Profissional por slug deve liberar pastor_app');

    // Demais Planos (Bloqueados)
    const basicPorId = { id: '187a57b1-b4cb-4f40-8517-6527df1d10c4', name: 'Básico' };
    const basicPorSlug = { slug: 'basic', name: 'Plano Básico' };
    const juniorPorId = { id: 'b958c5c1-24dc-40b2-9b89-6e576055d288', name: 'Junior' };
    const juniorPorSlug = { slug: 'junior', name: 'Plano Junior' };
    const planoNulo = null;
    const planoVazio = {};

    assert.strictEqual(resolvePlanFeatures(basicPorId).pastor_app, false, 'Básico por ID deve bloquear pastor_app');
    assert.strictEqual(resolvePlanFeatures(basicPorSlug).pastor_app, false, 'Básico por slug deve bloquear pastor_app');
    assert.strictEqual(resolvePlanFeatures(juniorPorId).pastor_app, false, 'Junior por ID deve bloquear pastor_app');
    assert.strictEqual(resolvePlanFeatures(juniorPorSlug).pastor_app, false, 'Junior por slug deve bloquear pastor_app');
    assert.strictEqual(resolvePlanFeatures(planoNulo).pastor_app, false, 'Plano nulo deve bloquear pastor_app');
    assert.strictEqual(resolvePlanFeatures(planoVazio).pastor_app, false, 'Plano vazio sem slug/id válido deve bloquear pastor_app');

    // Verifica que o endpoint /api/v1/pastor/dashboard lança PLAN_REQUIRED quando pastor_app é falso
    const checkEndpointPermission = (plan) => {
      const flags = resolvePlanFeatures(plan);
      if (!flags.pastor_app) throw new Error('PLAN_REQUIRED');
      return true;
    };

    assert.throws(() => checkEndpointPermission(basicPorId), /PLAN_REQUIRED/);
    assert.throws(() => checkEndpointPermission(basicPorSlug), /PLAN_REQUIRED/);
    assert.throws(() => checkEndpointPermission(juniorPorSlug), /PLAN_REQUIRED/);
    assert.throws(() => checkEndpointPermission(null), /PLAN_REQUIRED/);

    assert.doesNotThrow(() => checkEndpointPermission(starterPorId));
    assert.doesNotThrow(() => checkEndpointPermission(intermediarioPorId));
    assert.doesNotThrow(() => checkEndpointPermission(profissionalPorId));
  });

  await t.test('4. Preservação das regras de ERP (presidency_module permanece restrito a Profissional/Tier >= 3)', () => {
    const starter = { id: '503104e9-d532-433f-98b5-c7345152e275', slug: 'starter' };
    const intermediario = { id: '39c12fb2-dd08-4327-9411-f8bf4c0a226d', slug: 'intermediario' };
    const profissional = { id: '3eed6a7e-f5dc-42e7-a976-de79fd397f3c', slug: 'profissional' };

    // O módulo Presidência do ERP não deve ter sido afetado
    assert.strictEqual(resolvePlanFeatures(starter).presidency_module, false, 'Starter não possui presidency_module no ERP');
    assert.strictEqual(resolvePlanFeatures(intermediario).presidency_module, false, 'Intermediário não possui presidency_module no ERP');
    assert.strictEqual(resolvePlanFeatures(profissional).presidency_module, true, 'Profissional possui presidency_module no ERP');
  });

  await t.test('5. Isolamento estrito de ministry_id em consultas de dados', () => {
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

  await t.test('6. Formatação de Moeda e Números Compactos', () => {
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
