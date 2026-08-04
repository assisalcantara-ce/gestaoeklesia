'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AdminSidebar from '@/components/AdminSidebar'
import { FileText, FileCheck, CheckCircle2, History, Scale } from 'lucide-react'

export default function JuridicoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const tabs = [
    { label: 'Documentos', href: '/admin/configuracoes/juridico/documentos', icon: FileText },
    { label: 'Contratos', href: '/admin/configuracoes/juridico/contratos', icon: FileCheck },
    { label: 'Aceites', href: '/admin/configuracoes/juridico/aceites', icon: CheckCircle2 },
    { label: 'Histórico', href: '/admin/configuracoes/juridico/historico', icon: History },
  ]

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Cabeçalho Padrão Admin */}
        <header className="bg-gray-950 border-b border-gray-800 px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-400 rounded-lg border border-blue-500/20">
              <Scale size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <span>Configurações</span>
                <span>/</span>
                <span className="text-blue-400 font-medium">Módulo Jurídico</span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">Gestão Jurídica & Compliance</h1>
            </div>
          </div>
        </header>

        {/* Navegação de Abas do Módulo Jurídico */}
        <div className="bg-gray-950/60 border-b border-gray-800 px-8">
          <nav className="flex gap-6">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = pathname.startsWith(tab.href)
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-700'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Conteúdo Principal */}
        <main className="flex-1 overflow-y-auto p-8 bg-gray-900">{children}</main>
      </div>
    </div>
  )
}
