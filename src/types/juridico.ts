export type TipoDocumentoJuridico =
  | 'TERMOS_DE_USO'
  | 'POLITICA_PRIVACIDADE'
  | 'CONTRATO_SERVICO'
  | 'ADITIVO'
  | 'OUTRO';

export type StatusDocumentoJuridico = 'RASCUNHO' | 'PUBLICADO' | 'ARQUIVADO';

export interface DocumentoJuridico {
  id: string;
  tipo: TipoDocumentoJuridico;
  titulo: string;
  versao: string;
  conteudo_md: string;
  conteudo_html?: string | null;
  hash_sha256: string;
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
