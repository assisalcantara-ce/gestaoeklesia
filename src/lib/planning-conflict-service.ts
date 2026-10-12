// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ConflictResult {
  status: 'SEM_CONFLITO' | 'AVISO' | 'BLOQUEIO';
  motivo: string | null;
  regra_aplicada: string | null;
  conflito: any | null;
}

/**
 * PlanningConflictService
 * Centraliza a inteligência e a matriz de validação de conflitos de datas do Planejamento Ministerial.
 */
export interface EventoParaConflito {
  id?: string;
  titulo: string;
  data_inicio: string;
  data_fim: string | null;
  planejamento_id?: string | null;
  ministry_id?: string;
  church_id?: string | null;
  tipo_id?: string | null;
  tipo?: string;
  escopo?: 'organizacao' | 'divisao1' | 'divisao2' | 'divisao3' | string;
  prioridade?: number;
  calendario_oficial?: boolean;
  gera_bloqueio?: boolean;
  agenda_tipos?: { categoria?: string } | null;
}

/**
 * PlanningConflictService
 * Centraliza a inteligência e a matriz de validação de conflitos de datas da Agenda.
 *
 * REGRA CANÔNICA:
 * - calendario_oficial indica oficialidade;
 * - SOMENTE gera_bloqueio, quando verdadeiro e aplicável ao escopo, cria impedimento de agendamento (BLOQUEIO).
 * - Bloqueio geral (church_id nulo ou escopo 'organizacao') aplica-se a todas as congregações.
 * - Bloqueio local aplica-se apenas à mesma congregação.
 */
export const PlanningConflictService = {
  /**
   * Avalia conflitos em memória contra uma lista de eventos existentes.
   */
  avaliarConflitosEmMemoria(
    existingEvents: EventoParaConflito[],
    eventPayload: EventoParaConflito,
    currentEventId: string | null = null,
    currentCategory: string = 'outro'
  ): ConflictResult {
    const newStart = new Date(eventPayload.data_inicio).getTime();
    const newEnd = eventPayload.data_fim 
      ? new Date(eventPayload.data_fim).getTime()
      : newStart + (2 * 60 * 60 * 1000);

    const formatDateTime = (isoStr: string) => {
      const d = new Date(isoStr);
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    for (const evt of existingEvents) {
      if (currentEventId && evt.id === currentEventId) continue;

      const extStart = new Date(evt.data_inicio).getTime();
      const extEnd = evt.data_fim 
        ? new Date(evt.data_fim).getTime()
        : extStart + (2 * 60 * 60 * 1000);

      // Checa se há intersecção de faixas de data/hora
      const overlaps = newStart < extEnd && newEnd > extStart;
      if (!overlaps) continue;

      const extCategory = evt.agenda_tipos?.categoria || evt.tipo || 'outro';

      // Regra 1: Coexistência permitida para fins administrativos ou tarefas gerais
      if (
        currentCategory === 'administrativo' || 
        extCategory === 'administrativo' ||
        evt.tipo === 'tarefa' ||
        eventPayload.tipo === 'tarefa'
      ) {
        continue;
      }

      // Escopo de aplicabilidade geográfica/organizacional:
      // Se evt é bloqueio geral ministerial (church_id é nulo/vazio ou escopo é 'organizacao'):
      // Bloqueia TODAS as congregações do ministério.
      const isEvtGeneral = !evt.church_id || evt.escopo === 'organizacao';
      const isPayloadGeneral = !eventPayload.church_id || eventPayload.escopo === 'organizacao';
      const isSameChurch = evt.church_id && eventPayload.church_id && evt.church_id === eventPayload.church_id;

      // Eventos de congregações diferentes sem vínculo geral não colidem
      const isScopeApplicable = isEvtGeneral || isPayloadGeneral || isSameChurch;
      if (!isScopeApplicable) {
        continue;
      }

      // REGRA OBRIGATÓRIA: Somente gera_bloqueio cria impedimento de agendamento (status: BLOQUEIO)
      if (evt.gera_bloqueio) {
        const motivo = isEvtGeneral
          ? `Data bloqueada pelo evento oficial geral "${evt.titulo}" em ${formatDateTime(evt.data_inicio)}. Bloqueios gerais do ministério impedem agendamentos em todas as congregações neste período.`
          : `Data bloqueada pelo evento "${evt.titulo}" em ${formatDateTime(evt.data_inicio)} nesta congregação.`;

        return {
          status: 'BLOQUEIO',
          regra_aplicada: isEvtGeneral ? 'BLOQUEIO_GERAL_MINISTERIAL' : 'BLOQUEIO_LOCAL_CONGREGACAO',
          conflito: evt,
          motivo,
        };
      }

      // Se o novo evento tenta ativar gera_bloqueio, ele não pode colidir com nenhum evento existente no mesmo escopo
      if (eventPayload.gera_bloqueio) {
        return {
          status: 'BLOQUEIO',
          regra_aplicada: 'BLOQUEIO_NOVO_EVENTO',
          conflito: evt,
          motivo: `Não é possível ativar bloqueio oficial neste horário pois já existe o compromisso "${evt.titulo}" em ${formatDateTime(evt.data_inicio)} no escopo abrangido.`,
        };
      }

      // Se nenhum gera bloqueio, mas ambos são do calendário oficial no mesmo escopo/congregação: aviso consultivo
      if (evt.calendario_oficial && eventPayload.calendario_oficial) {
        if (isSameChurch || (isEvtGeneral && isPayloadGeneral)) {
          return {
            status: 'AVISO',
            regra_aplicada: 'AVISO_EVENTOS_OFICIAIS_COEXISTENTES',
            conflito: evt,
            motivo: `Aviso: Já existe o compromisso oficial "${evt.titulo}" em ${formatDateTime(evt.data_inicio)} neste mesmo horário.`,
          };
        }
      }
    }

    return { status: 'SEM_CONFLITO', motivo: null, regra_aplicada: null, conflito: null };
  },

  /**
   * Valida se existe conflito consultando o banco de dados via cliente Supabase.
   */
  async verificarConflito(
    supabase: any,
    eventPayload: EventoParaConflito,
    currentEventId: string | null
  ): Promise<ConflictResult> {
    try {
      let query = supabase
        .from('agenda_eventos')
        .select('*, agenda_tipos(*)');

      if (eventPayload.planejamento_id) {
        query = query.eq('planejamento_id', eventPayload.planejamento_id);
      } else if (eventPayload.ministry_id) {
        query = query.eq('ministry_id', eventPayload.ministry_id);
      }

      if (currentEventId) {
        query = query.neq('id', currentEventId);
      }

      const { data: existingEvents, error } = await query;
      if (error || !existingEvents) {
        return { status: 'SEM_CONFLITO', motivo: null, regra_aplicada: null, conflito: null };
      }

      let currentCategory = 'outro';
      if (eventPayload.tipo_id) {
        const { data: currentType } = await supabase
          .from('agenda_tipos')
          .select('categoria')
          .eq('id', eventPayload.tipo_id)
          .maybeSingle();
        currentCategory = currentType?.categoria || 'outro';
      }

      return this.avaliarConflitosEmMemoria(existingEvents, eventPayload, currentEventId, currentCategory);
    } catch {
      return { status: 'SEM_CONFLITO', motivo: null, regra_aplicada: null, conflito: null };
    }
  },
};
