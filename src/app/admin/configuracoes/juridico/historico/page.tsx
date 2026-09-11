'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { authenticatedFetch } from '@/lib/api-client'
import {
  History,
  Shield,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  Eye,
  X,
  User,
  FileCheck,
  CheckCircle2,
  FileText,
  Globe,
  Monitor,
  Calendar,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Layers,
  Activity,
} from 'lucide-react'

interface ItemHistoricoAdmin {
  id: string
  acao: string
  modulo: string
  tabela_afetada: string
  registro_id: string | null
  ministry_id: string | null
  ministry_name: string
  usuario_id: string | null
  usuario_nome: string
  usuario_email: string | null
  detalhes: Record<string, any>
  ip_address: string | null
  user_agent: string | null
  data_criacao: string
}

export default function HistoricoPage() {
  const [logs, setLogs] = useState<ItemHistoricoAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros e Busca
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAcao, setFilterAcao] = useState('TODOS')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Modal de Detalhes (READ-ONLY)
  const [selectedLog, setSelectedLog] = useState<ItemHistoricoAdmin | null>(null)

  const carregarHistorico = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await authenticatedFetch('/api/v1/admin/juridico/historico?limit=500')
      if (!res.ok) {
        throw new Error('Falha ao carregar a trilha de auditoria jurídica.')
      }
      const json = await res.json()
      if (json.success) {
        setLogs(json.data || [])
      } else {
        throw new Error(json.error || 'Erro ao consultar auditoria.')
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao carregar os eventos de auditoria.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarHistorico()
  }, [])

  // Métricas Executivas derivadas exclusivamente dos eventos reais
  const totalEventos = logs.length
  const totalAceites = logs.filter((l) => String(l.acao || '').toUpperCase().includes('ACEITE')).length
  const totalContratos = logs.filter((l) => String(l.acao || '').toUpperCase().includes('CONTRATO')).length
  const totalDocumentos = logs.filter((l) => String(l.acao || '').toUpperCase().includes('DOCUMENTO')).length

  // Lista única de ações existentes para preencher o dropdown de filtro
  const acoesDisponiveis = useMemo(() => {
    const set = new Set<string>()
    logs.forEach((l) => {
      if (l.acao) set.add(l.acao)
    })
    return Array.from(set).sort()
  }, [logs])

  // Filtragem e Busca
  const logsFiltrados = useMemo(() => {
    return logs.filter((item) => {
      const term = searchTerm.toLowerCase().trim()
      const matchesSearch =
        !term ||
        item.acao.toLowerCase().includes(term) ||
        item.ministry_name.toLowerCase().includes(term) ||
        item.usuario_nome.toLowerCase().includes(term) ||
        (item.usuario_email && item.usuario_email.toLowerCase().includes(term)) ||
        (item.ip_address && item.ip_address.includes(term)) ||
        (item.tabela_afetada && item.tabela_afetada.toLowerCase().includes(term))

      const matchesAcao = filterAcao === 'TODOS' || item.acao === filterAcao

      return matchesSearch && matchesAcao
    })
  }, [logs, searchTerm, filterAcao])

  // Paginação
  const totalPages = Math.max(1, Math.ceil(logsFiltrados.length / itemsPerPage))
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return logsFiltrados.slice(start, start + itemsPerPage)
  }, [logsFiltrados, currentPage])

  const getBadgeStyle = (acao: string) => {
    const act = (acao || '').toUpperCase()
    if (act.includes('BLOQUEADA') || act.includes('ERRO') || act.includes('FALHA')) {
      return 'bg-red-950 text-red-400 border-red-800'
    }
    if (act.includes('ACEITE')) {
      return 'bg-emerald-950 text-emerald-400 border-emerald-800'
    }
    if (act.includes('PUBLICADO') || act.includes('CONTRATO')) {
      return 'bg-blue-950 text-blue-400 border-blue-800'
    }
    if (act.includes('VERSAO') || act.includes('CRIADO')) {
      return 'bg-purple-950 text-purple-400 border-purple-800'
    }
    if (act.includes('ATUALIZADO') || act.includes('EDICAO')) {
      return 'bg-amber-950 text-amber-400 border-amber-800'
    }
    return 'bg-gray-800 text-gray-300 border-gray-700'
  }

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Trilha de Auditoria Jurídica & Compliance</h2>
          <p className="text-xs text-gray-400">
            Registro imutável de eventos jurídicos, celebração de contratos, publicações e aceites em <span className="font-mono text-gray-300">audit_logs</span>.
          </p>
        </div>
        <button
          onClick={carregarHistorico}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold border border-gray-700 transition"
        >
          <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar Trilha
        </button>
      </div>

      {/* Cards de Resumo Executivo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total de Eventos</p>
            <h3 className="text-2xl font-bold text-white mt-1">{loading ? '-' : totalEventos}</h3>
          </div>
          <div className="p-3 bg-blue-600/10 text-blue-400 rounded-lg border border-blue-500/20">
            <History size={20} />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Eventos de Aceite</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{loading ? '-' : totalAceites}</h3>
          </div>
          <div className="p-3 bg-emerald-600/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Ações de Contratos</p>
            <h3 className="text-2xl font-bold text-purple-400 mt-1">{loading ? '-' : totalContratos}</h3>
          </div>
          <div className="p-3 bg-purple-600/10 text-purple-400 rounded-lg border border-purple-500/20">
            <FileCheck size={20} />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Gestão de Documentos</p>
            <h3 className="text-2xl font-bold text-indigo-400 mt-1">{loading ? '-' : totalDocumentos}</h3>
          </div>
          <div className="p-3 bg-indigo-600/10 text-indigo-400 rounded-lg border border-indigo-500/20">
            <FileText size={20} />
          </div>
        </div>
      </div>

      {/* Tratamento de Erro */}
      {error && (
        <div className="p-4 bg-red-950/40 border border-red-800/50 rounded-xl flex items-center justify-between text-red-300">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Toolbar: Filtros & Busca */}
      <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por ação, tenant, usuário, IP..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <span className="text-xs text-gray-400 font-medium">Ação:</span>
          </div>

          <select
            value={filterAcao}
            onChange={(e) => {
              setFilterAcao(e.target.value)
              setCurrentPage(1)
            }}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500 max-w-xs"
          >
            <option value="TODOS">Todas as Ações</option>
            {acoesDisponiveis.map((ac) => (
              <option key={ac} value={ac}>
                {ac}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela de Eventos de Auditoria */}
      <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400 gap-3">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className="text-sm font-medium">Carregando trilha de auditoria jurídica...</p>
          </div>
        ) : paginatedLogs.length === 0 ? (
          <div className="p-12 text-center">
            <History size={40} className="mx-auto text-gray-600 mb-3" />
            <h3 className="text-base font-medium text-gray-300">Nenhum evento registrado</h3>
            <p className="text-xs text-gray-500 mt-1">
              Nenhum evento atende aos filtros de pesquisa ou não há logs registrados para o módulo JURIDICO.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-900/50 text-xs uppercase text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-3.5">Evento / Ação</th>
                  <th className="px-6 py-3.5">Usuário Responsável</th>
                  <th className="px-6 py-3.5">Tenant / Ministério</th>
                  <th className="px-6 py-3.5">Data / Hora</th>
                  <th className="px-6 py-3.5">IP de Origem</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-900/40 transition-colors">
                    {/* Evento / Ação */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-bold border ${getBadgeStyle(
                          log.acao
                        )}`}
                      >
                        {log.acao}
                      </span>
                      <div className="text-[11px] text-gray-500 font-mono mt-1">
                        Tabela: {log.tabela_afetada || 'documentos_juridicos'}
                      </div>
                    </td>

                    {/* Usuário Responsável */}
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-200">{log.usuario_nome}</div>
                      <div className="text-xs text-gray-400">{log.usuario_email || '-'}</div>
                    </td>

                    {/* Tenant / Ministério */}
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{log.ministry_name}</div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        {log.ministry_id && log.ministry_id !== '00000000-0000-0000-0000-000000000000'
                          ? log.ministry_id.slice(0, 8) + '...'
                          : 'Plataforma Global'}
                      </div>
                    </td>

                    {/* Data / Hora */}
                    <td className="px-6 py-4 text-xs text-gray-300">
                      <div>{new Date(log.data_criacao).toLocaleDateString('pt-BR')}</div>
                      <div className="text-gray-500 text-[11px]">{new Date(log.data_criacao).toLocaleTimeString('pt-BR')}</div>
                    </td>

                    {/* IP de Origem */}
                    <td className="px-6 py-4 text-xs font-mono text-gray-400">
                      {log.ip_address || 'desconhecido'}
                    </td>

                    {/* Ações */}
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-2 hover:bg-blue-600/10 text-gray-400 hover:text-blue-400 border border-transparent hover:border-blue-500/20 rounded-lg transition"
                        title="Visualizar Detalhes do Evento"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {!loading && logsFiltrados.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
            <span>
              Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, logsFiltrados.length)} a{' '}
              {Math.min(currentPage * itemsPerPage, logsFiltrados.length)} de {logsFiltrados.length} eventos
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-gray-800 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-medium text-gray-200">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-gray-800 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE DETALHES DO EVENTO DE AUDITORIA (100% READ-ONLY) */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header Modal */}
            <div className="px-6 py-4 bg-gray-900/60 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600/10 text-blue-400 rounded-lg border border-blue-500/20">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Detalhes do Evento de Auditoria
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-mono font-bold border ${getBadgeStyle(
                        selectedLog.acao
                      )}`}
                    >
                      {selectedLog.acao}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    ID do Log: <span className="font-mono text-gray-300">{selectedLog.id}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Grid 2 colunas: Metadados do Evento e Partes Envolvidas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Box 1: Metadados Técnicos */}
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity size={14} className="text-blue-400" /> Dados do Evento
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-gray-800/60">
                      <span className="text-gray-400">Ação / Operação:</span>
                      <span className="text-white font-mono font-medium">{selectedLog.acao}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-800/60">
                      <span className="text-gray-400">Módulo:</span>
                      <span className="text-gray-200 font-mono">{selectedLog.modulo}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-800/60">
                      <span className="text-gray-400">Tabela Afetada:</span>
                      <span className="text-gray-200 font-mono">{selectedLog.tabela_afetada || 'documentos_juridicos'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-800/60">
                      <span className="text-gray-400">Registro ID:</span>
                      <span className="text-gray-400 font-mono text-[11px]">{selectedLog.registro_id || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Box 2: Partes Envolvidas */}
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User size={14} className="text-purple-400" /> Partes Envolvidas
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-gray-800/60">
                      <span className="text-gray-400">Tenant / Ministério:</span>
                      <span className="text-white font-medium">{selectedLog.ministry_name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-800/60">
                      <span className="text-gray-400">Usuário Responsável:</span>
                      <span className="text-gray-200">{selectedLog.usuario_nome}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-800/60">
                      <span className="text-gray-400">E-mail:</span>
                      <span className="text-gray-300">{selectedLog.usuario_email || 'Não informado'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-800/60">
                      <span className="text-gray-400">User ID:</span>
                      <span className="text-gray-400 font-mono text-[11px]">{selectedLog.usuario_id || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Box 3: Metadados de Origem Técnica */}
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe size={14} className="text-emerald-400" /> Origem & Timestamp
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="flex justify-between py-1 border-b border-gray-800/60">
                    <span className="text-gray-400 flex items-center gap-1">
                      <Calendar size={12} /> Data/Hora do Registro:
                    </span>
                    <span className="text-gray-200">
                      {new Date(selectedLog.data_criacao).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-800/60">
                    <span className="text-gray-400 flex items-center gap-1">
                      <Globe size={12} /> Endereço IP:
                    </span>
                    <span className="text-emerald-400 font-mono font-medium">
                      {selectedLog.ip_address || 'desconhecido'}
                    </span>
                  </div>
                </div>
                {selectedLog.user_agent && (
                  <div className="text-xs pt-1">
                    <span className="text-gray-400 flex items-center gap-1 mb-1">
                      <Monitor size={12} /> User Agent / Dispositivo:
                    </span>
                    <div className="bg-gray-950 p-2.5 rounded-lg text-gray-300 font-mono text-[11px] break-all border border-gray-800">
                      {selectedLog.user_agent}
                    </div>
                  </div>
                )}
              </div>

              {/* Box 4: Detalhes JSON do Evento */}
              {selectedLog.detalhes && Object.keys(selectedLog.detalhes).length > 0 && (
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={14} className="text-indigo-400" /> Contexto & Detalhes da Auditoria
                  </h4>
                  <pre className="bg-gray-950 p-4 rounded-lg text-gray-200 font-mono text-xs overflow-x-auto border border-gray-800 whitespace-pre-wrap leading-relaxed">
                    {JSON.stringify(selectedLog.detalhes, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer Modal (100% READ-ONLY) */}
            <div className="px-6 py-4 bg-gray-900/60 border-t border-gray-800 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
