export type TipoDocumentoJuridico =
  | 'TERMOS_DE_USO'
  | 'POLITICA_PRIVACIDADE'
  | 'CONTRATO_SERVICO'
  | 'ADITIVO'
  | 'OUTRO';

export type StatusDocumentoJuridico = 'RASCUNHO' | 'PUBLICADO' | 'ARQUIVADO';

export interface DocumentoJuridico {
  id: string;
  documento_raiz_id?: string | null;
  tipo: TipoDocumentoJuridico;
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
}

export interface ListarDocumentosJuridicosFiltros {
  tipo?: TipoDocumentoJuridico;
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
  titulo: string;
  versao: string;
  hash_sha256?: string | null;
  publicado_em?: string | null;
  obrigatorio: boolean;
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
  | 'ACEITE_REGISTRADO';

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
