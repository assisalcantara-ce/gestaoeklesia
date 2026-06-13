export interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  modulo?: string;
  ebdMenu?: boolean;
  submenu?: {
    id: string;
    label: string;
    icon: string;
    path: string;
    modulo?: string;
  }[];
}

export interface NavigationGroup {
  groupName: string;
  items: NavigationItem[];
}

export const NAVIGATION_STRUCTURE: NavigationGroup[] = [
  {
    groupName: "GERAL",
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dashboard', modulo: 'dashboard' },
      {
        id: 'configuracoes',
        label: 'Configurações',
        icon: '⚙️',
        path: '/configuracoes',
        modulo: 'configuracoes',
        submenu: [
          { id: 'config-geral', label: 'Geral', icon: '⚙️', path: '/configuracoes' },
          { id: 'config-cartoes', label: 'Cartões', icon: '🎫', path: '/configuracoes/cartoes' },
          { id: 'ativar-fluxo', label: 'Ativar Fluxo', icon: '🔄', path: '/secretaria/ativar-fluxo' },
        ]
      },
    ]
  },
  {
    groupName: "SECRETARIA",
    items: [
      { id: 'membros', label: 'Membros', icon: '👥', path: '/secretaria/membros', modulo: 'secretaria' },
      { id: 'departamentos', label: 'Departamentos', icon: '🏷️', path: '/secretaria/departamentos', modulo: 'secretaria_local' },
      { id: 'apresentacao-criancas', label: 'Apresentação de Crianças', icon: '🧒', path: '/secretaria/apresentacao-criancas', modulo: 'secretaria_local' },
      { id: 'batismo-aguas', label: 'Batismo nas Águas', icon: '✝️', path: '/secretaria/batismo-aguas', modulo: 'secretaria_local' },
      { id: 'casamento', label: 'Casamento', icon: '💍', path: '/secretaria/casamento', modulo: 'gestao' },
      { id: 'cartas', label: 'Cartas ministeriais', icon: '📜', path: '/secretaria/cartas', modulo: 'gestao' },
      { id: 'cartas-pedidos', label: 'Pedidos de Cartas', icon: '✉️', path: '/secretaria/cartas/pedidos', modulo: 'secretaria_local' },
      { id: 'certificados', label: 'Certificados', icon: '🎓', path: '/secretaria/certificados', modulo: 'gestao' },
      { id: 'relatorios-secretaria', label: 'Relatórios', icon: '📋', path: '/secretaria/relatorios', modulo: 'gestao' },
      { id: 'funcionarios', label: 'Funcionários', icon: '👔', path: '/secretaria/funcionarios', modulo: 'gestao' },
      { id: 'achados-perdidos', label: 'Achados e Perdidos', icon: '🔍', path: '/secretaria/achados-perdidos', modulo: 'gestao' },
      {
        id: 'comissao',
        label: 'Comissão',
        icon: '👥',
        path: '/comissao',
        modulo: 'comissao',
        submenu: [
          { id: 'comissoes', label: 'Comissões', icon: '👥', path: '/comissao', modulo: 'gestao' },
          { id: 'consagracao', label: 'Consagração (obreiros)', icon: '🙏', path: '/secretaria/consagracao' },
        ]
      },
    ]
  },
  {
    groupName: "FINANCEIRO",
    items: [
      { id: 'tesouraria', label: 'Tesouraria', icon: '💰', path: '/tesouraria', modulo: 'tesouraria' },
      {
        id: 'presidencia',
        label: 'Presidência',
        icon: '👑',
        path: '/presidencia',
        modulo: 'presidencia',
        submenu: [
          { id: 'presidencia-geral', label: 'Visão Geral', icon: '📋', path: '/presidencia', modulo: 'presidencia' },
          { id: 'consolidado-financeiro', label: 'Consolidado Financeiro', icon: '🏛️', path: '/presidencia/consolidado', modulo: 'consolidado_financeiro' },
          { id: 'prestacao-contas', label: 'Prestação de Contas', icon: '📄', path: '/presidencia/prestacao-contas', modulo: 'consolidado_financeiro' },
          { id: 'prestacao-contas-oficial', label: 'Prestação de Contas Oficial', icon: '📋', path: '/presidencia/prestacao-contas-oficial', modulo: 'consolidado_financeiro' },
          { id: 'auditoria-financeira', label: 'Auditoria Financeira', icon: '🔍', path: '/presidencia/auditoria', modulo: 'consolidado_financeiro' },
          { id: 'conselho-fiscal', label: 'Conselho Fiscal', icon: '⚖️', path: '/presidencia/conselho-fiscal', modulo: 'conselho_fiscal' },
        ]
      },
      { id: 'financeiro', label: 'Financeiro', icon: '💳', path: '/financeiro', modulo: 'financeiro' },
      { id: 'auditoria', label: 'Auditoria', icon: '✅', path: '/auditoria', modulo: 'auditoria' },
    ]
  },
  {
    groupName: "ENSINO",
    items: [
      {
        id: 'ebd',
        label: 'EBD',
        icon: '📖',
        path: '/ebd/dashboard/geral',
        modulo: 'ebd',
        ebdMenu: true,
      },
    ]
  },
  {
    groupName: "EVENTOS",
    items: [
      { id: 'eventos', label: 'Eventos', icon: '📅', path: '/eventos', modulo: 'eventos' },
    ]
  },
  {
    groupName: "ADMINISTRAÇÃO",
    items: [
      { id: 'usuarios', label: 'Usuários', icon: '👤', path: '/usuarios', modulo: 'usuarios' },
      { id: 'suporte', label: 'Suporte', icon: '🎫', path: '/suporte', modulo: 'suporte' },
      { id: 'reunioes', label: 'Reuniões', icon: '🤝', path: '/reunioes', modulo: 'reunioes' },
      { id: 'missoes', label: 'Missões', icon: '✈️', path: '/missoes', modulo: 'missoes' },
      { id: 'patrimonio', label: 'Patrimônio', icon: '🏢', path: '/patrimonio', modulo: 'patrimonio' },
      { id: 'geolocalizacao', label: 'Geolocalização', icon: '📍', path: '/geolocalizacao', modulo: 'geolocalizacao' },
    ]
  }
];
