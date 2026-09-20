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
import Link from 'next/link'
import {
  Building2,
  CreditCard,
  Users,
  TrendingUp,
  AlertCircle,
  Inbox,
  Lock,
} from 'lucide-react'
import type { DashboardMetrics } from '@/types/admin'

export default function AdminDashboardPage() {
  const { adminUser, isLoading, isAuthenticated } = useAdminAuth()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [execStats, setExecStats] = useState<{ total: number; ativos: number; trials: number; suspensos: number; pendentes: number; leads?: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()

  // IMPORTANTE: Todos os hooks devem ser chamados ANTES de qualquer return
  // Isso respeita as Rules of Hooks do React

  // Efeito 1: Proteger a página - redirecionar imediatamente se não autenticado
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login')
      return
    }
  }, [isLoading, isAuthenticated, router])

  // Efeito 2: Buscar dados apenas se autenticado
  useEffect(() => {
    if (!isAuthenticated || isLoading) return

    const fetchData = async () => {
      try {
        const [metricsResponse, statsResponse] = await Promise.all([
          authenticatedFetch('/api/v1/admin/metrics'),
          authenticatedFetch('/api/v1/admin/ministries/stats'),
        ])
        if (metricsResponse.ok) {
          const metricsData = await metricsResponse.json()
          setMetrics(metricsData)
        }
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          if (statsData.data) {
            setExecStats(statsData.data)
          }
        }
        setLoading(false)
      } catch (err: any) {
        setError(err.message)
        setLoading(false)
      }
    }

    fetchData()
  }, [isAuthenticated, isLoading])

  // Agora SIM podemos fazer early returns (depois de todos os hooks)

  // Mostrar tela de carregamento enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className="flex h-screen bg-[#032C28]">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#F8FAFC] text-lg font-medium">Verificando autenticação...</div>
        </div>
      </div>
    )
  }

  // Bloquear acesso se não autenticado
  if (!isAuthenticated) {
    return null
  }

  // Mostrar tela de carregamento enquanto busca dados
  if (loading) {
    return (
      <div className="flex h-screen bg-[#032C28]">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#F8FAFC] text-lg font-medium">Carregando métricas...</div>
        </div>
      </div>
    )
  }

  const ticketsData = metrics?.tickets_by_month || []
  const deploymentsData = metrics?.deployments_by_month || []

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
    <div className="bg-[#073B34] rounded-2xl p-6 border border-[#0E4D43] shadow-sm hover:border-[#10B981]/50 transition duration-200 group">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[#A7C4BC] text-xs font-semibold uppercase tracking-wider">{title}</p>
          <p className="text-[#F8FAFC] text-3xl font-extrabold mt-2 tracking-tight">{value}</p>
          {trend && <p className="text-[#10B981] text-xs font-semibold mt-2">{trend}</p>}
        </div>
        <div className="bg-[#0B453B] border border-[#10B981]/30 p-3.5 rounded-xl text-[#10B981] group-hover:bg-[#059669] group-hover:text-white transition duration-200 shadow-sm">
          <Icon size={24} />
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#032C28]">
      <AdminSidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-[#032C28]">
        {/* Top Header */}
        <div className="sticky top-0 bg-[#02201d]/90 backdrop-blur-md border-b border-[#0E4D43]/70 px-6 py-4 z-10">
          <h2 className="text-2xl font-bold text-[#F8FAFC]">PAINEL ADMINISTRATIVO: Visão Geral</h2>
          <p className="text-[#A7C4BC] text-xs mt-1">
            Operador autenticado: <span className="text-white font-medium">{adminUser?.email}</span>
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-w-7xl">
          {error && (
            <div className="bg-rose-950/80 border border-rose-800/80 text-rose-200 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
              <AlertCircle size={20} className="text-rose-400 shrink-0" />
              {error}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Building2}
              title="Total de Ministérios"
              value={metrics?.total_ministries || 0}
            />
            <StatCard
              icon={Users}
              title="Ministérios Ativos"
              value={metrics?.active_ministries || 0}
            />
            <StatCard
              icon={CreditCard}
              title="Receita Total"
              value={`R$ ${((metrics?.total_revenue_month || 0) / 1000).toFixed(1)}k`}
            />
            <StatCard
              icon={TrendingUp}
              title="Taxa de Crescimento"
              value={`${metrics?.user_growth_percent || 0}%`}
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tickets Chart */}
            <div className="bg-[#073B34] rounded-2xl p-6 border border-[#0E4D43] shadow-sm">
              <h3 className="text-[#F8FAFC] font-bold text-lg mb-4">Chamados Mensal</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={ticketsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0E4D43" />
                  <XAxis stroke="#A7C4BC" dataKey="month" tick={{ fill: '#A7C4BC', fontSize: 12 }} />
                  <YAxis stroke="#A7C4BC" allowDecimals={false} tick={{ fill: '#A7C4BC', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#073B34',
                      border: '1px solid #0E4D43',
                      borderRadius: '0.75rem',
                      color: '#F8FAFC',
                    }}
                  />
                  <Legend wrapperStyle={{ color: '#A7C4BC' }} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="Chamados"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={{ fill: '#10B981', r: 4 }}
                    activeDot={{ r: 6, fill: '#34D399' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Painel de Alertas Executivos */}
            <div className="bg-[#073B34] rounded-2xl p-6 border border-[#0E4D43] shadow-sm">
              <h3 className="text-[#F8FAFC] font-bold text-lg mb-4 flex items-center justify-between">
                <span>🚨 Alertas Executivos</span>
                <span className="text-xs font-semibold text-[#A7C4BC]">Monitoramento em Tempo Real</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. ⚠️ Trials Expirados */}
                <Link
                  href="/admin/ministerios"
                  className="bg-[#032C28] hover:bg-[#0B453B] rounded-xl p-4 border border-rose-900/40 hover:border-rose-500/60 transition block group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-rose-400 text-xs font-extrabold uppercase tracking-wider">⚠️ Trials Expirados</p>
                      <p className="text-[#F8FAFC] text-3xl font-black mt-1">{execStats?.trials ? 0 : (execStats?.suspensos || 0)}</p>
                      <p className="text-[11px] text-[#A7C4BC] mt-1 group-hover:text-rose-300 transition">Ver clientes expirados →</p>
                    </div>
                    <div className="p-3 bg-rose-950/80 text-rose-400 rounded-xl border border-rose-800/50 group-hover:scale-105 transition">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                  </div>
                </Link>

                {/* 2. 💳 Cobranças Pendentes */}
                <Link
                  href="/admin/pagamentos"
                  className="bg-[#032C28] hover:bg-[#0B453B] rounded-xl p-4 border border-amber-900/40 hover:border-amber-500/60 transition block group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-amber-400 text-xs font-extrabold uppercase tracking-wider">💳 Cobranças Pendentes</p>
                      <p className="text-[#F8FAFC] text-3xl font-black mt-1">{execStats?.pendentes || 0}</p>
                      <p className="text-[11px] text-[#A7C4BC] mt-1 group-hover:text-amber-300 transition">Ver faturas abertas →</p>
                    </div>
                    <div className="p-3 bg-amber-950/80 text-amber-400 rounded-xl border border-amber-800/50 group-hover:scale-105 transition">
                      <CreditCard className="w-5 h-5" />
                    </div>
                  </div>
                </Link>

                {/* 3. 📥 Leads Aguardando Conversão */}
                <Link
                  href="/admin/ministerios"
                  className="bg-[#032C28] hover:bg-[#0B453B] rounded-xl p-4 border border-emerald-800/50 hover:border-[#10B981]/60 transition block group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#10B981] text-xs font-extrabold uppercase tracking-wider">📥 Leads Pendentes</p>
                      <p className="text-[#F8FAFC] text-3xl font-black mt-1">{execStats?.leads || 0}</p>
                      <p className="text-[11px] text-[#A7C4BC] mt-1 group-hover:text-emerald-300 transition">Ver central de leads →</p>
                    </div>
                    <div className="p-3 bg-[#0B453B] text-[#10B981] rounded-xl border border-[#10B981]/40 group-hover:scale-105 transition">
                      <Inbox className="w-5 h-5" />
                    </div>
                  </div>
                </Link>

                {/* 4. 🚨 Clientes Suspensos */}
                <Link
                  href="/admin/ministerios"
                  className="bg-[#032C28] hover:bg-[#0B453B] rounded-xl p-4 border border-rose-900/40 hover:border-rose-500/60 transition block group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-rose-400 text-xs font-extrabold uppercase tracking-wider">🚨 Clientes Suspensos</p>
                      <p className="text-[#F8FAFC] text-3xl font-black mt-1">{execStats?.suspensos || 0}</p>
                      <p className="text-[11px] text-[#A7C4BC] mt-1 group-hover:text-rose-300 transition">Ver clientes suspensos →</p>
                    </div>
                    <div className="p-3 bg-rose-950/80 text-rose-400 rounded-xl border border-rose-800/50 group-hover:scale-105 transition">
                      <Lock className="w-5 h-5" />
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Deployments Chart */}
          <div className="bg-[#073B34] rounded-2xl p-6 border border-[#0E4D43] shadow-sm">
            <h3 className="text-[#F8FAFC] font-bold text-lg mb-4">Implantações vs Cancelamentos</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deploymentsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0E4D43" />
                <XAxis stroke="#A7C4BC" dataKey="month" tick={{ fill: '#A7C4BC', fontSize: 12 }} />
                <YAxis stroke="#A7C4BC" allowDecimals={false} tick={{ fill: '#A7C4BC', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#073B34',
                    border: '1px solid #0E4D43',
                    borderRadius: '0.75rem',
                    color: '#F8FAFC',
                  }}
                />
                <Legend wrapperStyle={{ color: '#A7C4BC' }} />
                <Bar dataKey="implantacoes" name="Implantações" fill="#10B981" radius={[8, 8, 0, 0]} />
                <Bar dataKey="cancelamentos" name="Cancelamentos" fill="#EF4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      </main>
    </div>
  )
}
