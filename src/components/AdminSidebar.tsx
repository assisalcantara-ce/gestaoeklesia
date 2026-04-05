'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef } from 'react'
import {
  BarChart3,
  Building2,
  CreditCard,
  HeadphonesIcon,
  LogOut,
  Home,
  Settings,
  ChevronDown,
  Database,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-client'

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, _setIsOpen] = useState(true)
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  const handleLogout = async () => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient()
    }
    await supabaseRef.current.auth.signOut()
    router.push('/admin/login')
  }

  const menuItems = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: Home },
    { label: 'Instituições', href: '/admin/ministerios', icon: Building2 },
    { label: 'Pagamentos', href: '/admin/pagamentos', icon: CreditCard },
    { label: 'Planos', href: '/admin/planos', icon: BarChart3 },
    { label: 'Suporte', href: '/admin/suporte', icon: HeadphonesIcon },
    {
      label: 'Configurações',
      icon: Settings,
      submenu: [
        { label: 'Supabase', href: '/admin/configuracoes/supabase', icon: Database },
        { label: 'Usuários', href: '/admin/configuracoes/usuarios', icon: Users },
      ],
    },
  ]

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <aside
        className={`bg-gray-950 text-white transition-all duration-300 ${
          isOpen ? 'w-64' : 'w-20'
        } border-r border-gray-800 flex flex-col`}
      >
        <div className="flex items-center justify-center p-4 border-b border-gray-800">
          <img
            src="/img/logo333-v3.png"
            alt="Logo"
            className="h-[56px] w-auto object-contain"
          />
        </div>

        {/* Menu Items */}
        <nav className="p-4 space-y-2 flex-1">
          {menuItems.map((item: any) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            const isSubmenuOpen = expandedMenu === item.label
            const hasSubmenu = item.submenu

            return (
              <div key={item.label}>
                {hasSubmenu ? (
                  <button
                    onClick={() =>
                      setExpandedMenu(
                        isSubmenuOpen ? null : item.label
                      )
                    }
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                      isSubmenuOpen
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <Icon size={20} />
                    {isOpen && (
                      <>
                        <span className="text-sm flex-1 text-left">
                          {item.label}
                        </span>
                        <ChevronDown
                          size={16}
                          className={`transition-transform ${
                            isSubmenuOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                    title={!isOpen ? item.label : ''}
                  >
                    <Icon size={20} />
                    {isOpen && <span className="text-sm">{item.label}</span>}
                  </Link>
                )}

                {/* Submenu */}
                {hasSubmenu && isSubmenuOpen && isOpen && (
                  <div className="ml-4 space-y-1 mt-1">
                    {item.submenu.map((subitem: any) => {
                      const SubIcon = subitem.icon
                      const isSubActive = pathname === subitem.href

                      return (
                        <Link
                          key={subitem.href}
                          href={subitem.href}
                          className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition ${
                            isSubActive
                              ? 'bg-blue-500 text-white'
                              : 'text-gray-400 hover:bg-gray-800'
                          }`}
                        >
                          <SubIcon size={16} />
                          <span>{subitem.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Logout Button */}
        <div className="px-4 py-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white transition text-sm"
            title="Sair"
          >
            <LogOut size={20} />
            {isOpen && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-900" />
    </div>
  )
}
