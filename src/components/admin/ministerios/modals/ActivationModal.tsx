'use client'

import { CheckCircle2, ExternalLink, Copy } from 'lucide-react'
import type { Ministry as SupabaseMinistry } from '@/types/supabase'

interface ActivationModalProps {
  activatingMinistry: SupabaseMinistry | null
  asaasSuccessData: { id: string; invoiceUrl: string } | null
  activationMode: 'direto' | 'asaas'
  setActivationMode: (val: 'direto' | 'asaas') => void
  activationPlan: string
  setActivationPlan: (val: string) => void
  activationValidity: string
  setActivationValidity: (val: string) => void
  customValidity: string
  setCustomValidity: (val: string) => void
  asaasDueDate: string
  setAsaasDueDate: (val: string) => void
  activationObservation: string
  setActivationObservation: (val: string) => void
  confirmActivation: boolean
  setConfirmActivation: (val: boolean) => void
  activationLoading: boolean
  onClose: () => void
  onSubmit: () => void
}

export default function ActivationModal({
  activatingMinistry,
  asaasSuccessData,
  activationMode,
  setActivationMode,
  activationPlan,
  setActivationPlan,
  activationValidity,
  setActivationValidity,
  customValidity,
  setCustomValidity,
  asaasDueDate,
  setAsaasDueDate,
  activationObservation,
  setActivationObservation,
  confirmActivation,
  setConfirmActivation,
  activationLoading,
  onClose,
  onSubmit,
}: ActivationModalProps) {
  if (!activatingMinistry) return null

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-gray-100 max-h-[90vh] overflow-y-auto flex flex-col">
        <h2 className="text-xl font-bold text-white mb-4">Ativar Ministério</h2>
        
        {asaasSuccessData ? (
          <div className="space-y-6 py-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Fatura ASAAS Gerada com Sucesso!</p>
                <p className="text-xs text-gray-400 mt-1">
                  A ativação do ministério ocorrerá automaticamente após a confirmação do pagamento.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {asaasSuccessData.invoiceUrl && (
                <>
                  <a
                    href={asaasSuccessData.invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-center font-semibold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Abrir fatura
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(asaasSuccessData.invoiceUrl)
                      alert('Link da fatura copiado para a área de transferência!')
                    }}
                    className="w-full py-3 bg-gray-800 hover:bg-gray-750 text-gray-100 rounded-lg text-center font-semibold text-sm transition border border-gray-700 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Copiar link
                    <Copy className="h-4 w-4" />
                  </button>
                </>
              )}
              <a
                href="/admin/pagamentos"
                className="w-full py-3 bg-gray-900 hover:bg-gray-850 text-gray-400 hover:text-white rounded-lg text-center font-semibold text-sm transition border border-gray-800 flex items-center justify-center gap-2 cursor-pointer"
              >
                Ver em /admin/pagamentos
              </a>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-gray-800 hover:bg-gray-750 text-gray-300 rounded-lg text-center font-medium text-sm transition"
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4 bg-gray-800/40 p-4 rounded-xl border border-gray-800">
                <div>
                  <span className="text-xs text-gray-400 block mb-0.5">Ministério:</span>
                  <span className="font-semibold text-white text-sm">{activatingMinistry.name}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block mb-0.5">E-mail:</span>
                  <span className="text-gray-300 text-sm">{activatingMinistry.email_admin}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block mb-0.5">Plano Atual:</span>
                  <span className="text-gray-300 text-sm uppercase">{activatingMinistry.plan || 'Nenhum'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block mb-0.5">Expiração Trial:</span>
                  <span className="text-gray-300 text-sm">
                    {activatingMinistry.subscription_end_date 
                      ? new Date(activatingMinistry.subscription_end_date).toLocaleDateString('pt-BR') 
                      : 'Nenhum'}
                  </span>
                </div>
              </div>

              {/* Tipo de liberação */}
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                  Tipo de Liberação
                </label>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-blue-500/30 bg-blue-950/20 cursor-pointer">
                    <input
                      type="radio"
                      name="modo_liberacao"
                      checked={activationMode === 'direto'}
                      onChange={() => setActivationMode('direto')}
                      className="mt-1 accent-blue-500"
                    />
                    <div>
                      <span className="text-sm font-semibold text-white block">Ativação Direta</span>
                      <span className="text-xs text-gray-400">
                        Libera o ministério imediatamente sem gerar cobrança.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-lg border border-blue-500/30 bg-blue-950/20 cursor-pointer">
                    <input
                      type="radio"
                      name="modo_liberacao"
                      checked={activationMode === 'asaas'}
                      onChange={() => setActivationMode('asaas')}
                      className="mt-1 accent-blue-500"
                    />
                    <div>
                      <span className="text-sm font-semibold text-white block">
                        Ativação com Pagamento ASAAS — 12 meses
                      </span>
                      <span className="text-xs text-gray-400">
                        Gera assinatura/cobrança anual no ASAAS.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Plano Definitivo */}
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                  Plano Definitivo
                </label>
                <select
                  value={activationPlan}
                  onChange={(e) => setActivationPlan(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="starter">Starter</option>
                  <option value="intermediario">Intermediário</option>
                  <option value="profissional">Profissional</option>
                </select>
              </div>

              {/* Validade / Vencimento */}
              {activationMode === 'direto' ? (
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                    Validade da ativação
                  </label>
                  <div className="flex gap-4 items-center">
                    <select
                      value={activationValidity}
                      onChange={(e) => setActivationValidity(e.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                    >
                      <option value="12">12 meses</option>
                      <option value="custom">Personalizado (Meses)</option>
                    </select>
                    
                    {activationValidity === 'custom' && (
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={customValidity}
                        onChange={(e) => setCustomValidity(e.target.value)}
                        className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                    Data de Vencimento da Fatura *
                  </label>
                  <input
                    type="date"
                    required
                    value={asaasDueDate}
                    onChange={(e) => setAsaasDueDate(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* Campo observação admin */}
              {activationMode === 'direto' && (
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                    Observações Administrativas (Opcional)
                  </label>
                  <textarea
                    value={activationObservation}
                    onChange={(e) => setActivationObservation(e.target.value)}
                    placeholder="Motivo da liberação, contrato manual, etc..."
                    className="w-full h-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              )}

              {/* Aviso de Preservação de Dados */}
              <div className="bg-blue-950/30 border border-blue-900/50 rounded-lg px-4 py-3 text-xs text-blue-300">
                ℹ️ <strong>Preservação de Dados:</strong> Todos os dados cadastrados durante o teste gratuito (membros, financeiro, eventos) serão preservados. Nenhum dado será excluído.
              </div>

              {/* Checkbox de Confirmação */}
              <label className="flex items-start gap-3 cursor-pointer mt-4 select-none">
                <input
                  type="checkbox"
                  checked={confirmActivation}
                  onChange={(e) => setConfirmActivation(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-blue-500 rounded border-gray-700 text-blue-500 focus:ring-0 focus:ring-offset-0 bg-gray-800"
                />
                <span className="text-xs text-gray-300 leading-snug">
                  {activationMode === 'direto'
                    ? 'Confirmo que desejo ativar este ministério sem gerar cobrança automática.'
                    : 'Confirmo que desejo gerar a fatura de cobrança no ASAAS para este ministério.'}
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={activationLoading}
                className="flex-1 px-4 py-2.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-755 transition text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={activationLoading || !confirmActivation}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {activationLoading ? 'Processando...' : 'Confirmar Ativação'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
