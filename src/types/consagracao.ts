export type StatusProcessoConsagracao =
  | 'em_processo'
  | 'deferir'
  | 'indeferir'
  | 'homologar'
  | 'aprovado'
  | 'concluido'
  | 'rejeitado'
  | string;

export type TipoRegistroConsagracao = 'chegada' | 'progressao' | 'filiacao' | 'novo' | 'existente' | 'ministro' | string;

export interface ConsagracaoRegistro {
  id: string;
  ministry_id: string;
  member_id: string | null;
  comissao_id?: string | null;

  tipo_registro: TipoRegistroConsagracao;
  regiao?: string | null;

  numero_processo?: string | null;
  data_processo?: string | null;

  cpf?: string | null;
  nome: string;
  data_nascimento?: string | null;
  sexo?: string | null;
  rg?: string | null;
  orgao_emissor?: string | null;
  estado_civil?: string | null;
  nacionalidade?: string | null;
  naturalidade?: string | null;
  uf?: string | null;
  email?: string | null;
  telefone?: string | null;
  nome_pai?: string | null;
  nome_mae?: string | null;
  nome_conjuge?: string | null;
  matricula?: string | null;

  supervisao_id?: string | null;
  campo_id?: string | null;
  congregacao_id?: string | null;

  cargo_ocupa?: string | null;
  cargo_pretendido?: string | null;
  pastor_solicitante?: string | null;
  data_autorizacao?: string | null;

  origem_instituicao?: string | null;
  origem_cidade?: string | null;
  origem_uf?: string | null;
  origem_data_consagracao?: string | null;

  status_processo: StatusProcessoConsagracao;
  observacoes?: string | null;
  foto_url?: string | null;

  created_at: string;
  updated_at: string;

  // Relacionamento opcional com a comissão
  comissao?: {
    id: string;
    nome: string;
    status?: string;
  } | null;
}

export type ConsagracaoRegistroInput = Omit<
  ConsagracaoRegistro,
  'id' | 'created_at' | 'updated_at' | 'comissao'
>;
