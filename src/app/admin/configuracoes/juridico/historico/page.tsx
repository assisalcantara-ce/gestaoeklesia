'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { History, Shield, AlertCircle, Loader2 } from 'lucide-react'

export default function HistoricoPage() {
  const [logs, _setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, _setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  const totalEventos = logs.length

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total de Eventos Auditados</p>
            <h3 className="text-2xl font-bold text-white mt-1">{loading ? '-' : totalEventos}</h3>
          </div>
          <div className="p-3 bg-blue-600/10 text-blue-400 rounded-lg border border-blue-500/20">
            <History size={20} />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Segurança & Rastreabilidade</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">Audit Log Ativo</h3>
          </div>
          <div className="p-3 bg-emerald-600/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <Shield size={20} />
          </div>
        </div>
      </div>

      {/* Tratamento de Erro */}
      {error && (
        <div className="p-4 bg-red-950/40 border border-red-800/50 rounded-xl flex items-center gap-3 text-red-300">
          <AlertCircle size={20} className="shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Tabela de Histórico de Auditoria */}
      <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Trilha de Auditoria Jurídica</h2>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400 gap-3">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className="text-sm font-medium">Carregando trilha de auditoria...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <History size={40} className="mx-auto text-gray-600 mb-3" />
            <h3 className="text-base font-medium text-gray-300">Nenhum evento registrado</h3>
            <p className="text-xs text-gray-500 mt-1">Os eventos jurídicos auditados (criações, edições, versões e aceites) aparecerão aqui.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-900/50 text-xs uppercase text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-3.5">Ação</th>
                  <th className="px-6 py-3.5">Usuário ID</th>
                  <th className="px-6 py-3.5">Ministério ID</th>
                  <th className="px-6 py-3.5">Data/Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-900/40 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-blue-400">{log.acao}</td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-400">{log.usuario_id}</td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-400">{log.ministry_id}</td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {new Date(log.data_criacao).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
