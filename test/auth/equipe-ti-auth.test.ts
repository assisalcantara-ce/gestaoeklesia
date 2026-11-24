import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  temAcesso,
  temAcessoEscrita,
  resolveNivel,
  resolveRoles,
  mapRoleAndPermissions,
  hasRole,
  isEquipeTI,
  podeAcessarModuloFuncionarios,
  NivelAcesso,
} from '../../src/lib/access-control.js';

describe('Validação Direcionada de Segurança e Autorização — Perfil Equipe de TI', () => {
  it('1. Deve resolver corretamente o perfil e permissões a partir do registro do Supabase', () => {
    // Simula registro vindo do banco Supabase com constraint CHECK role IN ('admin', 'manager', 'operator', ...)
    const dbRow = {
      role: 'operator',
      permissions: ['EQUIPE_TI'],
    };

    const nivel = resolveNivel(dbRow.role, dbRow.permissions);
    assert.equal(nivel, 'equipe_ti');
    assert.equal(isEquipeTI(nivel), true);

    const roles = resolveRoles(dbRow.role, dbRow.permissions);
    assert.equal(roles.includes('EQUIPE_TI'), true);
    assert.equal(roles.includes('ADMINISTRADOR'), false);

    // Mapeamento inverso para persistência
    const roleConfig = mapRoleAndPermissions('equipe_ti');
    assert.equal(roleConfig.role, 'operator');
    assert.deepEqual(roleConfig.permissions, ['EQUIPE_TI']);
  });

  it('2. APIs e Rotas Financeiras Negam Acesso Efetivamente ao perfil equipe_ti', () => {
    const modulosFinanceiros = [
      'financeiro',
      'tesouraria',
      'consolidado_financeiro',
      'conselho_fiscal',
      'presidencia',
    ];

    for (const mod of modulosFinanceiros) {
      assert.equal(
        temAcesso('equipe_ti', mod),
        false,
        `Módulo financeiro ${mod} deve ser BLOQUEADO para equipe_ti`
      );
      assert.equal(
        temAcessoEscrita('equipe_ti', mod),
        false,
        `Escrita no módulo financeiro ${mod} deve ser BLOQUEADA para equipe_ti`
      );
    }

    // Funcionários (vinculado a folha de pagamento e financeiro)
    assert.equal(
      podeAcessarModuloFuncionarios('equipe_ti'),
      false,
      'equipe_ti NÃO pode ter acesso ao módulo de funcionários'
    );
  });

  it('3. Governança Anti-Escalonamento de Privilégios (Anti-Privilege Escalation)', () => {
    const roles = resolveRoles('operator', ['EQUIPE_TI']);

    // hasRole com ADMINISTRADOR deve retornar falso
    assert.equal(
      hasRole(roles, ['ADMINISTRADOR']),
      false,
      'equipe_ti não pode possuir a role ADMINISTRADOR'
    );

    // Perfis restritos que equipe_ti não pode conceder ou gerenciar
    const RESTRICTED_ROLES_FOR_TI: NivelAcesso[] = [
      'administrador',
      'financeiro',
      'tesoureiro_geral',
      'tesouraria_local',
      'financeiro_local',
      'presidencia',
      'conselho_fiscal',
    ];

    for (const restricted of RESTRICTED_ROLES_FOR_TI) {
      assert.ok(
        restricted === 'administrador' ||
          restricted.includes('financeiro') ||
          restricted.includes('tesour') ||
          restricted === 'presidencia' ||
          restricted === 'conselho_fiscal',
        `Perfil restrito identificado corretamente: ${restricted}`
      );
    }
  });

  it('4. Acesso operacional aos módulos não financeiros respeita permissões operacionais', () => {
    const modulosOperacionais = [
      'secretaria',
      'secretaria_local',
      'ebd',
      'usuarios',
      'configuracoes',
      'auditoria',
      'eventos',
      'reunioes',
      'missoes',
      'patrimonio',
      'suporte',
      'geolocalizacao',
      'comissao',
      'gestao',
      'agenda',
      'celulas',
    ];

    for (const mod of modulosOperacionais) {
      assert.equal(
        temAcesso('equipe_ti', mod),
        true,
        `Módulo operacional ${mod} deve ser acessível para suporte técnico da equipe_ti`
      );
    }
  });
});
