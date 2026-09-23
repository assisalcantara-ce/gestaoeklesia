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
  codigo_registro?: string | null;
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

  /**
   * Obtém apenas a sugestão/prévia de código para exibição visual no frontend (NÃO consome a sequência)
   */
  async obterPreviaCodigoRegistro(ministryId: string, ano: number): Promise<string> {
    try {
      const { data: rpcCode, error: rpcErr } = await this.supabase.rpc('obter_previa_codigo_lancamento', {
        p_ministry_id: ministryId,
        p_ano: ano,
      });
      if (!rpcErr && rpcCode && typeof rpcCode === 'string') {
        return rpcCode;
      }
    } catch {
      // Fallback
    }

    return this.calcularPreviaFallback(ministryId, ano);
  }

  /**
   * Aloca atômica e definitivamente o próximo código de registro com lock no PostgreSQL
   */
  async alocarProximoCodigoRegistro(ministryId: string, ano: number): Promise<string> {
    try {
      const { data: rpcCode, error: rpcErr } = await this.supabase.rpc('alocar_proximo_codigo_lancamento', {
        p_ministry_id: ministryId,
        p_ano: ano,
      });
      if (!rpcErr && rpcCode && typeof rpcCode === 'string') {
        return rpcCode;
      }
    } catch {
      // Fallback para query direta
    }

    return this.calcularPreviaFallback(ministryId, ano);
  }

  /**
   * @deprecated mantido para retrocompatibilidade; chama obterPreviaCodigoRegistro
   */
  async obterProximoCodigoRegistro(ministryId: string, ano: number): Promise<string> {
    return this.obterPreviaCodigoRegistro(ministryId, ano);
  }

  private async calcularPreviaFallback(ministryId: string, ano: number): Promise<string> {
    const prefix = `REG-${ano}-`;
    const { data, error } = await this.supabase
      .from('tesouraria_lancamentos')
      .select('codigo_registro')
      .eq('ministry_id', ministryId)
      .like('codigo_registro', `${prefix}%`)
      .order('codigo_registro', { ascending: false })
      .limit(100);

    let maxSeq = 0;
    if (!error && Array.isArray(data)) {
      const regex = new RegExp(`^REG-${ano}-(\\d+)$`, 'i');
      for (const item of data) {
        if (item.codigo_registro) {
          const match = item.codigo_registro.trim().match(regex);
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxSeq) {
              maxSeq = num;
            }
          }
        }
      }
    }

    const proximoNum = maxSeq + 1;
    return `${prefix}${String(proximoNum).padStart(6, '0')}`;
  }

  async verificarCodigoExiste(ministryId: string, codigo: string, excludeId?: string): Promise<boolean> {
    if (!codigo || !codigo.trim()) return false;
    let query = this.supabase
      .from('tesouraria_lancamentos')
      .select('id')
      .eq('ministry_id', ministryId)
      .ilike('codigo_registro', codigo.trim());

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query.limit(1);
    if (error) {
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  }

  async criarLancamento(payload: LancamentoInsert): Promise<LancamentoRow> {
    const { data, error } = await this.supabase
      .from('tesouraria_lancamentos')
      .insert([payload])
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505' || error.message?.includes('idx_tesouraria_lancamentos_codigo_registro')) {
        throw new Error('Já existe um lançamento registrado com este Código/ID.');
      }
      throw new Error(`Erro ao cadastrar lançamento: ${error.message}`);
    }

    return data as LancamentoRow;
  }

  async atualizarLancamento(id: string, ministryId: string, payload: Partial<LancamentoInsert>): Promise<LancamentoRow> {
    const { data, error } = await this.supabase
      .from('tesouraria_lancamentos')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505' || error.message?.includes('idx_tesouraria_lancamentos_codigo_registro')) {
        throw new Error('Já existe um lançamento registrado com este Código/ID.');
      }
      throw new Error(`Erro ao atualizar lançamento: ${error.message}`);
    }

    return data as LancamentoRow;
  }

  /**
   * Atualização restrita e segura: Altera exclusivamente o tipo de recebimento e a identificação do membro/dizimista.
   * Todos os demais campos financeiros permanecem imutáveis.
   */
  async atualizarClassificacao(
    id: string,
    ministryId: string,
    tipoRecebimento: string,
    memberId: string | null,
    userId?: string | null
  ): Promise<LancamentoRow> {
    // 1. Verificar se o lançamento existe e pertence ao ministry_id
    const { data: lancamentoExistente, error: getErr } = await this.supabase
      .from('tesouraria_lancamentos')
      .select('*')
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (getErr || !lancamentoExistente) {
      throw new Error('Lançamento não encontrado ou não pertence a esta instituição.');
    }

    // 2. Se memberId foi informado, validar se pertence ao mesmo ministry_id
    if (memberId) {
      const { data: membro, error: memErr } = await this.supabase
        .from('members')
        .select('id, name, ministry_id')
        .eq('id', memberId)
        .eq('ministry_id', ministryId)
        .maybeSingle();

      if (memErr || !membro) {
        throw new Error('O membro selecionado não pertence à instituição autorizada.');
      }
    }

    // 3. Atualizar exclusivamente tipo_recebimento e member_id
    const { data: lancamentoAtualizado, error: updateErr } = await this.supabase
      .from('tesouraria_lancamentos')
      .update({
        tipo_recebimento: tipoRecebimento.trim(),
        member_id: memberId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .select('*')
      .single();

    if (updateErr) {
      throw new Error(`Erro ao atualizar classificação do lançamento: ${updateErr.message}`);
    }

    // 4. Registrar log de auditoria
    if (lancamentoExistente) {
      try {
        await this.supabase.from('audit_logs').insert([
          {
            ministry_id: ministryId,
            user_id: userId || null,
            usuario_id: userId || null,
            action: 'UPDATE',
            acao: 'reclassificar',
            resource_type: 'tesouraria_lancamentos',
            modulo: 'financeiro',
            tabela_afetada: 'tesouraria_lancamentos',
            resource_id: id,
            registro_id: id,
            descricao: `Reclassificação de lançamento: Tipo '${lancamentoExistente.tipo_recebimento}' ➔ '${tipoRecebimento.trim()}'`,
            old_data: {
              tipo_recebimento: lancamentoExistente.tipo_recebimento,
              member_id: lancamentoExistente.member_id,
            },
            dados_anteriores: {
              tipo_recebimento: lancamentoExistente.tipo_recebimento,
              member_id: lancamentoExistente.member_id,
            },
            new_data: {
              tipo_recebimento: tipoRecebimento.trim(),
              member_id: memberId || null,
            },
            status: 'sucesso',
            status_code: 200,
          },
        ]);
      } catch (auditErr) {
        console.warn('Aviso: falha ao gravar log de auditoria da reclassificação:', auditErr);
      }
    }

    return lancamentoAtualizado as LancamentoRow;
  }

  async deletarLancamento(id: string, ministryId: string, userId?: string | null): Promise<boolean> {
    // 1. Buscar os dados do lançamento para preservar o histórico/auditoria
    const { data: lancamento } = await this.supabase
      .from('tesouraria_lancamentos')
      .select('*')
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    // 2. Excluir o registro
    const { error } = await this.supabase
      .from('tesouraria_lancamentos')
      .delete()
      .eq('id', id)
      .eq('ministry_id', ministryId);

    if (error) {
      throw new Error(`Erro ao deletar lançamento: ${error.message}`);
    }

    // 3. Registrar auditoria em audit_logs se o lançamento existia
    if (lancamento) {
      try {
        const descText = `Exclusão de lançamento financeiro [${lancamento.tipo_movimento?.toUpperCase()}] no valor de R$ ${lancamento.valor} (${lancamento.tipo_recebimento || 'Lançamento'})`;

        await this.supabase.from('audit_logs').insert([
          {
            ministry_id: ministryId,
            user_id: userId || null,
            usuario_id: userId || null,
            action: 'DELETE',
            acao: 'deletar',
            resource_type: 'tesouraria_lancamentos',
            modulo: 'financeiro',
            tabela_afetada: 'tesouraria_lancamentos',
            resource_id: id,
            registro_id: id,
            descricao: descText,
            old_data: {
              ...lancamento,
              motivo_exclusao: 'Exclusão solicitada na Tesouraria',
            },
            dados_anteriores: {
              ...lancamento,
              motivo_exclusao: 'Exclusão solicitada na Tesouraria',
            },
            new_data: null,
            status: 'sucesso',
            status_code: 200,
          },
        ]);
      } catch (auditErr) {
        console.warn('Aviso: falha ao gravar log de auditoria da exclusão:', auditErr);
      }
    }

    return true;
  }
}
