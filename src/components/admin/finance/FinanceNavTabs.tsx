'use client'

import Link from 'next/link'
import {
  BarChart3,
  ArrowDownLeft,
  ArrowUpRight,
  Tags,
  Coins,
  FileCheck,
} from 'lucide-react'

export type FinanceTabKey = 'overview' | 'statement' | 'revenues' | 'expenses' | 'categories' | 'balances' | 'invoices'

interface FinanceNavTabsProps {
  activeTab?: FinanceTabKey
  onSelectTab?: (tab: FinanceTabKey) => void
}

export default function FinanceNavTabs({ activeTab, onSelectTab }: FinanceNavTabsProps) {

  const tabs: { id: FinanceTabKey; label: string; href?: string; icon: any; badge?: string }[] = [
    {
      id: 'overview',
      label: 'Visão Geral Executiva',
      icon: BarChart3,
    },
    {
      id: 'statement',
      label: 'Prestação de Contas (Sócios)',
      icon: FileCheck,
      badge: 'DRE & Impressão',
    },
    {
      id: 'revenues',
      label: 'Receitas Manuais',
      icon: ArrowDownLeft,
    },
    {
      id: 'expenses',
      label: 'Despesas Corporativas',
      icon: ArrowUpRight,
    },
    {
      id: 'categories',
      label: 'Categorias',
      icon: Tags,
    },
    {
      id: 'balances',
      label: 'Saldo Inicial',
      icon: Coins,
    },
  ]

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-800 pb-3">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

        if (onSelectTab) {
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-gray-900/60 text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-gray-800/80'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          )
        }

        return (
          <Link
            key={tab.id}
            href={tab.href || '/admin/pagamentos/relatorios'}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'bg-gray-900/60 text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-gray-800/80'
            }`}
          >
            <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </div>
  )
}