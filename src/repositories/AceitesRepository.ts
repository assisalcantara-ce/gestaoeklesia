import { BaseRepository } from '@/repositories/shared/baseRepository';
import type { TenantAceite, RegistrarAceiteDTO } from '@/types/juridico';

export class AceitesRepository extends BaseRepository<TenantAceite> {
  constructor(customClient?: any) {
    super('tenant_aceites');
    if (customClient) {
      (this as any)._customClient = customClient;
    }
  }

  protected get client() {
    return (this as any)._customClient || super.client;
  }

  async registrar(dto: RegistrarAceiteDTO): Promise<TenantAceite> {
    const payload = {
      ministry_id: dto.ministry_id,
      user_id: dto.user_id,
      documento_id: dto.documento_id,
      versao_aceita: dto.versao_aceita,
      hash_documento: dto.hash_documento,
      ip_address: dto.ip_address || null,
      user_agent: dto.user_agent || null,
      payload_aceite: dto.payload_aceite || {},
    };

    const { data, error } = await this.client
      .from(this.table)
      .insert([payload])
      .select('*')
      .single();

    if (error) throw error;
    return data as TenantAceite;
  }

  async consultarPorUsuario(userId: string, ministryId?: string): Promise<TenantAceite[]> {
    return this.findAll((builder: any) => {
      let query = builder.eq('user_id', userId);
      if (ministryId) {
        query = query.eq('ministry_id', ministryId);
      }
      return query.order('aceito_em', { ascending: false });
    });
  }

  async consultarPorDocumento(documentoId: string, ministryId?: string): Promise<TenantAceite[]> {
    return this.findAll((builder: any) => {
      let query = builder.eq('documento_id', documentoId);
      if (ministryId) {
        query = query.eq('ministry_id', ministryId);
      }
      return query.order('aceito_em', { ascending: false });
    });
  }

  async buscarAceiteEspecifico(
    ministryId: string,
    userId: string,
    documentoId: string,
    versaoAceita: string
  ): Promise<TenantAceite | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select('*')
      .eq('ministry_id', ministryId)
      .eq('user_id', userId)
      .eq('documento_id', documentoId)
      .eq('versao_aceita', versaoAceita)
      .maybeSingle();

    if (error) throw error;
    return data as TenantAceite | null;
  }
}
