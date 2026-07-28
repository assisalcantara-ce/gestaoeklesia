'use client'

import { useState, useEffect } from 'react'
import { authenticatedFetch } from '@/lib/api-client'
import DashboardEmptyState from '@/components/dashboard/DashboardEmptyState'
import { History, Eye, Wrench, ChevronLeft, ChevronRight } from 'lucide-react'

interface ImpersonationHistoryTabProps {
  tenantId: string
}

export default function ImpersonationHistoryTab({ tenantId }: ImpersonationHistoryTabProps) {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  useEffect(() => {
    fetchHistory(page)
  }, [tenantId, page])

  const fetchHistory = async (currentPage: number) => {
    setLoading(true)
    try {
      const res = await authenticatedFetch(
        `/api/v1/admin/impersonate/history?tenantId=${tenantId}&page=${currentPage}&limit=10`
      )
      if (res.ok) {
        const json = await res.json()
        setHistory(json.data || [])
        setTotalPages(json.totalPages || 1)
        setTotalItems(json.total || 0)
      }
    } catch (e) {
      console.error('Erro ao carregar histórico de impersonação:', e)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (startedAt: string, endedAt?: string | null) => {
    if (!endedAt) return 'Em andamento'
    const start = new Date(startedAt).getTime()
    const end = new Date(endedAt).getTime()
    const diffMinutes = Math.max(1, Math.round((end - start) / 60000))
    if (diffMinutes >= 60) {
      const h = Math.floor(diffMinutes / 60)
      const m = diffMinutes % 60
      return `${h}h ${m}m`
    }
    return `${diffMinutes} min`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800">Ativo</span>
      case 'completed':
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">Concluído</span>
      case 'expired':
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-gray-800 text-gray-400 border border-gray-700">Expirado</span>
      case 'revoked':
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-red-950/80 text-red-300 border border-red-800">Revogado</span>
      default:
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-gray-800 text-gray-300">{status}</span>
    }
  }

  if (loading) {
    return <div className="text-center text-gray-400 py-12">Carregando Histórico de Suporte...</div>
  }

  if (history.length === 0) {
    return (
      <DashboardEmptyState
        icon={History}
        title="Sem Histórico de Sessões"
        description="Nenhuma sessão de atendimento/impersonação foi realizada para este cliente até o momento."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
          <History className="w-5 h-5 text-rose-400" />
          <span>Histórico de Atendimentos & Impersonação</span>
        </h3>
        <span className="text-xs text-gray-400 font-medium">Total: {totalItems} atendimento(s)</span>
      </div>

      <div className="overflow-x-auto bg-gray-900/60 border border-gray-750 rounded-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-gray-900 border-b border-gray-800 text-gray-400 uppercase font-bold">
            <tr>
              <th className="px-4 py-3">Data & Início</th>
              <th className="px-4 py-3">Encerramento</th>
              <th className="px-4 py-3">Super Admin</th>
              <th className="px-4 py-3">Tipo & Motivo do Atendimento</th>
              <th className="px-4 py-3">Modo</th>
              <th className="px-4 py-3">Duração</th>
              <th className="px-4 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60 font-medium">
            {history.map((item) => {
              const startDate = new Date(item.started_at)
              const endDate = item.ended_at ? new Date(item.ended_at) : null

              return (
                <tr key={item.id} className="hover:bg-gray-800/40 transition">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-white font-semibold">{startDate.toLocaleDateString('pt-BR')}</p>
                    <p className="text-[11px] text-gray-400">{startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                    {endDate ? (
                      <>
                        <p>{endDate.toLocaleDateString('pt-BR')}</p>
                        <p className="text-[11px] text-gray-400">{endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </>
                    ) : (
                      <span className="text-amber-400 font-bold">Em andamento</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-gray-200 font-medium">{item.admin_users?.email || item.admin_id}</p>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-gray-200 line-clamp-2 leading-relaxed">{item.reason}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {item.read_only ? (
                      <span className="inline-flex items-center gap-1 text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-800/60 text-[11px]">
                        <Eye className="w-3 h-3" /> Visualização
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/60 text-[11px]">
                        <Wrench className="w-3 h-3" /> Administrador
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-300 font-mono">
                    {formatDuration(item.started_at, item.ended_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    {getStatusBadge(item.status)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs text-gray-400">
          <span>Página {page} de {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg border border-gray-700 text-white transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg border border-gray-700 text-white transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
