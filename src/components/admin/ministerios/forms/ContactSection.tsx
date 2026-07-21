'use client'

import { formatPhone, onlyDigits } from '@/lib/mascaras'

interface ContactSectionProps {
  formData: {
    contact_email: string
    contact_phone: string
    whatsapp: string
    website: string
  }
  onChangeFormData: (
    data: Partial<{
      contact_email: string
      contact_phone: string
      whatsapp: string
      website: string
    }>
  ) => void
}

export default function ContactSection({ formData, onChangeFormData }: ContactSectionProps) {
  return (
    <div className="mb-6">
      <h4 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">Informações de Contato</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-750 mb-2">E-mail Principal *</label>
          <input
            type="email"
            value={formData.contact_email}
            onChange={(e) => onChangeFormData({ contact_email: e.target.value })}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-750 mb-2">Telefone</label>
          <input
            type="text"
            placeholder="(00) 0000-0000"
            value={formatPhone(formData.contact_phone)}
            onChange={(e) => onChangeFormData({ contact_phone: onlyDigits(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-750 mb-2">WhatsApp</label>
          <input
            type="text"
            placeholder="(00) 00000-0000"
            value={formatPhone(formData.whatsapp)}
            onChange={(e) => onChangeFormData({ whatsapp: onlyDigits(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-750 mb-2">Site Oficial (URL)</label>
          <input
            type="text"
            placeholder="https://..."
            value={formData.website}
            onChange={(e) => onChangeFormData({ website: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  )
}
