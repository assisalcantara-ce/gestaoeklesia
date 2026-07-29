/**
 * BaseRepository — Camada Base de Acesso a Dados (Supabase Client-Side)
 */

import { createClient } from '@/lib/supabase-client';

export abstract class BaseRepository<T extends { id?: string | number }> {
  protected table: string;

  constructor(table: string) {
    this.table = table;
  }

  protected get client() {
    return createClient();
  }

  async findById(id: string | number): Promise<T | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as T | null;
  }

  async findAll(query?: (builder: any) => any): Promise<T[]> {
    let builder = this.client.from(this.table).select('*');
    if (query) {
      builder = query(builder);
    }
    const { data, error } = await builder;
    if (error) throw error;
    return (data || []) as T[];
  }
}
