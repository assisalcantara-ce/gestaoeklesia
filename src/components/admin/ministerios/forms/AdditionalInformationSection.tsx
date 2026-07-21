'use client'

interface AdditionalInformationSectionProps {
  formData: {
    description: string
  }
  onChangeFormData: (data: Partial<{ description: string }>) => void
}

export default function AdditionalInformationSection({
  formData,
  onChangeFormData,
}: AdditionalInformationSectionProps) {
  return (
    <div className="mb-6">
      <h4 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">Informações Adicionais</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
          <textarea
            value={formData.description}
            onChange={(e) => onChangeFormData({ description: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
            rows={4}
          />
        </div>
      </div>
    </div>
  )
}
