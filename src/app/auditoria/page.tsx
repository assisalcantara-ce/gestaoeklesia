'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth'
import Sidebar from '@/components/Sidebar'

type AuditLog = {
  id: string
  usuario_email: string
  acao: string
  modulo: string
  area: string | null
  descricao: string | null
  status: 'sucesso' | 'erro' | 'aviso'
  data_criacao: string
  ip_address?: string
  tabela_afetada?: string
}

export default function AuditoriaPage() {
  const supabase = createClient()
  const { loading: authLoading } = useRequireSupabaseAuth()

  const [activeMenu, setActiveMenu] = useState('auditoria')
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filtros
  const [filtroAcao, setFiltroAcao] = useState('todos')
  const [filtroModulo, setFiltroModulo] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroData, setFiltroData] = useState('7dias')
  const [filtroUsuario, setFiltroUsuario] = useState('')

  // Opções de filtro
  const acoes = ['criar', 'editar', 'deletar', 'visualizar', 'exportar', 'importar', 'responder', 'login', 'logout']
  const modulos = ['suporte', 'usuarios', 'ministerios', 'financeiro', 'membros', 'configuracoes']
  const statuses = ['sucesso', 'erro', 'aviso']

  // Carregar logs
  useEffect(() => {
    if (authLoading) return
    carregarLogs()
  }, [authLoading, filtroAcao, filtroModulo, filtroStatus, filtroData, filtroUsuario])

  const carregarLogs = async () => {
    try {
      setLoading(true)

      // Determinar data inicial baseado no filtro
      let dataInicial = new Date()

      switch (filtroData) {
        case 'hoje':
          dataInicial.setHours(0, 0, 0, 0)
          break
        case '7dias':
          dataInicial.setDate(dataInicial.getDate() - 7)
          break
        case '30dias':
          dataInicial.setDate(dataInicial.getDate() - 30)
          break
        case '90dias':
          dataInicial.setDate(dataInicial.getDate() - 90)
          break
        case 'todos':
          dataInicial = new Date('2000-01-01')
          break
      }

      // Buscar logs
      let query = supabase
        .from('audit_logs')
        .select('*')
        .gte('data_criacao', dataInicial.toISOString())
        .order('data_criacao', { ascending: false })
        .limit(500)

      // Aplicar filtros
      if (filtroAcao !== 'todos') {
        query = query.eq('acao', filtroAcao)
      }
      if (filtroModulo !== 'todos') {
        query = query.eq('modulo', filtroModulo)
      }
      if (filtroStatus !== 'todos') {
        query = query.eq('status', filtroStatus)
      }
      if (filtroUsuario) {
        query = query.ilike('usuario_email', `%${filtroUsuario}%`)
      }

      const { data, error: err } = await query

      if (err) {
        if (err.code === 'PGRST116' || err.message?.includes('not found')) {
          // Tabela não existe, criar automaticamente
          const response = await fetch('/api/v1/create-audit-logs-table', {
            method: 'POST',
          })
          if (response.ok) {
            await new Promise(resolve => setTimeout(resolve, 2000))
            await carregarLogs()
            return
          }
        }
        setError('Erro ao carregar logs: ' + (err.message || 'Erro desconhecido'))
        return
      }

      setError('')
      setLogs(data || [])
    } catch (err) {
      console.error('Erro ao carregar logs:', err)
      setError('Erro ao carregar logs')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) return <div className="p-8">Carregando...</div>

  // Cores para status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sucesso':
        return 'bg-green-50 border-green-200 text-green-700'
      case 'erro':
        return 'bg-red-50 border-red-200 text-red-700'
      case 'aviso':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sucesso':
        return '✅'
      case 'erro':
        return '❌'
      case 'aviso':
        return '⚠️'
      default:
        return '📝'
    }
  }

  const getAcaoIcon = (acao: string) => {
    const icons: { [key: string]: string } = {
      criar: '➕',
      editar: '✏️',
      deletar: '🗑️',
      visualizar: '👁️',
      exportar: '📤',
      importar: '📥',
      responder: '💬',
      login: '🔓',
      logout: '🔒',
    }
    return icons[acao] || '📝'
  }

  const formatarData = (data: string) => {
    const d = new Date(data)
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#f8f9fa] to-[#e9ecef]">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {/* HEADER */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-[#123b63] mb-2">📋 Auditoria</h1>
            <p className="text-gray-600">Log de todas as ações realizadas no sistema</p>
          </div>

          {/* FILTROS */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Filtros</h2>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Ação */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ação</label>
                <select
                  value={filtroAcao}
                  onChange={e => setFiltroAcao(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/20"
                >
                  <option value="todos">Todas</option>
                  {acoes.map(acao => (
                    <option key={acao} value={acao}>
                      {acao.charAt(0).toUpperCase() + acao.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Módulo */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Módulo</label>
                <select
                  value={filtroModulo}
                  onChange={e => setFiltroModulo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/20"
                >
                  <option value="todos">Todos</option>
                  {modulos.map(mod => (
                    <option key={mod} value={mod}>
                      {mod.charAt(0).toUpperCase() + mod.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                <select
                  value={filtroStatus}
                  onChange={e => setFiltroStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/20"
                >
                  <option value="todos">Todos</option>
                  {statuses.map(st => (
                    <option key={st} value={st}>
                      {st.charAt(0).toUpperCase() + st.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Período</label>
                <select
                  value={filtroData}
                  onChange={e => setFiltroData(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/20"
                >
                  <option value="hoje">Hoje</option>
                  <option value="7dias">Últimos 7 dias</option>
                  <option value="30dias">Últimos 30 dias</option>
                  <option value="90dias">Últimos 90 dias</option>
                  <option value="todos">Todos</option>
                </select>
              </div>

              {/* Usuário */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Usuário</label>
                <input
                  type="text"
                  value={filtroUsuario}
                  onChange={e => setFiltroUsuario(e.target.value)}
                  placeholder="Email do usuário"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/20"
                />
              </div>
            </div>
          </div>

          {/* ERRO */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
              <p className="text-red-800 font-semibold">{error}</p>
            </div>
          )}

          {/* LOGS */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin">⏳</div>
              <p className="text-gray-600 mt-2">Carregando logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-600">Nenhum log encontrado com esses filtros</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map(log => (
                <div
                  key={log.id}
                  className={`border-l-4 rounded-lg p-4 bg-white shadow transition hover:shadow-md`}
                  style={{
                    borderColor:
                      log.status === 'sucesso'
                        ? '#10b981'
                        : log.status === 'erro'
                          ? '#ef4444'
                          : '#f59e0b',
                  }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Coluna 1: Ação e Status */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{getAcaoIcon(log.acao)}</span>
                        <span className="font-semibold text-gray-800 capitalize">{log.acao}</span>
                      </div>
                      <div className="text-xs">
                        <span className={`inline-block px-2 py-1 rounded ${getStatusColor(log.status)}`}>
                          {getStatusIcon(log.status)} {log.status}
                        </span>
                      </div>
                    </div>

                    {/* Coluna 2: Módulo e Área */}
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Módulo</p>
                      <p className="text-gray-600 capitalize">{log.modulo}</p>
                      {log.area && (
                        <>
                          <p className="text-sm font-semibold text-gray-700 mt-2">Área</p>
                          <p className="text-gray-600 capitalize">{log.area}</p>
                        </>
                      )}
                    </div>

                    {/* Coluna 3: Usuário e Data */}
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Usuário</p>
                      <p className="text-gray-600 truncate">{log.usuario_email}</p>
                      <p className="text-sm font-semibold text-gray-700 mt-2">Data/Hora</p>
                      <p className="text-xs text-gray-600">{formatarData(log.data_criacao)}</p>
                    </div>

                    {/* Coluna 4: Descrição */}
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Descrição</p>
                      <p className="text-gray-600 text-sm line-clamp-2">
                        {log.descricao || '-'}
                      </p>
                      {log.tabela_afetada && (
                        <p className="text-xs text-gray-500 mt-2">
                          Tabela: <code className="bg-gray-100 px-1 rounded">{log.tabela_afetada}</code>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* RESUMO */}
          {!loading && logs.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-gray-600">
              📊 Total de {logs.length} logs encontrados
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
