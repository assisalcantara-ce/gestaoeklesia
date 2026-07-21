'use client'

import type { SubscriptionPlan } from '@/types/admin'
import BasicInformationSection from './BasicInformationSection'
import ContactSection from './ContactSection'
import ResponsibleSection from './ResponsibleSection'
import CredentialsSection from './CredentialsSection'
import AddressSection from './AddressSection'
import CommercialSection from './CommercialSection'
import AdditionalInformationSection from './AdditionalInformationSection'

interface MinistryFormProps {
  formData: any
  editingId: string | null
  onSubmit: (e: React.FormEvent) => void
  planos: SubscriptionPlan[]
  planosLoading: boolean
  isTrial: boolean
  setIsTrial: (val: boolean) => void
  trialDays: number
  setTrialDays: (days: number) => void
  logoPreviewSrc: string
  logoFile: File | null
  onFileChange: (file: File | null, objectUrl: string) => void
  logoPreviewObjectUrl: string
  cepLookupLoading: boolean
  cepLookupError: string
  cepResolved: string
  onChangeFormData: (data: Partial<any>) => void
}

export default function MinistryForm({
  formData,
  editingId,
  onSubmit,
  planos,
  planosLoading,
  isTrial,
  setIsTrial,
  trialDays,
  setTrialDays,
  logoPreviewSrc,
  logoFile,
  onFileChange,
  logoPreviewObjectUrl,
  cepLookupLoading,
  cepLookupError,
  cepResolved,
  onChangeFormData,
}: MinistryFormProps) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6 mb-8 text-gray-100">
      <h3 className="text-xl font-bold mb-4">
        {editingId ? 'Editar Ministério' : 'Novo Ministério'}
      </h3>
      <form
        onSubmit={onSubmit}
        className="space-y-6 text-gray-100 [&_h3]:text-white [&_h4]:text-gray-200 [&_label]:text-gray-300 [&_input]:bg-gray-900 [&_input]:border-gray-700 [&_input]:text-gray-100 [&_input]:placeholder:text-gray-500 [&_select]:bg-gray-900 [&_select]:border-gray-700 [&_select]:text-gray-100 [&_textarea]:bg-gray-900 [&_textarea]:border-gray-700 [&_textarea]:text-gray-100 [&_textarea]:placeholder:text-gray-500"
      >
        <BasicInformationSection
          formData={formData}
          logoPreviewSrc={logoPreviewSrc}
          logoFile={logoFile}
          onFileChange={onFileChange}
          logoPreviewObjectUrl={logoPreviewObjectUrl}
          onChangeFormData={onChangeFormData}
        />

        <ContactSection
          formData={formData}
          onChangeFormData={onChangeFormData}
        />

        <ResponsibleSection
          formData={formData}
          onChangeFormData={onChangeFormData}
        />

        <CredentialsSection
          formData={formData}
          editingId={editingId}
          onChangeFormData={onChangeFormData}
        />

        <AddressSection
          formData={formData}
          cepLookupLoading={cepLookupLoading}
          cepLookupError={cepLookupError}
          cepResolved={cepResolved}
          onChangeFormData={onChangeFormData}
        />

        <CommercialSection
          formData={formData}
          planos={planos}
          planosLoading={planosLoading}
          editingId={editingId}
          isTrial={isTrial}
          setIsTrial={setIsTrial}
          trialDays={trialDays}
          setTrialDays={setTrialDays}
          onChangeFormData={onChangeFormData}
        />

        <AdditionalInformationSection
          formData={formData}
          onChangeFormData={onChangeFormData}
        />

        <button
          type="submit"
          className="mt-6 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
        >
          {editingId ? 'Atualizar Ministério' : 'Criar Ministério'}
        </button>
      </form>
    </div>
  )
}
