'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase-client';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { FeatureFlag } from '@/lib/feature-flags';
import EbdSidebarMenu, { ALL_EBD_IDS } from '@/components/EbdSidebarMenu';
import { useUserContext } from '@/hooks/useUserContext';
import {
  LayoutDashboard,
  FileText,
  BadgeDollarSign,
  Users2,
  CalendarDays,
  BookOpen,
  UserCheck,
  Handshake,
  Plane,
  CalendarCheck,
  Crown,
  Building2,
  Search,
  UserCog,
  CreditCard,
  CheckCircle2,
  MapPin,
  Users,
  LifeBuoy,
  Settings,
  ChevronDown,
  LogOut,
  Sparkles,
  Menu,
  X,
  LucideIcon,
} from 'lucide-react';

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

interface MenuItemDef {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  modulo?: string;
  featureFlag?: FeatureFlag;
  planFeature?: string;
  ebdMenu?: boolean;
  submenu?: Array<{
    id: string;
    label: string;
    path: string;
    modulo?: string;
    featureFlag?: FeatureFlag;
    planFeature?: string;
  }>;
}

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

  // Calcula dias restantes do trial
  const trialDaysLeft: number | null = (() => {
    if (planFeatures.loading) return null;
    if (planFeatures.subscription_status !== 'trial') return null;
    if (!planFeatures.subscription_end_date) return null;

    const end = new Date(planFeatures.subscription_end_date);
    const now = new Date();

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
    'certificados': 'configuracoes',
    'relatorio-espiritual': 'acolhimento',
    'relatorios-acolhimento': 'acolhimento',
    'cultos': 'acolhimento',
    'visitantes': 'acolhimento',
    'sorteios': 'secretaria',
    'config-geral': 'configuracoes',
    'meu-contrato': 'configuracoes',
    'config-cartoes': 'configuracoes',
    'ativar-fluxo': 'configuracoes',
    ...Object.fromEntries(ALL_EBD_IDS.map(id => [id, 'ebd'])),
    'ebd-historico': 'ebd',
    'ebd-trimestres': 'ebd',
    'ebd-chamada': 'ebd',
    'presidencia-geral': 'presidencia',
    'consolidado-financeiro': 'presidencia',
    'prestacao-contas': 'presidencia',
    'prestacao-contas-oficial': 'presidencia',
    'auditoria-financeira': 'presidencia',
    'conselho-fiscal': 'presidencia',
  };

  useEffect(() => {
    if (parentMap[activeMenu]) {
      setExpandedMenu(parentMap[activeMenu]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu]);

  // Lista com ícones Lucide padronizados
  const allMenuItems: MenuItemDef[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', modulo: 'dashboard' },
    {
      id: 'secretaria',
      label: 'Secretaria',
      icon: FileText,
      path: '/secretaria',
      modulo: 'secretaria',
      submenu: [
        { id: 'estrutura-hierarquica', label: 'Estrutura Hierárquica', path: '/secretaria/estrutura-hierarquica', modulo: 'gestao' },
        { id: 'membros', label: 'Membros', path: '/secretaria/membros' },
        { id: 'departamentos', label: 'Departamentos', path: '/secretaria/departamentos', modulo: 'secretaria_local' },
        { id: 'apresentacao-criancas', label: 'Apresentação de Crianças', path: '/secretaria/apresentacao-criancas', modulo: 'secretaria_local', featureFlag: 'kids_module', planFeature: 'has_modulo_kids' },
        { id: 'batismo-aguas', label: 'Batismo nas Águas', path: '/secretaria/batismo-aguas', modulo: 'secretaria_local' },
        { id: 'casamento', label: 'Casamento', path: '/secretaria/casamento', modulo: 'gestao' },
        { id: 'cartas', label: 'Cartas e Declarações', path: '/secretaria/cartas', modulo: 'gestao' },
        { id: 'cartas-pedidos', label: 'Pedidos de Cartas', path: '/secretaria/cartas/pedidos', modulo: 'secretaria_local' },
        { id: 'relatorios-secretaria', label: 'Relatórios', path: '/secretaria/relatorios', modulo: 'gestao' },
        { id: 'sorteios', label: 'Sorteios', path: '/secretaria/sorteios', modulo: 'secretaria_local' },
      ],
    },
    {
      id: 'tesouraria',
      label: 'Tesouraria',
      icon: BadgeDollarSign,
      path: '/tesouraria',
      modulo: 'tesouraria',
    },
    {
      id: 'acolhimento',
      label: 'Acolhimento',
      icon: Users2,
      path: '/secretaria/cultos',
      modulo: 'secretaria',
      submenu: [
        { id: 'cultos', label: 'Cultos', path: '/secretaria/cultos', modulo: 'gestao' },
        { id: 'visitantes', label: 'Visitantes', path: '/acolhimento/visitantes', modulo: 'secretaria_local' },
        { id: 'relatorio-espiritual', label: 'Livro Espiritual', path: '/secretaria/relatorio-espiritual', modulo: 'gestao' },
        { id: 'relatorios-acolhimento', label: 'Relatórios', path: '/acolhimento/relatorios', modulo: 'gestao' },
      ],
    },
    { id: 'agenda', label: 'Agenda', icon: CalendarDays, path: '/agenda', modulo: 'agenda', planFeature: 'has_modulo_agenda', featureFlag: 'agenda_module' },
    {
      id: 'ebd',
      label: 'EBD',
      icon: BookOpen,
      path: '/ebd/dashboard',
      modulo: 'ebd',
      ebdMenu: true,
      featureFlag: 'ebd_module',
      planFeature: 'has_modulo_ebd',
    },
    {
      id: 'comissao',
      label: 'Comissão',
      icon: UserCheck,
      path: '/comissao',
      modulo: 'comissao',
      featureFlag: 'ordination_module',
      planFeature: 'has_modulo_comissao',
      submenu: [
        { id: 'comissoes', label: 'Comissões', path: '/comissao', modulo: 'gestao', featureFlag: 'ordination_module', planFeature: 'has_modulo_comissao' },
        { id: 'consagracao', label: 'Consagração (obreiros)', path: '/secretaria/consagracao', featureFlag: 'ordination_module', planFeature: 'has_modulo_comissao' },
      ],
    },
    { id: 'reunioes', label: 'Reuniões', icon: Handshake, path: '/reunioes', modulo: 'reunioes', featureFlag: 'meetings_module', planFeature: 'has_modulo_reunioes' },
    { id: 'missoes', label: 'Missões', icon: Plane, path: '/missoes', modulo: 'missoes', featureFlag: 'missions_module', planFeature: 'has_modulo_missoes' },
    { id: 'eventos', label: 'Eventos', icon: CalendarCheck, path: '/eventos', modulo: 'eventos', featureFlag: 'events_module', planFeature: 'has_modulo_eventos' },
    {
      id: 'presidencia',
      label: 'Presidência',
      icon: Crown,
      path: '/presidencia',
      modulo: 'presidencia',
      featureFlag: 'presidency_module',
      planFeature: 'has_modulo_presidencial',
      submenu: [
        { id: 'presidencia-geral', label: 'Visão Geral', path: '/presidencia', modulo: 'presidencia', featureFlag: 'presidency_module', planFeature: 'has_modulo_presidencial' },
        { id: 'consolidado-financeiro', label: 'Consolidado Financeiro', path: '/presidencia/consolidado', modulo: 'consolidado_financeiro', featureFlag: 'presidency_module', planFeature: 'has_modulo_presidencial' },
        { id: 'prestacao-contas', label: 'Prestação de Contas', path: '/presidencia/prestacao-contas', modulo: 'consolidado_financeiro', featureFlag: 'accounting_module', planFeature: 'has_modulo_contabilidade' },
        { id: 'prestacao-contas-oficial', label: 'Prestação de Contas Oficial', path: '/presidencia/prestacao-contas-oficial', modulo: 'consolidado_financeiro', featureFlag: 'accounting_module', planFeature: 'has_modulo_contabilidade' },
        { id: 'auditoria-financeira', label: 'Auditoria Financeira', path: '/presidencia/auditoria', modulo: 'consolidado_financeiro', featureFlag: 'presidency_module', planFeature: 'has_modulo_presidencial' },
        { id: 'conselho-fiscal', label: 'Conselho Fiscal', path: '/presidencia/conselho-fiscal', modulo: 'conselho_fiscal', featureFlag: 'fiscal_council_module', planFeature: 'has_modulo_conselho_fiscal' },
      ],
    },
    { id: 'patrimonio', label: 'Patrimônio', icon: Building2, path: '/patrimonio', modulo: 'patrimonio' },
    { id: 'achados-perdidos', label: 'Achados e Perdidos', icon: Search, path: '/secretaria/achados-perdidos', modulo: 'gestao' },
    { id: 'funcionarios', label: 'Funcionários', icon: UserCog, path: '/secretaria/funcionarios', modulo: 'gestao', featureFlag: 'employees_module', planFeature: 'has_modulo_funcionarios' },
    { id: 'financeiro', label: 'Financeiro', icon: CreditCard, path: '/financeiro', modulo: 'financeiro' },
    { id: 'auditoria', label: 'Auditoria', icon: CheckCircle2, path: '/auditoria', modulo: 'auditoria' },
    { id: 'geolocalizacao', label: 'Geolocalização', icon: MapPin, path: '/geolocalizacao', modulo: 'geolocalizacao' },
    { id: 'usuarios', label: 'Usuários', icon: Users, path: '/usuarios', modulo: 'usuarios' },
    { id: 'suporte', label: 'Suporte', icon: LifeBuoy, path: '/suporte', modulo: 'suporte' },
    {
      id: 'configuracoes',
      label: 'Configurações',
      icon: Settings,
      path: '/configuracoes',
      modulo: 'configuracoes',
      submenu: [
        { id: 'config-geral', label: 'Geral', path: '/configuracoes' },
        { id: 'meu-contrato', label: 'Meu Contrato', path: '/juridico/meu-contrato' },
        { id: 'config-cartoes', label: 'Cartões', path: '/configuracoes/cartoes' },
        { id: 'certificados', label: 'Certificados', path: '/configuracoes/certificados', modulo: 'configuracoes' },
        { id: 'ativar-fluxo', label: 'Ativar Fluxo', path: '/secretaria/ativar-fluxo' },
      ],
    },
  ];

  // Filtra menus: 1) por plano  2) por nível de acesso do usuário
  const menuItems = allMenuItems.filter(i => {
    if (planFeatures.loading || userCtx.loading) {
      return !['tesouraria', 'financeiro', 'eventos', 'reunioes', 'auditoria', 'usuarios', 'agenda', 'ebd', 'missoes', 'funcionarios', 'comissao', 'comissoes', 'consagracao', 'apresentacao-criancas', 'presidencia', 'presidencia-geral', 'consolidado-financeiro', 'prestacao-contas', 'prestacao-contas-oficial', 'auditoria-financeira', 'conselho-fiscal'].includes(i.id);
    }
    if (i.featureFlag && !planFeatures.hasFeature(i.featureFlag)) return false;
    if (i.id === 'tesouraria' && !planFeatures.has_modulo_financeiro) return false;
    if (i.id === 'financeiro' && !planFeatures.has_modulo_financeiro_avancado) return false;
    if (i.id === 'eventos' && !planFeatures.has_modulo_eventos) return false;
    if (i.id === 'reunioes' && !planFeatures.has_modulo_reunioes) return false;
    if (i.id === 'agenda' && !planFeatures.has_modulo_agenda) return false;
    if (i.id === 'funcionarios') {
      if (!planFeatures.has_modulo_funcionarios || !planFeatures.hasFeature('employees_module')) return false;
      const isLocal = userCtx.nivel && ['admin_local', 'financeiro_local', 'supervisor', 'viewer'].includes(userCtx.nivel);
      if (isLocal) return false;
    }
    if (userCtx.nivel === 'auxiliar_secretaria') {
      if (['cartas', 'certificados', 'funcionarios', 'comissao', 'ativar-fluxo', 'casamento', 'estrutura-hierarquica'].includes(i.id)) {
        return false;
      }
    }
    const modulo = i.modulo;
    if (modulo && !userCtx.podeAcessar(modulo)) return false;
    return true;
  });

  const handleNavigate = (_id: string, path: string) => {
    router.push(path);
    setIsMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="w-64 bg-gradient-to-b from-[#0c233c] via-[#091b2e] to-[#051220] text-slate-100 flex flex-col h-full border-r border-[#163657]/70 shadow-2xl select-none">
      {/* ─── 1. ÁREA DE BRANDING (TOPO) ─── */}
      <div className="px-6 py-6 flex items-center justify-center border-b border-white/[0.08] relative bg-gradient-to-b from-[#112d4a]/50 to-transparent">
        <div className="relative w-[180px] h-[52px] flex items-center justify-center">
          <Image
            src="/img/logoh.png"
            alt="Gestão Eklésia"
            width={180}
            height={52}
            priority
            sizes="180px"
            className="max-h-[52px] w-auto object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
          />
        </div>
      </div>

      {/* ─── TRIAL BANNER ─── */}
      {trialDaysLeft !== null && trialDaysLeft >= 0 && (
        <div className="mx-3 mt-3 mb-1 p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 shadow-inner">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <p className="text-amber-300 text-xs font-bold uppercase tracking-wider">Período de Teste</p>
          </div>
          <p className="text-slate-300 text-xs mt-1">
            {trialDaysLeft === 0
              ? 'Último dia de acesso gratuito!'
              : `Restam ${trialDaysLeft} ${trialDaysLeft === 1 ? 'dia' : 'dias'}`}
          </p>
          <button
            onClick={() => router.push('/trial-expirado')}
            className="mt-2 w-full py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:from-amber-600 text-slate-950 text-xs font-black rounded-lg transition shadow-sm"
          >
            Assinar agora →
          </button>
        </div>
      )}

      {/* ─── 2. NAVEGAÇÃO / MENU (SCROLL INDEPENDENTE) ─── */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto sidebar-scrollbar space-y-1">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const hasSub = !!item.submenu || !!item.ebdMenu;
          const isItemExpanded = expandedMenu === item.id;
          const isDirectActive = activeMenu === item.id;
          const isParentActive = parentMap[activeMenu] === item.id;
          const isHighlighted = isDirectActive || (isParentActive && !isItemExpanded);

          return (
            <div key={item.id} className="relative">
              <button
                onClick={() => {
                  if (hasSub) {
                    setExpandedMenu(isItemExpanded ? null : item.id);
                  } else {
                    handleNavigate(item.id, item.path);
                  }
                }}
                className={`group w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-all duration-200 text-left relative text-sm font-medium ${
                  isHighlighted
                    ? 'bg-gradient-to-r from-[#173e65] to-[#123151] text-white font-semibold shadow-[0_2px_10px_rgba(0,0,0,0.25)] border border-cyan-500/20'
                    : 'text-slate-300/85 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {/* Barra vertical de indicador ativo (azul/ciano claro) */}
                {isHighlighted && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-cyan-400 rounded-r-full shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                )}

                {/* Ícone */}
                <span
                  className={`flex items-center justify-center transition-transform duration-200 flex-shrink-0 ${
                    isHighlighted
                      ? 'text-cyan-400 scale-105'
                      : 'text-slate-400 group-hover:text-slate-200 group-hover:scale-105'
                  }`}
                >
                  <IconComponent className="w-5 h-5 stroke-[1.9]" />
                </span>

                {/* Texto do Módulo */}
                <span className="flex-1 truncate tracking-tight text-[13.5px]">
                  {item.label}
                </span>

                {/* Indicador Chevron */}
                {hasSub && (
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 flex-shrink-0 ${
                      isItemExpanded
                        ? 'rotate-180 text-cyan-400'
                        : isHighlighted
                        ? 'text-cyan-300/80'
                        : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                )}
              </button>

              {/* ─── SUBMENU FLAT ─── */}
              {item.submenu && isItemExpanded && (
                <div className="mt-1 mb-2 ml-4 pl-3.5 border-l border-white/[0.12] space-y-0.5 animate-fadeIn">
                  {item.submenu
                    .filter((sub) => !sub.modulo || userCtx.podeAcessar(sub.modulo))
                    .filter((sub) => !(sub.id === 'cartas-pedidos' && userCtx.nivel === 'administrador'))
                    .filter((sub) => !sub.featureFlag || planFeatures.hasFeature(sub.featureFlag))
                    .filter((sub) => !sub.planFeature || (planFeatures as any)[sub.planFeature])
                    .map((submenu) => {
                      const isSubActive = activeMenu === submenu.id;
                      return (
                        <button
                          key={submenu.id}
                          onClick={() => handleNavigate(submenu.id, submenu.path)}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-left transition-all duration-150 relative ${
                            isSubActive
                              ? 'text-cyan-300 font-semibold bg-cyan-500/10'
                              : 'text-slate-300/80 hover:text-white hover:bg-white/[0.04]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full transition-colors flex-shrink-0 ${
                              isSubActive
                                ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]'
                                : 'bg-slate-500/60'
                            }`}
                          />
                          <span className="flex-1 truncate">{submenu.label}</span>
                        </button>
                      );
                    })}
                </div>
              )}

              {/* ─── SUBMENU EBD (3 NÍVEIS) ─── */}
              {item.ebdMenu && isItemExpanded && (
                <div className="mt-1 mb-2 ml-2 rounded-xl overflow-hidden animate-fadeIn">
                  <EbdSidebarMenu
                    activeMenu={activeMenu}
                    onNavigate={handleNavigate}
                  />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ─── 3. RODAPÉ ESTÁVEL (LOGOUT + VERSÃO) ─── */}
      <div className="p-4 border-t border-white/[0.08] bg-gradient-to-b from-transparent to-[#040e1a]/80 space-y-3.5">
        <button
          onClick={() => {
            supabase.auth.signOut().finally(() => router.push('/'));
          }}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-red-600 via-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:from-red-700 text-white rounded-xl font-bold text-sm shadow-[0_2px_10px_rgba(220,38,38,0.35)] hover:shadow-[0_4px_14px_rgba(220,38,38,0.5)] transition-all duration-150 active:scale-[0.98] border border-red-500/30"
        >
          <LogOut className="w-4 h-4 stroke-[2.2]" />
          <span>Sair</span>
        </button>

        <div className="flex items-center justify-center gap-2 pt-0.5">
          <div className="h-[1px] bg-white/[0.1] flex-1 max-w-[36px]" />
          <p className="text-center text-[10px] uppercase font-bold tracking-widest text-slate-400/80">
            GESTÃO EKLÉSIA v1.0
          </p>
          <div className="h-[1px] bg-white/[0.1] flex-1 max-w-[36px]" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Botão de Menu Mobile */}
      <button
        onClick={() => setIsMobileMenuOpen((open) => !open)}
        className="md:hidden fixed left-4 top-4 z-50 p-2.5 bg-[#091b2e] text-white rounded-xl shadow-lg border border-[#163657] hover:bg-[#112d4a] transition-all"
        aria-label="Alternar Menu"
        aria-expanded={isMobileMenuOpen}
      >
        {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Drawer Overlay Mobile */}
      {isMobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 md:hidden animate-fadeIn"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed left-0 top-0 h-full z-50 md:hidden animate-slideIn">
            {sidebarContent}
          </div>
        </>
      )}

      {/* Sidebar Fixo Desktop */}
      <div className="hidden md:flex h-screen flex-shrink-0">
        {sidebarContent}
      </div>
    </>
  );
}
