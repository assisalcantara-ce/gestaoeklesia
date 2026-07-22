'use client'

export const dynamic = 'force-dynamic';

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import AdminSidebar from '@/components/AdminSidebar'
import ExecutiveMetricCard from '@/components/dashboard/ExecutiveMetricCard'
import { temAcessoAdmin } from '@/lib/access-control'
import {
  BarChart3,
  TrendingUp,
  FileSpreadsheet,
  Download,
  Calendar,
  AlertTriangle,
  ArrowLeft,
  DollarSign,
  PieChart,
} from 'lucide-react'

export default function RelatoriosFinanceirosPage() {
  const { isLoading, isAuthenticated, isAdmin, adminUser } = useAdminAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !isAdmin) {
        router.push('/admin/login')
        return
      }
      if (!temAcessoAdmin(adminUser?.role, 'pagamentos')) {
        router.push('/admin/dashboard')
      }
    }
  }, [isLoading, isAuthenticated, isAdmin, adminUser, router])

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-950 text-white items-center justify-center">
        <p className="text-sm text-gray-400">Carregando módulo de relatórios...</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <AdminSidebar />

      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Cabeçalho & Breadcrumb */}
        <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur px-8 py-6 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto space-y-3">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
              <Link href="/admin/dashboard" className="hover:text-white transition">
                Painel Admin
              </Link>
              <span>/</span>
              <Link href="/admin/pagamentos" className="hover:text-white transition">
                Financeiro
              </Link>
              <span>/</span>
              <span className="text-blue-400 font-bold">Relatórios</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                  <BarChart3 className="text-blue-500 h-7 w-7" />
                  Relatórios Financeiros da Plataforma
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  Análises consolidadas, evolução de receita recorrente, projeções e exportações financeiras.
                </p>
              </div>

              <button
                onClick={() => router.push('/admin/pagamentos')}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 hover:border-gray-600 px-4 py-2 rounded-lg text-xs font-semibold transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Financeiro
              </button>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl w-full mx-auto space-y-8">
          {/* Área 1: KPIs Executivos */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              Indicadores Estratégicos de Desempenho
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ExecutiveMetricCard
                title="Receita Consolidada Anual"
                value="Em implantação"
                subtitle="Faturamento total acumulado no ano"
                icon={DollarSign}
                color="emerald"
              />

              <ExecutiveMetricCard
                title="Inadimplência Média"
                value="Em implantação"
                subtitle="Percentual de faturas em atraso"
                icon={AlertTriangle}
                color="rose"
              />

              <ExecutiveMetricCard
                title="Ticket Médio por Cliente"
                value="Em implantação"
                subtitle="Valor médio mensal por contrato"
                icon={PieChart}
                color="blue"
              />

              <ExecutiveMetricCard
                title="Projeção de Receita Semestral"
                value="Em implantação"
                subtitle="Estimativa recorrente futura"
                icon={Calendar}
                color="indigo"
              />
            </div>
          </section>

          {/* Área 2: Gráficos de Análise e Evolução */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              Gráficos de Evolução Financeira
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico 1: Evolução da Receita */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl flex flex-col justify-between min-h-[300px]">
                <div>
                  <h3 className="font-bold text-white text-base">Evolução da Receita Mensal</h3>
                  <p className="text-xs text-gray-400 mt-1">Comparativo de faturamento recebido vs projetado mês a mês.</p>
                </div>

                <div className="my-8 flex flex-col items-center justify-center p-8 bg-gray-950/60 rounded-lg border border-gray-800/80 text-center">
                  <BarChart3 className="w-10 h-10 text-gray-600 mb-2 animate-pulse" />
                  <p className="text-sm font-semibold text-gray-300">Gráfico em Implantação</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm">
                    A visualização gráfica consolidada da curva de faturamento estará disponível na próxima atualização.
                  </p>
                </div>
              </div>

              {/* Gráfico 2: Análise de Inadimplência */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl flex flex-col justify-between min-h-[300px]">
                <div>
                  <h3 className="font-bold text-white text-base">Índice de Inadimplência por Período</h3>
                  <p className="text-xs text-gray-400 mt-1">Acompanhamento do índice de cobranças vencidas vs pagas no Asaas.</p>
                </div>

                <div className="my-8 flex flex-col items-center justify-center p-8 bg-gray-950/60 rounded-lg border border-gray-800/80 text-center">
                  <PieChart className="w-10 h-10 text-gray-600 mb-2 animate-pulse" />
                  <p className="text-sm font-semibold text-gray-300">Gráfico em Implantação</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm">
                    O relatório de aging e faixa de atraso de faturas será ativado na próxima sprint do módulo.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Área 3: Exportações e Extratos */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-400" />
              Central de Exportações e Extratos
            </h2>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl space-y-4">
              <div>
                <h3 className="font-bold text-white text-base">Exportação de Relatórios de Cobrança</h3>
                <p className="text-xs text-gray-400 mt-1">Exporte planilhas completas com o histórico financeiro dos clientes.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="bg-gray-950/60 p-4 rounded-lg border border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="text-xs font-bold text-white">Relatório CSV</p>
                      <p className="text-[10px] text-gray-400">Extrato completo de cobranças</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold bg-gray-800 text-gray-400 px-2 py-1 rounded">Em implantação</span>
                </div>

                <div className="bg-gray-950/60 p-4 rounded-lg border border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-xs font-bold text-white">Planilha Excel</p>
                      <p className="text-[10px] text-gray-400">Análise de conciliação</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold bg-gray-800 text-gray-400 px-2 py-1 rounded">Em implantação</span>
                </div>

                <div className="bg-gray-950/60 p-4 rounded-lg border border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-red-400" />
                    <div>
                      <p className="text-xs font-bold text-white">Relatório PDF</p>
                      <p className="text-[10px] text-gray-400">Resumo executivo impresso</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold bg-gray-800 text-gray-400 px-2 py-1 rounded">Em implantação</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
