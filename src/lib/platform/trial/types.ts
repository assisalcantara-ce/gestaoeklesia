export interface PreRegistration {
  id: string
  user_id: string
  ministry_id: string | null
  ministry_name: string
  responsavel: string
  email: string
  telefone: string
  status: 'pendente' | 'efetivado'
  created_at: string
}

export interface TrialStatus {
  is_expired: boolean
  days_remaining: number
  pre_registration: PreRegistration | null
}

/** DTO de resposta do getTrialStatus — espelha o contrato da rota /trial/status */
export interface TrialStatusResponse {
  expired: boolean
  status: string | null
  trial_expires_at: string | null
  trial_days: number | null
}

/** Dados seguros retornados por activateTrial para pré-preenchimento do formulário */
export interface TrialLeadData {
  ministry_name: string
  responsible_name: string
  cpf_cnpj: string
  whatsapp: string
  email: string
  phone: string
  website: string
  plan: string
}

/** Resultado da validação do link de ativação de trial */
export interface ActivateTrialResult {
  success: boolean
  lead: TrialLeadData
}

export interface PrepareCheckoutInput {
  userId: string
  planId?: string
  planSlug?: string
}

export interface PrepareCheckoutResult {
  preReg: any
  planRow: any
  planPrice: number
  existingPayment?: {
    status: string
    invoice_url: string | null
    bank_slip_url: string | null
    due_date: string | null
    amount: number
  } | null
}

