import { BaseRepository } from '@/repositories/shared/baseRepository';
import type { TenantContrato } from '@/types/juridico';

export class ContratosRepository extends BaseRepository<TenantContrato> {
  constructor(customClient?: any) {
    super('tenant_contratos');
    if (customClient) {
      (this as any)._customClient = customClient;
    }
  }

  protected get client() {
    return (this as any)._customClient || super.client;
  }

  async criar(payload: Partial<TenantContrato>): Promise<TenantContrato> {
    const { data, error } = await this.client
      .from(this.table)
      .insert([payload])
      .select('*')
      .single();

    if (error) throw error;
    return data as TenantContrato;
  }

  async buscarPorMinistryId(ministryId: string): Promise<TenantContrato[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select('*')
      .eq('ministry_id', ministryId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as TenantContrato[];
  }
}
