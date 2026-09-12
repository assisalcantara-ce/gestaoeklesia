'use client'

import { useState, useEffect, useCallback } from 'react'
import { authenticatedFetch } from '@/lib/api-client'
import { PlatformFinancialBalance } from '@/lib/platform/finance'
import {
  Coins,
  RefreshCw,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Wallet,
  Info,
  Building,
} from 'lucide-react'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export default function FinancialBalancesTab({ onDataChanged }: { onDataChanged?: () => void }) {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [balances, setBalances] = useState<PlatformFinancialBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Modal de Configuração
  const [modalOpen, setModalOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const [formData, setFormData] = useState({
    account_name: 'Conta Principal Gestão Eklésia',
    reference_year: currentYear,
    reference_month: new Date().getMonth() + 1,
    initial_balance: '',
    notes: '',
  })

  const formatCurrency = (val: number | null | undefined) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const fetchBalances = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await authenticatedFetch(`/api/v1/admin/corporate-finance/balances?year=${selectedYear}`)
      if (!res.ok) throw new Error('Falha ao carregar saldos iniciais')
      const json = await res.json()
      setBalances(json.data || [])
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar saldos')
    } finally {
      setLoading(false)
    }
  }, [selectedYear])

  useEffect(() => {
    fetchBalances()
  }, [fetchBalances])

  const handleOpenEdit = (month: number) => {
    const existing = balances.find((b) => b.reference_month === month)
    setFormData({
      account_name: existing?.account_name || 'Conta Principal Gestão Eklésia',
      reference_year: selectedYear,
      reference_month: month,
      initial_balance: existing ? String(existing.initial_balance) : '0',
      notes: existing?.notes || '',
    })
    setFormError('')
    setModalOpen(true)
  }

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setFormLoading(true)
      setFormError('')

      const numBal = Number(formData.initial_balance)
      if (!Number.isFinite(numBal)) throw new Error('Informe um valor numérico válido para o saldo')

      const res = await authenticatedFetch('/api/v1/admin/corporate-finance/balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_name: formData.account_name.trim() || 'Conta Principal Gestão Eklésia',
          reference_year: Number(formData.reference_year),
          reference_month: Number(formData.reference_month),
          initial_balance: numBal,
          notes: formData.notes.trim() || null,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Erro ao salvar saldo inicial')
      }

      setModalOpen(false)
      setSuccessMsg(`Saldo de ${MONTH_NAMES[formData.reference_month - 1]}/${formData.reference_year} configurado com sucesso!`)
      setTimeout(() => setSuccessMsg(''), 4000)
      await fetchBalances()
      if (onDataChanged) onDataChanged()
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar saldo')
    } finally {
      setFormLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Alerta de Explicação da Regra */}
      <div className="bg-amber-950/30 border border-amber-900/60 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-300">
        <Info className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-200">
            Regra e Finalidade do Saldo Inicial
          </p>
          <p className="text-gray-400">
            O <strong className="text-amber-300">Saldo Inicial</strong> representa a disponibilidade financeira de caixa e bancos no primeiro instante do mês selecionado. Ele é o ponto de partida para o cálculo do <strong className="text-amber-300">Saldo Financeiro Final</strong> (<span className="text-gray-300 font-mono">Saldo Inicial + Entradas Recebidas - Despesas Pagas</span>). Cada combinação de <em>Conta + Ano + Mês</em> possui um único saldo de referência.
          </p>
        </div>
      </div>

      {/* Sucesso */}
      {successMsg && (
        <div className="bg-emerald-950/70 border border-emerald-800 text-emerald-300 p-4 rounded-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="bg-red-950/70 border border-red-800 text-red-300 p-4 rounded-xl flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            {error}
          </div>
          <button onClick={fetchBalances} className="underline hover:text-white font-bold cursor-pointer">
            Recarregar
          </button>
        </div>
      )}

      {/* Seletor de Ano */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5 text-blue-400" />
          <div>
            <h3 className="text-sm font-bold text-white">Saldos Iniciais Mensais</h3>
            <p className="text-xs text-gray-400">Ano base de competência</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-200 font-semibold focus:outline-none focus:border-blue-500"
          >
            {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                Exercício {y}
              </option>
            ))}
          </select>

          <button
            onClick={fetchBalances}
            disabled={loading}
            className="p-2 bg-gray-950 border border-gray-800 hover:border-gray-700 rounded-lg text-gray-400 hover:text-white transition cursor-pointer"
            title="Recarregar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid com os 12 meses do ano */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {MONTH_NAMES.map((monthName, idx) => {
          const monthNumber = idx + 1
          const bal = balances.find((b) => b.reference_month === monthNumber)
          const hasBalance = bal !== undefined

          return (
            <div
              key={monthNumber}
              className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 flex flex-col justify-between transition group"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-blue-400" />
                    {monthName} / {selectedYear}
                  </span>
                  <button
                    onClick={() => handleOpenEdit(monthNumber)}
                    className="p-1 text-gray-400 hover:text-blue-400 bg-gray-950 rounded-md border border-gray-800 transition cursor-pointer"
                    title="Editar Saldo Inicial"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                </div>

                <div className="mt-4">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">
                    Saldo Inicial Definido
                  </span>
                  <p className={`text-lg font-bold mt-0.5 ${hasBalance && bal.initial_balance > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                    {hasBalance ? formatCurrency(bal.initial_balance) : 'R$ 0,00'}
                  </p>
                </div>

                {bal?.notes && (
                  <p className="text-[10px] text-gray-500 italic mt-2 line-clamp-1">
                    {bal.notes}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-800/60 flex items-center justify-between text-[10px]">
                <span className="text-gray-500">
                  {hasBalance ? 'Configurado' : 'Não parametrizado'}
                </span>
                <button
                  onClick={() => handleOpenEdit(monthNumber)}
                  className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                >
                  {hasBalance ? 'Alterar' : '+ Definir'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal de Configuração de Saldo */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-500" />
                Definir Saldo Inicial — {MONTH_NAMES[formData.reference_month - 1]}/{formData.reference_year}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-950/70 border border-red-800 text-red-300 p-3 rounded-lg text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Identificação da Conta / Fundo
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    required
                    value={formData.account_name}
                    onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Saldo Inicial no 1º Dia do Mês (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={formData.initial_balance}
                  onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Observações / Justificativa
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Saldo conciliado com extrato bancário do dia 01..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={formLoading}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition shadow-sm shadow-blue-500/20 cursor-pointer"
                >
                  {formLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  Salvar Saldo Inicial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

