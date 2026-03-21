'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SidebarProps {
  activeMenu: string;
  setActiveMenu: (id: string) => void;
}

export default function Sidebar({ activeMenu, setActiveMenu }: SidebarProps) {
  const router = useRouter();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dashboard' },
    {
      id: 'secretaria',
      label: 'Secretaria',
      icon: '📝',
      path: '/secretaria',
      submenu: [
        { id: 'estrutura-hierarquica', label: 'Estrutura Hierárquica', icon: '🏛️', path: '/secretaria/estrutura-hierarquica' },
        { id: 'membros', label: 'Membros/Congregados', icon: '👥', path: '/secretaria/membros' },
        { id: 'funcionarios', label: 'Funcionários', icon: '👔', path: '/secretaria/funcionarios' },
        { id: 'fluxos-operacao', label: 'Fluxos (Operacao)', icon: '📌', path: '/secretaria/fluxos' },
        { id: 'criancas', label: 'Apresentação de Crianças', icon: '👶', path: '/secretaria/criancas' },
        { id: 'batismo', label: 'Batismo', icon: '💧', path: '/secretaria/batismo' },
        { id: 'casamentos', label: 'Casamentos', icon: '💍', path: '/secretaria/casamentos' },
        { id: 'consagracao', label: 'Consagração (obreiros)', icon: '🙏', path: '/secretaria/consagracao' },
        { id: 'cartas', label: 'Cartas ministeriais', icon: '📜', path: '/secretaria/cartas' },
        { id: 'desligamento', label: 'Solicitação de desligamento', icon: '📋', path: '/secretaria/desligamento' },
        { id: 'gabinete', label: 'Gabinete (agenda)', icon: '📅', path: '/secretaria/gabinete' },
        { id: 'cadastros', label: 'Cadastros', icon: '📑', path: '/secretaria/cadastros' },
        { id: 'pre-cadastro', label: 'Pré-cadastro', icon: '📝', path: '/secretaria/pre-cadastro' },
        { id: 'relatorios', label: 'Relatórios', icon: '📊', path: '/secretaria/relatorios' }
      ]
    },
    { id: 'tesouraria', label: 'Tesouraria', icon: '💰', path: '/tesouraria' },
    { id: 'financeiro', label: 'Financeiro', icon: '💳', path: '/financeiro' },
    { id: 'geolocalizacao', label: 'Geolocalização', icon: '📍', path: '/geolocalizacao' },
    { id: 'eventos', label: 'Eventos', icon: '📅', path: '/eventos' },
    { id: 'presidencia', label: 'Presidência', icon: '👑', path: '/presidencia' },
    { id: 'reunioes', label: 'Reuniões', icon: '🤝', path: '/reunioes' },
    { id: 'comissao', label: 'Comissão', icon: '👥', path: '/comissao' },
    { id: 'patrimonio', label: 'Patrimônio', icon: '🏢', path: '/patrimonio' },
    { id: 'ebd', label: 'EBD', icon: '📚', path: '/ebd' },
    { id: 'kids', label: 'KIDs', icon: '👶', path: '/kids' },
    { id: 'missoes', label: 'Missões', icon: '✈️', path: '/missoes' },
    { id: 'achados', label: 'Achados e Perdidos', icon: '🔍', path: '/achados' },
    { id: 'auditoria', label: 'Auditoria', icon: '✅', path: '/auditoria' },
    { id: 'usuarios', label: 'Usuários', icon: '👤', path: '/usuarios' },
    { id: 'suporte', label: 'Suporte', icon: '🎫', path: '/suporte' },
    {
      id: 'configuracoes',
      label: 'Configurações',
      icon: '⚙️',
      path: '/configuracoes',
      submenu: [
        { id: 'config-geral', label: 'Geral', icon: '⚙️', path: '/configuracoes' },
        { id: 'config-certificados', label: 'Certificados', icon: '🎓', path: '/configuracoes/certificados' },
        { id: 'config-cartoes', label: 'Cartões', icon: '🎫', path: '/configuracoes/cartoes' },
        { id: 'ativar-fluxo', label: 'Ativar Fluxo', icon: '🔄', path: '/secretaria/ativar-fluxo' },
      ]
    },
  ];

  return (
    <div className="w-64 bg-[#123b63] text-white shadow-lg flex flex-col">
      {/* LOGO */}
      <div className="p-6 border-b border-white/20 flex items-center justify-center">
        <img
          src="/img/logo_menu.png"
          alt="Gestão Eclesial"
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
                  if ((item as any).submenu) {
                    setExpandedMenu(expandedMenu === item.id ? null : item.id);
                  } else {
                    setActiveMenu(item.id);
                    router.push(item.path);
                  }
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 transition ${activeMenu === item.id
                    ? 'bg-[#4A6FA5] text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
              >
                <span className="text-lg w-6 text-center">{item.icon}</span>
                <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                {(item as any).submenu && (
                  <span className={`text-white/50 transition transform text-xs ${expandedMenu === item.id ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                )}
              </button>

              {/* SUBMENUS */}
              {(item as any).submenu && expandedMenu === item.id && (
                <div className="bg-[#0f2a45] border-y border-white/10">
                  {(item as any).submenu.map((submenu: any, index: number) => (
                    <button
                      key={submenu.id}
                      onClick={() => {
                        setActiveMenu(submenu.id);
                        router.push(submenu.path);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition text-sm text-left ${activeMenu === submenu.id
                          ? 'bg-white/20 text-white font-semibold'
                          : 'text-white/60 hover:bg-white/15 hover:text-white'
                        } ${index < (item as any).submenu.length - 1 ? 'border-b border-white/5' : ''}`}
                    >
                      <span className="text-orange-400 text-lg w-6 text-center">▸</span>
                      <span className="flex-1">{submenu.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* FOOTER */}
      <div className="p-4 border-t border-white/20 text-center text-xs text-white/60">
        <p>Gestão Eclesial v1.0</p>
      </div>
    </div>
  );
}
