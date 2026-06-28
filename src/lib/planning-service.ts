/**
 * PlanningService
 * Serviço interno para cópia, replicação e gerenciamento de planejamentos anuais.
 */
export const PlanningService = {
  /**
   * Copia todos os eventos de um planejamento de origem para um novo ano de destino.
   * Preserva a estrutura organizacional, tipos de compromissos, escopos e flags associadas.
   */
  async copiarPlanejamento(
    supabase: any,
    sourcePlanId: string,
    targetYear: number,
    userId: string
  ): Promise<{ success: boolean; planningId: string; copiedCount: number }> {
    // 1. Buscar planejamento de origem
    const { data: sourcePlan, error: sourceErr } = await supabase
      .from('agenda_planejamentos')
      .select('*')
      .eq('id', sourcePlanId)
      .single();

    if (sourceErr || !sourcePlan) {
      throw new Error(`Planejamento de origem não encontrado: ${sourceErr?.message}`);
    }

    const yearDifference = targetYear - sourcePlan.ano;

    // 2. Garantir existência do planejamento de destino
    let { data: targetPlan, error: targetPlanErr } = await supabase
      .from('agenda_planejamentos')
      .select('*')
      .eq('ministry_id', sourcePlan.ministry_id)
      .eq('ano', targetYear)
      .maybeSingle();

    if (targetPlanErr) {
      throw new Error(`Erro ao buscar planejamento de destino: ${targetPlanErr.message}`);
    }

    if (!targetPlan) {
      const { data: newPlan, error: createPlanErr } = await supabase
        .from('agenda_planejamentos')
        .insert({
          ministry_id: sourcePlan.ministry_id,
          ano: targetYear,
          nome: `Planejamento Anual ${targetYear}`,
          status: 'rascunho',
          created_by: userId,
        })
        .select('*')
        .single();

      if (createPlanErr || !newPlan) {
        throw new Error(`Erro ao criar planejamento de destino: ${createPlanErr?.message}`);
      }
      targetPlan = newPlan;
    }

    // 3. Buscar eventos do planejamento de origem
    const { data: sourceEvents, error: eventsErr } = await supabase
      .from('agenda_eventos')
      .select('*')
      .eq('planejamento_id', sourcePlanId);

    if (eventsErr) {
      throw new Error(`Erro ao buscar eventos de origem: ${eventsErr.message}`);
    }

    if (!sourceEvents || sourceEvents.length === 0) {
      return { success: true, planningId: targetPlan.id, copiedCount: 0 };
    }

    // Helper para ajustar o ano de uma data preservando timezone
    const adjustYear = (dateIsoStr: string | null): string | null => {
      if (!dateIsoStr) return null;
      const date = new Date(dateIsoStr);
      date.setFullYear(date.getFullYear() + yearDifference);
      return date.toISOString();
    };

    // 4. Mapear e preparar eventos de destino para inserção em lote
    const targetEventsPayload = sourceEvents.map((evt: any) => {
      return {
        ministry_id: sourcePlan.ministry_id,
        church_id: evt.church_id,
        planejamento_id: targetPlan.id,
        titulo: evt.titulo,
        descricao: evt.descricao,
        tipo: evt.tipo,
        tipo_id: evt.tipo_id,
        origem: evt.origem || 'manual',
        data_inicio: adjustYear(evt.data_inicio),
        data_fim: adjustYear(evt.data_fim),
        local: evt.local,
        visibilidade: evt.visibilidade,
        status: 'agendado', // Reseta status para agendado no novo planejamento
        escopo: evt.escopo || 'divisao1',
        prioridade: evt.prioridade || 4,
        calendario_oficial: evt.calendario_oficial || false,
        gera_bloqueio: evt.gera_bloqueio || false,
        bloqueado: evt.bloqueado || false,
        origem_tipo: evt.origem_tipo,
        origem_id: evt.origem_id,
        regra_posicionamento: evt.regra_posicionamento,
        created_by: userId,
      };
    });

    // 5. Inserir eventos em lote no destino
    const { error: insertErr } = await supabase
      .from('agenda_eventos')
      .insert(targetEventsPayload);

    if (insertErr) {
      throw new Error(`Erro ao replicar eventos de planejamento: ${insertErr.message}`);
    }

    return {
      success: true,
      planningId: targetPlan.id,
      copiedCount: targetEventsPayload.length,
    };
  },
};
