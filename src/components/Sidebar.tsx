'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

interface SidebarProps {
  activeMenu: string;
  setActiveMenu: (id: string) => void;
}

export default function Sidebar({ activeMenu, setActiveMenu }: SidebarProps) {
  const router = useRouter();
  const supabase = createClient();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dashboard' },
    {
      id: 'secretaria',
      label: 'Secretaria',
      icon: '📝',
      path: '/secretaria',
      submenu: [
        { id: 'estrutura-hierarquica', label: 'Estrutura Hierárquica', icon: '🏛️', path: '/secretaria/estrutura-hierarquica' },
        { id: 'membros', label: 'Ministros', icon: '👥', path: '/secretaria/membros' },
        { id: 'funcionarios', label: 'Funcionários', icon: '👔', path: '/secretaria/funcionarios' },
        { id: 'consagracao', label: 'Consagração (obreiros)', icon: '🙏', path: '/secretaria/consagracao' },
        { id: 'cartas', label: 'Cartas ministeriais', icon: '📜', path: '/secretaria/cartas' },
        { id: 'certificados', label: 'Certificados', icon: '🎓', path: '/configuracoes/certificados' }
      ]
    },
    { id: 'financeiro', label: 'Financeiro', icon: '💳', path: '/financeiro' },
    { id: 'eventos', label: 'Eventos', icon: '📅', path: '/eventos' },
    { id: 'presidencia', label: 'Presidência', icon: '👑', path: '/presidencia' },
    { id: 'reunioes', label: 'Reuniões', icon: '🤝', path: '/reunioes' },
    { id: 'comissao', label: 'Comissão', icon: '👥', path: '/comissao' },
    { id: 'patrimonio', label: 'Patrimônio', icon: '🏢', path: '/patrimonio' },
    { id: 'missoes', label: 'Missões', icon: '✈️', path: '/missoes' },
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
          src="/img/logo333-v3.png"
          alt="GESTAOSERVUS"
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
                      onClick={() => handleNavigate(submenu.id, submenu.path)}
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
      <div className="p-4 border-t border-white/20 space-y-3">
        <button
          onClick={() => {
            supabase.auth.signOut().finally(() => router.push('/'));
          }}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
        >
          Sair
        </button>
        <p className="text-center text-xs text-white/60">GESTAOSERVUS v1.0</p>
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
