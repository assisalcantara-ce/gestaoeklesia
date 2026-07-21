import { SupabaseClient } from '@supabase/supabase-js';

export class CommercialRepository {
  /**
   * Consulta as ministries da plataforma.
   */
  async getMinistries(supabase: SupabaseClient): Promise<any[]> {
    const { data, error } = await supabase
      .from('ministries')
      .select('*');
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') return [];
      throw error;
    }
    return data || [];
  }

  /**
   * Consulta os pré-cadastros de trial.
   */
  async getPreRegistrations(supabase: SupabaseClient): Promise<any[]> {
    const { data, error } = await supabase
      .from('pre_registrations')
      .select('*');
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') return [];
      throw error;
    }
    return data || [];
  }

  /**
   * Consulta as faturas emitidas da plataforma.
   */
  async getBillingInvoices(supabase: SupabaseClient): Promise<any[]> {
    const { data, error } = await supabase
      .from('platform_billing_invoices')
      .select('*');
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') return [];
      throw error;
    }
    return data || [];
  }

  /**
   * Consulta as oportunidades de vendas.
   */
  async getOpportunities(supabase: SupabaseClient): Promise<any[]> {
    const { data, error } = await supabase
      .from('oportunidades_comerciais')
      .select('*');
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') return [];
      throw error;
    }
    return data || [];
  }

  /**
   * Consulta o histórico das oportunidades comerciais.
   */
  async getOpportunityHistory(supabase: SupabaseClient): Promise<any[]> {
    const { data, error } = await supabase
      .from('oportunidades_comerciais_historico')
      .select('*');
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') return [];
      throw error;
    }
    return data || [];
  }

  /**
   * Consulta as configurações de ministérios.
   */
  async getConfigurations(supabase: SupabaseClient): Promise<any[]> {
    const { data, error } = await supabase
      .from('configurations')
      .select('ministry_id, church_profile');
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') return [];
      throw error;
    }
    return data || [];
  }
}
