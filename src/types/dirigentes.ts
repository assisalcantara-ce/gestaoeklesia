export type TipoMovimentacao =
  | 'rodizio_anual'
  | 'transferencia_extraordinaria'
  | 'substituicao_temporaria';

export type StatusMovimentacao =
  | 'rascunho'
  | 'proposta'
  | 'aprovada'
  | 'efetivada'
  | 'rejeitada'
  | 'cancelada';

export type TipoDesignacao = 'titular' | 'co_dirigente' | 'interino';

export type StatusDesignacao = 'ativo' | 'concluido' | 'afastado' | 'revogado';

export type StatusConferenciaPatrimonial =
  | 'nao_se_aplica'
  | 'pendente'
  | 'conferido_sem_divergencias'
  | 'conferido_com_divergencias';

export type StatusTermoPatrimonial =
  | 'pendente_assinaturas'
  | 'assinado_e_homologado'
  | 'com_ressalvas';

export interface DirigenteDesignacao {
  id: string;
  ministry_id: string;
  congregacao_id: string;
  member_id: string | null;
  nome_dirigente: string;
  cpf_dirigente: string | null;
  cargo_ministerial: string | null;
  matricula_dirigente: string | null;
  telefone: string | null;
  tipo_designacao: TipoDesignacao;
  is_acumulacao: boolean;
  status: StatusDesignacao;
  data_posse: string; // YYYY-MM-DD
  data_termino: string | null; // YYYY-MM-DD
  motivo_saida: string | null;
  movimentacao_origem_id: string | null;
  movimentacao_saida_id: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DirigenteMovimentacao {
  id: string;
  ministry_id: string;
  tipo_movimentacao: TipoMovimentacao;
  status: StatusMovimentacao;
  ano_referencia: number | null;
  titulo: string | null;

  congregacao_destino_id: string;
  congregacao_origem_id: string | null;

  dirigente_novo_member_id: string | null;
  dirigente_novo_nome: string;
  dirigente_novo_cargo: string | null;
  dirigente_novo_cpf: string | null;
  dirigente_novo_matricula: string | null;

  dirigente_anterior_member_id: string | null;
  dirigente_anterior_nome: string | null;
  dirigente_anterior_cargo: string | null;

  motivo: string;
  data_prevista: string; // YYYY-MM-DD
  data_efetiva: string | null; // YYYY-MM-DD
  prazo_retorno: string | null; // YYYY-MM-DD

  solicitante_user_id: string | null;
  solicitante_nome: string | null;
  aprovador_user_id: string | null;
  aprovador_nome: string | null;
  data_aprovacao: string | null;
  justificativa_aprovacao_rejeicao: string | null;

  requer_termo_patrimonial: boolean;
  status_conferencia_patrimonial: StatusConferenciaPatrimonial;
  termo_patrimonial_id: string | null;
  divergencias_patrimoniais: string | null;

  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DirigenteTermoPatrimonial {
  id: string;
  ministry_id: string;
  movimentacao_id: string;
  congregacao_id: string;
  data_emissao: string;
  dirigente_transmitente_nome: string;
  dirigente_recebedor_nome: string;
  secretario_geral_nome: string | null;
  total_itens: number;
  valor_total_estimado: number;
  itens_snapshot: Array<{
    id: string;
    numero_tombamento: string | null;
    descricao: string;
    categoria: string;
    estado_conservacao: string;
    valor_aquisicao: number | null;
    status: string;
  }>;
  divergencias_identificadas: string | null;
  status_termo: StatusTermoPatrimonial;
  created_at: string;
}

export interface CongregacaoLiderancaView {
  congregacao_id: string;
  congregacao_nome: string;
  campo_id: string | null;
  supervisao_id: string | null;
  dirigente_atual_member_id?: string | null;
  dirigente_atual_nome: string | null;
  dirigente_atual_cargo: string | null;
  dirigente_atual_telefone: string | null;
  data_posse_atual: string | null;
  tempo_mandato_meses: number;
  designacao_atual_id: string | null;
  is_acumulacao: boolean;
  total_bens_patrimonio: number;
  valor_patrimonio_estimado: number;
  movimentacao_em_andamento?: DirigenteMovimentacao | null;
}

export interface MinistroElegivelBusca {
  id: string; // member_id
  nome: string;
  matricula: string | null;
  cpf: string | null;
  cargo_ministerial: string | null;
  congregacao_id: string | null;
  congregacao_nome: string | null;
  foto_url?: string | null;
}
