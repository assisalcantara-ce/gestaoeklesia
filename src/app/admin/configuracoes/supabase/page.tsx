'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react'
import { Database, AlertTriangle, HardDrive } from 'lucide-react'
import AdminSidebar from '@/components/AdminSidebar'
import { createClient } from '@/lib/supabase-client'

type AlertLevel = 'warning' | 'critical'

interface CapacityAlert {
  level: AlertLevel
  code: string
  message: string
}

interface CapacityMetrics {
  generatedAt: string
  plan: {
    name: string | null
    dbBytesLimit: number | null
  }
  usage: {
    dbBytesUsed: number
  }
  computed: {
    dbPercentUsed: number | null
    dbBytesRemaining: number | null
  }
  alerts: CapacityAlert[]
}

export default function SupabasePage() {
  const [stats, setStats] = useState<CapacityMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDatabaseStats()
  }, [])

  const fetchDatabaseStats = async () => {
    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        throw new Error('Não autenticado')
      }

      // Buscar estatísticas reais do Supabase
      const response = await fetch('/api/admin/supabase-metrics', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (!response.ok) throw new Error('Erro ao buscar métricas')
      
      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar estatísticas')
    } finally {
      setLoading(false)
    }
  }

  const getDbPercentage = () => {
    if (!stats) return 0
    if (typeof stats.computed.dbPercentUsed === 'number') return stats.computed.dbPercentUsed
    const limit = stats.plan.dbBytesLimit
    if (!limit || limit <= 0) return 0
    return Math.round((stats.usage.dbBytesUsed / limit) * 100)
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const getStatusColor = (percentage: number) => {
    if (percentage < 50) return 'text-green-500'
    if (percentage < 80) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getStatusBg = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500/10 border-green-500/20'
    if (percentage < 80) return 'bg-yellow-500/10 border-yellow-500/20'
    return 'bg-red-500/10 border-red-500/20'
  }

  const dbPercentage = getDbPercentage()

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 z-10">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-500" />
            PAINEL ADMINISTRATIVO: Métricas Supabase
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Monitore a capacidade e uso do seu banco de dados
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Alertas */}
          {stats?.alerts?.map((a, idx) => (
            <div
              key={`${a.code}-${idx}`}
              className={`flex items-start gap-3 p-4 rounded-lg border ${
                a.level === 'critical'
                  ? 'bg-red-500/10 border-red-500/20'
                  : 'bg-yellow-500/10 border-yellow-500/20'
              }`}
            >
              <AlertTriangle
                className={`w-5 h-5 flex-shrink-0 mt-0.5 ${a.level === 'critical' ? 'text-red-500' : 'text-yellow-500'}`}
              />
              <div>
                <p className={`${a.level === 'critical' ? 'text-red-200' : 'text-yellow-200'} font-bold`}>
                  {a.level === 'critical' ? 'Crítico' : 'Atenção'}
                </p>
                <p className={`${a.level === 'critical' ? 'text-red-300' : 'text-yellow-300'} text-sm mt-1`}>
                  {a.message}
                </p>
              </div>
            </div>
          ))}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-400">Carregando estatísticas...</div>
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <p className="text-red-200">{error}</p>
            </div>
          ) : stats ? (
            <>
              {/* Métricas Principais */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Banco (tamanho) */}
                <div className={`p-6 rounded-lg border ${getStatusBg(dbPercentage)}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-gray-300 font-bold flex items-center gap-2">
                      <HardDrive className="w-5 h-5" />
                      Banco de dados (tamanho)
                    </h3>
                    {stats.plan.dbBytesLimit ? (
                      <span className={`text-lg font-bold ${getStatusColor(dbPercentage)}`}>
                        {dbPercentage}%
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">
                      {formatBytes(stats.usage.dbBytesUsed)}
                      {stats.plan.dbBytesLimit ? ` / ${formatBytes(stats.plan.dbBytesLimit)}` : ''}
                    </p>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          dbPercentage < 50
                            ? 'bg-green-500'
                            : dbPercentage < 80
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(dbPercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Informações do Plano */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-gray-300 font-bold mb-4">📊 Informações do Plano</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-900 rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Plano Atual</p>
                    <p className="text-white font-bold text-lg">{stats.plan.name ?? 'Não informado'}</p>
                    <p className="text-gray-500 text-xs mt-2">Configurado via variáveis de ambiente</p>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Limite DB</p>
                    <p className="text-blue-400 font-bold text-lg">
                      {stats.plan.dbBytesLimit
                        ? `${formatBytes(stats.plan.dbBytesLimit)}${stats.plan.name ? ` (${stats.plan.name})` : ''}`
                        : 'Não configurado'}
                    </p>
                    <p className="text-gray-500 text-xs mt-2">Defina SUPABASE_PLAN_DB_BYTES_LIMIT</p>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Espaço Disponível</p>
                    <p className="text-green-400 font-bold text-lg">
                      {typeof stats.computed.dbBytesRemaining === 'number'
                        ? formatBytes(stats.computed.dbBytesRemaining)
                        : '—'}
                    </p>
                    <p className="text-gray-500 text-xs mt-2">Até limite do plano</p>
                  </div>
                </div>
              </div>

              {/* Botão de Refresh */}
              <button
                onClick={fetchDatabaseStats}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                🔄 Atualizar Estatísticas
              </button>
            </>
          ) : null}
        </div>
      </main>
    </div>
  )
}
