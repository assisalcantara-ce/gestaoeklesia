'use client'

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
  PieChart,
  Pie,
  Cell,
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
import type { DashboardMetrics, AdminUser } from '@/types/admin'

export default function AdminDashboardPage() {
  const { user, isLoading, isAuthenticated } = useAdminAuth()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (!isAuthenticated || isLoading) return

    const fetchData = async () => {
      try {
        // Buscar dados do admin user
        const adminResponse = await authenticatedFetch('/api/v1/admin/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user?.id }),
        })

        if (!adminResponse.ok) {
          router.push('/admin/login')
          return
        }

        const adminData = await adminResponse.json()
        setAdminUser(adminData)

        // Buscar métricas
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
  }, [isAuthenticated, isLoading, user?.id])

  if (isLoading || loading) {
    return (
      <div className="flex h-screen bg-gray-900">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white text-lg">Carregando dashboard...</div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  // Dados de exemplo para gráficos
  const revenueData = [
    { month: 'Jan', value: 4000 },
    { month: 'Fev', value: 3000 },
    { month: 'Mar', value: 2000 },
    { month: 'Abr', value: 2780 },
    { month: 'Mai', value: 1890 },
    { month: 'Jun', value: 2390 },
  ]

  const planDistribution = [
    { name: 'Starter', value: metrics?.total_ministries || 0 },
    { name: 'Pro', value: metrics?.active_ministries || 0 },
    { name: 'Enterprise', value: (metrics?.total_ministries || 0) - (metrics?.active_ministries || 0) },
  ]

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b']

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
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
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
        <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-2xl font-bold text-white">Dashboard</h2>
            <p className="text-gray-400 text-sm mt-1">
              Bem-vindo de volta, {adminUser?.email}
            </p>
          </div>
          <div className="text-gray-400 text-sm">
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
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
              value={`R$ ${(metrics?.total_revenue_month || 0).toLocaleString('pt-BR')}`}
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
            {/* Revenue Chart */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-white font-bold text-lg mb-4">Receita Mensal</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
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

            {/* Plan Distribution */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-white font-bold text-lg mb-4">
                Distribuição de Planos
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={planDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {COLORS.map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #4b5563',
                      borderRadius: '0.5rem',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-white font-bold text-lg mb-4">Comparação Mensal</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData}>
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
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  )
}
