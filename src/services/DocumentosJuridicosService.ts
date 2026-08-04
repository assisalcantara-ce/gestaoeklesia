import { DocumentosJuridicosRepository } from '@/repositories/DocumentosJuridicosRepository';
import type {
  DocumentoJuridico,
  CriarDocumentoJuridicoDTO,
  AtualizarDocumentoJuridicoRascunhoDTO,
  ListarDocumentosJuridicosFiltros,
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
      hash_sha256: 'PENDENTE',
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
}
