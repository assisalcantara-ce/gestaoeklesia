'use client'

import { useState } from 'react'

export default function MigrationPanel() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{
    tipo: 'sucesso' | 'erro' | 'info'
    mensagem: string
    detalhes?: string
  } | null>(null)
  const [mostrarSql, setMostrarSql] = useState(false)

  const verificarTabela = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/v1/create-tickets-table')
      const data = await res.json()

      if (res.ok) {
        setStatus({
          tipo: 'sucesso',
          mensagem: `✅ ${data.mensagem} (${data.registros} registros)`,
        })
      } else {
        setStatus({
          tipo: 'erro',
          mensagem: `❌ ${data.erro || 'Tabela não encontrada'}`,
        })
      }
    } catch (erro) {
      setStatus({
        tipo: 'erro',
        mensagem: `❌ Erro ao verificar: ${erro instanceof Error ? erro.message : 'Desconhecido'}`,
      })
    } finally {
      setLoading(false)
    }
  }

  const criarTabela = async () => {
    try {
      setLoading(true)
      setStatus({
        tipo: 'info',
        mensagem: '⏳ Criando tabela...',
      })

      const res = await fetch('/api/v1/create-tickets-table', {
        method: 'POST',
      })
      const data = await res.json()

      if (res.ok) {
        setStatus({
          tipo: 'sucesso',
          mensagem: '✅ Tabela criada com sucesso! Recarregue a página.',
        })
        // Aguardar 2 segundos e verificar
        setTimeout(verificarTabela, 2000)
      } else {
        setStatus({
          tipo: 'erro',
          mensagem: data.erro || 'Erro ao criar tabela',
          detalhes: data.instrucoes,
        })
      }
    } catch (erro) {
      setStatus({
        tipo: 'erro',
        mensagem: `❌ Erro: ${erro instanceof Error ? erro.message : 'Desconhecido'}`,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-xl p-6 max-w-sm border-2 border-[#0284c7] z-50">
      <h3 className="font-bold text-[#123b63] mb-4 flex items-center gap-2">
        🔧 Painel de Migração
        <button
          onClick={() => setMostrarSql(!mostrarSql)}
          className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300 transition"
        >
          {mostrarSql ? 'Ocultar' : 'Ver'} SQL
        </button>
      </h3>

      <div className="space-y-3">
        <button
          onClick={verificarTabela}
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition font-semibold"
        >
          {loading ? '⏳ Verificando...' : '🔍 Verificar Tabela'}
        </button>

        <button
          onClick={criarTabela}
          disabled={loading}
          className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition font-semibold"
        >
          {loading ? '⏳ Criando...' : '✨ Criar Tabela'}
        </button>
      </div>

      {status && (
        <div
          className={`mt-4 p-4 rounded text-sm border-l-4 ${
            status.tipo === 'sucesso'
              ? 'bg-green-50 text-green-800 border-green-500'
              : status.tipo === 'erro'
                ? 'bg-red-50 text-red-800 border-red-500'
                : 'bg-blue-50 text-blue-800 border-blue-500'
          }`}
        >
          <p className="font-semibold mb-2">{status.mensagem}</p>
          {status.detalhes && (
            <pre className="text-xs whitespace-pre-wrap font-mono bg-black/5 p-2 rounded mt-2 max-h-40 overflow-y-auto">
              {status.detalhes}
            </pre>
          )}
        </div>
      )}

      {mostrarSql && (
        <div className="mt-4 p-3 bg-gray-100 rounded text-xs max-h-40 overflow-y-auto font-mono border border-gray-300">
          <p className="text-gray-600 mb-2">Execute manualmente no Supabase SQL Editor:</p>
          <code className="text-gray-800">
            CREATE TABLE IF NOT EXISTS tickets_suporte (
            <br />
            &nbsp;&nbsp;id UUID PRIMARY KEY,
            <br />
            &nbsp;&nbsp;usuario_id UUID NOT NULL,
            <br />
            &nbsp;&nbsp;titulo VARCHAR(100),
            <br />
            &nbsp;&nbsp;...
            <br />
            );
          </code>
        </div>
      )}
    </div>
  )
}
