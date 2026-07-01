'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase-client';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import EbdSidebarMenu, { ALL_EBD_IDS } from '@/components/EbdSidebarMenu';
import { useUserContext } from '@/hooks/useUserContext';

// Mapa estático path → id de menu (mais específico primeiro)
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
  { path: '/secretaria/certificados',          id: 'certificados'         },
  { path: '/secretaria/departamentos',         id: 'departamentos'        },
  { path: '/secretaria/casamento',             id: 'casamento'            },
  { path: '/secretaria/relatorio-espiritual',  id: 'relatorio-espiritual' },
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
  { path: '/tesouraria',                       id: 'tesouraria'           },
  { path: '/ebd',                              id: 'ebd'                  },
  { path: '/comissao',                         id: 'comissoes'            },
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

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const planFeatures = usePlanFeatures();
  const userCtx = useUserContext();

  // Deriva o menu ativo a partir da URL atual
  const activeMenu = useMemo(() => {
    for (const { path, id } of PATH_TO_MENU_ID) {
      if (pathname === path || pathname.startsWith(path + '/')) return id;
    }
    return 'dashboard';
  }, [pathname]);

  // Calcula dias restantes do trial usando dias calendário (sem influência de hora/fuso)
  // Equivalente ao differenceInCalendarDays() do date-fns:
  // normaliza ambas as datas para meia-noite UTC antes de subtrair.
  // Math.ceil era usado antes e resultava em +1 dia quando subscription_end_date
  // tinha componente de hora ligeiramente adiantado em relação ao momento da checagem.
  const trialDaysLeft: number | null = (() => {
    if (planFeatures.loading) return null;
    if (planFeatures.subscription_status !== 'trial') return null;
    if (!planFeatures.subscription_end_date) return null;

    const end = new Date(planFeatures.subscription_end_date);
    const now = new Date();

    // Zera o componente de hora comparando apenas a data calendário em UTC
    const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    return Math.round((endDay - nowDay) / (1000 * 60 * 60 * 24));
  })();

  // Auto-expande o menu pai quando um filho está ativo
  const parentMap: Record<string, string> = {
    'consagracao': 'comissao',
    'comissoes': 'comissao',
    'estrutura-hierarquica': 'secretaria',
    'membros': 'secretaria',
    'departamentos': 'secretaria',
    'apresentacao-criancas': 'secretaria',
    'batismo-aguas': 'secretaria',
    'casamento': 'secretaria',
    'cartas': 'secretaria',
    'cartas-pedidos': 'secretaria',
    'certificados': 'secretaria',
    'relatorios-secretaria': 'secretaria',
    'relatorio-espiritual': 'secretaria',
    'cultos': 'secretaria',
    'config-geral': 'configuracoes',
    'config-cartoes': 'configuracoes',
    'ativar-fluxo': 'configuracoes',
    // Todos os IDs EBD → raiz 'ebd' (EbdSidebarMenu gerencia expansão interna)
    ...Object.fromEntries(ALL_EBD_IDS.map(id => [id, 'ebd'])),
    // legados — compatibilidade com páginas ainda não migradas
    'ebd-historico': 'ebd',
    'ebd-trimestres': 'ebd',
    'ebd-chamada': 'ebd',
    // Presidência subpages
    'conselho-fiscal':          'presidencia',
    'prestacao-contas-oficial': 'presidencia',
  };
  useEffect(() => {
    if (parentMap[activeMenu]) setExpandedMenu(parentMap[activeMenu]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu]);

  // Módulo que cada item requer (undefined = visível para todos autenticados)
  const allMenuItems = [
    { id: 'dashboard',        label: 'Dashboard',          icon: '📊', path: '/dashboard',   modulo: 'dashboard'  },
    {
      id: 'secretaria',
      label: 'Secretaria',
      icon: '📝',
      path: '/secretaria',
      modulo: 'secretaria',
      submenu: [
        { id: 'estrutura-hierarquica', label: 'Estrutura Hierárquica',  icon: '🏛️', path: '/secretaria/estrutura-hierarquica', modulo: 'gestao'          },
        { id: 'membros',               label: 'Membros',                icon: '👥', path: '/secretaria/membros'                                            },
        { id: 'departamentos',         label: 'Departamentos',          icon: '🏷️', path: '/secretaria/departamentos',          modulo: 'secretaria_local' },
        { id: 'apresentacao-criancas', label: 'Apresentação de Crianças', icon: '🧒', path: '/secretaria/apresentacao-criancas', modulo: 'secretaria_local' },
        { id: 'batismo-aguas',         label: 'Batismo nas Águas',      icon: '✝️', path: '/secretaria/batismo-aguas',          modulo: 'secretaria_local' },
        { id: 'casamento',             label: 'Casamento',              icon: '💍', path: '/secretaria/casamento',              modulo: 'gestao'           },
        { id: 'cartas',                label: 'Cartas ministeriais',    icon: '📜', path: '/secretaria/cartas',                 modulo: 'gestao'          },
        { id: 'cartas-pedidos',        label: 'Pedidos de Cartas',      icon: '✉️', path: '/secretaria/cartas/pedidos',         modulo: 'secretaria_local' },
        { id: 'certificados',          label: 'Certificados',           icon: '🎓', path: '/secretaria/certificados',           modulo: 'gestao'          },
        { id: 'relatorios-secretaria', label: 'Relatórios',              icon: '📋', path: '/secretaria/relatorios',             modulo: 'gestao'          },
        { id: 'cultos',                label: 'Cultos',                  icon: '⛪', path: '/secretaria/cultos',                 modulo: 'gestao'          },
        { id: 'relatorio-espiritual',  label: 'Relatório Espiritual',    icon: '🕊️', path: '/secretaria/relatorio-espiritual',   modulo: 'gestao'          },
      ]
    },
    { id: 'tesouraria', label: 'Tesouraria', icon: '💰', path: '/tesouraria', modulo: 'tesouraria' },
    { id: 'agenda',           label: 'Agenda',             icon: '📅', path: '/agenda',      modulo: 'agenda'     },
    {
      id: 'ebd',
      label: 'EBD',
      icon: '📖',
      path: '/ebd/dashboard/geral',
      modulo: 'ebd',
      ebdMenu: true,
    },
    { id: 'comissao', label: 'Comissão', icon: '👥', path: '/comissao', modulo: 'comissao', submenu: [
        { id: 'comissoes',   label: 'Comissões',              icon: '👥', path: '/comissao',               modulo: 'gestao' },
        { id: 'consagracao', label: 'Consagração (obreiros)', icon: '🙏', path: '/secretaria/consagracao'  },
      ]
    },
    { id: 'reunioes',         label: 'Reuniões',           icon: '🤝', path: '/reunioes',                   modulo: 'reunioes'   },
    { id: 'missoes',          label: 'Missões',            icon: '✈️', path: '/missoes',                    modulo: 'missoes'    },
    { id: 'eventos',          label: 'Eventos',            icon: '📅', path: '/eventos',                    modulo: 'eventos'    },
    {
      id: 'presidencia',
      label: 'Presidência',
      icon: '👑',
      path: '/presidencia',
      modulo: 'presidencia',
      submenu: [
        { id: 'presidencia-geral',        label: 'Visão Geral',             icon: '📋', path: '/presidencia',                     modulo: 'presidencia'           },
        { id: 'consolidado-financeiro',   label: 'Consolidado Financeiro',  icon: '🏛️', path: '/presidencia/consolidado',        modulo: 'consolidado_financeiro' },
        { id: 'prestacao-contas',          label: 'Prestação de Contas',        icon: '📄', path: '/presidencia/prestacao-contas',          modulo: 'consolidado_financeiro' },
        { id: 'prestacao-contas-oficial', label: 'Prestação de Contas Oficial', icon: '📋', path: '/presidencia/prestacao-contas-oficial', modulo: 'consolidado_financeiro' },
        { id: 'auditoria-financeira',     label: 'Auditoria Financeira',       icon: '🔍', path: '/presidencia/auditoria',                modulo: 'consolidado_financeiro' },
        { id: 'conselho-fiscal',          label: 'Conselho Fiscal',         icon: '⚖️', path: '/presidencia/conselho-fiscal',   modulo: 'conselho_fiscal'        },
      ]
    },
    { id: 'patrimonio',       label: 'Patrimônio',         icon: '🏢', path: '/patrimonio',                 modulo: 'patrimonio' },
    { id: 'achados-perdidos', label: 'Achados e Perdidos', icon: '🔍', path: '/secretaria/achados-perdidos', modulo: 'gestao' },
    { id: 'funcionarios',     label: 'Funcionários',       icon: '👔', path: '/secretaria/funcionarios',     modulo: 'gestao'     },
    { id: 'financeiro',       label: 'Financeiro',         icon: '💳', path: '/financeiro',                 modulo: 'financeiro' },
    { id: 'auditoria',        label: 'Auditoria',          icon: '✅', path: '/auditoria',                  modulo: 'auditoria'       },
    { id: 'geolocalizacao',   label: 'Geolocalização',     icon: '📍', path: '/geolocalizacao',              modulo: 'geolocalizacao'  },
    { id: 'usuarios',         label: 'Usuários',           icon: '👤', path: '/usuarios',                   modulo: 'usuarios'        },
    { id: 'suporte',          label: 'Suporte',            icon: '🎫', path: '/suporte',       modulo: 'suporte'    },
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
      return !['tesouraria', 'financeiro', 'eventos', 'reunioes', 'auditoria', 'usuarios', 'agenda'].includes(i.id);
    }
    // Filtro por plano
    if (i.id === 'tesouraria' && !planFeatures.has_modulo_financeiro)          return false;
    if (i.id === 'financeiro' && !planFeatures.has_modulo_financeiro_avancado) return false;
    if (i.id === 'eventos'    && !planFeatures.has_modulo_eventos)             return false;
    if (i.id === 'reunioes'   && !planFeatures.has_modulo_reunioes)            return false;
    if (i.id === 'agenda'     && !planFeatures.has_modulo_agenda)              return false;
    if (i.id === 'funcionarios') {
      const isLocal = userCtx.nivel && ['admin_local', 'financeiro_local', 'supervisor', 'viewer'].includes(userCtx.nivel);
      if (isLocal) return false;
    }
    // Filtro por permissão de nível
    const modulo = (i as any).modulo as string | undefined;
    if (modulo && !userCtx.podeAcessar(modulo)) return false;
    return true;
  });

  const handleNavigate = (_id: string, path: string) => {
    router.push(path);
    setIsMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="w-64 bg-[#123b63] text-white shadow-lg flex flex-col h-full">
      {/* LOGO */}
      <div className="p-6 border-b border-white/20 flex items-center justify-center">
        <Image
          src="/img/logoh.png"
          alt="Gestão Eklésia"
          width={190}
          height={53}
          priority
          sizes="190px"
          className="h-[53px] w-auto object-contain"
        />
      </div>

      {/* TRIAL BANNER — exibe durante período de teste, incluindo o dia de expiração */}
      {trialDaysLeft !== null && trialDaysLeft >= 0 && (
        <div className="mx-3 mt-3 mb-1 p-3 rounded-lg bg-amber-500/20 border border-amber-400/30">
          <p className="text-amber-300 text-xs font-semibold">🎯 Teste gratuito</p>
          <p className="text-white/80 text-xs mt-1">
            {trialDaysLeft === 0
              ? 'Último dia!'
              : `Restam ${trialDaysLeft} ${trialDaysLeft === 1 ? 'dia' : 'dias'}`}
          </p>
          <button
            onClick={() => router.push('/trial-expirado')}
            className="mt-2 w-full py-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white text-xs font-bold rounded transition"
          >
            Assinar agora →
          </button>
        </div>
      )}

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
                    .filter((sub) => !(sub.id === 'cartas-pedidos' && userCtx.nivel === 'administrador'))
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
