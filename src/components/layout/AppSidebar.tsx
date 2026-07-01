'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase-client';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import EbdSidebarMenu, { ALL_EBD_IDS } from '@/components/EbdSidebarMenu';
import { useUserContext } from '@/hooks/useUserContext';
import { BRAND } from '@/config/brand';
import { NAVIGATION_STRUCTURE, NavigationItem } from '@/config/navigation';

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
  { path: '/secretaria/relatorios',            id: 'relatorios-secretaria'},
  { path: '/secretaria/cultos',                id: 'cultos'               },
  { path: '/secretaria/relatorio-espiritual',  id: 'relatorio-espiritual' },
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

const GROUP_ICONS: Record<string, string> = {
  "GERAL": "📊",
  "SECRETARIA": "👥",
  "FINANCEIRO": "💰",
  "ENSINO": "📖",
  "EVENTOS": "📅",
  "ADMINISTRAÇÃO": "⚙️",
};

interface AppSidebarProps {
  setIsMobileMenuOpen: (open: boolean) => void;
}

export default function AppSidebar({ setIsMobileMenuOpen }: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const planFeatures = usePlanFeatures();
  const userCtx = useUserContext();

  const activeMenu = useMemo(() => {
    for (const { path, id } of PATH_TO_MENU_ID) {
      if (pathname === path || pathname.startsWith(path + '/')) return id;
    }
    return 'dashboard';
  }, [pathname]);

  const trialDaysLeft: number | null = (() => {
    if (planFeatures.loading || planFeatures.subscription_status !== 'trial' || !planFeatures.subscription_end_date) {
      return null;
    }
    const end = new Date(planFeatures.subscription_end_date);
    const now = new Date();
    const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.round((endDay - nowDay) / (1000 * 60 * 60 * 24));
  })();

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
    'sorteios': 'secretaria',
    'config-geral': 'configuracoes',
    'config-cartoes': 'configuracoes',
    'ativar-fluxo': 'configuracoes',
    ...Object.fromEntries(ALL_EBD_IDS.map(id => [id, 'ebd'])),
    'ebd-historico': 'ebd',
    'ebd-trimestres': 'ebd',
    'ebd-chamada': 'ebd',
    'conselho-fiscal':          'presidencia',
    'prestacao-contas-oficial': 'presidencia',
  };

  useEffect(() => {
    if (parentMap[activeMenu]) {
      setExpandedMenu(parentMap[activeMenu]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu]);

  const handleNavigate = (_id: string, path: string) => {
    router.push(path);
    setIsMobileMenuOpen(false);
  };

  const filterItem = (i: NavigationItem) => {
    if (planFeatures.loading || userCtx.loading) {
      return !['tesouraria', 'financeiro', 'eventos', 'reunioes', 'auditoria', 'usuarios', 'agenda'].includes(i.id);
    }
    if (i.id === 'tesouraria' && !planFeatures.has_modulo_financeiro)          return false;
    if (i.id === 'financeiro' && !planFeatures.has_modulo_financeiro_avancado) return false;
    if (i.id === 'eventos'    && !planFeatures.has_modulo_eventos)             return false;
    if (i.id === 'reunioes'   && !planFeatures.has_modulo_reunioes)            return false;
    if (i.id === 'agenda'     && !planFeatures.has_modulo_agenda)              return false;
    
    if (i.id === 'funcionarios') {
      const isLocal = userCtx.nivel && ['admin_local', 'financeiro_local', 'supervisor', 'viewer'].includes(userCtx.nivel);
      if (isLocal) return false;
    }
    const modulo = i.modulo;
    if (modulo && !userCtx.podeAcessar(modulo)) return false;
    return true;
  };

  const filteredGroups = useMemo(() => {
    return NAVIGATION_STRUCTURE.map(group => {
      const items = group.items.filter(filterItem);
      return { ...group, items };
    }).filter(group => group.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planFeatures.loading, userCtx.loading, planFeatures.has_modulo_financeiro, planFeatures.has_modulo_financeiro_avancado, planFeatures.has_modulo_eventos, planFeatures.has_modulo_reunioes, planFeatures.has_modulo_agenda, userCtx.nivel]);

  // Expand group associated with active item automatically
  useEffect(() => {
    const matchingGroup = filteredGroups.find(group =>
      group.items.some(
        item => item.id === activeMenu ||
        item.submenu?.some(sub => sub.id === activeMenu) ||
        (item.ebdMenu && ALL_EBD_IDS.includes(activeMenu))
      )
    );
    if (matchingGroup) {
      setExpandedGroup(matchingGroup.groupName);
    }
  }, [activeMenu, filteredGroups]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroup(prev => prev === groupName ? null : groupName);
  };

  const formatGroupName = (name: string) => {
    if (name === 'ADMINISTRAÇÃO') return 'Administração';
    return name.charAt(0) + name.slice(1).toLowerCase();
  };

  return (
    <div className="w-64 bg-[#0A2A4F] text-white shadow-lg flex flex-col h-dvh min-h-screen md:h-full shrink-0">
      {/* LOGO */}
      <div className="p-4 border-b border-white/5 flex items-center justify-center mb-1">
        <Image
          src={BRAND.logoHorizontal}
          alt="Gestão Eklésia"
          width={130}
          height={32}
          priority
          sizes="130px"
          className="h-[32px] w-auto object-contain select-none"
        />
      </div>

      {/* TRIAL BANNER */}
      {trialDaysLeft !== null && trialDaysLeft >= 0 && (
        <div className="mx-4 mt-3 mb-1 p-3 rounded-xl bg-amber-500/20 border border-amber-400/30">
          <p className="text-amber-300 text-xs font-semibold">🎯 Teste gratuito</p>
          <p className="text-white/80 text-xs mt-1">
            {trialDaysLeft === 0
              ? 'Último dia!'
              : `Restam ${trialDaysLeft} ${trialDaysLeft === 1 ? 'dia' : 'dias'}`}
          </p>
          <button
            onClick={() => router.push('/trial-expirado')}
            className="mt-2 w-full py-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white text-xs font-bold rounded-lg transition"
          >
            Assinar agora →
          </button>
        </div>
      )}

      {/* MENU */}
      <nav className="flex-1 px-0 py-2 overflow-y-auto space-y-1">
        {filteredGroups.map((group) => {
          const isGroupOpen = expandedGroup === group.groupName;
          const isGroupActive = group.items.some(
            item => item.id === activeMenu ||
            item.submenu?.some(sub => sub.id === activeMenu) ||
            (item.ebdMenu && ALL_EBD_IDS.includes(activeMenu))
          );

          return (
            <div key={group.groupName} className="space-y-0.5">
              {/* GROUP HEADER BUTTON */}
              <button
                onClick={() => toggleGroup(group.groupName)}
                className={`w-full flex items-center gap-3 px-4 py-2 transition-all duration-200 relative select-none ${
                  isGroupOpen ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                {isGroupActive && (
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[4px]"
                    style={{ backgroundColor: '#D4A017' }}
                  />
                )}
                <span className="text-base select-none">{GROUP_ICONS[group.groupName] || '📂'}</span>
                <span className="text-xs font-bold flex-1 text-left tracking-wide text-white">
                  {formatGroupName(group.groupName)}
                </span>
                <span className={`text-[#BFD2E8] transition-transform duration-200 text-[10px] ${isGroupOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {/* CHILD ITEMS (ACCORDION BODY) */}
              {isGroupOpen && (
                <div className="pl-4 ml-6 border-l border-white/10 my-1 space-y-1">
                  {group.items.map((item) => {
                    const isItemActive = activeMenu === item.id;
                    return (
                      <div key={item.id} className="relative">
                        <button
                          onClick={() => {
                            if (item.submenu || item.ebdMenu) {
                              setExpandedMenu(expandedMenu === item.id ? null : item.id);
                            } else {
                              handleNavigate(item.id, item.path);
                            }
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-r-md transition-all duration-200 relative text-left ${
                            isItemActive
                              ? 'bg-white/[0.14] text-white font-semibold'
                              : 'text-[#BFD2E8] hover:bg-white/[0.08] hover:text-white'
                          }`}
                        >
                          {isItemActive && (
                            <div
                              className="absolute left-0 top-0 bottom-0 w-[3px]"
                              style={{ backgroundColor: '#D4A017' }}
                            />
                          )}
                          <span className="text-sm select-none">{item.icon}</span>
                          <span className="text-xs font-semibold flex-1">{item.label}</span>
                          {(item.submenu || item.ebdMenu) && (
                            <span className={`text-white/40 transition transform text-[8px] ${expandedMenu === item.id ? 'rotate-180' : ''}`}>
                              ▼
                            </span>
                          )}
                        </button>

                        {/* SUBMENU FLAT */}
                        {item.submenu && expandedMenu === item.id && (
                          <div className="pl-3 border-l border-white/5 my-1 space-y-0.5">
                            {item.submenu
                              .filter((sub) => !sub.modulo || userCtx.podeAcessar(sub.modulo))
                              .filter((sub) => !(sub.id === 'cartas-pedidos' && userCtx.nivel === 'administrador'))
                              .map((submenu: any) => {
                                const isSubActive = activeMenu === submenu.id;
                                return (
                                  <button
                                    key={submenu.id}
                                    onClick={() => handleNavigate(submenu.id, submenu.path)}
                                    className={`w-full flex items-center gap-2 px-3 py-1 rounded transition text-[11px] text-left relative ${
                                      isSubActive
                                        ? 'bg-white/[0.14] text-white font-semibold'
                                        : 'text-[#BFD2E8]/80 hover:bg-white/[0.08] hover:text-white'
                                    }`}
                                  >
                                    {isSubActive && (
                                      <div
                                        className="absolute left-0 top-0 bottom-0 w-[2px]"
                                        style={{ backgroundColor: '#D4A017' }}
                                      />
                                    )}
                                    <span className="text-xs">▸</span>
                                    <span className="flex-1 font-medium">{submenu.label}</span>
                                  </button>
                                );
                              })}
                          </div>
                        )}

                        {/* SUBMENU EBD */}
                        {item.ebdMenu && expandedMenu === item.id && (
                          <div className="pl-3 border-l border-white/5 my-1">
                            <EbdSidebarMenu
                              activeMenu={activeMenu}
                              onNavigate={handleNavigate}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* FOOTER */}
      <div className="p-3 border-t border-white/5 space-y-2">
        <button
          onClick={() => {
            supabase.auth.signOut().finally(() => router.push('/'));
          }}
          className="w-full py-1.5 px-3 border border-white/10 hover:bg-red-600/10 hover:border-red-600/30 text-white/70 hover:text-red-400 active:scale-95 rounded-lg text-[11px] font-semibold transition-all duration-150 flex items-center justify-center gap-2"
        >
          <span>🚪</span> Sair
        </button>
        <p className="text-center text-[9px] text-[#BFD2E8]/40 font-semibold select-none">
          GESTÃO EKLÉSIA v1.0
        </p>
      </div>
    </div>
  );
}
