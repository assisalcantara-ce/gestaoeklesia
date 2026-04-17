'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import EbdSidebarMenu, { ALL_EBD_IDS } from '@/components/EbdSidebarMenu';
import { useUserContext } from '@/hooks/useUserContext';

interface SidebarProps {
  activeMenu: string;
  setActiveMenu: (id: string) => void;
}

export default function Sidebar({ activeMenu, setActiveMenu }: SidebarProps) {
  const router = useRouter();
  const supabase = createClient();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const planFeatures = usePlanFeatures();
  const userCtx = useUserContext();

  // Auto-expande o menu pai quando um filho está ativo
  const parentMap: Record<string, string> = {
    'consagracao': 'comissao',
    'comissoes': 'comissao',
    'estrutura-hierarquica': 'secretaria',
    'membros': 'secretaria',
    'departamentos': 'secretaria',
    'apresentacao-criancas': 'secretaria',
    'batismo-aguas': 'secretaria',
    'cartas': 'secretaria',
    'cartas-pedidos': 'secretaria',
    'certificados': 'secretaria',
    'config-geral': 'configuracoes',
    'config-cartoes': 'configuracoes',
    'ativar-fluxo': 'configuracoes',
    // Todos os IDs EBD → raiz 'ebd' (EbdSidebarMenu gerencia expansão interna)
    ...Object.fromEntries(ALL_EBD_IDS.map(id => [id, 'ebd'])),
    // legados — compatibilidade com páginas ainda não migradas
    'ebd-historico': 'ebd',
    'ebd-trimestres': 'ebd',
    'ebd-chamada': 'ebd',
  };
  useEffect(() => {
    if (parentMap[activeMenu]) setExpandedMenu(parentMap[activeMenu]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu]);

  // Módulo que cada item requer (undefined = visível para todos autenticados)
  const allMenuItems = [
    { id: 'dashboard',        label: 'Dashboard',          icon: '📊', path: '/dashboard' },
    {
      id: 'secretaria',
      label: 'Secretaria',
      icon: '📝',
      path: '/secretaria',
      modulo: 'secretaria',
      submenu: [
        { id: 'estrutura-hierarquica', label: 'Estrutura Hierárquica',  icon: '🏛️', path: '/secretaria/estrutura-hierarquica', modulo: 'gestao'     },
        { id: 'membros',               label: 'Membros',                icon: '👥', path: '/secretaria/membros'                                       },
        { id: 'departamentos',         label: 'Departamentos',          icon: '🏷️', path: '/secretaria/departamentos'                                 },
        { id: 'apresentacao-criancas', label: 'Apresentação de Crianças', icon: '🧒', path: '/secretaria/apresentacao-criancas'                       },
        { id: 'batismo-aguas',         label: 'Batismo nas Águas',      icon: '✝️', path: '/secretaria/batismo-aguas'                                 },
        { id: 'cartas',                label: 'Cartas ministeriais',    icon: '📜', path: '/secretaria/cartas',         modulo: 'gestao'          },
        { id: 'cartas-pedidos',        label: 'Pedidos de Cartas',      icon: '✉️', path: '/secretaria/cartas/pedidos'                                },
        { id: 'certificados',          label: 'Certificados',           icon: '🎓', path: '/secretaria/certificados',  modulo: 'gestao'          },
      ]
    },
    { id: 'tesouraria', label: 'Tesouraria', icon: '💰', path: '/tesouraria', modulo: 'tesouraria' },
    {
      id: 'ebd',
      label: 'EBD',
      icon: '📖',
      path: '/ebd/dashboard/geral',
      modulo: 'ebd',
      ebdMenu: true,
    },
    { id: 'comissao', label: 'Comissão', icon: '👥', path: '/comissao', modulo: 'comissao', submenu: [
        { id: 'comissoes',   label: 'Comissões',              icon: '👥', path: '/comissao'                },
        { id: 'consagracao', label: 'Consagração (obreiros)', icon: '🙏', path: '/secretaria/consagracao'  },
      ]
    },
    { id: 'reunioes',         label: 'Reuniões',           icon: '🤝', path: '/reunioes',                   modulo: 'reunioes'   },
    { id: 'missoes',          label: 'Missões',            icon: '✈️', path: '/missoes',                    modulo: 'missoes'    },
    { id: 'eventos',          label: 'Eventos',            icon: '📅', path: '/eventos',                    modulo: 'eventos'    },
    { id: 'presidencia',      label: 'Presidência',        icon: '👑', path: '/presidencia'                                     },
    { id: 'patrimonio',       label: 'Patrimônio',         icon: '🏢', path: '/patrimonio',                 modulo: 'patrimonio' },
    { id: 'achados-perdidos', label: 'Achados e Perdidos', icon: '🔍', path: '/secretaria/achados-perdidos', modulo: 'secretaria' },
    { id: 'funcionarios',     label: 'Funcionários',       icon: '👔', path: '/secretaria/funcionarios',     modulo: 'gestao'     },
    { id: 'financeiro',       label: 'Financeiro',         icon: '💳', path: '/financeiro',                 modulo: 'financeiro' },
    { id: 'auditoria',        label: 'Auditoria',          icon: '✅', path: '/auditoria',                  modulo: 'auditoria'  },
    { id: 'usuarios',         label: 'Usuários',           icon: '👤', path: '/usuarios',                   modulo: 'usuarios'   },
    { id: 'suporte',          label: 'Suporte',            icon: '🎫', path: '/suporte'                                         },
    {
      id: 'configuracoes',
      label: 'Configurações',
      icon: '⚙️',
      path: '/configuracoes',
      modulo: 'configuracoes',
      submenu: [
        { id: 'config-geral',   label: 'Geral',        icon: '⚙️', path: '/configuracoes'           },
        { id: 'config-cartoes', label: 'Cartões',      icon: '🎫', path: '/configuracoes/cartoes'   },
        { id: 'ativar-fluxo',   label: 'Ativar Fluxo', icon: '🔄', path: '/secretaria/ativar-fluxo' },
      ]
    },
  ];

  // Filtra menus: 1) por plano  2) por nível de acesso do usuário
  const menuItems = allMenuItems.filter(i => {
    // Enquanto algum dos dois carrega, oculta itens sensíveis para não piscar
    if (planFeatures.loading || userCtx.loading) {
      return !['tesouraria', 'financeiro', 'eventos', 'reunioes', 'auditoria', 'usuarios'].includes(i.id);
    }
    // Filtro por plano
    if (i.id === 'tesouraria' && !planFeatures.has_modulo_financeiro)          return false;
    if (i.id === 'financeiro' && !planFeatures.has_modulo_financeiro_avancado) return false;
    if (i.id === 'eventos'    && !planFeatures.has_modulo_eventos)             return false;
    if (i.id === 'reunioes'   && !planFeatures.has_modulo_reunioes)            return false;
    // Filtro por permissão de nível
    const modulo = (i as any).modulo as string | undefined;
    if (modulo && !userCtx.podeAcessar(modulo)) return false;
    return true;
  });

  const handleNavigate = (id: string, path: string) => {
    setActiveMenu(id);
    router.push(path);
    setIsMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="w-64 bg-[#123b63] text-white shadow-lg flex flex-col h-full">
      {/* LOGO */}
      <div className="p-6 border-b border-white/20 flex items-center justify-center">
        <img
          src="/img/logo_menu.png"
          alt="Gestão Eklesia"
          className="h-16 object-contain"
        />
      </div>

      {/* MENU */}
      <nav className="flex-1 px-0 py-4 overflow-y-auto">
        <div className="space-y-0">
          {menuItems.map((item) => (
            <div key={item.id}>
              <button
                onClick={() => {
                  if ((item as any).submenu || (item as any).ebdMenu) {
                    setExpandedMenu(expandedMenu === item.id ? null : item.id);
                  } else {
                    handleNavigate(item.id, item.path);
                  }
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 transition ${activeMenu === item.id
                    ? 'bg-[#4A6FA5] text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
              >
                <span className="text-lg w-6 text-center">{item.icon}</span>
                <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                {((item as any).submenu || (item as any).ebdMenu) && (
                  <span className={`text-white/50 transition transform text-xs ${expandedMenu === item.id ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                )}
              </button>

              {/* SUBMENU FLAT — outros módulos */}
              {(item as any).submenu && expandedMenu === item.id && (
                <div className="bg-[#0f2a45] border-y border-white/10">
                  {((item as any).submenu as any[])
                    .filter((sub) => !sub.modulo || userCtx.podeAcessar(sub.modulo))
                    .map((submenu: any, index: number, arr: any[]) => (
                    <button
                      key={submenu.id}
                      onClick={() => handleNavigate(submenu.id, submenu.path)}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition text-sm text-left ${activeMenu === submenu.id
                          ? 'bg-white/20 text-white font-semibold'
                          : 'text-white/60 hover:bg-white/15 hover:text-white'
                        } ${index < arr.length - 1 ? 'border-b border-white/5' : ''}`}
                    >
                      <span className="text-orange-400 text-lg w-6 text-center">▸</span>
                      <span className="flex-1">{submenu.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* SUBMENU EBD — hierarquia de 3 níveis (EbdSidebarMenu) */}
              {(item as any).ebdMenu && expandedMenu === item.id && (
                <EbdSidebarMenu
                  activeMenu={activeMenu}
                  onNavigate={handleNavigate}
                />
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* FOOTER */}
      <div className="p-4 border-t border-white/20 space-y-3">
        <button
          onClick={() => {
            supabase.auth.signOut().finally(() => router.push('/'));
          }}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
        >
          Sair
        </button>
        <p className="text-center text-xs text-white/60">GESTÃO EKLESIA v1.0</p>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setIsMobileMenuOpen((open) => !open)}
        className="md:hidden fixed left-4 top-4 z-50 p-2 bg-white rounded-lg shadow-md text-[#123b63] hover:bg-gray-100 transition"
        aria-label="Menu"
        aria-expanded={isMobileMenuOpen}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {isMobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed left-0 top-0 h-full z-50 md:hidden">
            {sidebarContent}
          </div>
        </>
      )}

      <div className="hidden md:flex h-screen">
        {sidebarContent}
      </div>
    </>
  );
}
