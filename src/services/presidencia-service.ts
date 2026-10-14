import { DirigentesService, type UserContextAuth } from './dirigentes-service';
import { CartasService } from './cartas-service';
import type { DirigenteMovimentacao } from '@/types/dirigentes';

export type ProcessoOrigem = 'dirigente_movimentacao' | 'carta_pedido';
export type ProcessoCategoria =
  | 'dirigente'
  | 'carta_mudanca'
  | 'carta_desligamento'
  | 'carta_transito'
  | 'carta_recomendacao';

export interface ProcessoDecisao {
  id: string;
  origem: ProcessoOrigem;
  tipoCategoria: ProcessoCategoria;
  tipoLabel: string;
  pessoaNome: string;
  pessoaCargo?: string | null;
  pessoaCpf?: string | null;
  pessoaMatricula?: string | null;
  pessoaId?: string | null;
  congregacaoId?: string | null;
  congregacaoNome: string;
  origemNome?: string | null;
  destinoNome?: string | null;
  solicitanteNome?: string | null;
  solicitanteId?: string | null;
  dataSolicitacao: string;
  dataPrevista?: string | null;
  motivoOuDescricao?: string | null;
  observacoes?: string | null;
  status:
    | 'proposta'
    | 'aprovada'
    | 'pendente'
    | 'efetivada'
    | 'autorizado'
    | 'rejeitada'
    | 'rejeitado';
  statusLabel: string;
  statusBadge: {
    bg: string;
    text: string;
    border: string;
  };
  acaoRequerida:
    | 'Deliberar Proposta'
    | 'Efetivar Posse'
    | 'Autorizar / Assinar Carta'
    | 'Concluído'
    | 'Indeferido';
  requerTermoPatrimonial?: boolean;
  statusConferenciaPatrimonial?: string;
  divergenciasPatrimoniais?: string | null;
  detalhesRaw: any;
}

export interface PresidenciaResumo {
  totalPendencias: number;
  dirigentesPropostas: number;
  dirigentesAprovadosAguardandoPosse: number;
  cartasMudanca: number;
  cartasDesligamento: number;
  outrasCartas: number;
  totalLiderancasAtivas: number;
}

export interface DeliberarCartaInput {
  pedido_id: string;
  decisao: 'autorizar' | 'rejeitar';
  motivo_rejeicao?: string;
}

export class PresidenciaService {
  /**
   * Verifica se o usuário tem autoridade presidencial ou administrativa.
   */
  public static isPresidenciaOuAdmin(user: UserContextAuth): boolean {
    if (user.isAdmin) return true;
    const n = user.nivel;
    return n === 'administrador' || n === 'presidencia';
  }

  /**
   * Valida isolamento multi-tenant
   */
  public static validarTenant(userMinistryId: string, targetMinistryId: string): void {
    if (!userMinistryId || !targetMinistryId || userMinistryId !== targetMinistryId) {
      throw new Error('Violação de segurança multi-tenant: Inconsistência de identificação do ministério.');
    }
  }

  /**
   * Carrega a Fila Unificada de Decisões e os Indicadores de Pendências da Presidência.
   * Consulta apenas o ministério autenticado (isolamento estrito multi-tenant).
   */
  public static async carregarCentralDecisoes(
    supabase: any,
    ministryId: string
  ): Promise<{
    fila: ProcessoDecisao[];
    resumo: PresidenciaResumo;
  }> {
    if (!ministryId) {
      return {
        fila: [],
        resumo: {
          totalPendencias: 0,
          dirigentesPropostas: 0,
          dirigentesAprovadosAguardandoPosse: 0,
          cartasMudanca: 0,
          cartasDesligamento: 0,
          outrasCartas: 0,
          totalLiderancasAtivas: 0,
        },
      };
    }

    // 1. Busca congregações para de-para de nomes
    const { data: congs } = await supabase
      .from('congregacoes')
      .select('id, nome')
      .eq('ministry_id', ministryId);

    const mapCongs = new Map<string, string>();
    (congs || []).forEach((c: { id: string; nome: string }) => {
      mapCongs.set(c.id, c.nome);
    });

    // 2. Busca movimentações de dirigentes pendentes de deliberação ('proposta') ou posse ('aprovada')
    const { data: movs, error: movsErr } = await supabase
      .from('dirigentes_movimentacoes')
      .select('*')
      .eq('ministry_id', ministryId)
      .in('status', ['proposta', 'aprovada'])
      .order('created_at', { ascending: false });

    if (movsErr) {
      console.error('Erro ao carregar movimentações de dirigentes na Presidência:', movsErr);
    }

    // 3. Busca pedidos de cartas pendentes de autorização ('pendente')
    const { data: cartas, error: cartasErr } = await supabase
      .from('carta_pedidos')
      .select('*')
      .eq('ministry_id', ministryId)
      .eq('status', 'pendente')
      .order('created_at', { ascending: false });

    if (cartasErr) {
      console.error('Erro ao carregar pedidos de cartas na Presidência:', cartasErr);
    }

    // 4. Busca total de lideranças ativas no ministério
    const { count: totalAtivas } = await supabase
      .from('dirigentes_designacoes')
      .select('id', { count: 'exact', head: true })
      .eq('ministry_id', ministryId)
      .eq('status', 'ativo');

    // 5. Montagem da Fila Unificada
    const fila: ProcessoDecisao[] = [];

    (movs || []).forEach((m: DirigenteMovimentacao) => {
      const congDestinoNome = mapCongs.get(m.congregacao_destino_id) || 'Congregação Destino';
      const congOrigemNome = m.congregacao_origem_id
        ? mapCongs.get(m.congregacao_origem_id) || 'Origem'
        : null;

      const isProposta = m.status === 'proposta';
      const statusLabel = isProposta
        ? 'Proposta em Análise'
        : 'Aprovada — Aguardando Efetivação';
      const acaoRequerida = isProposta ? 'Deliberar Proposta' : 'Efetivar Posse';
      const statusBadge = isProposta
        ? { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' }
        : { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-300' };

      fila.push({
        id: m.id,
        origem: 'dirigente_movimentacao',
        tipoCategoria: 'dirigente',
        tipoLabel: 'Mudança de Dirigente',
        pessoaNome: m.dirigente_novo_nome,
        pessoaCargo: m.dirigente_novo_cargo,
        pessoaCpf: m.dirigente_novo_cpf,
        pessoaMatricula: m.dirigente_novo_matricula,
        pessoaId: m.dirigente_novo_member_id,
        congregacaoId: m.congregacao_destino_id,
        congregacaoNome: congDestinoNome,
        origemNome: congOrigemNome,
        destinoNome: congDestinoNome,
        solicitanteNome: m.solicitante_nome,
        solicitanteId: m.solicitante_user_id,
        dataSolicitacao: m.created_at,
        dataPrevista: m.data_prevista,
        motivoOuDescricao: m.motivo,
        observacoes: m.observacoes,
        status: m.status as any,
        statusLabel,
        statusBadge,
        acaoRequerida,
        requerTermoPatrimonial: m.requer_termo_patrimonial,
        statusConferenciaPatrimonial: m.status_conferencia_patrimonial,
        divergenciasPatrimoniais: m.divergencias_patrimoniais,
        detalhesRaw: m,
      });
    });

    (cartas || []).forEach((c: any) => {
      const congNome = c.congregacao_id
        ? mapCongs.get(c.congregacao_id) || 'Congregação Local'
        : 'Sede Geral';

      let tipoLabel = 'Carta Ministerial';
      let tipoCategoria: ProcessoCategoria = 'carta_recomendacao';

      if (c.tipo_carta === 'mudanca') {
        tipoLabel = 'Carta Ministerial de Mudança';
        tipoCategoria = 'carta_mudanca';
      } else if (c.tipo_carta === 'desligamento') {
        tipoLabel = 'Carta Ministerial de Desligamento';
        tipoCategoria = 'carta_desligamento';
      } else if (c.tipo_carta === 'transito') {
        tipoLabel = 'Carta de Trânsito';
        tipoCategoria = 'carta_transito';
      } else {
        tipoLabel = 'Carta de Recomendação';
        tipoCategoria = 'carta_recomendacao';
      }

      fila.push({
        id: c.id,
        origem: 'carta_pedido',
        tipoCategoria,
        tipoLabel,
        pessoaNome: c.membro_nome,
        pessoaCargo: c.membro_cargo,
        pessoaId: c.member_id,
        congregacaoId: c.congregacao_id,
        congregacaoNome: congNome,
        destinoNome: c.destino || null,
        solicitanteNome: c.solicitante_nome,
        solicitanteId: c.solicitante_id,
        dataSolicitacao: c.created_at,
        motivoOuDescricao: c.observacoes || null,
        observacoes: c.observacoes || null,
        status: 'pendente',
        statusLabel: 'Aguardando Decisão Presidencial',
        statusBadge: {
          bg: 'bg-amber-50',
          text: 'text-amber-800',
          border: 'border-amber-300',
        },
        acaoRequerida: 'Autorizar / Assinar Carta',
        detalhesRaw: c,
      });
    });

    // Ordena fila: propostas mais recentes primeiro
    fila.sort((a, b) => new Date(b.dataSolicitacao).getTime() - new Date(a.dataSolicitacao).getTime());

    // 6. Contagem dos Indicadores
    const dirigentesPropostas = (movs || []).filter((m: DirigenteMovimentacao) => m.status === 'proposta').length;
    const dirigentesAprovadosAguardandoPosse = (movs || []).filter((m: DirigenteMovimentacao) => m.status === 'aprovada').length;
    const cartasMudanca = (cartas || []).filter((c: any) => c.tipo_carta === 'mudanca').length;
    const cartasDesligamento = (cartas || []).filter((c: any) => c.tipo_carta === 'desligamento').length;
    const outrasCartas = (cartas || []).filter(
      (c: any) => c.tipo_carta !== 'mudanca' && c.tipo_carta !== 'desligamento'
    ).length;

    const resumo: PresidenciaResumo = {
      totalPendencias: fila.length,
      dirigentesPropostas,
      dirigentesAprovadosAguardandoPosse,
      cartasMudanca,
      cartasDesligamento,
      outrasCartas,
      totalLiderancasAtivas: Number(totalAtivas || 0),
    };

    return { fila, resumo };
  }

  /**
   * Carrega histórico de deliberações já concluídas pela Presidência.
   */
  public static async carregarHistoricoDecisoes(
    supabase: any,
    ministryId: string,
    limite = 40
  ): Promise<ProcessoDecisao[]> {
    if (!ministryId) return [];

    const { data: congs } = await supabase
      .from('congregacoes')
      .select('id, nome')
      .eq('ministry_id', ministryId);

    const mapCongs = new Map<string, string>();
    (congs || []).forEach((c: { id: string; nome: string }) => {
      mapCongs.set(c.id, c.nome);
    });

    const [movsRes, cartasRes] = await Promise.all([
      supabase
        .from('dirigentes_movimentacoes')
        .select('*')
        .eq('ministry_id', ministryId)
        .in('status', ['efetivada', 'rejeitada'])
        .order('updated_at', { ascending: false })
        .limit(limite),
      supabase
        .from('carta_pedidos')
        .select('*')
        .eq('ministry_id', ministryId)
        .in('status', ['autorizado', 'rejeitado'])
        .order('updated_at', { ascending: false })
        .limit(limite),
    ]);

    const historico: ProcessoDecisao[] = [];

    (movsRes.data || []).forEach((m: DirigenteMovimentacao) => {
      const congDestino = mapCongs.get(m.congregacao_destino_id) || 'Congregação Destino';
      const isEfetivada = m.status === 'efetivada';

      historico.push({
        id: m.id,
        origem: 'dirigente_movimentacao',
        tipoCategoria: 'dirigente',
        tipoLabel: 'Mudança de Dirigente',
        pessoaNome: m.dirigente_novo_nome,
        pessoaCargo: m.dirigente_novo_cargo,
        pessoaCpf: m.dirigente_novo_cpf,
        pessoaMatricula: m.dirigente_novo_matricula,
        pessoaId: m.dirigente_novo_member_id,
        congregacaoId: m.congregacao_destino_id,
        congregacaoNome: congDestino,
        destinoNome: congDestino,
        solicitanteNome: m.solicitante_nome,
        dataSolicitacao: m.created_at,
        dataPrevista: m.data_efetiva || m.data_prevista,
        motivoOuDescricao: m.motivo,
        observacoes: m.justificativa_aprovacao_rejeicao || m.observacoes,
        status: m.status as any,
        statusLabel: isEfetivada ? 'Efetivada / Posse Homologada' : 'Indeferida / Rejeitada',
        statusBadge: isEfetivada
          ? { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-300' }
          : { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-300' },
        acaoRequerida: isEfetivada ? 'Concluído' : 'Indeferido',
        detalhesRaw: m,
      });
    });

    (cartasRes.data || []).forEach((c: any) => {
      const congNome = c.congregacao_id
        ? mapCongs.get(c.congregacao_id) || 'Congregação Local'
        : 'Sede Geral';
      const isAutorizado = c.status === 'autorizado';

      let tipoLabel = 'Carta Ministerial';
      let tipoCategoria: ProcessoCategoria = 'carta_recomendacao';
      if (c.tipo_carta === 'mudanca') {
        tipoLabel = 'Carta Ministerial de Mudança';
        tipoCategoria = 'carta_mudanca';
      } else if (c.tipo_carta === 'desligamento') {
        tipoLabel = 'Carta Ministerial de Desligamento';
        tipoCategoria = 'carta_desligamento';
      } else if (c.tipo_carta === 'transito') {
        tipoLabel = 'Carta de Trânsito';
        tipoCategoria = 'carta_transito';
      }

      historico.push({
        id: c.id,
        origem: 'carta_pedido',
        tipoCategoria,
        tipoLabel,
        pessoaNome: c.membro_nome,
        pessoaCargo: c.membro_cargo,
        pessoaId: c.member_id,
        congregacaoId: c.congregacao_id,
        congregacaoNome: congNome,
        destinoNome: c.destino,
        solicitanteNome: c.solicitante_nome,
        dataSolicitacao: c.created_at,
        motivoOuDescricao: c.observacoes || c.motivo_rejeicao || null,
        observacoes: c.motivo_rejeicao || null,
        status: c.status,
        statusLabel: isAutorizado ? 'Autorizada / Assinada' : 'Indeferida / Rejeitada',
        statusBadge: isAutorizado
          ? { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-300' }
          : { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-300' },
        acaoRequerida: isAutorizado ? 'Concluído' : 'Indeferido',
        detalhesRaw: c,
      });
    });

    historico.sort(
      (a, b) =>
        new Date(b.detalhesRaw.updated_at || b.dataSolicitacao).getTime() -
        new Date(a.detalhesRaw.updated_at || a.dataSolicitacao).getTime()
    );

    return historico.slice(0, limite);
  }

  /**
   * Delibera uma proposta de movimentação de dirigente (Aprovação ou Rejeição formal).
   */
  public static async deliberarPropostaDirigente(
    supabase: any,
    user: UserContextAuth,
    params: {
      movimentacaoId: string;
      decisao: 'aprovar' | 'rejeitar';
      justificativa?: string;
    }
  ): Promise<DirigenteMovimentacao> {
    if (!this.isPresidenciaOuAdmin(user)) {
      throw new Error('Acesso negado: Somente a Presidência ou Administrador podem deliberar propostas de liderança.');
    }

    if (params.decisao === 'aprovar') {
      return await DirigentesService.aprovarProposta(supabase, user, {
        movimentacao_id: params.movimentacaoId,
        justificativa: params.justificativa,
      });
    } else {
      if (!params.justificativa || !params.justificativa.trim()) {
        throw new Error('O motivo da rejeição da proposta é obrigatório.');
      }
      return await DirigentesService.rejeitarProposta(
        supabase,
        user,
        params.movimentacaoId,
        params.justificativa.trim()
      );
    }
  }

  /**
   * Efetiva a posse da liderança e injeta no histórico ministerial individual dos obreiros.
   */
  public static async efetivarPosseDirigente(
    supabase: any,
    user: UserContextAuth,
    params: {
      movimentacaoId: string;
      dataEfetiva: string;
      divergenciasPatrimoniais?: string;
      observacoes?: string;
    }
  ): Promise<{ movimentacao: DirigenteMovimentacao; novaDesignacao: any }> {
    if (!this.isPresidenciaOuAdmin(user)) {
      throw new Error('Acesso negado: Somente a Presidência ou Administrador podem efetivar a posse de dirigentes.');
    }

    return await DirigentesService.efetivarMovimentacao(supabase, user, {
      movimentacao_id: params.movimentacaoId,
      data_efetiva: params.dataEfetiva,
      divergencias_patrimoniais: params.divergenciasPatrimoniais,
      observacoes: params.observacoes,
    });
  }

  /**
   * Delibera formalmente um pedido de carta ministerial (Autorização ou Rejeição).
   */
  public static async deliberarCartaPedido(
    supabase: any,
    user: UserContextAuth,
    input: DeliberarCartaInput
  ): Promise<any> {
    if (!this.isPresidenciaOuAdmin(user)) {
      throw new Error('Acesso negado: Somente a Presidência ou Administrador podem autorizar ou rejeitar cartas ministeriais.');
    }

    if (!input.pedido_id) {
      throw new Error('Identificador do pedido de carta é obrigatório.');
    }

    // 1. Tenta executar de forma 100% atômica no PostgreSQL via RPC transacional
    if (typeof supabase?.rpc === 'function') {
      try {
        const { data: rpcResult, error: rpcError } = await supabase.rpc('deliberar_carta_presidencia_rpc', {
        p_pedido_id: input.pedido_id,
        p_ministry_id: user.ministryId,
        p_decisao: input.decisao,
        p_motivo_rejeicao: input.motivo_rejeicao || null,
        p_autorizador_id: user.userId,
        p_autorizador_nome: user.userName,
      });

      if (rpcError) {
        const msg = String(rpcError.message || '').toLowerCase();
        const code = String(rpcError.code || '');
        const isNotInstalled =
          code === 'PGRST202' ||
          msg.includes('could not find the function') ||
          msg.includes('não encontrada') ||
          msg.includes('não instalada');

        if (!isNotInstalled) {
          throw new Error(rpcError.message);
        }
      } else if (rpcResult && rpcResult.sucesso) {
        const { data: pedidoAtualizado } = await supabase
          .from('carta_pedidos')
          .select('*')
          .eq('id', input.pedido_id)
          .eq('ministry_id', user.ministryId)
          .maybeSingle();

        return pedidoAtualizado || rpcResult;
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

    // 2. Fallback lógico resiliente (compensação de consistência)
    // Valida tenant
    const { data: pedido, error: findErr } = await supabase
      .from('carta_pedidos')
      .select('*')
      .eq('id', input.pedido_id)
      .eq('ministry_id', user.ministryId)
      .maybeSingle();

    if (findErr || !pedido) {
      throw new Error('Pedido de carta não encontrado ou pertencente a outro ministério.');
    }

    if (pedido.status !== 'pendente') {
      throw new Error(`Este pedido de carta já se encontra ${pedido.status}.`);
    }

    const agora = new Date().toISOString();

    if (input.decisao === 'autorizar') {
      const { data, error } = await supabase
        .from('carta_pedidos')
        .update({
          status: 'autorizado',
          autorizador_id: user.userId,
          autorizador_nome: user.userName,
          data_autorizacao: agora,
        })
        .eq('id', input.pedido_id)
        .eq('ministry_id', user.ministryId)
        .select()
        .single();

      if (error) throw new Error(`Falha ao autorizar pedido de carta: ${error.message}`);

      // Efeito Institucional da Presidência:
      // Se for carta de mudança ou desligamento, o membro é inativado e o histórico registrado com idempotência.
      // Se a atualização do membro falhar, aplica compensação (rollback) revertendo o pedido para pendente.
      if (pedido.member_id && CartasService.exigeAutorizacaoPresidencial(pedido.tipo_carta)) {
        try {
          await CartasService.aplicarEfeitoDeliberacaoPresidencial(supabase, {
            memberId: pedido.member_id,
            ministryId: user.ministryId,
            pedido: data,
            usuario: {
              userId: user.userId,
              userName: user.userName,
            },
          });
        } catch (memberErr: any) {
          // Compensação / Rollback de consistência
          await supabase
            .from('carta_pedidos')
            .update({
              status: 'pendente',
              autorizador_id: null,
              autorizador_nome: null,
              data_autorizacao: null,
            })
            .eq('id', input.pedido_id)
            .eq('ministry_id', user.ministryId);

          throw new Error(
            `Falha ao aplicar efeitos cadastrais no membro ao autorizar carta (${memberErr?.message || 'erro desconhecido'}). A deliberação foi revertida.`
          );
        }
      }

      return data;
    } else {
      const motivo = (input.motivo_rejeicao || '').trim();
      if (!motivo) {
        throw new Error('O motivo do indeferimento da carta é obrigatório.');
      }

      const { data, error } = await supabase
        .from('carta_pedidos')
        .update({
          status: 'rejeitado',
          autorizador_id: user.userId,
          autorizador_nome: user.userName,
          motivo_rejeicao: motivo,
          data_autorizacao: agora,
        })
        .eq('id', input.pedido_id)
        .eq('ministry_id', user.ministryId)
        .select()
        .single();

      if (error) throw new Error(`Falha ao rejeitar pedido de carta: ${error.message}`);
      return data;
    }
  }
}
