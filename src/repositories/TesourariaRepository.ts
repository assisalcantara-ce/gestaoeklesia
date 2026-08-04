/**
 * TesourariaRepository
 * Camada de acesso a dados da Tesouraria (server-side, supabase admin client).
 * NÃO utiliza createClient() do browser — recebe a instância admin injetada.
 */

export interface LancamentoInsert {
  ministry_id: string;
  data_lancamento: string;
  tipo_movimento: 'entrada' | 'saida';
  tipo_recebimento: string;
  valor: number;
  referencia?: string | null;
  observacoes?: string | null;
  descricao?: string | null;
  congregacao_id?: string | null;
  departamento_id?: string | null;
  conta_id?: string | null;
  categoria_id?: string | null;
  member_id?: string | null;
}

export interface LancamentoRow extends LancamentoInsert {
  id: string;
  created_at: string;
  updated_at?: string | null;
}

export class TesourariaRepository {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async criarLancamento(payload: LancamentoInsert): Promise<LancamentoRow> {
    const { data, error } = await this.supabase
      .from('tesouraria_lancamentos')
      .insert([payload])
      .select('*')
      .single();

    if (error) {
      throw new Error(`Erro ao cadastrar lançamento: ${error.message}`);
    }

    return data as LancamentoRow;
  }
}
