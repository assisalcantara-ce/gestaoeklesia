export interface OportunidadeComercial {
  id: string
  ministry_id: string
  ministry_name: string
  responsavel: string
  email: string
  telefone: string
  plano_solicitado: string
  observacao: string | null
  observacao_interna: string | null
  status: string
  created_at: string
  updated_at?: string
  updated_by?: string | null
}

export interface HistoricoComercial {
  id: string
  oportunidade_id: string
  status_anterior: string
  status_novo: string
  usuario: string
  observacao: string
  created_at: string
}
