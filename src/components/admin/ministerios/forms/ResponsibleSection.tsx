'use client'

interface ResponsibleSectionProps {
  formData: {
    responsible_name: string
  }
  onChangeFormData: (data: Partial<{ responsible_name: string }>) => void
}

export default function ResponsibleSection({ formData, onChangeFormData }: ResponsibleSectionProps) {
  return (
    <div className="mb-6">
      <h4 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">Responsável</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-750 mb-2">Nome do Responsável</label>
          <input
            type="text"
            value={formData.responsible_name}
            onChange={(e) => onChangeFormData({ responsible_name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  )
}
