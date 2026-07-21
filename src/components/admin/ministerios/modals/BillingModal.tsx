'use client'

import { CheckCircle2, ExternalLink, Copy } from 'lucide-react'
import type { Ministry as SupabaseMinistry } from '@/types/supabase'

interface BillingModalProps {
  billingMinistry: SupabaseMinistry | null
  billingSuccessData: { id: string; invoiceUrl: string } | null
  billingPlan: string
  setBillingPlan: (val: string) => void
  billingDueDate: string
  setBillingDueDate: (val: string) => void
  billingInstallments: string
  setBillingInstallments: (val: string) => void
  billingLoading: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  getPlanPrice: (slug: string) => number
}

export default function BillingModal({
  billingMinistry,
  billingSuccessData,
  billingPlan,
  setBillingPlan,
  billingDueDate,
  setBillingDueDate,
  billingInstallments,
  setBillingInstallments,
  billingLoading,
  onClose,
  onSubmit,
  getPlanPrice,
}: BillingModalProps) {
  if (!billingMinistry) return null

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-gray-100">
        <h2 className="text-xl font-bold text-white mb-4">Gerar Faturas ASAAS</h2>
        
        {billingSuccessData ? (
          <div className="space-y-6 py-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Fatura(s) ASAAS Gerada(s) com Sucesso!</p>
                <p className="text-xs text-gray-400 mt-1">
                  A ativação do ministério ocorrerá automaticamente após a confirmação do pagamento.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {billingSuccessData.invoiceUrl && (
                <>
                  <a
                    href={billingSuccessData.invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-center font-semibold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Abrir 1ª fatura
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(billingSuccessData.invoiceUrl)
                      alert('Link da primeira fatura copiado!')
                    }}
                    className="w-full py-3 bg-gray-800 hover:bg-gray-750 text-gray-100 rounded-lg text-center font-semibold text-sm transition border border-gray-700 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Copiar link da 1ª fatura
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
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4 bg-gray-800/40 p-4 rounded-xl border border-gray-800">
                <div className="col-span-2">
                  <span className="text-xs text-gray-400 block mb-0.5">Ministério:</span>
                  <span className="font-semibold text-white text-sm">{billingMinistry.name}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-gray-400 block mb-0.5">E-mail Administrativo:</span>
                  <span className="text-gray-300 text-sm">{billingMinistry.email_admin}</span>
                </div>
              </div>

              {/* Plano Definitivo */}
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                  Plano Escolhido
                </label>
                <select
                  value={billingPlan}
                  onChange={(e) => setBillingPlan(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="starter">Starter</option>
                  <option value="intermediario">Intermediário</option>
                  <option value="profissional">Profissional</option>
                </select>
              </div>

              {/* Data de Vencimento da 1ª Parcela */}
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                  Data de Vencimento da 1ª Parcela *
                </label>
                <input
                  type="date"
                  required
                  value={billingDueDate}
                  onChange={(e) => setBillingDueDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Quantidade de Parcelas */}
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                  Quantidade de Parcelas
                </label>
                <select
                  value={billingInstallments}
                  onChange={(e) => setBillingInstallments(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                    <option key={n} value={String(n)}>
                      {n === 1 ? '1x (À vista)' : `${n}x`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Resumo Financeiro */}
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 text-xs space-y-2">
                <span className="font-semibold text-white block mb-1 text-xs uppercase tracking-wider">Resumo Financeiro (Anual)</span>
                <div className="flex justify-between">
                  <span className="text-gray-400">Mensalidade do Plano:</span>
                  <span className="text-gray-200 font-medium">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getPlanPrice(billingPlan))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Anual (12 meses):</span>
                  <span className="text-gray-255 font-semibold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getPlanPrice(billingPlan) * 12)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-700/50 pt-2 text-sm">
                  <span className="text-gray-300 font-medium">Valor por Parcela ({billingInstallments}x):</span>
                  <span className="text-emerald-400 font-bold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((getPlanPrice(billingPlan) * 12) / Math.max(1, Number(billingInstallments)))}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={billingLoading}
                className="flex-1 px-4 py-2.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-755 transition text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={billingLoading}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {billingLoading ? 'Processando...' : 'Gerar Faturas'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
