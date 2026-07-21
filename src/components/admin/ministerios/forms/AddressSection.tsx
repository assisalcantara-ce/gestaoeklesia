'use client'

import { onlyDigits } from '@/lib/mascaras'

interface AddressSectionProps {
  formData: {
    address_zip: string
    address_street: string
    address_number: string
    address_complement: string
    address_city: string
    address_state: string
  }
  cepLookupLoading: boolean
  cepLookupError: string
  cepResolved: string
  onChangeFormData: (
    data: Partial<{
      address_zip: string
      address_street: string
      address_number: string
      address_complement: string
      address_city: string
      address_state: string
    }>
  ) => void
}

export default function AddressSection({
  formData,
  cepLookupLoading,
  cepLookupError,
  cepResolved,
  onChangeFormData,
}: AddressSectionProps) {
  return (
    <div className="mb-6">
      <h4 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">Endereço / Localização</h4>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">CEP</label>
          <div className="relative">
            <input
              type="text"
              placeholder="00000-000"
              value={formData.address_zip}
              onChange={(e) => {
                const value = e.target.value
                const digits = onlyDigits(value).slice(0, 8)
                onChangeFormData({ address_zip: digits })
              }}
              className={`w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 ${
                cepLookupError ? 'border-red-500 bg-red-50/10' : ''
              }`}
              maxLength={9}
            />
            {cepLookupLoading && (
              <span className="absolute right-3 top-2.5 text-xs text-gray-400 animate-pulse">Buscando...</span>
            )}
          </div>
          {cepLookupError && (
            <p className="mt-1 text-xs text-red-400">{cepLookupError}</p>
          )}
          {cepResolved && (
            <p className="mt-1 text-xs text-green-500">{cepResolved}</p>
          )}
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">Logradouro (Rua/Av)</label>
          <input
            type="text"
            value={formData.address_street}
            onChange={(e) => onChangeFormData({ address_street: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Número</label>
          <input
            type="text"
            value={formData.address_number}
            onChange={(e) => onChangeFormData({ address_number: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Complemento</label>
          <input
            type="text"
            value={formData.address_complement}
            onChange={(e) => onChangeFormData({ address_complement: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
          <input
            type="text"
            value={formData.address_city}
            onChange={(e) => onChangeFormData({ address_city: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Estado (UF)</label>
          <select
            value={formData.address_state}
            onChange={(e) => onChangeFormData({ address_state: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 bg-gray-900 border-gray-700 text-gray-100"
          >
            <option value="">UF</option>
            <option value="AC">AC</option>
            <option value="AL">AL</option>
            <option value="AP">AP</option>
            <option value="AM">AM</option>
            <option value="BA">BA</option>
            <option value="CE">CE</option>
            <option value="DF">DF</option>
            <option value="ES">ES</option>
            <option value="GO">GO</option>
            <option value="MA">MA</option>
            <option value="MT">MT</option>
            <option value="MS">MS</option>
            <option value="MG">MG</option>
            <option value="PA">PA</option>
            <option value="PB">PB</option>
            <option value="PR">PR</option>
            <option value="PE">PE</option>
            <option value="PI">PI</option>
            <option value="RJ">RJ</option>
            <option value="RN">RN</option>
            <option value="RS">RS</option>
            <option value="RO">RO</option>
            <option value="RR">RR</option>
            <option value="SC">SC</option>
            <option value="SP">SP</option>
            <option value="SE">SE</option>
            <option value="TO">TO</option>
          </select>
        </div>
      </div>
    </div>
  )
}
