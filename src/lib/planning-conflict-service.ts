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
export const PlanningConflictService = {
  /**
   * Valida se existe conflito entre o payload do evento que está sendo salvo e os eventos do mesmo ano/planejamento.
   */
  async verificarConflito(
    supabase: any,
    eventPayload: {
      titulo: string;
      data_inicio: string;
      data_fim: string | null;
      planejamento_id: string;
      tipo_id: string;
      escopo: 'organizacao' | 'divisao1' | 'divisao2' | 'divisao3';
      prioridade: number;
      calendario_oficial: boolean;
      gera_bloqueio: boolean;
    },
    currentEventId: string | null
  ): Promise<ConflictResult> {
    // 1. Buscar todos os eventos do mesmo planejamento (incluindo tipo para checagem da matriz)
    let query = supabase
      .from('agenda_eventos')
      .select('*, agenda_tipos(*)')
      .eq('planejamento_id', eventPayload.planejamento_id);

    if (currentEventId) {
      query = query.neq('id', currentEventId);
    }

    const { data: existingEvents, error } = await query;
    if (error || !existingEvents) {
      return { status: 'SEM_CONFLITO', motivo: null, regra_aplicada: null, conflito: null };
    }

    // Datas do evento que está sendo salvo
    const newStart = new Date(eventPayload.data_inicio).getTime();
    // Fallback de 2 horas se a data_fim for nula
    const newEnd = eventPayload.data_fim 
      ? new Date(eventPayload.data_fim).getTime()
      : newStart + (2 * 60 * 60 * 1000);

    // Buscar tipo de agenda do evento sendo salvo
    const { data: currentType } = await supabase
      .from('agenda_tipos')
      .select('*')
      .eq('id', eventPayload.tipo_id)
      .maybeSingle();

    const currentCategory = currentType?.categoria || 'outro';

    // 2. Iterar sobre todos os eventos para encontrar interseção e avaliar regras
    for (const evt of existingEvents) {
      const extStart = new Date(evt.data_inicio).getTime();
      const extEnd = evt.data_fim 
        ? new Date(evt.data_fim).getTime()
        : extStart + (2 * 60 * 60 * 1000);

      // Checa se há intersecção de faixas de data/hora
      const overlaps = newStart < extEnd && newEnd > extStart;
      if (!overlaps) continue;

      // Filtro de relevância: Apenas eventos de Calendário Oficial ou que geram bloqueio
      const isRelevant = 
        evt.calendario_oficial || 
        evt.gera_bloqueio || 
        eventPayload.calendario_oficial || 
        eventPayload.gera_bloqueio;

      if (!isRelevant) continue;

      // Matriz de Regras Iniciais
      const extCategory = evt.agenda_tipos?.categoria || 'outro';

      // Regra 1: Coexistência para Tarefas e Administrativos
      if (
        currentCategory === 'administrativo' || 
        extCategory === 'administrativo' ||
        evt.tipo === 'tarefa'
      ) {
        // Coexistência permitida para fins administrativos ou tarefas gerais
        continue;
      }

      const formatDateTime = (isoStr: string) => {
        const d = new Date(isoStr);
        return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      };

      // Regra 2: Conflitos Críticos (Eventos de maior prioridade bloqueiam os de menor prioridade)
      // Nota: Menores números de prioridade indicam maior relevância (Ex: organizacao = 1, divisao1 = 4)
      if (evt.prioridade < eventPayload.prioridade) {
        return {
          status: 'BLOQUEIO',
          regra_aplicada: 'BLOQUEIO_PRIORIDADE_SUPERIOR',
          conflito: evt,
          motivo: `Esta data está reservada pelo Planejamento Oficial. O evento "${evt.titulo}" em ${formatDateTime(evt.data_inicio)} pertence ao escopo superior (${evt.escopo}) e bloqueia novos agendamentos neste período.`,
        };
      }

      // Regra 3: Conflitos de Escopo Coexistente (Mesmo escopo gera aviso para revisão)
      if (evt.prioridade === eventPayload.prioridade) {
        return {
          status: 'AVISO',
          regra_aplicada: 'AVISO_MESMO_ESCOPO',
          conflito: evt,
          motivo: `Aviso de duplicidade de agenda no escopo. Já existe o evento oficial "${evt.titulo}" em ${formatDateTime(evt.data_inicio)} no mesmo nível organizacional. Deseja prosseguir assim mesmo?`,
        };
      }
    }

    return { status: 'SEM_CONFLITO', motivo: null, regra_aplicada: null, conflito: null };
  },
};
