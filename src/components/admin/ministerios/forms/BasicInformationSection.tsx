'use client'

import { formatCnpj, formatCpf, validarCnpj, validarCpf, onlyDigits } from '@/lib/mascaras'

interface BasicInformationSectionProps {
  formData: {
    name: string
    cnpj: string
    documento_tipo: 'cnpj' | 'cpf'
  }
  logoPreviewSrc: string
  logoFile: File | null
  onFileChange: (file: File | null, objectUrl: string) => void
  logoPreviewObjectUrl: string
  onChangeFormData: (
    data: Partial<{
      name: string
      cnpj: string
      documento_tipo: 'cnpj' | 'cpf'
    }>
  ) => void
}

export default function BasicInformationSection({
  formData,
  logoPreviewSrc,
  logoFile,
  onFileChange,
  logoPreviewObjectUrl,
  onChangeFormData,
}: BasicInformationSectionProps) {
  return (
    <div className="mb-6">
      <h4 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">Informações Básicas</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Ministério *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => onChangeFormData({ name: e.target.value })}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">
              {formData.documento_tipo === 'cnpj' ? 'CNPJ' : 'CPF'}
            </label>
            <div className="flex gap-1 bg-gray-900 border border-gray-700 rounded-lg p-0.5 scale-90 -mr-2">
              <button
                type="button"
                onClick={() => onChangeFormData({ documento_tipo: 'cnpj', cnpj: '' })}
                className={`px-2.5 py-0.5 text-[10px] font-bold rounded transition ${
                  formData.documento_tipo === 'cnpj'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-gray-250'
                }`}
              >
                CNPJ
              </button>
              <button
                type="button"
                onClick={() => onChangeFormData({ documento_tipo: 'cpf', cnpj: '' })}
                className={`px-2.5 py-0.5 text-[10px] font-bold rounded transition ${
                  formData.documento_tipo === 'cpf'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-gray-250'
                }`}
              >
                CPF
              </button>
            </div>
          </div>

          {formData.documento_tipo === 'cnpj' ? (
            <input
              type="text"
              placeholder="00.000.000/0000-00"
              value={formatCnpj(formData.cnpj)}
              onChange={(e) => {
                const digits = onlyDigits(e.target.value).slice(0, 14)
                onChangeFormData({ cnpj: digits })
              }}
              className={`w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500 bg-gray-900 border-gray-700 text-gray-100 ${
                formData.cnpj.length === 14 && !validarCnpj(formData.cnpj)
                  ? 'border-red-500 bg-red-50/10'
                  : formData.cnpj.length === 14
                  ? 'border-green-500'
                  : 'border-gray-750'
              }`}
              maxLength={18}
            />
          ) : (
            <input
              type="text"
              placeholder="000.000.000-00"
              value={formatCpf(formData.cnpj)}
              onChange={(e) => {
                const digits = onlyDigits(e.target.value).slice(0, 11)
                onChangeFormData({ cnpj: digits })
              }}
              className={`w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500 bg-gray-900 border-gray-700 text-gray-100 ${
                formData.cnpj.length === 11 && !validarCpf(formData.cnpj)
                  ? 'border-red-500 bg-red-50/10'
                  : formData.cnpj.length === 11
                  ? 'border-green-500'
                  : 'border-gray-750'
              }`}
              maxLength={14}
            />
          )}

          {formData.documento_tipo === 'cnpj' && formData.cnpj.length === 14 && !validarCnpj(formData.cnpj) && (
            <p className="mt-1 text-xs text-red-400">CNPJ inválido — verifique os dígitos verificadores</p>
          )}
          {formData.documento_tipo === 'cnpj' && formData.cnpj.length === 14 && validarCnpj(formData.cnpj) && (
            <p className="mt-1 text-xs text-green-500">CNPJ válido ✓</p>
          )}

          {formData.documento_tipo === 'cpf' && formData.cnpj.length === 11 && !validarCpf(formData.cnpj) && (
            <p className="mt-1 text-xs text-red-400">CPF inválido — verifique os dígitos verificadores</p>
          )}
          {formData.documento_tipo === 'cpf' && formData.cnpj.length === 11 && validarCpf(formData.cnpj) && (
            <p className="mt-1 text-xs text-green-500">CPF válido ✓</p>
          )}
        </div>
        <div className="md:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>

              <div className="flex items-center gap-3">
                <input
                  id="ministry-logo-file-comp"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    if (logoPreviewObjectUrl) URL.revokeObjectURL(logoPreviewObjectUrl)
                    if (!file) {
                      onFileChange(null, '')
                      return
                    }
                    const objectUrl = URL.createObjectURL(file)
                    onFileChange(file, objectUrl)
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="ministry-logo-file-comp"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded cursor-pointer hover:bg-blue-700"
                >
                  Adicionar foto
                </label>
                <span className="text-sm text-gray-600">
                  {logoFile ? logoFile.name : 'Nenhum arquivo selecionado'}
                </span>
              </div>
            </div>

            {logoPreviewSrc && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-300">Pré-visualização da Logo</span>
                <div className="w-24 h-24 rounded-lg overflow-hidden border border-gray-700 bg-gray-900 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoPreviewSrc}
                    alt="Preview da Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
