'use client'

import { useState, useEffect } from 'react'
import type { Ministry as SupabaseMinistry } from '@/types/supabase'
import { ShieldAlert, X, Eye, Wrench, CheckCircle2 } from 'lucide-react'

interface ImpersonationModalProps {
  isOpen: boolean
  onClose: () => void
  ministry: SupabaseMinistry | null
}

const TIPOS_ATENDIMENTO = [
  { value: 'suporte_tecnico', label: 'Suporte Técnico', duration: 30 },
  { value: 'configuracao', label: 'Configuração', duration: 120 },
  { value: 'treinamento', label: 'Treinamento', duration: 120 },
  { value: 'migracao_dados', label: 'Migração de Dados', duration: 240 },
  { value: 'implantacao', label: 'Implantação', duration: 240 },
]

export default function ImpersonationModal({ isOpen, onClose, ministry }: ImpersonationModalProps) {
  const [tipoAtendimento, setTipoAtendimento] = useState('suporte_tecnico')
  const [durationMinutes, setDurationMinutes] = useState<number>(30)
  const [readOnly, setReadOnly] = useState<boolean>(false)
  const [reason, setReason] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  // Ao mudar o Tipo de Atendimento, sugerir automaticamente a duração padrão
  useEffect(() => {
    const selected = TIPOS_ATENDIMENTO.find((t) => t.value === tipoAtendimento)
    if (selected) {
      setDurationMinutes(selected.duration)
    }
  }, [tipoAtendimento])

  // Limpar formulário ao abrir/fechar
  useEffect(() => {
    if (isOpen) {
      setTipoAtendimento('suporte_tecnico')
      setDurationMinutes(30)
      setReadOnly(false)
      setReason('')
      setError('')
    }
  }, [isOpen])

  if (!isOpen || !ministry) return null

  const handleStartImpersonation = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const cleanReason = reason.trim()
    if (cleanReason.length < 5) {
      setError('O motivo do atendimento é obrigatório e deve possuir no mínimo 5 caracteres.')
      return
    }

    if (cleanReason.length > 500) {
      setError('O motivo do atendimento excede o limite máximo de 500 caracteres.')
      return
    }

    const tipoObj = TIPOS_ATENDIMENTO.find((t) => t.value === tipoAtendimento)
    const formattedReason = `[${tipoObj?.label || 'Atendimento'}]: ${cleanReason}`

    setLoading(true)

    try {
      const response = await fetch('/api/v1/admin/impersonate/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionStorage.getItem('supabase.auth.token') || ''}`, // authenticatedFetch injects token
        },
        body: JSON.stringify({
          tenantId: ministry.id,
          reason: formattedReason,
          readOnly,
          durationMinutes: Number(durationMinutes),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao iniciar a sessão de impersonação.')
      }

      // Persistir o JWT de Impersonação retornado
      if (data.token) {
        sessionStorage.setItem('eklesia_impersonation_token', data.token)
        localStorage.setItem('eklesia_impersonation_token', data.token)
      }

      onClose()

      // Redirecionar imediatamente para o Dashboard do cliente impersonado sem exigir novo login
      window.location.href = '/admin/dashboard'
    } catch (err: any) {
      console.error('Erro ao iniciar impersonação:', err)
      setError(err.message || 'Erro inesperado ao conectar à API.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden text-gray-100 relative">
        {/* Cabeçalho do Modal */}
        <div className="bg-rose-950/40 border-b border-rose-900/50 p-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600/20 border border-rose-500/30 text-rose-400 rounded-xl">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Assumir Sessão</h2>
              <p className="text-xs text-rose-200/80 mt-0.5">
                Você acessará temporariamente o ambiente administrativo deste cliente. Todas as ações realizadas durante esta sessão serão registradas para auditoria.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleStartImpersonation} className="p-6 space-y-6">
          {/* Card com Informações do Cliente */}
          <div className="bg-gray-800/60 border border-gray-750 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-400 font-medium">Nome do Ministério:</span>
              <p className="text-sm font-bold text-white mt-0.5">{ministry.name}</p>
            </div>
            <div>
              <span className="text-gray-400 font-medium">CNPJ / Documento:</span>
              <p className="text-sm font-semibold text-gray-200 mt-0.5">{ministry.cnpj_cpf || 'Não informado'}</p>
            </div>
            <div>
              <span className="text-gray-400 font-medium">Plano Contratado:</span>
              <p className="text-sm font-bold text-blue-400 uppercase mt-0.5">{ministry.plan || 'Starter'}</p>
            </div>
            <div>
              <span className="text-gray-400 font-medium">Status da Assinatura:</span>
              <p className="text-sm font-semibold text-emerald-400 uppercase mt-0.5">{ministry.subscription_status || 'Ativo'}</p>
            </div>
          </div>

          {/* Erro de Validação */}
          {error && (
            <div className="p-3.5 bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-xl flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Campo 1: Tipo de Atendimento */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Tipo de Atendimento *</label>
              <select
                value={tipoAtendimento}
                onChange={(e) => setTipoAtendimento(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
              >
                {TIPOS_ATENDIMENTO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Campo 2: Tempo da Sessão */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Tempo da Sessão *</label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
              >
                <option value={30}>30 minutos</option>
                <option value={120}>2 horas</option>
                <option value={240}>4 horas</option>
              </select>
              <p className="text-[11px] text-gray-400 italic">
                O tempo poderá ser renovado futuramente antes do vencimento da sessão.
              </p>
            </div>
          </div>

          {/* Campo 3: Modo de Acesso */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-300">Modo de Acesso *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                onClick={() => setReadOnly(true)}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  readOnly
                    ? 'bg-blue-950/40 border-blue-500 text-blue-200'
                    : 'bg-gray-800/40 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                <input
                  type="radio"
                  name="readOnly"
                  checked={readOnly === true}
                  onChange={() => setReadOnly(true)}
                  className="hidden"
                />
                <Eye className={`w-4 h-4 ${readOnly ? 'text-blue-400' : 'text-gray-500'}`} />
                <div>
                  <p className="text-xs font-bold">Somente Visualização</p>
                  <p className="text-[11px] opacity-75">Nenhuma alteração no banco é permitida</p>
                </div>
              </label>

              <label
                onClick={() => setReadOnly(false)}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  !readOnly
                    ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                    : 'bg-gray-800/40 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                <input
                  type="radio"
                  name="readOnly"
                  checked={readOnly === false}
                  onChange={() => setReadOnly(false)}
                  className="hidden"
                />
                <Wrench className={`w-4 h-4 ${!readOnly ? 'text-amber-400' : 'text-gray-500'}`} />
                <div>
                  <p className="text-xs font-bold">Administrador</p>
                  <p className="text-[11px] opacity-75">Acesso total com auditoria gravada</p>
                </div>
              </label>
            </div>
          </div>

          {/* Campo 4: Motivo do Atendimento */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-300">Motivo do Atendimento *</label>
              <span className="text-[11px] text-gray-400">{reason.trim().length} / 500</span>
            </div>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              placeholder="Descreva o motivo detalhado do acesso administrativo ou número do chamado de suporte (mínimo 5 caracteres)..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500 transition resize-none"
            />
          </div>

          {/* Botões do Rodapé */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || reason.trim().length < 5}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-950/50"
            >
              {loading ? (
                <span>Iniciando...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar & Assumir Sessão</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
