'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { FileCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import type { TenantContrato } from '@/types/juridico'

export default function ContratosPage() {
  const [contratos, _setContratos] = useState<TenantContrato[]>([])
  const [loading, setLoading] = useState(true)
  const [error, _setError] = useState<string | null>(null)

  useEffect(() => {
    // Simula carregamento inicial ou requisição integrada à API de contratos
    const timer = setTimeout(() => {
      setLoading(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  const totalContratos = contratos.length
  const totalAtivos = contratos.filter((c) => c.status === 'ATIVO').length

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total de Contratos Emitidos</p>
            <h3 className="text-2xl font-bold text-white mt-1">{loading ? '-' : totalContratos}</h3>
          </div>
          <div className="p-3 bg-blue-600/10 text-blue-400 rounded-lg border border-blue-500/20">
            <FileCheck size={20} />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Contratos Ativos</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{loading ? '-' : totalAtivos}</h3>
          </div>
          <div className="p-3 bg-emerald-600/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <CheckCircle2 size={20} />
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

      {/* Tabela de Contratos */}
      <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Contratos de Clientes (Tenants)</h2>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400 gap-3">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className="text-sm font-medium">Carregando contratos de clientes...</p>
          </div>
        ) : contratos.length === 0 ? (
          <div className="p-12 text-center">
            <FileCheck size={40} className="mx-auto text-gray-600 mb-3" />
            <h3 className="text-base font-medium text-gray-300">Nenhum contrato ativo</h3>
            <p className="text-xs text-gray-500 mt-1">Os contratos emitidos durante a conversão do Billing serão exibidos aqui.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-900/50 text-xs uppercase text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-3.5">Número do Contrato</th>
                  <th className="px-6 py-3.5">Plano Contratado</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Início da Vigência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {contratos.map((contrato) => (
                  <tr key={contrato.id} className="hover:bg-gray-900/40 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{contrato.numero_contrato || contrato.id}</td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-400">{contrato.plano_contratado}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
                        {contrato.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {new Date(contrato.data_inicio).toLocaleDateString('pt-BR')}
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
