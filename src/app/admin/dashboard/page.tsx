'use client'

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import AdminSidebar from '@/components/AdminSidebar'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Building2,
  CreditCard,
  Users,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'
import type { DashboardMetrics } from '@/types/admin'

export default function AdminDashboardPage() {
  const { adminUser, isLoading, isAuthenticated, isAdmin } = useAdminAuth()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()

  // IMPORTANTE: Todos os hooks devem ser chamados ANTES de qualquer return
  // Isso respeita as Rules of Hooks do React

  // Efeito 1: Proteger a página - redirecionar imediatamente se não autenticado
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin)) {
      router.push('/admin/login')
      return
    }
  }, [isLoading, isAuthenticated, isAdmin, router])

  // Efeito 2: Buscar dados apenas se autenticado como admin
  useEffect(() => {
    if (!isAuthenticated || !isAdmin || isLoading) return

    const fetchData = async () => {
      try {
        const metricsResponse = await authenticatedFetch('/api/v1/admin/metrics')
        if (metricsResponse.ok) {
          const metricsData = await metricsResponse.json()
          setMetrics(metricsData)
        }
        setLoading(false)
      } catch (err: any) {
        setError(err.message)
        setLoading(false)
      }
    }

    fetchData()
  }, [isAuthenticated, isAdmin, isLoading])

  // Agora SIM podemos fazer early returns (depois de todos os hooks)

  // Mostrar tela de carregamento enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-900">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white text-lg">Verificando autenticação...</div>
        </div>
      </div>
    )
  }

  // Bloquear acesso se não autenticado (não deve chegar aqui por causa do middleware)
  if (!isAuthenticated || !isAdmin) {
    return null
  }

  // Mostrar tela de carregamento enquanto busca dados
  if (loading) {
    return (
      <div className="flex h-screen bg-gray-900">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white text-lg">Carregando métricas...</div>
        </div>
      </div>
    )
  }

  // Dados de exemplo para gráficos
  const ticketsData = [
    { month: 'Jan', value: 12 },
    { month: 'Fev', value: 19 },
    { month: 'Mar', value: 15 },
    { month: 'Abr', value: 22 },
    { month: 'Mai', value: 18 },
    { month: 'Jun', value: 25 },
  ]

  const deploymentsData = [
    { month: 'Jan', implantacoes: 8, cancelamentos: 2 },
    { month: 'Fev', implantacoes: 12, cancelamentos: 1 },
    { month: 'Mar', implantacoes: 10, cancelamentos: 3 },
    { month: 'Abr', implantacoes: 15, cancelamentos: 2 },
    { month: 'Mai', implantacoes: 11, cancelamentos: 4 },
    { month: 'Jun', implantacoes: 18, cancelamentos: 1 },
  ]

  const StatCard = ({
    icon: Icon,
    title,
    value,
    trend,
  }: {
    icon: any
    title: string
    value: string | number
    trend?: string
  }) => (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          <p className="text-white text-3xl font-bold mt-2">{value}</p>
          {trend && <p className="text-green-400 text-sm mt-2">{trend}</p>}
        </div>
        <div className="bg-blue-600 p-3 rounded-lg">
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Header */}
        <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 z-10">
          <h2 className="text-2xl font-bold text-white">PAINEL ADMINISTRATIVO: Visão Geral</h2>
          <p className="text-gray-400 text-sm mt-1">
            Bem-vindo de volta, {adminUser?.email}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Building2}
              title="Total de Ministérios"
              value={metrics?.total_ministries || 0}
              trend="+12% vs mês anterior"
            />
            <StatCard
              icon={Users}
              title="Ministérios Ativos"
              value={metrics?.active_ministries || 0}
              trend="+8% vs mês anterior"
            />
            <StatCard
              icon={CreditCard}
              title="Receita Total"
              value={`R$ ${((metrics?.total_revenue_month || 0) / 1000).toFixed(1)}k`}
              trend="+23% vs mês anterior"
            />
            <StatCard
              icon={TrendingUp}
              title="Taxa de Crescimento"
              value="12.5%"
              trend="Em alta"
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tickets Chart */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-white font-bold text-lg mb-4">Chamados Mensal</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={ticketsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #4b5563',
                      borderRadius: '0.5rem',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Tickets Management */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-white font-bold text-lg mb-4">
                Gerenciamento de Chamados
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <p className="text-gray-400 text-sm mb-2">Chamados Recebidos</p>
                  <p className="text-white text-3xl font-bold">24</p>
                  <p className="text-green-400 text-xs mt-2">↑ 12% vs semana anterior</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <p className="text-gray-400 text-sm mb-2">Chamados Atendidos</p>
                  <p className="text-white text-3xl font-bold">18</p>
                  <p className="text-green-400 text-xs mt-2">75% de taxa de conclusão</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <p className="text-gray-400 text-sm mb-2">Chamados em Espera</p>
                  <p className="text-white text-3xl font-bold">6</p>
                  <p className="text-yellow-400 text-xs mt-2">Tempo médio: 45min</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <p className="text-gray-400 text-sm mb-2">Prioridade Alta</p>
                  <p className="text-white text-3xl font-bold">3</p>
                  <p className="text-red-400 text-xs mt-2">Requerem atenção</p>
                </div>
              </div>
            </div>
          </div>

          {/* Deployments Chart */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-white font-bold text-lg mb-4">Implantações vs Cancelamentos</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deploymentsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #4b5563',
                    borderRadius: '0.5rem',
                  }}
                />
                <Legend />
                <Bar dataKey="implantacoes" fill="#10b981" radius={[8, 8, 0, 0]} />
                <Bar dataKey="cancelamentos" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  )
}
