export type TipoDocumentoJuridico =
  | 'TERMOS_DE_USO'
  | 'POLITICA_PRIVACIDADE'
  | 'CONTRATO_SERVICO'
  | 'ADITIVO'
  | 'OUTRO';

export type StatusDocumentoJuridico = 'RASCUNHO' | 'PUBLICADO' | 'ARQUIVADO';

export type EscopoDocumentoJuridico = 'INDIVIDUAL' | 'INSTITUCIONAL';

export interface DocumentoJuridico {
  id: string;
  documento_raiz_id?: string | null;
  tipo: TipoDocumentoJuridico;
  escopo: EscopoDocumentoJuridico;
  titulo: string;
  versao: string;
  conteudo_md: string;
  conteudo_html?: string | null;
  hash_sha256?: string | null;
  status: StatusDocumentoJuridico;
  obrigatorio: boolean;
  ativo: boolean;
  publicado_em?: string | null;
  criado_por?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CriarDocumentoJuridicoDTO {
  tipo: TipoDocumentoJuridico;
  escopo?: EscopoDocumentoJuridico;
  titulo: string;
  versao: string;
  conteudo_md: string;
  conteudo_html?: string | null;
  obrigatorio?: boolean;
  criado_por?: string | null;
}

export interface AtualizarDocumentoJuridicoRascunhoDTO {
  titulo?: string;
  versao?: string;
  conteudo_md?: string;
  conteudo_html?: string | null;
  obrigatorio?: boolean;
  escopo?: EscopoDocumentoJuridico;
}

export interface ListarDocumentosJuridicosFiltros {
  tipo?: TipoDocumentoJuridico;
  escopo?: EscopoDocumentoJuridico;
  status?: StatusDocumentoJuridico;
  ativo?: boolean;
}

export interface ItemHistoricoVersaoDTO {
  id: string;
  documento_raiz_id: string;
  versao: string;
  status: StatusDocumentoJuridico;
  publicado_em: string | null;
  created_at: string;
  ativo: boolean;
  is_publicado_atual: boolean;
}

export interface RespostaHistoricoVersoesDTO {
  documento_raiz_id: string;
  total_versoes: number;
  versao_publicada_atual_id: string | null;
  versoes: ItemHistoricoVersaoDTO[];
}

export interface DocumentoPendenteAceiteDTO {
  id: string;
  tipo: TipoDocumentoJuridico;
  escopo: EscopoDocumentoJuridico;
  titulo: string;
  versao: string;
  versao_publicada: string;
  ultima_versao_aceita: string | null;
  hash_sha256?: string | null;
  publicado_em?: string | null;
  obrigatorio: boolean;
  conteudo_md?: string | null;
  conteudo_md_materializado?: string | null;
}

export interface ResultadoValidacaoAceitesDTO {
  possui_pendencias: boolean;
  total_pendencias: number;
  documentos_pendentes: DocumentoPendenteAceiteDTO[];
}

// ----------------------------------------------------------------------------
// ESTRUTURAS DE ACEITE ELETRÔNICO
// ----------------------------------------------------------------------------

export interface TenantAceite {
  id: string;
  ministry_id: string;
  user_id: string;
  documento_id: string;
  versao_aceita: string;
  hash_documento: string;
  ip_address?: string | null;
  user_agent?: string | null;
  payload_aceite?: Record<string, any> | null;
  aceito_em: string;
  created_at: string;
}

export interface RegistrarAceiteDTO {
  ministry_id: string;
  user_id: string;
  documento_id: string;
  versao_aceita: string;
  hash_documento: string;
  ip_address?: string | null;
  user_agent?: string | null;
  payload_aceite?: Record<string, any> | null;
}

// ----------------------------------------------------------------------------
// ESTRUTURAS DE AUDITORIA JURÍDICA
// ----------------------------------------------------------------------------

export type TipoEventoAuditoriaJuridica =
  | 'DOCUMENTO_CRIADO'
  | 'DOCUMENTO_ATUALIZADO'
  | 'DOCUMENTO_ARQUIVADO'
  | 'DOCUMENTO_PUBLICADO'
  | 'DOCUMENTO_NOVA_VERSAO'
  | 'TENTATIVA_EDICAO_BLOQUEADA'
  | 'TENTATIVA_ALTERACAO_STATUS_BLOQUEADA'
  | 'TENTATIVA_EXCLUSAO_BLOQUEADA'
  | 'ACEITE_REGISTRADO'
  | 'CONTRATO_CRIADO';

export type SnapshotStatusContrato =
  | 'INTEGRO_IMUTAVEL'
  | 'RECONSTRUIDO_HISTORICO'
  | 'HERDADO_MATRIZ'
  | 'REQUER_REGULARIZACAO';

export type OrigemSnapshotContrato =
  | 'CELEBRACAO_ORIGINAL'
  | 'MIGRATION_SANEAMENTO'
  | 'MODELO_BASE';

export interface TenantContrato {
  id: string;
  ministry_id: string;
  documento_base_id?: string | null;
  documento_raiz_id?: string | null;
  versao_documento?: string | null;
  hash_documento?: string | null;
  plano_contratado?: string | null;
  numero_contrato?: string | null;
  status: 'RASCUNHO' | 'AGUARDANDO_ASSINATURA' | 'ATIVO' | 'CANCELADO' | 'EXPIRADO' | 'RESCINDIDO';
  conteudo_customizado?: string | null;
  valor_mensal?: number | null;
  data_inicio: string;
  data_fim?: string | null;
  assinado_em?: string | null;
  assinado_por?: string | null;
  snapshot_status?: SnapshotStatusContrato;
  origem_snapshot?: OrigemSnapshotContrato;
  integridade_verificada?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ItemHistoricoDocumentoInstitucionalDTO {
  id: string;
  tipo: TipoDocumentoJuridico;
  titulo: string;
  versao: string;
  hash_sha256?: string | null;
  aceito_em: string;
  aceito_por_id: string;
  aceito_por_nome?: string | null;
  aceito_por_email?: string | null;
  conteudo_md?: string | null;
}

export interface DiagnosticoIntegridadeContratoDTO {
  possui_snapshot: boolean;
  hash_consistente_com_aceite: boolean;
  contem_placeholders: boolean;
  contem_texto_generico_legado: boolean;
  plano_valido: boolean;
  snapshot_status: SnapshotStatusContrato;
  origem_snapshot: OrigemSnapshotContrato;
  integridade_verificada: boolean;
  snapshot_pendente: boolean;
  tipo_visualizacao: 'SNAPSHOT_IMUTAVEL' | 'MODELO_BASE_HISTORICO' | 'AGUARDANDO_ACEITE';
}

export interface DetalhesContratoTenantDTO {
  contrato: TenantContrato | null;
  documento_base: DocumentoJuridico | null;
  assinado_por_usuario: {
    id: string;
    email?: string | null;
    full_name?: string | null;
  } | null;
  conteudo_efetivo: string | null;
  historico_documentos: ItemHistoricoDocumentoInstitucionalDTO[];
  diagnostico_integridade?: DiagnosticoIntegridadeContratoDTO;
}

export interface CriarContratoVinculadoDTO {
  ministry_id: string;
  plano_contratado: string;
  valor_mensal?: number | null;
  data_inicio?: string;
  assinado_por?: string | null;
}

export interface RegistrarEventoAuditoriaJuridicaDTO {
  usuario_id: string;
  ministry_id: string;
  documento_id: string;
  versao: string;
  hash_documento: string;
  tipo_evento: TipoEventoAuditoriaJuridica;
  ip_address?: string | null;
  user_agent?: string | null;
  detalhes?: Record<string, any> | null;
}

export interface RegistroAuditoriaJuridicaLog {
  id: string;
  usuario_id: string;
  ministry_id: string;
  documento_id: string;
  versao: string;
  hash_documento: string;
  tipo_evento: TipoEventoAuditoriaJuridica;
  ip_address?: string | null;
  user_agent?: string | null;
  detalhes?: Record<string, any> | null;
  created_at: string;
}
