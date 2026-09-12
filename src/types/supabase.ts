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
  whatsapp?: string | null
  website: string | null
  asaas_customer_id?: string | null
  logo_url: string | null
  description: string | null
  responsible_name?: string | null
  address_street?: string | null
  address_number?: string | null
  address_complement?: string | null
  address_city?: string | null
  address_state?: string | null
  address_zip?: string | null
  quantity_temples?: number | null
  quantity_members?: number | null
  plan: 'starter' | 'intermediario' | 'profissional' | 'expert'
  subscription_plan_id?: string | null
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
  // Datas ministeriais
  data_consagracao?: string | null
  data_emissao?: string | null
  data_validade_credencial?: string | null
  // Aba Dados
  matricula?: string | null
  unique_id?: string | null
  tipo_cadastro?: string | null
  data_nascimento: string | null
  sexo: string | null
  tipo_sanguineo?: string | null
  escolaridade?: string | null
  estado_civil: string | null
  nome_conjuge?: string | null
  cpf_conjuge?: string | null
  data_nascimento_conjuge?: string | null
  nome_pai?: string | null
  nome_mae?: string | null
  rg?: string | null
  orgao_emissor?: string | null
  nacionalidade?: string | null
  naturalidade?: string | null
  uf_naturalidade?: string | null
  titulo_eleitoral?: string | null
  zona_eleitoral?: string | null
  secao_eleitoral?: string | null
  data_batismo_aguas?: string | null
  data_batismo_espirito_santo?: string | null
  // Aba Endereço
  cep?: string | null
  logradouro: string | null
  numero?: string | null
  bairro?: string | null
  complemento: string | null
  cidade: string | null
  estado: string | null
  // Aba Contato
  celular?: string | null
  whatsapp?: string | null
  // Geolocalização
  congregacao_id?: string | null
  latitude?: number | null
  longitude?: number | null
  // Aba Ministerial
  profissao: string | null
  curso_teologico?: string | null
  instituicao_teologica?: string | null
  pastor_auxiliar?: boolean | null
  procedencia?: string | null
  procedencia_local?: string | null
  cargo_ministerial?: string | null
  dados_cargos?: Record<string, any> | null
  tem_funcao_igreja?: boolean | null
  qual_funcao?: string | null
  setor_departamento?: string | null
  observacoes_ministeriais?: string | null
  // Aba Foto
  foto_url?: string | null
  // Dizimistas
  is_dizimista?: boolean | null
  // Campos do sistema
  member_since: string
  role: string | null
  status: 'active' | 'inactive' | 'deceased' | 'transferred'
  custom_fields: Record<string, any>
  observacoes: string | null
  created_at: string
  updated_at: string
}

export type TemplateCategoria = 'carta' | 'declaracao'
export type TemplateTipo = 'mudanca' | 'transito' | 'desligamento' | 'recomendacao' | 'membro_ativo' | 'batismo' | 'cargo' | 'apresentacao_crianca' | 'custom'
export type TemplateScope = 'system' | 'tenant'

export type CartaCanvasElement = {
  id: string
  tipo: 'texto' | 'qrcode' | 'logo' | 'foto-membro' | 'chapa' | 'imagem' | 'linha' | 'forma'
  x: number
  y: number
  largura: number
  altura: number
  fontSize?: number
  cor?: string
  backgroundColor?: string
  borderColor?: string
  borderWidth?: number
  borderStyle?: 'solid' | 'dashed' | 'dotted'
  fonte?: string
  transparencia?: number
  borderRadius?: number
  texto?: string
  alinhamento?: 'left' | 'center' | 'right'
  negrito?: boolean
  italico?: boolean
  sublinhado?: boolean
  sombreado?: boolean
  imagemUrl?: string
  locked?: boolean
  visivel: boolean
}

export type CartaCanvasData = {
  width: number
  height: number
  backgroundUrl?: string
  elements: CartaCanvasElement[]
}

export type CartaTemplate = {
  id: string
  ministry_id: string | null
  template_key: string
  title: string
  tipo: TemplateTipo
  categoria: TemplateCategoria
  scope: TemplateScope
  content_json: any
  is_active: boolean
  updated_at?: string | null
  created_at?: string
}

export type CartaRegistro = {
  id: string
  ministry_id: string
  member_id: string | null
  template_id: string | null
  template_key: string | null
  template_title: string | null
  categoria: TemplateCategoria
  status: string
  rendered_html: string | null
  issued_by?: string | null
  issued_at: string | null
  created_at?: string
  payload_snapshot: any
  template_snapshot: any
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
  data_consagracao?: string | null
  data_emissao?: string | null
  data_validade_credencial?: string | null
  // Aba Dados
  matricula?: string | null
  unique_id?: string | null
  tipo_cadastro?: string | null
  data_nascimento?: string | null
  sexo?: string | null
  tipo_sanguineo?: string | null
  escolaridade?: string | null
  estado_civil?: string | null
  nome_conjuge?: string | null
  cpf_conjuge?: string | null
  data_nascimento_conjuge?: string | null
  nome_pai?: string | null
  nome_mae?: string | null
  rg?: string | null
  orgao_emissor?: string | null
  nacionalidade?: string | null
  naturalidade?: string | null
  uf_naturalidade?: string | null
  titulo_eleitoral?: string | null
  zona_eleitoral?: string | null
  secao_eleitoral?: string | null
  data_batismo_aguas?: string | null
  data_batismo_espirito_santo?: string | null
  // Aba Endereço
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  complemento?: string | null
  cidade?: string | null
  estado?: string | null
  // Aba Contato
  celular?: string | null
  whatsapp?: string | null
  // Geolocalização
  congregacao_id?: string | null
  latitude?: number | null
  longitude?: number | null
  // Aba Ministerial
  profissao?: string | null
  curso_teologico?: string | null
  instituicao_teologica?: string | null
  pastor_auxiliar?: boolean | null
  procedencia?: string | null
  procedencia_local?: string | null
  cargo_ministerial?: string | null
  dados_cargos?: Record<string, any> | null
  tem_funcao_igreja?: boolean | null
  qual_funcao?: string | null
  setor_departamento?: string | null
  observacoes_ministeriais?: string | null
  // Aba Foto
  foto_url?: string | null
  // Dizimistas
  is_dizimista?: boolean | null
  // Sistema
  member_since?: string | Date
  role?: string | null
  status?: Member['status']
  custom_fields?: Record<string, any>
  observacoes?: string | null
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
