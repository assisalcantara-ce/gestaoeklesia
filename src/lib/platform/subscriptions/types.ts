export interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  price_monthly: number
  is_active: boolean
  created_at: string
}

export interface SubscriptionInfo {
  ministry_id: string
  plan_slug: string
  plan_id: string
  start_date: string
  end_date: string
  status: 'active' | 'inactive' | 'expired' | 'canceled'
}

/** Dados de pre_registration usados para criar ou ativar um ministério via pagamento Trial */
export interface PreRegistrationData {
  id: string
  user_id: string | null
  ministry_name: string | null
  email: string | null
  cpf_cnpj: string | null
  phone: string | null
  whatsapp: string | null
  website: string | null
  description: string | null
  plan: string | null
  asaas_customer_id: string | null
  address_street: string | null
  address_number: string | null
  address_complement: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  pastor_name: string | null
  status: string | null
}

export interface ActivateFromPreRegResult {
  success: boolean
  ministryId: string
  wasCreated: boolean
  hasPreRegUpdated: boolean
  linkedMinistryUser: boolean
}
