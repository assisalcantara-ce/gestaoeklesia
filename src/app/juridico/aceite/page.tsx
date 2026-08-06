'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { authenticatedFetch } from '@/lib/api-client'
import { Scale, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import type { DocumentoJuridico } from '@/types/juridico'

export default function AceiteDocumentoPage() {
  const [documento, setDocumento] = useState<DocumentoJuridico | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Checkboxes de confirmação obrigatórios
  const [chkLido, setChkLido] = useState(false)
  const [chkConcordo, setChkConcordo] = useState(false)

  // Carregar documento jurídico publicado retornado da API
  useEffect(() => {
    const carregarDocumento = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await authenticatedFetch('/api/v1/admin/juridico/documentos?status=PUBLICADO&ativo=true')
        if (!res.ok) {
          throw new Error('Não foi possível carregar os termos jurídicos.')
        }
        const json = await res.json()
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setDocumento(json.data[0])
        } else {
          setDocumento(null)
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar o documento jurídico.')
      } finally {
        setLoading(false)
      }
    }

    carregarDocumento()
  }, [])

  // Botão habilitado apenas quando houver documento e os dois checkboxes estiverem marcados
  const isFormValido = Boolean(documento) && chkLido && chkConcordo

  const handleAceitarEContinuar = () => {
    // Na v1: ainda NÃO registra o aceite nem integra com middleware de bloqueio
    alert('Confirmação registrada na interface! A integração com registro e middleware será ativada nas próximas fases.')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-4 md:p-6">
      {/* Background Decorativo */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-950 to-gray-950 pointer-events-none" />

      {/* Container Principal */}
      <div className="relative w-full max-w-3xl bg-gray-900/90 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-800 bg-gray-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Scale size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                {documento?.titulo || 'Documento Jurídico'}
              </h1>
              <p className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                {documento ? (
                  <>
                    <span>Versão <strong className="font-mono text-blue-400">v{documento.versao}</strong></span>
                    <span>•</span>
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <ShieldCheck size={13} /> Oficial Vigente
                    </span>
                  </>
                ) : (
                  <span className="text-gray-500">Nenhum termo ativo localizado</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Conteúdo do Documento */}
        <div className="p-6 flex-1 max-h-[420px] overflow-y-auto space-y-4">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-gray-400 gap-3">
              <Loader2 size={32} className="animate-spin text-blue-500" />
              <p className="text-sm font-medium">Carregando termos jurídicos...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-950/40 border border-red-800/50 rounded-xl flex items-center gap-3 text-red-300">
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          ) : !documento ? (
            <div className="py-12 px-4 text-center space-y-3">
              <AlertCircle size={36} className="mx-auto text-amber-400 opacity-80" />
              <h3 className="text-sm font-semibold text-gray-200">Nenhum termo jurídico publicado</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                No momento não há nenhum documento jurídico vigente publicado para aceite. Entre em contato com o suporte ou aguarde a publicação oficial.
              </p>
            </div>
          ) : (
            <div className="bg-gray-950/70 border border-gray-800/80 rounded-xl p-5 font-mono text-xs text-gray-300 leading-relaxed whitespace-pre-wrap selection:bg-blue-900 selection:text-white">
              {documento.conteudo_md}
            </div>
          )}
        </div>

        {/* Rodapé: Checkboxes Obrigatórios & Ação */}
        <div className="p-6 border-t border-gray-800 bg-gray-950/80 space-y-5">
          {/* Checkboxes de confirmação */}
          <div className="space-y-3">
            <label className={`flex items-start gap-3 group ${!documento ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={chkLido}
                disabled={!documento || loading}
                onChange={(e) => setChkLido(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-gray-300 group-hover:text-white transition-colors">
                Li integralmente este documento.
              </span>
            </label>

            <label className={`flex items-start gap-3 group ${!documento ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={chkConcordo}
                disabled={!documento || loading}
                onChange={(e) => setChkConcordo(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-gray-300 group-hover:text-white transition-colors">
                Concordo com os termos apresentados.
              </span>
            </label>
          </div>

          {/* Botão Aceitar e Continuar */}
          <div className="flex items-center justify-end pt-2">
            <button
              onClick={handleAceitarEContinuar}
              disabled={!isFormValido || loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-xl text-xs font-semibold shadow-lg disabled:shadow-none transition-all disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={16} /> Aceitar e Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}