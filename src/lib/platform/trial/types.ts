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
