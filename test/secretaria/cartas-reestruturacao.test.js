import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('Cartas e Declarações - Reestruturação e Conformidade de Menus e Rotas', async (t) => {
  await t.test('1. Sidebar e Navigation incluem Cartas e Declarações em Configurações ao lado de Cartões e Certificados', () => {
    const navContent = fs.readFileSync(path.join(projectRoot, 'src/config/navigation.ts'), 'utf-8');
    const sidebarContent = fs.readFileSync(path.join(projectRoot, 'src/components/Sidebar.tsx'), 'utf-8');
    const appSidebarContent = fs.readFileSync(path.join(projectRoot, 'src/components/layout/AppSidebar.tsx'), 'utf-8');

    // navigation.ts
    assert.match(navContent, /id:\s*['"]config-cartas['"]/);
    assert.match(navContent, /path:\s*['"]\/configuracoes\/cartas['"]/);
    assert.match(navContent, /label:\s*['"]Cartas e Declarações['"]/);

    // Sidebar.tsx
    assert.match(sidebarContent, /id:\s*['"]config-cartas['"]/);
    assert.match(sidebarContent, /path:\s*['"]\/configuracoes\/cartas['"]/);

    // AppSidebar.tsx
    assert.match(appSidebarContent, /'config-cartas':\s*['"]configuracoes['"]/);
  });

  await t.test('2. Página operacional /secretaria/cartas não contém aba "modelos" e mantém ordem Emitir -> Pedidos -> Histórico', () => {
    const secretariaPage = fs.readFileSync(path.join(projectRoot, 'src/app/secretaria/cartas/page.tsx'), 'utf-8');

    // Default tab must be 'emitir'
    assert.match(secretariaPage, /useState\(['"]emitir['"]\)/);

    // Tab definition array order
    assert.match(secretariaPage, /const tabs = \[([\s\S]*?)\];/);
    const tabsMatch = secretariaPage.match(/const tabs = \[([\s\S]*?)\];/);
    assert.ok(tabsMatch, 'Tabs array should exist in page.tsx');
    const tabsBody = tabsMatch[1];

    // Ensure order is emitir -> pedidos -> historico
    const emitirIdx = tabsBody.indexOf("'emitir'");
    const pedidosIdx = tabsBody.indexOf("'pedidos'");
    const historicoIdx = tabsBody.indexOf("'historico'");

    assert.ok(emitirIdx !== -1, "'emitir' tab must exist");
    assert.ok(pedidosIdx !== -1, "'pedidos' tab must exist");
    assert.ok(historicoIdx !== -1, "'historico' tab must exist");
    assert.ok(emitirIdx < pedidosIdx, "'emitir' must come before 'pedidos'");
    assert.ok(pedidosIdx < historicoIdx, "'pedidos' must come before 'historico'");

    // 'modelos' must NOT be in tabs
    assert.ok(!tabsBody.includes("'modelos'"), "'modelos' must not be in operational tabs array");
  });

  await t.test('3. Configurações /configuracoes/cartas está protegida pelo perfil MASTER e possui editor completo', () => {
    const configPage = fs.readFileSync(path.join(projectRoot, 'src/app/configuracoes/cartas/page.tsx'), 'utf-8');

    // Checks permission and user context isMaster
    assert.match(configPage, /useUserContext/);
    assert.match(configPage, /userCtx\.isMaster/);
    assert.match(configPage, /Acesso Exclusivo MASTER/);

    // InteractiveCanvas integrated
    assert.match(configPage, /InteractiveCanvas/);
    assert.match(configPage, /Copiar JSON/);
    assert.match(configPage, /Salvar Modelo/);
    assert.match(configPage, /Restaurar Nativo/);
  });

  await t.test('4. API /api/v1/cartas/templates protege operações de escrita e exclusão apenas para MASTER', () => {
    const apiRoute = fs.readFileSync(path.join(projectRoot, 'src/app/api/v1/cartas/templates/route.ts'), 'utf-8');

    assert.match(apiRoute, /isMasterUsuarioMinisterio/);
    // POST handler check
    assert.match(apiRoute, /export async function POST/);
    assert.match(apiRoute, /403/);
    // DELETE handler check
    assert.match(apiRoute, /export async function DELETE/);
    // Scoped by ministry_id for multi-tenant isolation
    assert.match(apiRoute, /ministry_id/);
  });

  await t.test('5. API /api/v1/cartas/uploads protege uploads de imagem e fundo apenas para MASTER', () => {
    const uploadRoute = fs.readFileSync(path.join(projectRoot, 'src/app/api/v1/cartas/uploads/route.ts'), 'utf-8');

    assert.match(uploadRoute, /isMasterUsuarioMinisterio/);
    assert.match(uploadRoute, /export async function POST/);
    assert.match(uploadRoute, /Somente o perfil MASTER possui permissão para gerenciar modelos de cartas/);
  });
});
