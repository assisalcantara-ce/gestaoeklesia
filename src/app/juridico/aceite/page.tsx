'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { authenticatedFetch } from '@/lib/api-client'
import { useUserContext } from '@/hooks/useUserContext'
import { Scale, ShieldCheck, CheckCircle2, AlertCircle, Loader2, FileText } from 'lucide-react'
import type { DocumentoPendenteAceiteDTO } from '@/types/juridico'

export default function AceiteDocumentoPage() {
  const userCtx = useUserContext()
  const [documentos, setDocumentos] = useState<DocumentoPendenteAceiteDTO[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Checkboxes de confirmação obrigatórios
  const [chkLido, setChkLido] = useState(false)
  const [chkConcordo, setChkConcordo] = useState(false)

  // Carregar lista oficial de documentos pendentes via AcceptanceValidationService
  useEffect(() => {
    if (userCtx.loading) return

    const carregarPendencias = async () => {
      try {
        setLoading(true)
        setError(null)

        const ministryId = userCtx.ministryId
        if (!ministryId) {
          setError('Não foi possível identificar o ministério vinculado à sua conta.')
          setLoading(false)
          return
        }

        const res = await authenticatedFetch(
          `/api/v1/juridico/verificar-pendencias?ministry_id=${encodeURIComponent(ministryId)}`
        )

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          throw new Error(errJson.error || 'Não foi possível carregar as pendências jurídicas.')
        }

        const json = await res.json()
        if (json.success && json.data) {
          const pendentes: DocumentoPendenteAceiteDTO[] = json.data.documentos_pendentes || []
          setDocumentos(pendentes)
          setCurrentIndex(0)

          if (!json.data.possui_pendencias || pendentes.length === 0) {
            setSuccessMsg('Todos os termos jurídicos obrigatórios já estão aceitos e em dia! Redirecionando...')
            setTimeout(() => {
              window.location.href = '/dashboard'
            }, 1500)
          }
        } else {
          setDocumentos([])
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar os documentos jurídicos pendentes.')
      } finally {
        setLoading(false)
      }
    }

    carregarPendencias()
  }, [userCtx.loading, userCtx.ministryId])

  const documentoAtual = documentos[currentIndex] || null

  // Botão habilitado apenas quando houver documento e os dois checkboxes estiverem marcados
  const isFormValido = Boolean(documentoAtual) && chkLido && chkConcordo && !submitting

  const handleAceitarEContinuar = async () => {
    if (!documentoAtual || !isFormValido) return

    try {
      setSubmitting(true)
      setError(null)
      setSuccessMsg(null)

      const ministryId = userCtx.ministryId
      if (!ministryId) {
        throw new Error('Ministério não identificado.')
      }

      const res = await authenticatedFetch('/api/v1/juridico/aceite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documento_id: documentoAtual.id,
          ministry_id: ministryId,
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Falha ao registrar aceite do documento.')
      }

      // Se houver mais documentos pendentes na fila
      if (currentIndex < documentos.length - 1) {
        setSuccessMsg(`Aceite do termo "${documentoAtual.titulo}" registrado com sucesso! Carregando próximo documento...`)
        setTimeout(() => {
          setSuccessMsg(null)
          setChkLido(false)
          setChkConcordo(false)
          setCurrentIndex((prev) => prev + 1)
        }, 1200)
      } else {
        // Todos os documentos foram aceitos
        setSuccessMsg(`Todos os aceites jurídicos foram registrados com sucesso! Redirecionando para o sistema...`)
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 1500)
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar aceite.')
    } finally {
      setSubmitting(false)
    }
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
                {documentoAtual?.titulo || 'Termos e Condições Jurídicas'}
              </h1>
              <p className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                {documentoAtual ? (
                  <>
                    <span>Versão <strong className="font-mono text-blue-400">v{documentoAtual.versao}</strong></span>
                    <span>•</span>
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <ShieldCheck size={13} /> Oficial Vigente
                    </span>
                    {documentos.length > 1 && (
                      <>
                        <span>•</span>
                        <span className="text-amber-400 font-semibold">
                          Documento {currentIndex + 1} de {documentos.length}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <span className="text-gray-500">
                    {loading ? 'Consultando pendências...' : 'Nenhum termo ativo pendente'}
                  </span>
                )}
              </p>
            </div>
          </div>

          {documentos.length > 1 && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-gray-800/80 rounded-full border border-gray-700 text-xs font-mono text-gray-300">
              <FileText size={13} className="text-blue-400" />
              <span>{currentIndex + 1} / {documentos.length}</span>
            </div>
          )}
        </div>

        {/* Conteúdo do Documento */}
        <div className="p-6 flex-1 max-h-[420px] overflow-y-auto space-y-4">
          {loading || userCtx.loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-gray-400 gap-3">
              <Loader2 size={32} className="animate-spin text-blue-500" />
              <p className="text-sm font-medium">Carregando termos jurídicos obrigatórios...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-950/40 border border-red-800/50 rounded-xl flex items-center gap-3 text-red-300">
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          ) : !documentoAtual ? (
            <div className="py-12 px-4 text-center space-y-3">
              <CheckCircle2 size={36} className="mx-auto text-emerald-400 opacity-90" />
              <h3 className="text-sm font-semibold text-gray-200">Todos os termos estão em dia</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                Você já aceitou todos os documentos jurídicos e contratuais vigentes. Redirecionando para o sistema...
              </p>
            </div>
          ) : (
            <div className="bg-gray-950/70 border border-gray-800/80 rounded-xl p-5 font-mono text-xs text-gray-300 leading-relaxed whitespace-pre-wrap selection:bg-blue-900 selection:text-white">
              {documentoAtual.conteudo_md || 'Conteúdo do documento jurídico indisponível.'}
            </div>
          )}
        </div>

        {/* Rodapé: Checkboxes Obrigatórios & Ação */}
        <div className="p-6 border-t border-gray-800 bg-gray-950/80 space-y-5">
          {/* Checkboxes de confirmação */}
          <div className="space-y-3">
            <label className={`flex items-start gap-3 group ${!documentoAtual ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={chkLido}
                disabled={!documentoAtual || loading || submitting}
                onChange={(e) => setChkLido(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-gray-300 group-hover:text-white transition-colors">
                Li integralmente este documento ({documentoAtual?.titulo || 'termo'}).
              </span>
            </label>

            <label className={`flex items-start gap-3 group ${!documentoAtual ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={chkConcordo}
                disabled={!documentoAtual || loading || submitting}
                onChange={(e) => setChkConcordo(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-gray-300 group-hover:text-white transition-colors">
                Concordo com os termos apresentados na versão <strong className="font-mono text-blue-400">v{documentoAtual?.versao || '1.0'}</strong>.
              </span>
            </label>
          </div>

          {/* Alertas de Erro ou Sucesso */}
          {successMsg && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800/50 rounded-xl flex items-center gap-3 text-emerald-300">
              <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
              <p className="text-xs font-medium">{successMsg}</p>
            </div>
          )}

          {/* Botão Aceitar e Continuar */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-gray-500">
              {documentoAtual ? `Hash SHA-256: ${documentoAtual.hash_sha256?.substring(0, 16) || 'Oficial'}...` : ''}
            </span>

            <button
              onClick={handleAceitarEContinuar}
              disabled={!isFormValido || loading || submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-xl text-xs font-semibold shadow-lg disabled:shadow-none transition-all disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  Registrando Aceite...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Aceitar e Continuar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}