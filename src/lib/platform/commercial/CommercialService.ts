import { SupabaseClient } from '@supabase/supabase-js';
import { CommercialRepository } from './CommercialRepository';
import { CommercialBuilder } from './CommercialBuilder';
import { ComercialViewModel } from './types';
import { CommercialCache } from '../commercial-cache/CommercialCache';

export class CommercialService {
  private repository = new CommercialRepository();
  private builder = new CommercialBuilder();
  private cache = CommercialCache.getInstance();

  /**
   * Retorna a listagem unificada de todos os clientes comerciais da plataforma com suporte a cache.
   */
  async list(supabase: SupabaseClient): Promise<ComercialViewModel[]> {
    // 1. Tentar ler do cache
    const cachedList = this.cache.get();
    if (cachedList) {
      return cachedList;
    }

    // 2. Se não estiver no cache (cache miss), registra a consulta e faz o carregamento
    this.cache.recordQuery();
    const [ministries, preRegs, invoices, opportunities, opportunitiesHistory, configurations] = await Promise.all([
      this.repository.getMinistries(supabase),
      this.repository.getPreRegistrations(supabase),
      this.repository.getBillingInvoices(supabase),
      this.repository.getOpportunities(supabase),
      this.repository.getOpportunityHistory(supabase),
      this.repository.getConfigurations(supabase)
    ]);

    // 3. Executa o builder e registra métrica
    this.cache.recordBuilder();
    const listResult = this.builder.buildList({
      ministries,
      preRegs,
      invoices,
      opportunities,
      opportunitiesHistory,
      configurations
    });

    // 4. Salva o resultado no cache e retorna
    this.cache.set(listResult);
    return listResult;
  }


  /**
   * Retorna o DTO comercial de um cliente específico buscando por seu ID único (ministry_id ou pre_registration_id).
   */
  async findById(supabase: SupabaseClient, id: string): Promise<ComercialViewModel | null> {
    const list = await this.list(supabase);
    return list.find(item => item.id === id) || null;
  }

  /**
   * Retorna o DTO comercial associado a um ministério.
   */
  async findByMinistry(supabase: SupabaseClient, ministryId: string): Promise<ComercialViewModel | null> {
    const list = await this.list(supabase);
    return list.find(item => item.id === ministryId && item.origem === 'ministries') || null;
  }

  /**
   * Retorna o DTO comercial associado a um pré-cadastro.
   */
  async findByPreRegistration(supabase: SupabaseClient, preRegId: string): Promise<ComercialViewModel | null> {
    const list = await this.list(supabase);
    return list.find(item => item.id === preRegId && item.origem === 'pre_registrations') || null;
  }
}
