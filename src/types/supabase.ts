/**
 * TIPOS TYPESCRIPT para Supabase
 * Arquivo: src/types/supabase.ts
 * 
 * Auto-gerado pelo Supabase (depois você pode rodar `supabase gen types typescript`)
 * Por enquanto, usando tipos manuais
 */

export type Ministry = {
  id: string
  user_id: string
  name: string
  slug: string
  email_admin: string
  cnpj_cpf: string | null
  phone: string | null
  website: string | null
  logo_url: string | null
  description: string | null
  plan: 'starter' | 'growth' | 'enterprise'
  subscription_status: 'active' | 'trial' | 'suspended' | 'expired'
  subscription_start_date: string
  subscription_end_date: string | null
  auto_renew: boolean
  max_users: number
  max_storage_bytes: number
  storage_used_bytes: number
  timezone: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type MinistryUser = {
  id: string
  ministry_id: string
  user_id: string
  role: 'admin' | 'manager' | 'operator' | 'viewer'
  permissions: string[]
  is_active: boolean
  last_activity: string | null
  created_at: string
}

export type Member = {
  id: string
  ministry_id: string
  name: string
  email: string | null
  phone: string | null
  cpf: string | null
  birth_date: string | null
  gender: string | null
  marital_status: string | null
  occupation: string | null
  address: string | null
  complement: string | null
  city: string | null
  state: string | null
  zipcode: string | null
  latitude?: number | null
  longitude?: number | null
  member_since: string
  role: string | null
  status: 'active' | 'inactive' | 'deceased' | 'transferred'
  custom_fields: Record<string, any>
  notes: string | null
  created_at: string
  updated_at: string
}

export type CartaoTemplate = {
  id: string
  ministry_id: string
  template_key?: string
  tipo_cadastro?: 'membro' | 'congregado' | 'ministro' | 'funcionario' | string
  name: string
  description: string | null
  template_data: Record<string, any>
  preview_url: string | null
  is_default: boolean
  is_active?: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type CartaoGerado = {
  id: string
  ministry_id: string
  member_id: string
  template_id: string
  pdf_url: string | null
  qr_code_data: string | null
  generated_by: string | null
  printed_count: number
  created_at: string
}

export type Configuration = {
  id: string
  ministry_id: string
  nomenclaturas: {
    member: string
    members: string
    role: string
    roles: string
    division: string
    divisions: string
  }
  notification_settings: Record<string, any>
  report_settings: Record<string, any>
  custom_fields: CustomField[]
  created_at: string
  updated_at: string
}

export type CustomField = {
  id: string
  name: string
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox'
  required: boolean
  options?: string[]
}

export type AuditLog = {
  id: string
  ministry_id: string
  user_id: string | null
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'LOGIN' | 'LOGOUT' | 'DOWNLOAD'
  resource_type: string
  resource_id: string | null
  old_data: Record<string, any> | null
  new_data: Record<string, any> | null
  changes: Record<string, any> | null
  ip_address: string | null
  user_agent: string | null
  status_code: number | null
  error_message: string | null
  created_at: string
}

export type Arquivo = {
  id: string
  ministry_id: string
  filename: string
  mimetype: string | null
  size_bytes: number
  storage_path: string
  url: string | null
  uploaded_by: string | null
  resource_type: string | null
  resource_id: string | null
  created_at: string
}

// Request/Response types para API

// OBS: a API resolve `ministry_id` no servidor (multi-tenancy). Portanto, o client
// não deve enviar `ministry_id` ao criar/atualizar.
export type CreateMemberRequest = {
  name: string
  email?: string | null
  phone?: string | null
  cpf?: string | null
  birth_date?: string | null
  gender?: string | null
  marital_status?: string | null
  occupation?: string | null
  address?: string | null
  complement?: string | null
  city?: string | null
  state?: string | null
  zipcode?: string | null
  latitude?: number | null
  longitude?: number | null
  member_since?: string | Date
  role?: string | null
  status?: Member['status']
  custom_fields?: Record<string, any>
  notes?: string | null
}

export type UpdateMemberRequest = Partial<CreateMemberRequest>

export type PaginatedResponse<T> = {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}

export type ApiResponse<T = any> = {
  data?: T
  error?: string
  pagination?: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}
