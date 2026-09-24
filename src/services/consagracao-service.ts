import { createClient } from '@/lib/supabase-client';
import {
  ConsagracaoRegistro,
  ConsagracaoRegistroInput,
} from '@/types/consagracao';

export const consacracaoService = {
  /**
   * Lista todos os registros de consagração de um ministério com comissão associada (se houver)
   */
  async listarRegistros(
    ministryId: string,
    filtros?: { status?: string; comissaoId?: string; search?: string }
  ): Promise<ConsagracaoRegistro[]> {
    const supabase = createClient();

    let query = supabase
      .from('consagracao_registros')
      .select(`
        *,
        comissao:comissoes (
          id,
          nome,
          status
        )
      `)
      .eq('ministry_id', ministryId)
      .order('created_at', { ascending: false });

    if (filtros?.status && filtros.status !== 'todos') {
      query = query.eq('status_processo', filtros.status);
    }

    if (filtros?.comissaoId && filtros.comissaoId !== 'todas') {
      query = query.eq('comissao_id', filtros.comissaoId);
    }

    if (filtros?.search && filtros.search.trim() !== '') {
      const termo = filtros.search.trim();
      query = query.or(`nome.ilike.%${termo}%,numero_processo.ilike.%${termo}%,cpf.ilike.%${termo}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((row: any) => ({
      ...row,
      comissao_id: row.comissao_id || null,
      comissao: row.comissao ? {
        id: row.comissao.id,
        nome: row.comissao.nome,
        status: row.comissao.status,
      } : null,
    }));
  },

  /**
   * Obtém detalhes de um processo por ID
   */
  async obterRegistroPorId(
    id: string,
    ministryId: string
  ): Promise<ConsagracaoRegistro | null> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('consagracao_registros')
      .select(`
        *,
        comissao:comissoes (
          id,
          nome,
          status
        )
      `)
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return {
      ...data,
      comissao_id: data.comissao_id || null,
      comissao: data.comissao ? {
        id: data.comissao.id,
        nome: data.comissao.nome,
        status: data.comissao.status,
      } : null,
    };
  },

  /**
   * Cria um novo registro de consagração
   */
  async criarRegistro(
    ministryId: string,
    input: ConsagracaoRegistroInput
  ): Promise<ConsagracaoRegistro> {
    const supabase = createClient();

    const payload: Record<string, any> = {
      ...input,
      ministry_id: ministryId,
      comissao_id: input.comissao_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('consagracao_registros')
      .insert(payload)
      .select(`
        *,
        comissao:comissoes (
          id,
          nome,
          status
        )
      `)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Atualiza dados de um registro de consagração
   */
  async atualizarRegistro(
    id: string,
    ministryId: string,
    input: Partial<ConsagracaoRegistroInput>
  ): Promise<ConsagracaoRegistro> {
    const supabase = createClient();

    const updateData: Record<string, any> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    if (input.comissao_id !== undefined) {
      updateData.comissao_id = input.comissao_id || null;
    }

    const { data, error } = await supabase
      .from('consagracao_registros')
      .update(updateData)
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .select(`
        *,
        comissao:comissoes (
          id,
          nome,
          status
        )
      `)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Exclui um registro de consagração
   */
  async excluirRegistro(id: string, ministryId: string): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from('consagracao_registros')
      .delete()
      .eq('id', id)
      .eq('ministry_id', ministryId);

    if (error) throw error;
  },

  /**
   * Homologa um processo de consagração e sincroniza o cargo ministerial e histórico em members
   * através de transação atômica nativa RPC no PostgreSQL (v2).
   *
   * A RPC distingue três casos:
   *   - success: true, already_homologado: false → homologação nova concluída
   *   - success: true, already_homologado: true  → já homologado e consistente (idempotente)
   *   - success: false, divergencia: true        → já homologado mas cadastro divergente → erro
   */
  async homologarProcesso(
    processId: string,
    ministryId: string
  ): Promise<{ success: boolean; message?: string; alreadyHomologado?: boolean }> {
    const supabase = createClient();

    const { data, error } = await supabase.rpc('homologar_processo_consagracao', {
      p_process_id: processId,
      p_ministry_id: ministryId,
    });

    if (error) {
      console.error('Erro na RPC homologar_processo_consagracao:', error);
      throw new Error(error.message || 'Falha ao homologar processo no banco de dados.');
    }

    const res = data as {
      success?: boolean;
      message?: string;
      already_homologado?: boolean;
      divergencia?: boolean;
    } | null;

    // Divergência detectada pelo banco: processo marcado como homologado
    // mas cadastro ministerial inconsistente — propagar como erro controlado.
    if (res?.success === false && res?.divergencia === true) {
      throw new Error(res.message || 'Inconsistência detectada: processo já homologado com dados ministeriais divergentes. Revise manualmente.');
    }

    return {
      success: Boolean(res?.success),
      alreadyHomologado: Boolean(res?.already_homologado),
      message: res?.message || 'Processo homologado com sucesso.',
    };
  },
};
