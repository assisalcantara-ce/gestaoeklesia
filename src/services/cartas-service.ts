/**
 * Serviço de Regras e Governança para Cartas Ministeriais e Declarações
 * Gestão Eklésia
 */

import { isSecretariaLocal } from '@/lib/access-control';

export interface VerificacaoAutorizacaoCarta {
  exigeAutorizacao: boolean;
  autorizado: boolean;
  status: 'isento' | 'nao_solicitado' | 'pendente' | 'autorizado' | 'rejeitado';
  mensagem: string;
  pedidoId?: string | null;
  autorizadorId?: string | null;
  autorizadorNome?: string | null;
  dataAutorizacao?: string | null;
  motivoRejeicao?: string | null;
  pedido?: {
    id: string;
    ministry_id: string;
    member_id: string | null;
    membro_nome: string;
    tipo_carta: string;
    destino: string | null;
    observacoes: string | null;
    status: string;
    autorizador_id: string | null;
    autorizador_nome: string | null;
    data_autorizacao: string | null;
    motivo_rejeicao: string | null;
    created_at: string;
  } | null;
}

export interface SolicitacaoAutorizacaoCartaInput {
  ministryId: string;
  memberId: string;
  membroNome: string;
  membroCargo?: string | null;
  congregacaoId?: string | null;
  tipoCarta: string;
  destino?: string | null;
  motivo?: string | null;
  observacoes?: string | null;
  solicitanteId: string;
  solicitanteNome?: string | null;
}

export interface SolicitacaoAutorizacaoCartaResult {
  sucesso: boolean;
  jaExistente: boolean;
  pedido: any;
  mensagem: string;
}

export class CartasService {
  /**
   * Determina se o tipo de carta exige obrigatoriamente deliberação prévia da Presidência.
   * Cartas de Mudança e Desligamento são institucionais e exigem autorização da Presidência.
   */
  public static exigeAutorizacaoPresidencial(tipoCarta?: string | null): boolean {
    if (!tipoCarta) return false;
    const cleanTipo = this.normalizarTipoCarta(tipoCarta);
    return cleanTipo === 'mudanca' || cleanTipo === 'desligamento';
  }

  /**
   * Normaliza o tipo de carta a partir de aliases ou strings de template.
   */
  public static normalizarTipoCarta(tipoOuChave?: string | null): string {
    if (!tipoOuChave) return '';
    const clean = tipoOuChave.trim().toLowerCase();
    if (clean.includes('mudanca') || clean.includes('mudança')) return 'mudanca';
    if (clean.includes('desligamento')) return 'desligamento';
    if (clean.includes('transito') || clean.includes('trânsito')) return 'transito';
    if (clean.includes('recomendacao') || clean.includes('recomendação')) return 'recomendacao';
    return clean;
  }

  /**
   * Verifica no banco (tabela carta_pedidos) se há autorização presidencial válida para o membro e tipo de carta.
   */
  public static async verificarAutorizacaoCarta(
    supabase: any,
    ministryId: string,
    memberId: string | null | undefined,
    tipoCarta: string,
    membroNome?: string | null
  ): Promise<VerificacaoAutorizacaoCarta> {
    const normalTipo = this.normalizarTipoCarta(tipoCarta);

    if (!this.exigeAutorizacaoPresidencial(normalTipo)) {
      return {
        exigeAutorizacao: false,
        autorizado: true,
        status: 'isento',
        mensagem: 'Este documento não exige deliberação prévia da Presidência.',
      };
    }

    if (!ministryId || (!memberId && !membroNome)) {
      return {
        exigeAutorizacao: true,
        autorizado: false,
        status: 'nao_solicitado',
        mensagem: 'Selecione um membro para verificar a deliberação presidencial.',
      };
    }

    let pedido: any = null;

    if (memberId) {
      const { data, error } = await supabase
        .from('carta_pedidos')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('member_id', memberId)
        .eq('tipo_carta', normalTipo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Erro ao consultar autorização de carta por member_id:', error);
        throw new Error(`Erro ao verificar deliberação presidencial: ${error.message}`);
      }
      pedido = data;
    }

    if (!pedido && membroNome && membroNome.trim()) {
      const { data, error } = await supabase
        .from('carta_pedidos')
        .select('*')
        .eq('ministry_id', ministryId)
        .ilike('membro_nome', `%${membroNome.trim()}%`)
        .eq('tipo_carta', normalTipo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Erro ao consultar autorização de carta por membro_nome:', error);
        throw new Error(`Erro ao verificar deliberação presidencial: ${error.message}`);
      }
      pedido = data;
    }

    const tipoLabel = normalTipo === 'mudanca' ? 'Carta de Mudança' : 'Carta de Desligamento';

    if (!pedido) {
      return {
        exigeAutorizacao: true,
        autorizado: false,
        status: 'nao_solicitado',
        mensagem: `Não há pedido de ${tipoLabel} registrado para este membro. Registre a solicitação em "Pedidos de Cartas" para deliberação da Presidência.`,
      };
    }

    if (pedido.status === 'pendente') {
      return {
        exigeAutorizacao: true,
        autorizado: false,
        status: 'pendente',
        pedidoId: pedido.id,
        pedido,
        mensagem: `O pedido de ${tipoLabel} está pendente e aguardando deliberação da Presidência na Central de Decisões Institucionais.`,
      };
    }

    if (pedido.status === 'rejeitado') {
      const motivo = pedido.motivo_rejeicao ? ` Motivo: "${pedido.motivo_rejeicao}".` : '';
      return {
        exigeAutorizacao: true,
        autorizado: false,
        status: 'rejeitado',
        pedidoId: pedido.id,
        pedido,
        motivoRejeicao: pedido.motivo_rejeicao,
        mensagem: `O pedido desta carta foi indeferido pela Presidência.${motivo} A emissão oficial permanece bloqueada.`,
      };
    }

    if (pedido.status === 'autorizado') {
      const dataFmt = pedido.data_autorizacao
        ? new Date(pedido.data_autorizacao).toLocaleDateString('pt-BR')
        : '';
      const autorizador = pedido.autorizador_nome || 'Presidência';
      return {
        exigeAutorizacao: true,
        autorizado: true,
        status: 'autorizado',
        pedidoId: pedido.id,
        autorizadorId: pedido.autorizador_id,
        autorizadorNome: autorizador,
        dataAutorizacao: pedido.data_autorizacao,
        pedido,
        mensagem: `Carta autorizada pela Presidência por ${autorizador}${dataFmt ? ` em ${dataFmt}` : ''}. Emissão oficial liberada.`,
      };
    }

    return {
      exigeAutorizacao: true,
      autorizado: false,
      status: 'pendente',
      pedidoId: pedido.id,
      pedido,
      mensagem: `Status de autorização desconhecido (${pedido.status}). Emissão bloqueada por segurança.`,
    };
  }

  /**
   * Valida a emissão ou impressão de uma carta ministerial.
   * Lança erro explícito se a carta exigir deliberação presidencial e não estiver autorizada.
   */
  public static async validarEmissaoOuImpressaoCarta(
    supabase: any,
    ministryId: string,
    memberId: string | null | undefined,
    tipoCarta: string,
    membroNome?: string | null,
    userNivel?: string | null
  ): Promise<VerificacaoAutorizacaoCarta> {
    if (userNivel && isSecretariaLocal(userNivel)) {
      throw new Error(
        'Acesso negado: Usuários da Secretaria Local não possuem permissão para realizar emissão direta de cartas ministeriais. Registre a solicitação para deliberação da Secretaria Geral.'
      );
    }
    const auth = await this.verificarAutorizacaoCarta(supabase, ministryId, memberId, tipoCarta, membroNome);
    if (auth.exigeAutorizacao && !auth.autorizado) {
      throw new Error(`Emissão bloqueada: ${auth.mensagem}`);
    }
    return auth;
  }

  /**
   * Registra diretamente um pedido de autorização de carta ministerial para deliberação da Presidência.
   * Evita duplicidade se já houver um pedido pendente para o mesmo membro e tipo de carta.
   * Não altera o status cadastral do membro no momento do registro (apenas após deliberação presidencial).
   */
  public static async solicitarAutorizacaoCarta(
    supabase: any,
    input: SolicitacaoAutorizacaoCartaInput
  ): Promise<SolicitacaoAutorizacaoCartaResult> {
    if (!input.ministryId) {
      throw new Error('O identificador do ministério é obrigatório para registrar a solicitação.');
    }
    if (!input.memberId || !input.membroNome || !input.membroNome.trim()) {
      throw new Error('Os dados do membro destinatário são obrigatórios para registrar a solicitação.');
    }
    if (!input.solicitanteId) {
      throw new Error('Identificador do solicitante não encontrado.');
    }

    const normalTipo = this.normalizarTipoCarta(input.tipoCarta);
    if (!normalTipo) {
      throw new Error('Tipo de carta inválido para solicitação.');
    }

    const tipoLabel =
      normalTipo === 'mudanca'
        ? 'Carta de Mudança'
        : normalTipo === 'desligamento'
        ? 'Carta de Desligamento'
        : normalTipo === 'transito'
        ? 'Carta de Trânsito'
        : 'Carta de Recomendação';

    // 1. Verificação de Duplicidade: impede criar novo pedido se já houver um pendente
    const { data: pedidoExistente, error: errExistente } = await supabase
      .from('carta_pedidos')
      .select('*')
      .eq('ministry_id', input.ministryId)
      .eq('member_id', input.memberId)
      .eq('tipo_carta', normalTipo)
      .eq('status', 'pendente')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (errExistente) {
      console.error('Erro ao verificar duplicidade de pedido de carta:', errExistente);
      throw new Error(`Erro ao verificar pedidos existentes: ${errExistente.message}`);
    }

    if (pedidoExistente) {
      const destinoCentral = this.exigeAutorizacaoPresidencial(normalTipo)
        ? 'na Central de Decisões da Presidência'
        : 'para deliberação institucional';
      return {
        sucesso: true,
        jaExistente: true,
        pedido: pedidoExistente,
        mensagem: `Já existe um pedido de ${tipoLabel} pendente de análise para ${input.membroNome.trim()} ${destinoCentral}.`,
      };
    }

    // 2. Formatação das observações integrando motivo e observações preenchidas
    const motivoTrim = (input.motivo || '').trim();
    const obsTrim = (input.observacoes || '').trim();
    let observacoesFinal: string | null = null;
    if (motivoTrim && obsTrim) {
      observacoesFinal = `Motivo: ${motivoTrim}\nObservações: ${obsTrim}`;
    } else if (motivoTrim) {
      observacoesFinal = motivoTrim;
    } else if (obsTrim) {
      observacoesFinal = obsTrim;
    }

    // 3. Inserção do pedido na tabela carta_pedidos
    const { data: novoPedido, error: insertErr } = await supabase
      .from('carta_pedidos')
      .insert({
        ministry_id: input.ministryId,
        congregacao_id: input.congregacaoId || null,
        solicitante_id: input.solicitanteId,
        solicitante_nome: input.solicitanteNome || 'Secretaria',
        member_id: input.memberId,
        membro_nome: input.membroNome.trim(),
        membro_cargo: (input.membroCargo || '').trim() || null,
        tipo_carta: normalTipo,
        destino: (input.destino || '').trim() || null,
        observacoes: observacoesFinal,
        status: 'pendente',
      })
      .select('*')
      .single();

    if (insertErr) {
      console.error('Erro ao inserir pedido de carta:', insertErr);
      throw new Error(`Falha ao registrar pedido de carta: ${insertErr.message}`);
    }

    return {
      sucesso: true,
      jaExistente: false,
      pedido: novoPedido,
      mensagem: this.exigeAutorizacaoPresidencial(normalTipo)
        ? `Pedido de ${tipoLabel} encaminhado com sucesso à Presidência!`
        : `Pedido de ${tipoLabel} registrado com sucesso para análise da Secretaria Geral!`,
    };
  }

  public static normalizarStatusDb(status: string | null | undefined): string | null {
    if (!status) return null;
    const lower = String(status).toLowerCase();
    if (lower === 'ativo' || lower === 'active') return 'active';
    if (lower === 'inativo' || lower === 'inactive') return 'inactive';
    return lower;
  }

  /**
   * Registra um evento no histórico cadastral do membro (members.custom_fields.historico_processos)
   * com garantia de idempotência, preservação de eventos anteriores e compatibilidade snake_case/camelCase.
   */
  public static async registrarEventoHistoricoMembro(
    supabase: any,
    input: EventoHistoricoMembroInput
  ): Promise<{ sucesso: boolean; eventoId: string; jaRegistrado: boolean }> {
    if (!input.memberId || !input.ministryId) {
      throw new Error('Parâmetros obrigatórios ausentes para registrar histórico do membro.');
    }

    const nowIso = input.dataHora || new Date().toISOString();
    const eventoId = input.documentoId
      ? `doc_${input.documentoId}_${input.tipoEvento}`
      : input.pedidoId
      ? `delib_${input.pedidoId}_${input.tipoEvento}`
      : `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    // 1. Tenta executar via RPC no PostgreSQL
    if (typeof supabase?.rpc === 'function') {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('registrar_evento_historico_membro', {
          p_ministry_id: input.ministryId,
          p_member_id: input.memberId,
          p_tipo_evento: input.tipoEvento,
          p_tipo_documento: input.tipoDocumento || null,
          p_evento_id: eventoId,
          p_pedido_id: input.pedidoId || null,
          p_documento_id: input.documentoId || null,
          p_numero_documento: input.numeroDocumento || null,
          p_novo_status_membro: input.novoStatusMembro ? this.normalizarStatusDb(input.novoStatusMembro) : null,
          p_motivo: input.motivo || input.destino || null,
          p_destino: input.destino || null,
          p_observacoes: input.observacoes || null,
          p_responsavel: input.responsavel || 'Presidência',
          p_usuario_id: input.usuarioId || null,
          p_descricao: input.descricao || null,
        });

        if (rpcErr) {
          const msg = String(rpcErr.message || '').toLowerCase();
          const code = String(rpcErr.code || '');
          const isNotInstalled =
            code === 'PGRST202' ||
            msg.includes('could not find the function') ||
            msg.includes('não encontrada') ||
            msg.includes('não instalada');

          if (!isNotInstalled) {
            throw new Error(rpcErr.message);
          }
        } else if (rpcData && rpcData.sucesso) {
          return {
            sucesso: true,
            eventoId: rpcData.evento_id || eventoId,
            jaRegistrado: Boolean(rpcData.ja_registrado),
          };
        }
      } catch (err: any) {
        const msg = String(err?.message || '').toLowerCase();
        const isNotInstalled =
          msg.includes('could not find the function') ||
          msg.includes('não encontrada') ||
          msg.includes('não instalada');

        if (!isNotInstalled) {
          throw err;
        }
      }
    }

    // 2. Fallback via PostgREST direto (compatível com schema sem is_active)
    const { data: member, error: fetchErr } = await supabase
      .from('members')
      .select('id, name, status, custom_fields')
      .eq('id', input.memberId)
      .eq('ministry_id', input.ministryId)
      .maybeSingle();

    if (fetchErr) {
      throw new Error(`Erro ao consultar membro para histórico: ${fetchErr.message}`);
    }

    if (!member) {
      throw new Error('Membro não encontrado ou pertencente a outro ministério.');
    }

    const cf = (member.custom_fields && typeof member.custom_fields === 'object')
      ? { ...member.custom_fields }
      : {};

    const historicoAtual: any[] = Array.isArray(cf.historico_processos)
      ? [...cf.historico_processos]
      : Array.isArray(cf.historicoProcessos)
      ? [...cf.historicoProcessos]
      : [];

    // Verificação estrita de idempotência: impede duplicidade de registros
    const exists = historicoAtual.some((h) => {
      if (h.id === eventoId) return true;
      if (input.documentoId && h.documento_id === input.documentoId && h.tipo_evento === input.tipoEvento) {
        return true;
      }
      if (input.pedidoId && h.pedido_id === input.pedidoId && h.tipo_evento === input.tipoEvento) {
        return true;
      }
      return false;
    });

    if (exists) {
      // Se já existe e há solicitação de atualização de status do membro, garante que o status está alinhado
      const dbStatus = this.normalizarStatusDb(input.novoStatusMembro);
      if (dbStatus && member.status !== dbStatus) {
        await supabase
          .from('members')
          .update({
            status: dbStatus,
            updated_at: nowIso,
          })
          .eq('id', input.memberId)
          .eq('ministry_id', input.ministryId);
      }
      return { sucesso: true, eventoId, jaRegistrado: true };
    }

    const dbNovoStatus = this.normalizarStatusDb(input.novoStatusMembro);
    const statusResultante = input.statusResultante
      ? this.normalizarStatusDb(input.statusResultante)
      : dbNovoStatus || member.status || null;

    const novoItem = {
      id: eventoId,
      processo_id: input.processoId || input.pedidoId || input.documentoId || null,
      pedido_id: input.pedidoId || null,
      documento_id: input.documentoId || null,
      numero_documento: input.numeroDocumento || null,
      ministry_id: input.ministryId,
      member_id: input.memberId,
      tipo_evento: input.tipoEvento,
      tipo_documento: input.tipoDocumento || null,
      data: input.data || nowIso.slice(0, 10),
      data_hora: nowIso,
      status_anterior: member.status || null,
      status_resultante: statusResultante,
      motivo: input.motivo || input.destino || null,
      destino: input.destino || null,
      observacoes: input.observacoes || null,
      responsavel: input.responsavel || 'Sistema',
      usuario_id: input.usuarioId || null,
      descricao: input.descricao || `Registro de ${input.tipoDocumento || input.tipoEvento}.`,
      criado_em: nowIso,
    };

    const nextHistorico = [...historicoAtual, novoItem];

    const updatePayload: Record<string, any> = {
      custom_fields: {
        ...cf,
        historico_processos: nextHistorico,
        historicoProcessos: nextHistorico,
      },
      updated_at: nowIso,
    };

    if (dbNovoStatus) {
      updatePayload.status = dbNovoStatus;
    }

    const { error: upErr } = await supabase
      .from('members')
      .update(updatePayload)
      .eq('id', input.memberId)
      .eq('ministry_id', input.ministryId);

    if (upErr) {
      throw new Error(`Falha ao registrar histórico do membro: ${upErr.message}`);
    }

    return { sucesso: true, eventoId, jaRegistrado: false };
  }

  /**
   * Aplica o efeito institucional da deliberação da Presidência:
   * - Quando autorizado para mudança ou desligamento, inativa automaticamente o membro
   *   e grava o evento com todos os metadados no histórico individual.
   */
  public static async aplicarEfeitoDeliberacaoPresidencial(
    supabase: any,
    params: {
      memberId: string;
      ministryId: string;
      pedido: {
        id: string;
        tipo_carta: string;
        destino?: string | null;
        observacoes?: string | null;
        autorizador_nome?: string | null;
        autorizador_id?: string | null;
        data_autorizacao?: string | null;
      };
      usuario: {
        userId: string;
        userName: string;
      };
    }
  ): Promise<{ inativado: boolean; eventoId?: string }> {
    const { memberId, ministryId, pedido, usuario } = params;
    const normalTipo = this.normalizarTipoCarta(pedido.tipo_carta);

    if (!this.exigeAutorizacaoPresidencial(normalTipo)) {
      return { inativado: false };
    }

    const tipoDoc = normalTipo === 'mudanca' ? 'Carta de Mudança' : 'Carta de Desligamento';
    const tipoEvt = normalTipo === 'mudanca' ? 'carta_mudanca' : 'carta_desligamento';
    const desc = normalTipo === 'mudanca'
      ? `Carta de Mudança autorizada pela Presidência${pedido.destino ? ` para ${pedido.destino}` : ''}. Membro inativado no rol.`
      : `Carta de Desligamento autorizada pela Presidência. Membro inativado no rol.`;

    const res = await this.registrarEventoHistoricoMembro(supabase, {
      memberId,
      ministryId,
      tipoEvento: tipoEvt,
      tipoDocumento: tipoDoc,
      pedidoId: pedido.id,
      processoId: pedido.id,
      data: pedido.data_autorizacao ? pedido.data_autorizacao.slice(0, 10) : new Date().toISOString().slice(0, 10),
      dataHora: pedido.data_autorizacao || new Date().toISOString(),
      novoStatusMembro: 'inactive',
      statusResultante: 'inactive',
      motivo: pedido.destino || 'Autorizado pela Presidência',
      destino: pedido.destino || null,
      observacoes: pedido.observacoes || null,
      responsavel: usuario.userName || pedido.autorizador_nome || 'Presidência',
      usuarioId: usuario.userId || pedido.autorizador_id || null,
      descricao: desc,
    });

    return { inativado: true, eventoId: res.eventoId };
  }

  /**
   * Registra a emissão de documento (carta, declaração, ofício) no histórico individual do membro.
   * Não altera o status do membro (não inativa).
   */
  public static async registrarEmissaoDocumentoNoHistoricoMembro(
    supabase: any,
    params: {
      memberId: string;
      ministryId: string;
      documentoId: string;
      tipoDocumento: string;
      categoria?: string | null;
      tipoCarta?: string | null;
      motivo?: string | null;
      destino?: string | null;
      observacoes?: string | null;
      usuarioNome: string;
      usuarioId?: string | null;
    }
  ): Promise<{ sucesso: boolean; eventoId: string }> {
    const {
      memberId,
      ministryId,
      documentoId,
      tipoDocumento,
      motivo,
      destino,
      observacoes,
      usuarioNome,
      usuarioId,
      tipoCarta,
    } = params;

    let tipoEvento: any = 'documento_emitido';
    const normalTipo = tipoCarta ? this.normalizarTipoCarta(tipoCarta) : null;
    if (normalTipo === 'transito') {
      tipoEvento = 'carta_transito';
    } else if (normalTipo === 'mudanca') {
      tipoEvento = 'carta_mudanca';
    } else if (normalTipo === 'desligamento') {
      tipoEvento = 'carta_desligamento';
    } else if (normalTipo === 'recomendacao') {
      tipoEvento = 'carta_recomendacao';
    }

    const desc = `Emissão oficial de ${tipoDocumento}${destino ? ` para ${destino}` : ''}.`;

    const res = await this.registrarEventoHistoricoMembro(supabase, {
      memberId,
      ministryId,
      tipoEvento,
      tipoDocumento,
      documentoId,
      processoId: documentoId,
      motivo: motivo || destino || null,
      destino: destino || null,
      observacoes: observacoes || null,
      responsavel: usuarioNome,
      usuarioId: usuarioId || null,
      descricao: desc,
      novoStatusMembro: null, // NÃO inativa o membro!
    });

    return { sucesso: res.sucesso, eventoId: res.eventoId };
  }

  /**
   * Reativa um membro inativo, preservando integralmente todo o histórico anterior
   * e registrando um novo evento de reativação com responsável e motivo.
   */
  public static async reativarMembro(
    supabase: any,
    params: {
      memberId: string;
      ministryId: string;
      usuarioNome: string;
      usuarioId?: string | null;
      motivo?: string | null;
      observacoes?: string | null;
    }
  ): Promise<{ sucesso: boolean; eventoId: string }> {
    const { memberId, ministryId, usuarioNome, usuarioId, motivo, observacoes } = params;

    const res = await this.registrarEventoHistoricoMembro(supabase, {
      memberId,
      ministryId,
      tipoEvento: 'reativacao',
      tipoDocumento: 'Reativação Cadastral',
      statusResultante: 'active',
      novoStatusMembro: 'active',
      motivo: motivo || 'Reativação de membro no rol de membros ativos',
      observacoes: observacoes || null,
      responsavel: usuarioNome,
      usuarioId: usuarioId || null,
      descricao: `Membro reativado e retornado ao rol de membros ativos. Motivo: ${motivo || 'Reativação cadastral autorizada'}.`,
    });

    return { sucesso: res.sucesso, eventoId: res.eventoId };
  }

  /**
   * Valida arquivo de imagem para inserção em cartas ministeriais e modelos de documentos.
   * Regras: aceita somente JPG/JPEG, PNG e WebP, com tamanho máximo de 2 MB.
   */
  public static validarArquivoImagemCarta(file?: { type?: string; size: number } | null): {
    valido: boolean;
    erro?: string;
  } {
    if (!file) {
      return { valido: false, erro: 'Nenhum arquivo de imagem foi fornecido.' };
    }
    const formatosPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
    const tipo = (file.type || '').toLowerCase();
    if (!tipo || !formatosPermitidos.includes(tipo)) {
      return {
        valido: false,
        erro: 'Formato de imagem inválido. Selecione um arquivo JPG, PNG ou WebP.',
      };
    }
    const maxBytes = 2 * 1024 * 1024; // 2 MB
    if (file.size > maxBytes) {
      return {
        valido: false,
        erro: 'O arquivo selecionado excede o limite máximo permitido de 2 MB.',
      };
    }
    return { valido: true };
  }

  /**
   * Exclui um registro de documento emitido (cartas_registros).
   * Garante validação de parâmetros e isolamento multi-tenant por ministry_id.
   */
  public static async excluirCartaEmitida(
    supabase: any,
    params: {
      registroId: string;
      ministryId: string;
    }
  ): Promise<{ sucesso: boolean; id: string }> {
    const { registroId, ministryId } = params;

    if (!registroId || !ministryId) {
      throw new Error('ID do registro e ID do ministério são obrigatórios para exclusão.');
    }

    const { error, data } = await supabase
      .from('cartas_registros')
      .delete()
      .eq('id', registroId)
      .eq('ministry_id', ministryId)
      .select('id');

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error('Registro não encontrado ou você não tem permissão para excluí-lo.');
    }

    return { sucesso: true, id: data[0]?.id || registroId };
  }
}

export interface EventoHistoricoMembroInput {
  memberId: string;
  ministryId: string;
  tipoEvento: string;
  tipoDocumento?: string | null;
  numeroDocumento?: string | null;
  processoId?: string | null;
  documentoId?: string | null;
  pedidoId?: string | null;
  data?: string | null;
  dataHora?: string | null;
  statusAnterior?: string | null;
  statusResultante?: string | null;
  motivo?: string | null;
  destino?: string | null;
  observacoes?: string | null;
  responsavel?: string | null;
  usuarioId?: string | null;
  descricao?: string | null;
  novoStatusMembro?: 'ativo' | 'inativo' | 'active' | 'inactive' | null;
}
