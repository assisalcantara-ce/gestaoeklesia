import { createClient } from '@/lib/supabase-client';
import {
  ConsagracaoRegistro,
  ConsagracaoRegistroInput,
  HistoricoProcessoItem,
} from '@/types/consagracao';

/**
 * Registra um evento no Histórico do Ministro (members.custom_fields.historico_processos)
 * Preserva eventos anteriores, garante atomicidade e idempotência por processo e tipo_evento.
 */
async function registrarEventoHistoricoMinistro(
  supabase: any,
  ministryId: string,
  memberId: string,
  evento: HistoricoProcessoItem
): Promise<void> {
  if (!memberId || !ministryId) return;

  try {
    const { data: member, error: fetchErr } = await supabase
      .from('members')
      .select('id, custom_fields, cargo_ministerial')
      .eq('id', memberId)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (fetchErr || !member) return;

    const cf = (member.custom_fields && typeof member.custom_fields === 'object')
      ? { ...(member.custom_fields as Record<string, any>) }
      : {};

    const historicoAtual: HistoricoProcessoItem[] = Array.isArray(cf.historico_processos)
      ? [...cf.historico_processos]
      : Array.isArray(cf.historicoProcessos)
      ? [...cf.historicoProcessos]
      : [];

    const nowIso = new Date().toISOString();
    const eventId = evento.id || `${evento.processo_id}_${evento.tipo_evento}_${evento.status_processo || evento.decisao || ''}`;

    // Idempotência: verificar se evento com mesmo id ou mesma combinação chave já existe (exceto reaberturas sucessivas)
    const exists = historicoAtual.some((h) => {
      if (h.id === eventId) return true;
      if (evento.tipo_evento === 'homologacao' && h.processo_id === evento.processo_id && h.tipo_evento === 'homologacao') {
        return true;
      }
      if (evento.tipo_evento === 'inicio_processo' && h.processo_id === evento.processo_id && h.tipo_evento === 'inicio_processo') {
        return true;
      }
      return false;
    });

    if (exists) return;

    const novoItem: HistoricoProcessoItem = {
      id: eventId,
      processo_id: evento.processo_id,
      numero_processo: evento.numero_processo || '',
      ministry_id: ministryId,
      member_id: memberId,
      tipo_evento: evento.tipo_evento,
      tipo_registro: evento.tipo_registro || 'progressao',
      data: evento.data || nowIso.slice(0, 10),
      cargo_anterior: evento.cargo_anterior || member.cargo_ministerial || '',
      cargo_pretendido: evento.cargo_pretendido || null,
      cargo_resultante: evento.cargo_resultante || null,
      status_processo: evento.status_processo || null,
      decisao: evento.decisao || null,
      parecer: evento.parecer || null,
      resultado: evento.resultado || null,
      descricao: evento.descricao || '',
      criado_em: nowIso,
    };

    const nextHistorico = [...historicoAtual, novoItem];

    await supabase
      .from('members')
      .update({
        custom_fields: {
          ...cf,
          historico_processos: nextHistorico,
          historicoProcessos: nextHistorico,
        },
        updated_at: nowIso,
      })
      .eq('id', memberId)
      .eq('ministry_id', ministryId);
  } catch (err) {
    console.error('Erro ao registrar evento no histórico do ministro:', err);
  }
}

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
   * Cria um novo registro de consagração (Secretaria Geral / Admin)
   */
  async criarRegistro(
    ministryId: string,
    input: ConsagracaoRegistroInput,
    userNivel?: string | null
  ): Promise<ConsagracaoRegistro> {
    if (userNivel === 'presidencia') {
      throw new Error('O Presidente do Ministério não possui ação operacional para cadastrar processos.');
    }
    if (userNivel === 'supervisor') {
      throw new Error('A Comissão não possui permissão para cadastrar ou alterar dados do processo.');
    }

    const normalizeCargo = (v: string | null | undefined) =>
      String(v || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();

    if (
      input.cargo_ocupa &&
      input.cargo_pretendido &&
      normalizeCargo(input.cargo_ocupa) === normalizeCargo(input.cargo_pretendido)
    ) {
      throw new Error('O cargo pretendido deve ser diferente do cargo atual.');
    }

    const supabase = createClient();

    const payload: Record<string, any> = {
      ...input,
      ministry_id: ministryId,
      comissao_id: input.comissao_id || null,
      status_processo: 'em_processo', // Novos processos sempre iniciam Em Processo
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

    // Registrar evento de início no histórico do ministro se vinculado
    if (data && data.member_id) {
      const tipoLabel = data.tipo_registro === 'progressao' ? 'Progressão' : data.tipo_registro === 'filiacao' ? 'Filiação' : 'Chegada';
      await registrarEventoHistoricoMinistro(supabase, ministryId, data.member_id, {
        id: `${data.id}_inicio_processo`,
        processo_id: data.id,
        numero_processo: data.numero_processo || '',
        tipo_evento: 'inicio_processo',
        tipo_registro: data.tipo_registro,
        data: data.data_processo || new Date().toISOString().slice(0, 10),
        cargo_anterior: data.cargo_ocupa || null,
        cargo_pretendido: data.cargo_pretendido || null,
        status_processo: 'em_processo',
        descricao: `Início do Processo de ${tipoLabel} (${data.cargo_ocupa || 'Sem cargo anterior'} → ${data.cargo_pretendido || 'Novo cargo'})`,
      });
    }

    return data;
  },

  /**
   * Atualiza dados cadastrais de um registro de consagração (Secretaria Geral / Admin)
   */
  async atualizarRegistro(
    id: string,
    ministryId: string,
    input: Partial<ConsagracaoRegistroInput>,
    userNivel?: string | null
  ): Promise<ConsagracaoRegistro> {
    if (userNivel === 'presidencia') {
      throw new Error('O Presidente do Ministério não possui ação operacional para alterar dados do processo.');
    }
    if (userNivel === 'supervisor') {
      throw new Error('A Comissão não possui permissão para alterar dados cadastrais do processo.');
    }

    const normalizeCargo = (v: string | null | undefined) =>
      String(v || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();

    if (
      input.cargo_ocupa &&
      input.cargo_pretendido &&
      normalizeCargo(input.cargo_ocupa) === normalizeCargo(input.cargo_pretendido)
    ) {
      throw new Error('O cargo pretendido deve ser diferente do cargo atual.');
    }

    const supabase = createClient();

    const updateData: Record<string, any> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    if (input.comissao_id !== undefined) {
      updateData.comissao_id = input.comissao_id || null;
    }

    // Não permitir alteração arbitrária de status via payload de edição cadastral
    delete updateData.status_processo;

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
   * Exclui um registro de consagração (Secretaria Geral / Admin)
   */
  async excluirRegistro(id: string, ministryId: string, userNivel?: string | null, clientOverride?: any): Promise<void> {
    if (userNivel === 'presidencia') {
      throw new Error('O Presidente do Ministério não possui ação operacional para excluir processos.');
    }
    if (userNivel === 'supervisor') {
      throw new Error('A Comissão não possui permissão para excluir processos.');
    }

    const supabase = clientOverride || createClient();

    const { data: reg, error: fetchErr } = await supabase
      .from('consagracao_registros')
      .select('id, status_processo, ministry_id, member_id, numero_processo')
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (fetchErr || !reg) {
      throw new Error('Processo não encontrado ou não pertence ao ministério atual.');
    }

    if (reg.status_processo === 'homologar') {
      throw new Error('Processos homologados não podem ser excluídos, pois fazem parte do histórico oficial da consagração.');
    }

    // Registrar rastreabilidade da exclusão no histórico do ministro antes de remover o processo
    if (reg.member_id) {
      await registrarEventoHistoricoMinistro(supabase, ministryId, reg.member_id, {
        id: `${id}_exclusao_processo_${Date.now()}`,
        processo_id: id,
        numero_processo: reg.numero_processo || '',
        tipo_evento: 'cancelamento',
        status_processo: reg.status_processo,
        data: new Date().toISOString().slice(0, 10),
        descricao: `Processo nº ${reg.numero_processo || id} excluído antes da homologação. Cargo atual preservado.`,
      });
    }

    const { error } = await supabase
      .from('consagracao_registros')
      .delete()
      .eq('id', id)
      .eq('ministry_id', ministryId);

    if (error) throw error;
  },

  /**
   * SECRETARIA GERAL: Registrar decisão da Comissão como Deferido (Em Processo → Deferido)
   */
  async deferirProcessoComissao(
    processId: string,
    ministryId: string,
    userNivel?: string | null,
    parecer?: string | null
  ): Promise<ConsagracaoRegistro> {
    if (userNivel === 'presidencia') {
      throw new Error('O Presidente do Ministério não possui ação operacional de tramitação no sistema.');
    }
    if (userNivel === 'supervisor') {
      throw new Error('A Comissão de Consagração não opera o sistema diretamente; os registros de tramitação são de competência da Secretaria Geral.');
    }

    const parecerTratado = (parecer || '').trim();
    if (!parecerTratado) {
      throw new Error('O parecer da Comissão deve ser registrado antes de lançar a decisão.');
    }

    const supabase = createClient();

    const { data: reg, error: fetchErr } = await supabase
      .from('consagracao_registros')
      .select('id, status_processo, ministry_id, member_id, numero_processo, tipo_registro, cargo_ocupa, cargo_pretendido')
      .eq('id', processId)
      .eq('ministry_id', ministryId)
      .single();

    if (fetchErr || !reg) {
      throw new Error('Processo não encontrado ou não pertence ao ministério atual.');
    }

    if (reg.status_processo !== 'em_processo') {
      throw new Error(`Ação indisponível: o processo está com status "${reg.status_processo}" e não pode ser deferido.`);
    }

    const { data, error } = await supabase
      .from('consagracao_registros')
      .update({
        status_processo: 'deferir',
        observacoes: parecerTratado,
        updated_at: new Date().toISOString()
      })
      .eq('id', processId)
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

    // Registrar evento de parecer deferido no histórico do ministro
    if (reg.member_id) {
      await registrarEventoHistoricoMinistro(supabase, ministryId, reg.member_id, {
        id: `${processId}_decisao_deferir_${Date.now()}`,
        processo_id: processId,
        numero_processo: reg.numero_processo || '',
        tipo_evento: 'decisao_comissao',
        tipo_registro: reg.tipo_registro,
        decisao: 'deferir',
        parecer: parecerTratado,
        status_processo: 'deferir',
        data: new Date().toISOString().slice(0, 10),
        cargo_anterior: reg.cargo_ocupa || null,
        cargo_pretendido: reg.cargo_pretendido || null,
        descricao: `Parecer Deferido pela Comissão de Consagração: ${parecerTratado}`,
      });
    }

    return data;
  },

  /**
   * SECRETARIA GERAL: Registrar decisão da Comissão como Indeferido (Em Processo → Indeferido)
   */
  async indeferirProcessoComissao(
    processId: string,
    ministryId: string,
    userNivel?: string | null,
    parecer?: string | null
  ): Promise<ConsagracaoRegistro> {
    if (userNivel === 'presidencia') {
      throw new Error('O Presidente do Ministério não possui ação operacional de tramitação no sistema.');
    }
    if (userNivel === 'supervisor') {
      throw new Error('A Comissão de Consagração não opera o sistema diretamente; os registros de tramitação são de competência da Secretaria Geral.');
    }

    const parecerTratado = (parecer || '').trim();
    if (!parecerTratado) {
      throw new Error('O parecer da Comissão deve ser registrado antes de lançar a decisão.');
    }

    const supabase = createClient();

    const { data: reg, error: fetchErr } = await supabase
      .from('consagracao_registros')
      .select('id, status_processo, ministry_id, member_id, numero_processo, tipo_registro, cargo_ocupa, cargo_pretendido')
      .eq('id', processId)
      .eq('ministry_id', ministryId)
      .single();

    if (fetchErr || !reg) {
      throw new Error('Processo não encontrado ou não pertence ao ministério atual.');
    }

    if (reg.status_processo !== 'em_processo') {
      throw new Error(`Ação indisponível: o processo está com status "${reg.status_processo}" e não pode ser indeferido.`);
    }

    const { data, error } = await supabase
      .from('consagracao_registros')
      .update({
        status_processo: 'indeferir',
        observacoes: parecerTratado,
        updated_at: new Date().toISOString()
      })
      .eq('id', processId)
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

    // Registrar evento de parecer indeferido no histórico do ministro
    if (reg.member_id) {
      await registrarEventoHistoricoMinistro(supabase, ministryId, reg.member_id, {
        id: `${processId}_decisao_indeferir_${Date.now()}`,
        processo_id: processId,
        numero_processo: reg.numero_processo || '',
        tipo_evento: 'decisao_comissao',
        tipo_registro: reg.tipo_registro,
        decisao: 'indeferir',
        parecer: parecerTratado,
        status_processo: 'indeferir',
        data: new Date().toISOString().slice(0, 10),
        cargo_anterior: reg.cargo_ocupa || null,
        cargo_pretendido: reg.cargo_pretendido || null,
        descricao: `Parecer Indeferido pela Comissão de Consagração: ${parecerTratado}`,
      });
    }

    return data;
  },

  /**
   * SECRETARIA GERAL: Voltar para Em Processo (Reabertura administrativa)
   * Válido para processos Indeferidos (ou Deferidos pendentes de reanálise).
   */
  async reabrirProcessoSecretaria(
    processId: string,
    ministryId: string,
    userNivel?: string | null
  ): Promise<ConsagracaoRegistro> {
    if (userNivel === 'presidencia') {
      throw new Error('O Presidente do Ministério não possui ação operacional de tramitação no sistema.');
    }
    if (userNivel === 'supervisor') {
      throw new Error('Ação exclusiva da Secretaria Geral: a Comissão não pode reabrir processos administrativamente.');
    }

    const supabase = createClient();

    const { data: reg, error: fetchErr } = await supabase
      .from('consagracao_registros')
      .select('id, status_processo, ministry_id, member_id, numero_processo, tipo_registro, cargo_ocupa, cargo_pretendido')
      .eq('id', processId)
      .eq('ministry_id', ministryId)
      .single();

    if (fetchErr || !reg) {
      throw new Error('Processo não encontrado ou não pertence ao ministério atual.');
    }

    if (reg.status_processo === 'homologar') {
      throw new Error('Processo homologado: processos homologados não podem ser reabertos para tramitação.');
    }

    if (reg.status_processo === 'em_processo') {
      throw new Error('O processo já se encontra em processo.');
    }

    const { data, error } = await supabase
      .from('consagracao_registros')
      .update({ status_processo: 'em_processo', updated_at: new Date().toISOString() })
      .eq('id', processId)
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

    // Registrar evento de reabertura administrativa no histórico do ministro
    if (reg.member_id) {
      await registrarEventoHistoricoMinistro(supabase, ministryId, reg.member_id, {
        id: `${processId}_reabertura_${Date.now()}`,
        processo_id: processId,
        numero_processo: reg.numero_processo || '',
        tipo_evento: 'reabertura',
        tipo_registro: reg.tipo_registro,
        status_processo: 'em_processo',
        data: new Date().toISOString().slice(0, 10),
        cargo_anterior: reg.cargo_ocupa || null,
        cargo_pretendido: reg.cargo_pretendido || null,
        descricao: 'Processo reaberto administrativamente pela Secretaria Geral para Em Processo',
      });
    }

    return data;
  },

  /**
   * SECRETARIA GERAL: Homologar processo (Deferido → Homologado)
   * Utiliza a RPC transacional homologar_processo_consagracao
   */
  async homologarProcesso(
    processId: string,
    ministryId: string,
    userNivel?: string | null
  ): Promise<{ success: boolean; message?: string; alreadyHomologado?: boolean }> {
    if (userNivel === 'presidencia') {
      throw new Error('O Presidente do Ministério não possui ação operacional de homologação no sistema.');
    }
    if (userNivel === 'supervisor') {
      throw new Error('Ação exclusiva da Secretaria Geral: a Comissão não possui autorização para homologar processos.');
    }

    const supabase = createClient();

    // Valida status prévio e presença obrigatória do parecer no banco antes de invocar a RPC
    const { data: reg, error: fetchErr } = await supabase
      .from('consagracao_registros')
      .select('id, status_processo, ministry_id, member_id, numero_processo, tipo_registro, cargo_ocupa, cargo_pretendido, data_autorizacao, data_processo, observacoes')
      .eq('id', processId)
      .eq('ministry_id', ministryId)
      .single();

    if (fetchErr || !reg) {
      throw new Error('Processo não encontrado ou não pertence ao ministério atual.');
    }

    if (reg.status_processo === 'em_processo') {
      throw new Error('Processo em análise: o processo precisa ser deferido pela Comissão antes de ser homologado.');
    }

    if (reg.status_processo === 'indeferir') {
      throw new Error('Processo indeferido: processos indeferidos pela Comissão não podem ser homologados.');
    }

    if (!reg.observacoes || !reg.observacoes.trim()) {
      throw new Error('Não é possível homologar: o processo deferido não possui parecer/despacho da Comissão registrado.');
    }

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

    if (res?.success === false && res?.divergencia === true) {
      throw new Error(res.message || 'Inconsistência detectada: processo já homologado com dados ministeriais divergentes. Revise manualmente.');
    }

    // Registrar evento de homologação no histórico do ministro (com verificação de não duplicação)
    if (reg.member_id && !res?.already_homologado) {
      const cargoAnterior = reg.cargo_ocupa || 'SEM CARGO';
      const cargoResultante = reg.cargo_pretendido || reg.cargo_ocupa || '';
      const isProgressao = reg.tipo_registro === 'progressao' || reg.tipo_registro === 'existente' || reg.tipo_registro === 'ministro';
      const resultadoStr = isProgressao ? `${cargoAnterior} → ${cargoResultante}` : cargoResultante;

      await registrarEventoHistoricoMinistro(supabase, ministryId, reg.member_id, {
        id: `${processId}_homologacao`,
        processo_id: processId,
        numero_processo: reg.numero_processo || '',
        tipo_evento: 'homologacao',
        tipo_registro: reg.tipo_registro,
        status_processo: 'homologar',
        data: reg.data_autorizacao || reg.data_processo || new Date().toISOString().slice(0, 10),
        cargo_anterior: cargoAnterior,
        cargo_pretendido: reg.cargo_pretendido || null,
        cargo_resultante: cargoResultante,
        resultado: resultadoStr,
        descricao: `Homologação de Consagração concluída: ${resultadoStr}`,
      });
    }

    return {
      success: Boolean(res?.success),
      alreadyHomologado: Boolean(res?.already_homologado),
      message: res?.message || 'Processo homologado com sucesso.',
    };
  },

  /**
   * Obtém o HISTÓRICO COMPLETO do ministro agregando:
   * 1. members.custom_fields.historico_processos
   * 2. members.dados_cargos
   * 3. members.data_consagracao / cargo_ministerial
   * 4. consagracao_registros do membro no tenant (com comissão)
   *
   * Garante idempotência, sem duplicatas, ordenado do mais recente para o mais antigo.
   */
  async obterHistoricoCompletoMinistro(
    memberId: string,
    ministryId: string
  ): Promise<{
    ministro: {
      id: string;
      nome: string;
      matricula: string;
      cpf: string;
      cargo_atual: string;
      data_consagracao_atual: string | null;
      foto_url: string | null;
      congregacao_nome?: string | null;
    };
    eventos: HistoricoProcessoItem[];
  }> {
    const supabase = createClient();

    // 1. Buscar dados do membro
    const { data: member, error: memErr } = await supabase
      .from('members')
      .select('id, name, matricula, cpf, cargo_ministerial, data_consagracao, foto_url, congregacao_id, dados_cargos, custom_fields')
      .eq('id', memberId)
      .eq('ministry_id', ministryId)
      .single();

    if (memErr || !member) {
      throw new Error('Ministro não encontrado ou não pertence ao ministério atual.');
    }

    // 2. Buscar processos de consagração registrados para o membro no tenant
    const { data: processosRaw, error: procErr } = await supabase
      .from('consagracao_registros')
      .select(`
        *,
        comissao:comissoes (
          id,
          nome,
          status
        )
      `)
      .eq('member_id', memberId)
      .eq('ministry_id', ministryId)
      .order('created_at', { ascending: false });

    if (procErr) {
      console.error('Erro ao buscar processos de consagração do ministro:', procErr);
    }

    const processos = processosRaw || [];
    const processosMap = new Map<string, any>();
    processos.forEach((p: any) => {
      processosMap.set(p.id, p);
    });

    // 3. Extrair eventos de custom_fields.historico_processos
    const cf = (member.custom_fields && typeof member.custom_fields === 'object')
      ? (member.custom_fields as Record<string, any>)
      : {};

    const rawHistorico: HistoricoProcessoItem[] = Array.isArray(cf.historico_processos)
      ? [...cf.historico_processos]
      : Array.isArray(cf.historicoProcessos)
      ? [...cf.historicoProcessos]
      : [];

    const eventosMap = new Map<string, HistoricoProcessoItem>();

    // 3.1. Enriquecer eventos do custom_fields
    rawHistorico.forEach((item) => {
      const proc = item.processo_id ? processosMap.get(item.processo_id) : null;
      const key = item.id || `${item.processo_id}_${item.tipo_evento}_${item.data}`;

      eventosMap.set(key, {
        ...item,
        numero_processo: item.numero_processo || proc?.numero_processo || '',
        comissao_nome: item.comissao_nome || proc?.comissao?.nome || null,
        pastor_solicitante: item.pastor_solicitante || proc?.pastor_solicitante || null,
        parecer: item.parecer || proc?.observacoes || null,
        status_processo: item.status_processo || proc?.status_processo || null,
      });
    });

    // 3.2. Integrar processos que eventualmente não tenham gerado evento em custom_fields
    processos.forEach((proc: any) => {
      const tipoLabel = proc.tipo_registro === 'progressao' ? 'Progressão' : proc.tipo_registro === 'filiacao' ? 'Filiação' : 'Chegada';
      const comissaoNome = proc.comissao?.nome || null;
      const dataProc = proc.data_processo || proc.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);

      // Evento de Início de Processo
      const inicioKey = `${proc.id}_inicio_processo`;
      if (!eventosMap.has(inicioKey)) {
        eventosMap.set(inicioKey, {
          id: inicioKey,
          processo_id: proc.id,
          numero_processo: proc.numero_processo || '',
          ministry_id: ministryId,
          member_id: memberId,
          tipo_evento: 'inicio_processo',
          tipo_registro: proc.tipo_registro,
          data: dataProc,
          cargo_anterior: proc.cargo_ocupa || null,
          cargo_pretendido: proc.cargo_pretendido || null,
          status_processo: 'em_processo',
          comissao_nome: comissaoNome,
          pastor_solicitante: proc.pastor_solicitante || null,
          descricao: `Início do Processo de ${tipoLabel} (${proc.cargo_ocupa || 'Sem cargo anterior'} → ${proc.cargo_pretendido || 'Novo cargo'})`,
          criado_em: proc.created_at,
        });
      }

      // Evento de Decisão da Comissão (se houver deliberação deferir ou indeferir)
      if (proc.status_processo === 'deferir' || proc.status_processo === 'indeferir' || proc.status_processo === 'homologar') {
        const decisaoKey = `${proc.id}_decisao_${proc.status_processo === 'indeferir' ? 'indeferir' : 'deferir'}`;
        const existingDecisao = Array.from(eventosMap.values()).find(
          (e) => e.processo_id === proc.id && e.tipo_evento === 'decisao_comissao'
        );

        if (!existingDecisao) {
          eventosMap.set(decisaoKey, {
            id: decisaoKey,
            processo_id: proc.id,
            numero_processo: proc.numero_processo || '',
            ministry_id: ministryId,
            member_id: memberId,
            tipo_evento: 'decisao_comissao',
            tipo_registro: proc.tipo_registro,
            decisao: proc.status_processo === 'indeferir' ? 'indeferir' : 'deferir',
            status_processo: proc.status_processo,
            parecer: proc.observacoes || null,
            data: proc.data_autorizacao || proc.updated_at?.slice(0, 10) || dataProc,
            cargo_anterior: proc.cargo_ocupa || null,
            cargo_pretendido: proc.cargo_pretendido || null,
            comissao_nome: comissaoNome,
            pastor_solicitante: proc.pastor_solicitante || null,
            descricao: `Parecer ${proc.status_processo === 'indeferir' ? 'Indeferido' : 'Deferido'} pela Comissão de Consagração${proc.observacoes ? `: ${proc.observacoes}` : ''}`,
            criado_em: proc.updated_at || proc.created_at,
          });
        }
      }

      // Evento de Homologação (se homologado)
      if (proc.status_processo === 'homologar') {
        const homologacaoKey = `${proc.id}_homologacao`;
        const existingHomolog = Array.from(eventosMap.values()).find(
          (e) => e.processo_id === proc.id && e.tipo_evento === 'homologacao'
        );

        if (!existingHomolog) {
          const cargoAnterior = proc.cargo_ocupa || 'SEM CARGO';
          const cargoResultante = proc.cargo_pretendido || proc.cargo_ocupa || '';
          const isProgressao = proc.tipo_registro === 'progressao' || proc.tipo_registro === 'existente' || proc.tipo_registro === 'ministro';
          const resultadoStr = isProgressao ? `${cargoAnterior} → ${cargoResultante}` : cargoResultante;

          eventosMap.set(homologacaoKey, {
            id: homologacaoKey,
            processo_id: proc.id,
            numero_processo: proc.numero_processo || '',
            ministry_id: ministryId,
            member_id: memberId,
            tipo_evento: 'homologacao',
            tipo_registro: proc.tipo_registro,
            status_processo: 'homologar',
            data: proc.data_autorizacao || proc.data_processo || proc.updated_at?.slice(0, 10) || dataProc,
            cargo_anterior: cargoAnterior,
            cargo_pretendido: proc.cargo_pretendido || null,
            cargo_resultante: cargoResultante,
            resultado: resultadoStr,
            comissao_nome: comissaoNome,
            pastor_solicitante: proc.pastor_solicitante || null,
            parecer: proc.observacoes || null,
            descricao: `Homologação de Consagração concluída: ${resultadoStr}`,
            criado_em: proc.updated_at || proc.created_at,
          });
        }
      }
    });

    // 4. Integrar marcos de `dados_cargos` (histórico ministerial de ordenações / recebimentos)
    const dadosCargos = (member.dados_cargos && typeof member.dados_cargos === 'object')
      ? (member.dados_cargos as Record<string, any>)
      : {};

    Object.entries(dadosCargos).forEach(([cargoNome, info]: [string, any]) => {
      if (!info || typeof info !== 'object') return;
      const dataConsag = info.dataConsagracaoRecebimento || info.dataConsagracao || info.data;
      if (!dataConsag) return;

      const marcoKey = `marco_cargo_${cargoNome.trim().toUpperCase()}_${dataConsag}`;
      if (!eventosMap.has(marcoKey)) {
        eventosMap.set(marcoKey, {
          id: marcoKey,
          tipo_evento: 'marco_ministerial',
          cargo: cargoNome.trim().toUpperCase(),
          data: dataConsag,
          local: info.localConsagracao || null,
          local_origem: info.localOrigem || null,
          descricao: `Registro de Consagração / Recebimento no cargo de ${cargoNome.trim().toUpperCase()}${info.localConsagracao ? ` (${info.localConsagracao})` : ''}`,
          criado_em: dataConsag,
        });
      }
    });

    // 5. Se houver data_consagracao no cadastro e nenhum evento para o cargo atual, registrar como marco inicial
    if (member.data_consagracao && member.cargo_ministerial) {
      const cargoAtualNome = String(member.cargo_ministerial).trim().toUpperCase();
      const currentConsagData = String(member.data_consagracao).slice(0, 10);
      const marcoAtualKey = `marco_cargo_${cargoAtualNome}_${currentConsagData}`;

      if (!eventosMap.has(marcoAtualKey)) {
        const hasSimilar = Array.from(eventosMap.values()).some(
          (e) => (e.cargo_resultante === cargoAtualNome || e.cargo === cargoAtualNome) && e.data === currentConsagData
        );
        if (!hasSimilar) {
          eventosMap.set(marcoAtualKey, {
            id: marcoAtualKey,
            tipo_evento: 'marco_ministerial',
            cargo: cargoAtualNome,
            data: currentConsagData,
            descricao: `Consagração Ministerial: ${cargoAtualNome}`,
            criado_em: currentConsagData,
          });
        }
      }
    }

    // 6. Ordenar todos os eventos: Mais recente primeiro (decrescente por data e criado_em)
    const eventosOrdenados = Array.from(eventosMap.values()).sort((a, b) => {
      const dateA = a.data || a.criado_em || '';
      const dateB = b.data || b.criado_em || '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      return (b.criado_em || '').localeCompare(a.criado_em || '');
    });

    return {
      ministro: {
        id: member.id,
        nome: member.name || 'Sem nome',
        matricula: member.matricula || '-',
        cpf: member.cpf || '-',
        cargo_atual: member.cargo_ministerial || 'Não informado',
        data_consagracao_atual: member.data_consagracao ? String(member.data_consagracao).slice(0, 10) : null,
        foto_url: member.foto_url || null,
        congregacao_nome: null,
      },
      eventos: eventosOrdenados,
    };
  },
};


