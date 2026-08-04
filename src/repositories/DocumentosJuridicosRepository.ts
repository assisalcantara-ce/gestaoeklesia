import { BaseRepository } from '@/repositories/shared/baseRepository';
import type {
  DocumentoJuridico,
  CriarDocumentoJuridicoDTO,
  AtualizarDocumentoJuridicoRascunhoDTO,
  ListarDocumentosJuridicosFiltros,
} from '@/types/juridico';

export class DocumentosJuridicosRepository extends BaseRepository<DocumentoJuridico> {
  constructor(customClient?: any) {
    super('documentos_juridicos');
    if (customClient) {
      (this as any)._customClient = customClient;
    }
  }

  protected get client() {
    return (this as any)._customClient || super.client;
  }

  async criar(dto: CriarDocumentoJuridicoDTO & { hash_sha256?: string | null; status: 'RASCUNHO'; ativo: boolean }): Promise<DocumentoJuridico> {
    const payload = {
      tipo: dto.tipo,
      titulo: dto.titulo,
      versao: dto.versao,
      conteudo_md: dto.conteudo_md,
      conteudo_html: dto.conteudo_html || null,
      hash_sha256: dto.hash_sha256 || null,
      status: dto.status,
      obrigatorio: dto.obrigatorio ?? true,
      ativo: dto.ativo ?? true,
      criado_por: dto.criado_por || null,
    };

    const { data, error } = await this.client
      .from(this.table)
      .insert([payload])
      .select('*')
      .single();

    if (error) throw error;
    return data as DocumentoJuridico;
  }

  async buscarPorId(id: string): Promise<DocumentoJuridico | null> {
    return this.findById(id);
  }

  async listar(filtros?: ListarDocumentosJuridicosFiltros): Promise<DocumentoJuridico[]> {
    return this.findAll((builder: any) => {
      let query = builder;
      if (filtros?.tipo) {
        query = query.eq('tipo', filtros.tipo);
      }
      if (filtros?.status) {
        query = query.eq('status', filtros.status);
      }
      if (filtros?.ativo !== undefined) {
        query = query.eq('ativo', filtros.ativo);
      }
      return query.order('created_at', { ascending: false });
    });
  }

  async atualizarRascunho(id: string, dto: AtualizarDocumentoJuridicoRascunhoDTO): Promise<DocumentoJuridico> {
    const payload: Record<string, any> = {};
    if (dto.titulo !== undefined) payload.titulo = dto.titulo;
    if (dto.versao !== undefined) payload.versao = dto.versao;
    if (dto.conteudo_md !== undefined) payload.conteudo_md = dto.conteudo_md;
    if (dto.conteudo_html !== undefined) payload.conteudo_html = dto.conteudo_html;
    if (dto.obrigatorio !== undefined) payload.obrigatorio = dto.obrigatorio;

    // Trava de banco: Apenas altera se status atual for RASCUNHO
    const { data, error } = await this.client
      .from(this.table)
      .update(payload)
      .eq('id', id)
      .eq('status', 'RASCUNHO')
      .select('*')
      .single();

    if (error) throw error;
    return data as DocumentoJuridico;
  }

  async arquivar(id: string): Promise<DocumentoJuridico> {
    const { data, error } = await this.client
      .from(this.table)
      .update({ status: 'ARQUIVADO', ativo: false })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as DocumentoJuridico;
  }

  async publicar(id: string): Promise<DocumentoJuridico> {
    // Trava de banco: Apenas publica se status atual for RASCUNHO
    const { data, error } = await this.client
      .from(this.table)
      .update({
        status: 'PUBLICADO',
        ativo: true,
        publicado_em: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'RASCUNHO')
      .select('*')
      .single();

    if (error) throw error;
    return data as DocumentoJuridico;
  }

  async criarNovaVersao(payload: {
    documento_raiz_id: string;
    tipo: string;
    titulo: string;
    versao: string;
    conteudo_md: string;
    conteudo_html?: string | null;
    hash_sha256?: string | null;
    status: 'RASCUNHO';
    obrigatorio: boolean;
    ativo: boolean;
    criado_por?: string | null;
  }): Promise<DocumentoJuridico> {
    const { data, error } = await this.client
      .from(this.table)
      .insert([payload])
      .select('*')
      .single();

    if (error) throw error;
    return data as DocumentoJuridico;
  }

  async listarHistoricoVersoes(documentoRaizId: string): Promise<DocumentoJuridico[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select('*')
      .or(`documento_raiz_id.eq.${documentoRaizId},id.eq.${documentoRaizId}`)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as DocumentoJuridico[];
  }
}
