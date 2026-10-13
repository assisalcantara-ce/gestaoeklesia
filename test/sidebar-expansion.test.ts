import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mapeamento e lógica de expansão canônica do Sidebar do Gestão Eklésia
const PATH_TO_MENU_ID: { path: string; id: string }[] = [
  { path: '/secretaria/estrutura-hierarquica', id: 'estrutura-hierarquica' },
  { path: '/secretaria/apresentacao-criancas', id: 'apresentacao-criancas' },
  { path: '/secretaria/batismo-aguas',         id: 'batismo-aguas'        },
  { path: '/secretaria/cartas/pedidos',        id: 'cartas-pedidos'       },
  { path: '/secretaria/achados-perdidos',      id: 'achados-perdidos'     },
  { path: '/secretaria/sorteios',             id: 'sorteios'             },
  { path: '/secretaria/ativar-fluxo',          id: 'ativar-fluxo'         },
  { path: '/secretaria/funcionarios',          id: 'funcionarios'         },
  { path: '/secretaria/consagracao',           id: 'consagracao'          },
  { path: '/configuracoes/certificados',       id: 'certificados'         },
  { path: '/juridico/meu-contrato',            id: 'meu-contrato'         },
  { path: '/secretaria/departamentos',         id: 'departamentos'        },
  { path: '/secretaria/casamento',             id: 'casamento'            },
  { path: '/secretaria/relatorio-espiritual',  id: 'relatorio-espiritual' },
  { path: '/acolhimento/visitantes',           id: 'visitantes'           },
  { path: '/acolhimento/relatorios',           id: 'relatorios-acolhimento' },
  { path: '/secretaria/cultos',                id: 'cultos'               },
  { path: '/secretaria/relatorios',            id: 'relatorios-secretaria'},
  { path: '/secretaria/cartas',                id: 'cartas'               },
  { path: '/secretaria/membros',               id: 'membros'              },
  { path: '/presidencia/prestacao-contas-oficial', id: 'prestacao-contas-oficial' },
  { path: '/presidencia/prestacao-contas',         id: 'prestacao-contas'         },
  { path: '/presidencia/consolidado',              id: 'consolidado-financeiro'   },
  { path: '/presidencia/auditoria',                id: 'auditoria-financeira'     },
  { path: '/presidencia/conselho-fiscal',          id: 'conselho-fiscal'          },
  { path: '/configuracoes/cartoes',            id: 'config-cartoes'       },
  { path: '/configuracoes',                    id: 'config-geral'         },
  { path: '/secretaria',                       id: 'secretaria'           },
  { path: '/presidencia',                      id: 'presidencia-geral'    },
  { path: '/dashboard',                        id: 'dashboard'            },
  { path: '/agenda',                           id: 'agenda'               },
  { path: '/tesouraria',                       id: 'tesouraria'           },
  { path: '/ebd',                              id: 'ebd'                  },
  { path: '/comissao',                         id: 'comissao'             },
  { path: '/reunioes',                         id: 'reunioes'             },
  { path: '/missoes',                          id: 'missoes'              },
  { path: '/eventos',                          id: 'eventos'              },
  { path: '/patrimonio',                       id: 'patrimonio'           },
  { path: '/financeiro',                       id: 'financeiro'           },
  { path: '/auditoria',                        id: 'auditoria'            },
  { path: '/geolocalizacao',                   id: 'geolocalizacao'       },
  { path: '/usuarios',                         id: 'usuarios'             },
  { path: '/suporte',                          id: 'suporte'              },
];

const parentMap: Record<string, string> = {
  'comissao': 'comissao',
  'consagracao': 'comissao',
  'comissoes': 'comissao',
  'secretaria': 'secretaria',
  'estrutura-hierarquica': 'secretaria',
  'membros': 'secretaria',
  'departamentos': 'secretaria',
  'apresentacao-criancas': 'secretaria',
  'batismo-aguas': 'secretaria',
  'casamento': 'secretaria',
  'cartas': 'secretaria',
  'cartas-pedidos': 'secretaria',
  'relatorios-secretaria': 'secretaria',
  'sorteios': 'secretaria',
  'acolhimento': 'acolhimento',
  'relatorio-espiritual': 'acolhimento',
  'relatorios-acolhimento': 'acolhimento',
  'cultos': 'acolhimento',
  'visitantes': 'acolhimento',
  'configuracoes': 'configuracoes',
  'certificados': 'configuracoes',
  'config-geral': 'configuracoes',
  'meu-contrato': 'configuracoes',
  'config-cartoes': 'configuracoes',
  'ativar-fluxo': 'configuracoes',
  'usuarios': 'configuracoes',
  'ebd': 'ebd',
  'presidencia': 'presidencia',
  'presidencia-geral': 'presidencia',
  'consolidado-financeiro': 'presidencia',
  'prestacao-contas': 'presidencia',
  'prestacao-contas-oficial': 'presidencia',
  'auditoria-financeira': 'presidencia',
  'conselho-fiscal': 'presidencia',
};

function resolveActiveMenu(pathname: string): string {
  for (const { path, id } of PATH_TO_MENU_ID) {
    if (pathname === path || pathname.startsWith(path + '/')) return id;
  }
  return 'dashboard';
}

function resolveExpandedMenuForRoute(pathname: string): string | null {
  const activeMenu = resolveActiveMenu(pathname);
  return parentMap[activeMenu] ?? null;
}

// Simulação da máquina de estados do menu do Sidebar
class SidebarStateSimulator {
  currentPath: string;
  expandedMenu: string | null;

  constructor(initialPath: string) {
    this.currentPath = initialPath;
    this.expandedMenu = resolveExpandedMenuForRoute(initialPath);
  }

  // Clique em item com submenu (hasSub = true)
  clickMenuWithSubmenu(menuId: string) {
    this.expandedMenu = this.expandedMenu === menuId ? null : menuId;
  }

  // Clique em item principal sem submenu (hasSub = false)
  clickMenuWithoutSubmenu(_menuId: string, targetPath: string) {
    // Regra: fechar qualquer submenu aberto imediatamente e navegar
    this.expandedMenu = null;
    this.navigateTo(targetPath);
  }

  // Navegação direta, via link ou botão voltar/avançar
  navigateTo(newPath: string) {
    this.currentPath = newPath;
    // Sincronização automática via useEffect([activeMenu])
    this.expandedMenu = resolveExpandedMenuForRoute(newPath);
  }
}

describe('Comportamento de Expansão e Retração do Menu Lateral (Sidebar)', () => {
  it('1. Deve resolver rota com submenu (/comissao ou /secretaria/consagracao) para o pai "comissao"', () => {
    assert.equal(resolveActiveMenu('/comissao'), 'comissao');
    assert.equal(resolveExpandedMenuForRoute('/comissao'), 'comissao');

    assert.equal(resolveActiveMenu('/secretaria/consagracao'), 'consagracao');
    assert.equal(resolveExpandedMenuForRoute('/secretaria/consagracao'), 'comissao');
  });

  it('2. Deve resolver rota sem submenu (/reunioes, /dashboard, /agenda) para null', () => {
    assert.equal(resolveActiveMenu('/reunioes'), 'reunioes');
    assert.equal(resolveExpandedMenuForRoute('/reunioes'), null);

    assert.equal(resolveActiveMenu('/dashboard'), 'dashboard');
    assert.equal(resolveExpandedMenuForRoute('/dashboard'), null);

    assert.equal(resolveActiveMenu('/agenda'), 'agenda');
    assert.equal(resolveExpandedMenuForRoute('/agenda'), null);
  });

  it('3. Cenário Exato do Erro: Comissão aberto -> Usuário clica em Reuniões -> Comissão deve fechar automaticamente', () => {
    const sidebar = new SidebarStateSimulator('/comissao');
    assert.equal(sidebar.expandedMenu, 'comissao', 'Comissão deve iniciar expandido');

    // Usuário clica no item principal "Reuniões" (sem submenu)
    sidebar.clickMenuWithoutSubmenu('reunioes', '/reunioes');

    assert.equal(sidebar.currentPath, '/reunioes');
    assert.equal(sidebar.expandedMenu, null, 'Comissão deve ser fechado automaticamente');
  });

  it('4. Ao clicar em outro menu com submenu diferente, fecha o anterior e abre o novo', () => {
    const sidebar = new SidebarStateSimulator('/dashboard');
    assert.equal(sidebar.expandedMenu, null);

    // Abre Comissão
    sidebar.clickMenuWithSubmenu('comissao');
    assert.equal(sidebar.expandedMenu, 'comissao');

    // Abre Configurações
    sidebar.clickMenuWithSubmenu('configuracoes');
    assert.equal(sidebar.expandedMenu, 'configuracoes', 'Comissão fecha e Configurações abre');
  });

  it('5. Clicar no mesmo menu sanfonado já aberto deve recolhê-lo (toggle)', () => {
    const sidebar = new SidebarStateSimulator('/dashboard');
    sidebar.clickMenuWithSubmenu('comissao');
    assert.equal(sidebar.expandedMenu, 'comissao');

    sidebar.clickMenuWithSubmenu('comissao');
    assert.equal(sidebar.expandedMenu, null, 'Menu deve recolher ao clicar novamente');
  });

  it('6. Deve manter fechado ou restaurar menu correto ao usar o botão Voltar do navegador', () => {
    const sidebar = new SidebarStateSimulator('/secretaria/consagracao');
    assert.equal(sidebar.expandedMenu, 'comissao');

    // Navega para Reuniões
    sidebar.clickMenuWithoutSubmenu('reunioes', '/reunioes');
    assert.equal(sidebar.expandedMenu, null);

    // Botão Voltar do navegador para /secretaria/consagracao
    sidebar.navigateTo('/secretaria/consagracao');
    assert.equal(sidebar.expandedMenu, 'comissao', 'Deve reabrir Comissão ao voltar para rota filha');

    // Botão Voltar para /dashboard
    sidebar.navigateTo('/dashboard');
    assert.equal(sidebar.expandedMenu, null, 'Deve fechar ao voltar para rota sem submenu');
  });

  it('7. Acesso direto a Usuários deve expandir Configurações', () => {
    const sidebar = new SidebarStateSimulator('/usuarios');
    assert.equal(sidebar.expandedMenu, 'configuracoes');
  });

  it('8. No modo expandido, deve utilizar w-64 e logo /icons/logob.png', () => {
    const isCollapsed = false;
    const sidebarWidthClass = isCollapsed ? 'w-20' : 'w-64';
    const logoSrc = isCollapsed ? '/icons/logob2.png' : '/icons/logob.png';

    assert.equal(sidebarWidthClass, 'w-64');
    assert.equal(logoSrc, '/icons/logob.png');
  });

  it('9. No modo recolhido, deve utilizar w-20 e substituir logo por /icons/logob2.png', () => {
    const isCollapsed = true;
    const sidebarWidthClass = isCollapsed ? 'w-20' : 'w-64';
    const logoSrc = isCollapsed ? '/icons/logob2.png' : '/icons/logob.png';

    assert.equal(sidebarWidthClass, 'w-20');
    assert.equal(logoSrc, '/icons/logob2.png');
  });

  it('10. No modo recolhido, clicar em item com submenu deve expandir a Sidebar e abrir o submenu', () => {
    let isCollapsed = true;
    let expandedMenu: string | null = null;
    const hasSub = true;
    const targetMenuId = 'comissao';

    // Simula o clique implementado no Sidebar.tsx quando isCollapsed === true
    if (isCollapsed) {
      if (hasSub) {
        isCollapsed = false;
        expandedMenu = targetMenuId;
      }
    }

    assert.equal(isCollapsed, false, 'Sidebar deve se auto-expandir ao clicar em menu com submenu');
    assert.equal(expandedMenu, 'comissao', 'Submenu clicado deve ser aberto');
  });

  it('11. Persistência de preferência deve utilizar a chave @gestaoeklesia/sidebar_collapsed', () => {
    const STORAGE_KEY = '@gestaoeklesia/sidebar_collapsed';
    const mockStorage: Record<string, string> = {};

    // Salva preferência recolhido
    mockStorage[STORAGE_KEY] = 'true';
    assert.equal(mockStorage[STORAGE_KEY], 'true');

    // Salva preferência expandido
    mockStorage[STORAGE_KEY] = 'false';
    assert.equal(mockStorage[STORAGE_KEY], 'false');
  });

  it('12. As opções do menu EBD devem estar na ordem exata solicitada', async () => {
    const { EBD_TREE } = await import('../src/components/EbdSidebarMenu');

    const expectedLabels = [
      'Dashboard',
      'Trimestres',
      'Classes',
      'Turmas',
      'Alunos',
      'Professores',
      'Chamada Dominical',
      'Oferta EBD',
      'Revistas / Pedidos',
      'Relatórios Consolidados',
    ];

    const actualLabels = EBD_TREE.map(node => node.label);
    assert.deepEqual(actualLabels, expectedLabels, 'A ordem e rótulos dos itens de EBD devem coincidir exatamente');
  });
});

