export type StatusComissao = 'ativa' | 'inativa';

export interface Comissao {
  id: string;
  ministry_id: string;
  nome: string;
  descricao: string | null;
  status: StatusComissao;
  created_at: string;
  updated_at: string;
  integrantes_count?: number;
}

export interface ComissaoInput {
  nome: string;
  descricao?: string | null;
  status?: StatusComissao;
}

export interface ComissaoIntegrante {
  id: string;
  ministry_id: string;
  comissao_id: string;
  member_id: string;
  cargo: string;
  created_at: string;
  updated_at: string;
  member?: {
    id: string;
    name: string;
    cargo_ministerial?: string | null;
    tipo_cadastro?: string | null;
    foto_url?: string | null;
    email?: string | null;
    phone?: string | null;
    celular?: string | null;
  };
}

export interface ComissaoIntegranteInput {
  comissao_id: string;
  member_id: string;
  cargo: string;
}

export interface MinistroDisponivel {
  id: string;
  name: string;
  cargo_ministerial?: string | null;
  tipo_cadastro?: string | null;
  foto_url?: string | null;
}
