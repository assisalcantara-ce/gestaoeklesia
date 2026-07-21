'use client'

interface CredentialsSectionProps {
  formData: {
    access_email: string
    access_password: string
  }
  editingId: string | null
  onChangeFormData: (
    data: Partial<{
      access_email: string
      access_password: string
    }>
  ) => void
}

export default function CredentialsSection({
  formData,
  editingId,
  onChangeFormData,
}: CredentialsSectionProps) {
  return (
    <div className="mb-6">
      <h4 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">Credenciais de Acesso</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            E-mail de Acesso {editingId ? '' : '*'}
          </label>
          <input
            type="email"
            value={formData.access_email}
            onChange={(e) => onChangeFormData({ access_email: e.target.value })}
            required={!editingId}
            placeholder={editingId ? 'Mantenha em branco para não alterar' : ''}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Senha de Acesso {editingId ? '' : '*'}
          </label>
          <input
            type="text"
            value={formData.access_password}
            onChange={(e) => onChangeFormData({ access_password: e.target.value })}
            required={!editingId}
            placeholder={editingId ? 'Mantenha em branco para não alterar' : 'Mínimo 6 caracteres'}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  )
}
