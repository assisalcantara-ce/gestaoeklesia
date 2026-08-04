'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { authenticatedFetch } from '@/lib/api-client'
import { FileText, CheckCircle2, Archive, FilePlus, AlertCircle, Loader2 } from 'lucide-react'
import type { DocumentoJuridico } from '@/types/juridico'

export default function DocumentosPage() {
  const [documentos, setDocumentos] = useState<DocumentoJuridico[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function carregarDocumentos() {
      try {
        setLoading(true)
        setError(null)
        const res = await authenticatedFetch('/api/admin/juridico/documentos')
        if (!res.ok) {
          throw new Error('Falha ao carregar a lista de documentos jurídicos.')
        }
        const json = await res.json()
        if (json.success) {
          setDocumentos(json.data || [])
        } else {
          throw new Error(json.error || 'Erro ao consultar documentos.')
        }
      } catch (err: any) {
        setError(err.message || 'Ocorreu um erro ao carregar os dados.')
      } finally {
        setLoading(false)
      }
    }

    carregarDocumentos()
  }, [])

  const totalDocumentos = documentos.length
  const totalPublicados = documentos.filter((d) => d.status === 'PUBLICADO').length
  const totalRascunhos = documentos.filter((d) => d.status === 'RASCUNHO').length
  const totalArquivados = documentos.filter((d) => d.status === 'ARQUIVADO').length

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total de Documentos</p>
            <h3 className="text-2xl font-bold text-white mt-1">{loading ? '-' : totalDocumentos}</h3>
          </div>
          <div className="p-3 bg-blue-600/10 text-blue-400 rounded-lg border border-blue-500/20">
            <FileText size={20} />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Publicados Vigentes</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{loading ? '-' : totalPublicados}</h3>
          </div>
          <div className="p-3 bg-emerald-600/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Rascunhos em Edição</p>
            <h3 className="text-2xl font-bold text-amber-400 mt-1">{loading ? '-' : totalRascunhos}</h3>
          </div>
          <div className="p-3 bg-amber-600/10 text-amber-400 rounded-lg border border-amber-500/20">
            <FilePlus size={20} />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Arquivados</p>
            <h3 className="text-2xl font-bold text-gray-400 mt-1">{loading ? '-' : totalArquivados}</h3>
          </div>
          <div className="p-3 bg-gray-800 text-gray-400 rounded-lg border border-gray-700">
            <Archive size={20} />
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

      {/* Tabela de Documentos */}
      <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Catálogo de Documentos Jurídicos</h2>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400 gap-3">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className="text-sm font-medium">Carregando documentos jurídicos...</p>
          </div>
        ) : documentos.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={40} className="mx-auto text-gray-600 mb-3" />
            <h3 className="text-base font-medium text-gray-300">Nenhum documento encontrado</h3>
            <p className="text-xs text-gray-500 mt-1">Nenhum documento jurídico cadastrado no catálogo até o momento.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-900/50 text-xs uppercase text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-3.5">Título</th>
                  <th className="px-6 py-3.5">Tipo</th>
                  <th className="px-6 py-3.5">Versão</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Obrigatório</th>
                  <th className="px-6 py-3.5">Criado Em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {documentos.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-900/40 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{doc.titulo}</td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-400">{doc.tipo}</td>
                    <td className="px-6 py-4 text-xs font-mono text-blue-400">v{doc.versao}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          doc.status === 'PUBLICADO'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : doc.status === 'RASCUNHO'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-gray-800 text-gray-400 border border-gray-700'
                        }`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {doc.obrigatorio ? (
                        <span className="text-emerald-400 font-medium">Sim</span>
                      ) : (
                        <span className="text-gray-500">Não</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {new Date(doc.created_at).toLocaleDateString('pt-BR')}
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
