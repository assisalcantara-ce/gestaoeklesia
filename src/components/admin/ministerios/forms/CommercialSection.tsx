'use client'

import type { SubscriptionPlan } from '@/types/admin'

interface CommercialSectionProps {
  formData: {
    subscription_plan_id: string
    is_active: boolean
  }
  planos: SubscriptionPlan[]
  planosLoading: boolean
  editingId: string | null
  isTrial: boolean
  setIsTrial: (val: boolean) => void
  trialDays: number
  setTrialDays: (days: number) => void
  onChangeFormData: (
    data: Partial<{
      subscription_plan_id: string
      is_active: boolean
    }>
  ) => void
}

export default function CommercialSection({
  formData,
  planos,
  planosLoading,
  editingId,
  isTrial,
  setIsTrial,
  trialDays,
  setTrialDays,
  onChangeFormData,
}: CommercialSectionProps) {
  return (
    <div className="mb-6">
      <h4 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">Informações Comerciais</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Plano de Inscrição</label>
          <select
            value={formData.subscription_plan_id}
            onChange={(e) => onChangeFormData({ subscription_plan_id: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          >
            <option value="">Selecione um plano...</option>
            {planosLoading && (
              <option value="" disabled>Carregando planos...</option>
            )}
            {!planosLoading && planos.map((plano) => (
              <option key={plano.id} value={plano.id}>
                {plano.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <select
            value={formData.is_active ? 'ativo' : 'inativo'}
            onChange={(e) => onChangeFormData({ is_active: e.target.value === 'ativo' })}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          >
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
        {/* Trial */}
        {!editingId && (
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 p-4 rounded-lg border-2 transition"
              style={{ borderColor: isTrial ? '#2563eb' : '#e5e7eb', background: isTrial ? '#eff6ff' : '#f9fafb' }}
            >
              <input
                type="checkbox"
                id="chk-trial-comp"
                checked={isTrial}
                onChange={e => setIsTrial(e.target.checked)}
                className="w-5 h-5 accent-blue-600 cursor-pointer"
              />
              <label htmlFor="chk-trial-comp" className="font-semibold text-gray-800 cursor-pointer select-none">
                Período Trial
              </label>
              <span className="text-xs text-gray-500">— o ministério iniciará em modo trial e será desativado após o prazo</span>
            </div>
            {isTrial && (
              <div className="mt-3 flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Duração do trial:</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={trialDays}
                  onChange={e => setTrialDays(Math.max(1, Math.min(90, Number(e.target.value))))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-sm"
                />
                <span className="text-sm text-gray-600">dias</span>
                <span className="text-xs text-blue-600 ml-1">
                  (expira em {new Date(Date.now() + trialDays * 86400000).toLocaleDateString('pt-BR')})
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
