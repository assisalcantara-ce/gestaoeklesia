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
  Scale,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import { temAcessoAdmin } from '@/lib/access-control'
import { authenticatedFetch } from '@/lib/api-client'
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
        const response = await authenticatedFetch('/api/v1/admin/oportunidades')
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

    ...(temAcessoAdmin(role, 'pagamentos') ? [{ label: 'Financeiro', href: '/admin/pagamentos', icon: CreditCard }] : []),
    ...(temAcessoAdmin(role, 'planos') ? [{ label: 'Planos', href: '/admin/planos', icon: BarChart3 }] : []),
    { label: 'Suporte', href: '/admin/suporte', icon: HeadphonesIcon },
    ...(temAcessoAdmin(role, 'configuracoes_supabase') || temAcessoAdmin(role, 'configuracoes_usuarios') || temAcessoAdmin(role, 'configuracoes_gateway') || role === 'super_admin' || role === 'admin'
      ? [
          {
            label: 'Configurações',
            icon: Settings,
            submenu: [
              ...(temAcessoAdmin(role, 'configuracoes_supabase') ? [{ label: 'Supabase', href: '/admin/configuracoes/supabase', icon: Database }] : []),
              ...(temAcessoAdmin(role, 'configuracoes_usuarios') ? [{ label: 'Usuários', href: '/admin/configuracoes/usuarios', icon: Users }] : []),
              ...(temAcessoAdmin(role, 'configuracoes_gateway') ? [{ label: 'Gateway', href: '/admin/configuracoes/gateway', icon: Link2 }] : []),
              { label: 'Jurídico', href: '/admin/configuracoes/juridico/documentos', icon: Scale },
            ],
          },
        ]
      : []),
  ]

  return (
    <div className="flex h-screen bg-[#032C28] print:hidden">
      {/* Sidebar */}
      <aside
        className={`bg-[#02201d] text-white transition-all duration-300 ${
          isOpen ? 'w-64' : 'w-20'
        } border-r border-[#0E4D43]/60 flex flex-col`}
      >
        <div className="flex items-center justify-center p-4 border-b border-[#0E4D43]/60 bg-[#032C28]/60">
          <div className="bg-white/95 px-3 py-1.5 rounded-xl shadow-sm">
            <Image
              src={BRAND.logoHorizontal}
              alt="Gestão Eklésia"
              width={140}
              height={38}
              priority
              sizes="140px"
              className="h-[36px] w-auto object-contain"
            />
          </div>
        </div>

        {/* Menu Items */}
        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto">
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
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                      isSubmenuOpen
                        ? 'bg-[#059669] text-white shadow-sm shadow-emerald-900/30'
                        : 'text-[#A7C4BC] hover:text-white hover:bg-[#073B34]'
                    }`}
                  >
                    <Icon size={19} className={isSubmenuOpen ? 'text-white' : 'text-[#10B981]'} />
                    {isOpen && (
                      <>
                        <span className="text-sm flex-1 text-left">
                          {item.label}
                        </span>
                        <ChevronDown
                          size={15}
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
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                      isActive
                        ? 'bg-[#059669] text-white shadow-sm shadow-emerald-900/40 border border-emerald-400/20'
                        : 'text-[#A7C4BC] hover:text-white hover:bg-[#073B34]'
                    }`}
                    title={!isOpen ? item.label : ''}
                  >
                    <div className="relative">
                      <Icon size={19} className={isActive ? 'text-white' : 'text-[#10B981]'} />
                      {!isOpen && item.badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {isOpen && (
                      <span className="flex-1 flex items-center justify-between">
                        {item.label}
                        {item.badge > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500 text-[10px] font-bold text-white">
                            {item.badge}
                          </span>
                        )}
                      </span>
                    )}
                  </Link>
                )}

                {/* Submenu */}
                {hasSubmenu && isSubmenuOpen && isOpen && (
                  <div className="ml-4 space-y-1 mt-1 pl-2 border-l border-[#0E4D43]">
                    {item.submenu.map((subitem: any) => {
                      const SubIcon = subitem.icon
                      const isSubActive = pathname === subitem.href

                      return (
                        <Link
                          key={subitem.href}
                          href={subitem.href}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                            isSubActive
                              ? 'bg-[#059669] text-white font-semibold'
                              : 'text-[#A7C4BC] hover:text-white hover:bg-[#073B34]'
                          }`}
                        >
                          <SubIcon size={15} className={isSubActive ? 'text-white' : 'text-[#10B981]'} />
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
        <div className="px-4 py-4 border-t border-[#0E4D43]/60 bg-[#02201d]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 transition text-xs font-semibold cursor-pointer"
            title="Sair"
          >
            <LogOut size={17} />
            {isOpen && <span>Sair do Backoffice</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-[#032C28]" />
    </div>
  )
}
