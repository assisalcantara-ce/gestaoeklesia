import { DocumentosJuridicosRepository } from '@/repositories/DocumentosJuridicosRepository';
import type {
  DocumentoJuridico,
  CriarDocumentoJuridicoDTO,
  AtualizarDocumentoJuridicoRascunhoDTO,
  ListarDocumentosJuridicosFiltros,
  ItemHistoricoVersaoDTO,
  RespostaHistoricoVersoesDTO,
} from '@/types/juridico';

export class DocumentosJuridicosService {
  private repository: DocumentosJuridicosRepository;

  constructor(customClient?: any) {
    this.repository = new DocumentosJuridicosRepository(customClient);
  }

  async criarDocumento(dto: CriarDocumentoJuridicoDTO): Promise<DocumentoJuridico> {
    if (!dto.titulo || dto.titulo.trim().length === 0) {
      throw new Error('O título do documento jurídico é obrigatório.');
    }
    if (!dto.tipo) {
      throw new Error('O tipo do documento jurídico é obrigatório.');
    }
    if (!dto.versao || dto.versao.trim().length === 0) {
      throw new Error('A versão do documento jurídico é obrigatória.');
    }
    if (!dto.conteudo_md || dto.conteudo_md.trim().length === 0) {
      throw new Error('O conteúdo em Markdown (conteudo_md) é obrigatório.');
    }

    return this.repository.criar({
      ...dto,
      titulo: dto.titulo.trim(),
      versao: dto.versao.trim(),
      conteudo_md: dto.conteudo_md.trim(),
      hash_sha256: null,
      status: 'RASCUNHO',
      ativo: true,
    });
  }

  async buscarPorId(id: string): Promise<DocumentoJuridico> {
    if (!id || id.trim().length === 0) {
      throw new Error('O ID do documento é obrigatório.');
    }
    const doc = await this.repository.buscarPorId(id.trim());
    if (!doc) {
      throw new Error(`Documento jurídico com ID "${id}" não foi encontrado.`);
    }
    return doc;
  }

  async listarDocumentos(filtros?: ListarDocumentosJuridicosFiltros): Promise<DocumentoJuridico[]> {
    return this.repository.listar(filtros);
  }

  async atualizarRascunho(
    id: string,
    dto: AtualizarDocumentoJuridicoRascunhoDTO
  ): Promise<DocumentoJuridico> {
    const docAtual = await this.buscarPorId(id);

    if (docAtual.status !== 'RASCUNHO') {
      throw new Error(
        `Apenas documentos em status RASCUNHO podem ser alterados. Status atual: ${docAtual.status}`
      );
    }

    if (dto.titulo !== undefined && dto.titulo.trim().length === 0) {
      throw new Error('O título não pode ser vazio.');
    }
    if (dto.versao !== undefined && dto.versao.trim().length === 0) {
      throw new Error('A versão não pode ser vazia.');
    }
    if (dto.conteudo_md !== undefined && dto.conteudo_md.trim().length === 0) {
      throw new Error('O conteúdo em Markdown não pode ser vazio.');
    }

    return this.repository.atualizarRascunho(id, {
      ...dto,
      titulo: dto.titulo !== undefined ? dto.titulo.trim() : undefined,
      versao: dto.versao !== undefined ? dto.versao.trim() : undefined,
      conteudo_md: dto.conteudo_md !== undefined ? dto.conteudo_md.trim() : undefined,
    });
  }

  async arquivarDocumento(id: string): Promise<DocumentoJuridico> {
    const docAtual = await this.buscarPorId(id);

    if (docAtual.status === 'ARQUIVADO') {
      throw new Error('O documento já se encontra arquivado.');
    }

    return this.repository.arquivar(id);
  }

  async publicarDocumento(id: string): Promise<DocumentoJuridico> {
    const docAtual = await this.buscarPorId(id);

    if (docAtual.status === 'PUBLICADO') {
      throw new Error(`O documento "${docAtual.titulo}" (versão ${docAtual.versao}) já está publicado.`);
    }

    if (docAtual.status !== 'RASCUNHO') {
      throw new Error(
        `Apenas documentos em status RASCUNHO podem ser publicados. Status atual: ${docAtual.status}`
      );
    }

    return this.repository.publicar(id);
  }

  async criarNovaVersao(
    idOriginal: string,
    novaVersao: string,
    criadoPor?: string
  ): Promise<DocumentoJuridico> {
    const docOriginal = await this.buscarPorId(idOriginal);

    if (docOriginal.status !== 'PUBLICADO') {
      throw new Error(
        `Apenas documentos no status PUBLICADO podem servir de base para uma nova versão. Status atual: ${docOriginal.status}`
      );
    }

    if (!novaVersao || novaVersao.trim().length === 0) {
      throw new Error('A nova versão deve ser informada.');
    }

    const versaoLimpa = novaVersao.trim();
    if (versaoLimpa === docOriginal.versao) {
      throw new Error(`A nova versão deve ser diferente da versão atual (${docOriginal.versao}).`);
    }

    // Verificar se já existe um documento com o mesmo tipo e mesma nova versão
    const docsExistentes = await this.repository.listar({ tipo: docOriginal.tipo });
    const jaExiste = docsExistentes.some((d) => d.versao === versaoLimpa);

    if (jaExiste) {
      throw new Error(
        `Já existe um documento do tipo "${docOriginal.tipo}" com a versão "${versaoLimpa}".`
      );
    }

    // Determinar o documento_raiz_id (na versão matriz pode ser o id dela própria se for o primeiro)
    const documentoRaizId = docOriginal.documento_raiz_id || docOriginal.id;

    // Duplicar tipo, titulo, conteudo_md, conteudo_html mantendo o vinculo logico via documento_raiz_id
    // e deixando hash_sha256 como NULL para ser calculado na publicacao
    return this.repository.criarNovaVersao({
      documento_raiz_id: documentoRaizId,
      tipo: docOriginal.tipo,
      titulo: docOriginal.titulo,
      versao: versaoLimpa,
      conteudo_md: docOriginal.conteudo_md,
      conteudo_html: docOriginal.conteudo_html || null,
      hash_sha256: null,
      status: 'RASCUNHO',
      obrigatorio: docOriginal.obrigatorio,
      ativo: true,
      criado_por: criadoPor || null,
    });
  }

  async listarHistoricoVersoes(documentoId: string): Promise<RespostaHistoricoVersoesDTO> {
    const docAlvo = await this.buscarPorId(documentoId);
    const documentoRaizId = docAlvo.documento_raiz_id || docAlvo.id;

    const listaDocs = await this.repository.listarHistoricoVersoes(documentoRaizId);

    // Identificar qual versão está atualmente PUBLICADA
    const docPublicadoAtual = listaDocs.find((d) => d.status === 'PUBLICADO' && d.ativo);
    const versaoPublicadaAtualId = docPublicadoAtual ? docPublicadoAtual.id : null;

    const versoes: ItemHistoricoVersaoDTO[] = listaDocs.map((d) => ({
      id: d.id,
      documento_raiz_id: d.documento_raiz_id || d.id,
      versao: d.versao,
      status: d.status,
      publicado_em: d.publicado_em || null,
      created_at: d.created_at,
      ativo: d.ativo,
      is_publicado_atual: d.id === versaoPublicadaAtualId,
    }));

    return {
      documento_raiz_id: documentoRaizId,
      total_versoes: versoes.length,
      versao_publicada_atual_id: versaoPublicadaAtualId,
      versoes,
    };
  }
}
