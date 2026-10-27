import test from 'node:test';
import assert from 'node:assert/strict';
import {
  temAcesso,
  temAcessoEscrita,
  podeAcessarModuloFuncionarios,
  resolveNivel,
  type NivelAcesso,
} from '../../src/lib/access-control.js';

test('Revisão Final da Matriz de Permissões — Secretaria Geral e Tesouraria Geral', async (t) => {
  await t.test('1. Resolução dos perfis a partir de permissions e roles', () => {
    assert.equal(resolveNivel('operator', ['SECRETARIO_GERAL']), 'secretario_geral');
    assert.equal(resolveNivel('operator', ['TESOUREIRO_GERAL']), 'tesoureiro_geral');
    assert.equal(resolveNivel('secretario_geral', []), 'secretario_geral');
    assert.equal(resolveNivel('tesoureiro_geral', []), 'tesoureiro_geral');
  });

  await t.test('2. Secretaria Geral: Acessos Efetivos a Acolhimento, EBD, Reuniões, Missões e Módulos Administrativos Autorizados', () => {
    const nivel: NivelAcesso = 'secretario_geral';

    // Módulos novos solicitados
    assert.equal(temAcesso(nivel, 'ebd'), true, 'Secretaria Geral tem acesso a EBD');
    assert.equal(temAcesso(nivel, 'reunioes'), true, 'Secretaria Geral tem acesso a Reuniões');
    assert.equal(temAcesso(nivel, 'missoes'), true, 'Secretaria Geral tem acesso a Missões');

    // Acolhimento (Cultos, Visitantes, Livro Espiritual via secretaria, secretaria_local, gestao)
    assert.equal(temAcesso(nivel, 'secretaria'), true, 'Secretaria Geral tem acesso a Secretaria');
    assert.equal(temAcesso(nivel, 'secretaria_local'), true, 'Secretaria Geral tem acesso a Secretaria Local');
    assert.equal(temAcesso(nivel, 'gestao'), true, 'Secretaria Geral tem acesso a Gestão');

    // Módulos existentes preservados
    assert.equal(temAcesso(nivel, 'agenda'), true, 'Secretaria Geral mantém acesso à Agenda');
    assert.equal(temAcesso(nivel, 'comissao'), true, 'Secretaria Geral mantém acesso a Comissões');
    assert.equal(temAcesso(nivel, 'eventos'), true, 'Secretaria Geral mantém acesso a Eventos');
    assert.equal(temAcesso(nivel, 'patrimonio'), true, 'Secretaria Geral mantém acesso a Patrimônio');
    assert.equal(temAcesso(nivel, 'geolocalizacao'), true, 'Secretaria Geral mantém acesso a Geolocalização');
    assert.equal(temAcesso(nivel, 'dashboard'), true, 'Secretaria Geral mantém acesso ao Dashboard');
    assert.equal(temAcesso(nivel, 'suporte'), true, 'Secretaria Geral mantém acesso a Suporte');

    // Escrita correspondente
    assert.equal(temAcessoEscrita(nivel, 'ebd'), true);
    assert.equal(temAcessoEscrita(nivel, 'reunioes'), true);
    assert.equal(temAcessoEscrita(nivel, 'missoes'), true);
    assert.equal(temAcessoEscrita(nivel, 'eventos'), true);
  });

  await t.test('3. Secretaria Geral: Bloqueio Rigoroso a Funcionários e Tesouraria (Menu, Rota e API)', () => {
    const nivel: NivelAcesso = 'secretario_geral';

    // Bloqueio a Tesouraria
    assert.equal(temAcesso(nivel, 'tesouraria'), false, 'Secretaria Geral NÃO acessa Tesouraria');
    assert.equal(temAcesso(nivel, 'financeiro'), false, 'Secretaria Geral NÃO acessa Financeiro');
    assert.equal(temAcessoEscrita(nivel, 'tesouraria'), false);
    assert.equal(temAcessoEscrita(nivel, 'financeiro'), false);

    // Bloqueio a Funcionários
    assert.equal(temAcesso(nivel, 'funcionarios'), false, 'Secretaria Geral NÃO tem permissão de funcionarios');
    assert.equal(temAcessoEscrita(nivel, 'funcionarios'), false);
    assert.equal(podeAcessarModuloFuncionarios(nivel), false, 'Helper de autorização de Funcionários nega Secretaria Geral');
  });

  await t.test('4. Tesouraria Geral: Acesso a Funcionários via Permissão Específica SEM Acesso Indevido a "gestao" ou Outros Módulos', () => {
    const nivel: NivelAcesso = 'tesoureiro_geral';

    // Permissão específica de Funcionários concedida
    assert.equal(temAcesso(nivel, 'funcionarios'), true, 'Tesouraria Geral acessa Funcionários');
    assert.equal(temAcessoEscrita(nivel, 'funcionarios'), true, 'Tesouraria Geral tem escrita em Funcionários');
    assert.equal(podeAcessarModuloFuncionarios(nivel), true, 'Helper de autorização de Funcionários autoriza Tesouraria Geral');

    // Regra Obrigatória: NÃO deve ter acesso ao módulo genérico 'gestao'
    assert.equal(temAcesso(nivel, 'gestao'), false, 'Tesouraria Geral NÃO deve possuir permissão "gestao"');
    assert.equal(temAcessoEscrita(nivel, 'gestao'), false, 'Tesouraria Geral NÃO deve ter escrita em "gestao"');

    // Módulos administrativos que usam 'gestao' permanecem bloqueados para Tesouraria Geral
    // Ex: Casamento, Cartas, Relatórios da Secretaria, Achados e Perdidos, Comissões, Cultos, etc.
    assert.equal(temAcesso(nivel, 'secretaria'), false, 'Tesouraria Geral não tem acesso a Secretaria');
    assert.equal(temAcesso(nivel, 'secretaria_local'), false, 'Tesouraria Geral não tem acesso a Secretaria Local');
    assert.equal(temAcesso(nivel, 'comissao'), false, 'Tesouraria Geral não tem acesso a Comissões');
    assert.equal(temAcesso(nivel, 'ebd'), false, 'Tesouraria Geral não tem acesso a EBD');
    assert.equal(temAcesso(nivel, 'reunioes'), false, 'Tesouraria Geral não tem acesso a Reuniões');
    assert.equal(temAcesso(nivel, 'missoes'), false, 'Tesouraria Geral não tem acesso a Missões');
    assert.equal(temAcesso(nivel, 'patrimonio'), false, 'Tesouraria Geral não tem acesso a Patrimônio');
    assert.equal(temAcesso(nivel, 'geolocalizacao'), false, 'Tesouraria Geral não tem acesso a Geolocalização');

    // Acessos legítimos de Tesouraria preservados
    assert.equal(temAcesso(nivel, 'tesouraria'), true, 'Tesouraria Geral mantém acesso à Tesouraria');
    assert.equal(temAcessoEscrita(nivel, 'tesouraria'), true, 'Tesouraria Geral mantém escrita em Tesouraria');
    assert.equal(temAcesso(nivel, 'agenda'), true, 'Tesouraria Geral mantém acesso à Agenda');
    assert.equal(temAcesso(nivel, 'dashboard'), true, 'Tesouraria Geral mantém acesso ao Dashboard');
    assert.equal(temAcesso(nivel, 'suporte'), true, 'Tesouraria Geral mantém acesso a Suporte');
  });

  await t.test('5. Simulação de Autorização em APIs: Funcionários e Tesouraria', () => {
    // API de Funcionários: GET / POST / PATCH / DELETE
    assert.equal(podeAcessarModuloFuncionarios('tesoureiro_geral'), true, 'API Funcionários: Tesoureiro Geral autorizado');
    assert.equal(podeAcessarModuloFuncionarios('administrador'), true, 'API Funcionários: Administrador autorizado');
    assert.equal(podeAcessarModuloFuncionarios('secretario_geral'), false, 'API Funcionários: Secretaria Geral negado (403)');
    assert.equal(podeAcessarModuloFuncionarios('auxiliar_secretaria'), false, 'API Funcionários: Auxiliar negado (403)');
    assert.equal(podeAcessarModuloFuncionarios('tesouraria_local'), false, 'API Funcionários: Tesouraria Local negado (403)');

    // APIs de Tesouraria: categorias, contas, lancamentos
    assert.equal(temAcesso('tesoureiro_geral', 'tesouraria'), true, 'API Tesouraria: Tesoureiro Geral autorizado');
    assert.equal(temAcesso('administrador', 'tesouraria'), true, 'API Tesouraria: Administrador autorizado');
    assert.equal(temAcesso('secretario_geral', 'tesouraria'), false, 'API Tesouraria: Secretaria Geral negado (403)');
  });

  await t.test('6. Demais perfis permanecem inalterados', () => {
    assert.equal(temAcesso('administrador', 'secretaria'), true);
    assert.equal(temAcesso('administrador', 'tesouraria'), true);
    assert.equal(temAcesso('auxiliar_secretaria', 'secretaria'), true);
    assert.equal(temAcesso('auxiliar_secretaria', 'tesouraria'), false);
    assert.equal(temAcesso('tesouraria_local', 'tesouraria'), true);
    assert.equal(temAcesso('tesouraria_local', 'secretaria'), false);
    assert.equal(temAcesso('superintendente_ebd', 'ebd'), true);
  });
});
