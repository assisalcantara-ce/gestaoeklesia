import { createClient } from '@/lib/supabase-client';
import {
  Comissao,
  ComissaoInput,
  ComissaoIntegrante,
  ComissaoIntegranteInput,
  MinistroDisponivel,
} from '@/types/comissoes';

export const comissoesService = {
  /**
   * Lista todas as comissões de um ministério com contagem confiável de integrantes
   */
  async listarComissoes(
    ministryId: string,
    filtros?: { status?: string; search?: string }
  ): Promise<Comissao[]> {
    const supabase = createClient();
    
    // 1. Buscar comissões do ministério
    let query = supabase
      .from('comissoes')
      .select('*')
      .eq('ministry_id', ministryId)
      .order('created_at', { ascending: false });

    if (filtros?.status && filtros.status !== 'todas') {
      query = query.eq('status', filtros.status);
    }

    if (filtros?.search && filtros.search.trim() !== '') {
      query = query.ilike('nome', `%${filtros.search.trim()}%`);
    }

    const { data: comissoesData, error: comissoesError } = await query;
    if (comissoesError) throw comissoesError;
    if (!comissoesData || comissoesData.length === 0) return [];

    // 2. Buscar contagem de integrantes agrupada por comissão de forma compatível e robusta
    const comissaoIds = (comissoesData as Array<{ id: string }>).map((c) => c.id);
    const { data: integrantesData, error: integrantesError } = await supabase
      .from('comissao_integrantes')
      .select('comissao_id')
      .eq('ministry_id', ministryId)
      .in('comissao_id', comissaoIds);

    if (integrantesError) throw integrantesError;

    const countMap: Record<string, number> = {};
    ((integrantesData || []) as Array<{ comissao_id: string }>).forEach((row) => {
      countMap[row.comissao_id] = (countMap[row.comissao_id] || 0) + 1;
    });

    return (comissoesData as Array<any>).map((c) => ({
      id: c.id,
      ministry_id: c.ministry_id,
      nome: c.nome,
      descricao: c.descricao,
      status: c.status,
      created_at: c.created_at,
      updated_at: c.updated_at,
      integrantes_count: countMap[c.id] || 0,
    }));
  },

  /**
   * Obtém detalhes de uma comissão por ID
   */
  async obterComissaoPorId(id: string, ministryId: string): Promise<Comissao | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('comissoes')
      .select('*')
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  },

  /**
   * Cria uma nova comissão
   */
  async criarComissao(ministryId: string, input: ComissaoInput): Promise<Comissao> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('comissoes')
      .insert({
        ministry_id: ministryId,
        nome: input.nome.trim(),
        descricao: input.descricao ? input.descricao.trim() : null,
        status: input.status || 'ativa',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Atualiza dados de uma comissão
   */
  async atualizarComissao(
    id: string,
    ministryId: string,
    input: Partial<ComissaoInput>
  ): Promise<Comissao> {
    const supabase = createClient();
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.nome !== undefined) updateData.nome = input.nome.trim();
    if (input.descricao !== undefined) updateData.descricao = input.descricao ? input.descricao.trim() : null;
    if (input.status !== undefined) updateData.status = input.status;

    const { data, error } = await supabase
      .from('comissoes')
      .update(updateData)
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Exclui uma comissão
   */
  async excluirComissao(id: string, ministryId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('comissoes')
      .delete()
      .eq('id', id)
      .eq('ministry_id', ministryId);

    if (error) throw error;
  },

  /**
   * Lista os integrantes de uma comissão com dados oficiais do membro/ministro (members)
   */
  async listarIntegrantes(comissaoId: string, ministryId: string): Promise<ComissaoIntegrante[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('comissao_integrantes')
      .select(`
        id,
        ministry_id,
        comissao_id,
        member_id,
        cargo,
        created_at,
        updated_at,
        member:members (
          id,
          name,
          cargo_ministerial,
          tipo_cadastro,
          foto_url,
          email,
          phone,
          celular
        )
      `)
      .eq('comissao_id', comissaoId)
      .eq('ministry_id', ministryId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      ministry_id: row.ministry_id,
      comissao_id: row.comissao_id,
      member_id: row.member_id,
      cargo: row.cargo,
      created_at: row.created_at,
      updated_at: row.updated_at,
      member: row.member ? {
        id: row.member.id,
        name: row.member.name,
        cargo_ministerial: row.member.cargo_ministerial,
        tipo_cadastro: row.member.tipo_cadastro,
        foto_url: row.member.foto_url,
        email: row.member.email,
        phone: row.member.phone,
        celular: row.member.celular,
      } : undefined,
    }));
  },

  /**
   * Adiciona um integrante à comissão após validar estritamente tipo_cadastro = 'ministro'
   */
  async adicionarIntegrante(
    ministryId: string,
    input: ComissaoIntegranteInput
  ): Promise<ComissaoIntegrante> {
    const supabase = createClient();

    // 1. Validar se o membro pertence ao mesmo ministério e possui tipo_cadastro = 'ministro'
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, name, tipo_cadastro')
      .eq('id', input.member_id)
      .eq('ministry_id', ministryId)
      .single();

    if (memberError || !member) {
      throw new Error('Ministro não encontrado ou não pertence a este ministério.');
    }

    if (member.tipo_cadastro?.toLowerCase() !== 'ministro') {
      throw new Error('O integrante selecionado não possui cadastro com status oficial de ministro (tipo_cadastro = ministro).');
    }

    // 2. Inserir integrante na comissão
    const { data, error } = await supabase
      .from('comissao_integrantes')
      .insert({
        ministry_id: ministryId,
        comissao_id: input.comissao_id,
        member_id: input.member_id,
        cargo: input.cargo.trim() || 'Membro',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Este ministro já está cadastrado nesta comissão.');
      }
      throw error;
    }

    return data;
  },

  /**
   * Atualiza o cargo de um integrante na comissão
   */
  async atualizarCargoIntegrante(
    id: string,
    ministryId: string,
    cargo: string
  ): Promise<ComissaoIntegrante> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('comissao_integrantes')
      .update({
        cargo: cargo.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Remove um integrante de uma comissão
   */
  async removerIntegrante(id: string, ministryId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('comissao_integrantes')
      .delete()
      .eq('id', id)
      .eq('ministry_id', ministryId);

    if (error) throw error;
  },

  /**
   * Lista ministros do ministério disponíveis para adicionar a uma comissão
   * Filtrando estritamente por tipo_cadastro = 'ministro'
   */
  async listarMinistrosDisponiveis(
    ministryId: string,
    comissaoId?: string
  ): Promise<MinistroDisponivel[]> {
    const supabase = createClient();

    // 1. Buscar membros onde tipo_cadastro = 'ministro'
    const { data: ministros, error: ministrosError } = await supabase
      .from('members')
      .select('id, name, cargo_ministerial, tipo_cadastro, foto_url')
      .eq('ministry_id', ministryId)
      .eq('tipo_cadastro', 'ministro')
      .order('name', { ascending: true });

    if (ministrosError) throw ministrosError;
    if (!ministros || ministros.length === 0) return [];

    if (!comissaoId) {
      return ministros as MinistroDisponivel[];
    }

    // 2. Filtrar os ministros que já estão vinculados a esta comissão específica
    const { data: vinculados, error: vinculadosError } = await supabase
      .from('comissao_integrantes')
      .select('member_id')
      .eq('comissao_id', comissaoId)
      .eq('ministry_id', ministryId);

    if (vinculadosError) throw vinculadosError;

    const idsVinculados = new Set((vinculados || []).map((v: { member_id: string }) => v.member_id));
    return (ministros as MinistroDisponivel[]).filter((m: MinistroDisponivel) => !idsVinculados.has(m.id));
  },
};
