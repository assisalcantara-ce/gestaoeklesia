'use client'

import Link from 'next/link'
import Image from 'next/image'
import { BRAND } from '@/config/brand'
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
  Link2,
  Briefcase,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import { temAcessoAdmin } from '@/lib/access-control'
import { useEffect } from 'react'

export default function AdminSidebar() {
  const { adminUser } = useAdminAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, _setIsOpen] = useState(true)
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null)
  const [newCount, setNewCount] = useState(0)

  useEffect(() => {
    const fetchNewCount = async () => {
      try {
        const response = await fetch('/api/v1/admin/oportunidades')
        if (response.ok) {
          const data = await response.json()
          setNewCount(data.new_count || 0)
        }
      } catch (err) {
        console.error('Erro ao buscar contagem de oportunidades:', err)
      }
    }
    
    if (adminUser) {
      fetchNewCount()
      const interval = setInterval(fetchNewCount, 30000)
      return () => clearInterval(interval)
    }
  }, [adminUser])

  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  const handleLogout = async () => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient()
    }
    await supabaseRef.current.auth.signOut()
    router.push('/admin/login')
  }

  const role = adminUser?.role || ''

  const menuItems = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: Home },
    ...(temAcessoAdmin(role, 'ministerios') ? [
      { label: 'Clientes', href: '/admin/ministerios', icon: Building2 },
      { label: `Comercial ${newCount > 0 ? `(${newCount})` : ''}`, href: '/admin/comercial', icon: Briefcase, badge: newCount }
    ] : []),

    ...(temAcessoAdmin(role, 'pagamentos') ? [{ label: 'Pagamentos', href: '/admin/pagamentos', icon: CreditCard }] : []),
    ...(temAcessoAdmin(role, 'planos') ? [{ label: 'Planos', href: '/admin/planos', icon: BarChart3 }] : []),
    { label: 'Suporte', href: '/admin/suporte', icon: HeadphonesIcon },
    ...(temAcessoAdmin(role, 'configuracoes_supabase') || temAcessoAdmin(role, 'configuracoes_usuarios') || temAcessoAdmin(role, 'configuracoes_gateway')
      ? [
          {
            label: 'Configurações',
            icon: Settings,
            submenu: [
              ...(temAcessoAdmin(role, 'configuracoes_supabase') ? [{ label: 'Supabase', href: '/admin/configuracoes/supabase', icon: Database }] : []),
              ...(temAcessoAdmin(role, 'configuracoes_usuarios') ? [{ label: 'Usuários', href: '/admin/configuracoes/usuarios', icon: Users }] : []),
              ...(temAcessoAdmin(role, 'configuracoes_gateway') ? [{ label: 'Gateway', href: '/admin/configuracoes/gateway', icon: Link2 }] : []),
            ],
          },
        ]
      : []),
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
          <Image
            src={BRAND.logoHorizontal}
            alt="Gestão Eklésia"
            width={150}
            height={42}
            priority
            sizes="150px"
            className="h-[42px] w-auto object-contain"
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
                    <div className="relative">
                      <Icon size={20} />
                      {!isOpen && item.badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {isOpen && (
                      <span className="text-sm flex-1 flex items-center justify-between">
                        {item.label}
                        {item.badge > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-red-500 text-[10px] font-bold text-white">
                            {item.badge}
                          </span>
                        )}
                      </span>
                    )}
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
