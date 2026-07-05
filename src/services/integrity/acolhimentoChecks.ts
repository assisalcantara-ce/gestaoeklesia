/**
 * Verificações de Integridade — Módulo Acolhimento
 *
 * Contém as regras de integridade específicas do módulo Acolhimento.
 * Importar e passar para runIntegrityCheck() na abertura do Relatório Espiritual.
 *
 * Regras implementadas:
 *  1. checkCultosOrfaos — Culto com status CONSOLIDADO sem relatorio_espiritual_id.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { IntegrityCheckFn, IntegrityIssue } from '../SystemIntegrityService';

// ---------------------------------------------------------------------------
// Utilitário interno
// ---------------------------------------------------------------------------

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function competenciaLabel(dataCulto: string): string {
  const d = new Date(dataCulto);
  return `${MESES[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
}

// ---------------------------------------------------------------------------
// Regra 1: Culto consolidado sem registro espiritual
// ---------------------------------------------------------------------------

/**
 * Detecta cultos com status = 'Consolidado' e relatorio_espiritual_id = NULL.
 *
 * Correção automática:
 *  a) Se já existe um relatorio_espiritual_registros com culto_id = culto.id
 *     (índice único sobreviveu) → apenas restaura o vínculo em culto_registros.
 *  b) Caso contrário → cria o registro espiritual e vincula.
 *
 * Nunca gera registros duplicados.
 */
export const checkCultosOrfaos: IntegrityCheckFn = async (
  supabase: SupabaseClient,
  ministryId: string
): Promise<IntegrityIssue[]> => {
  const { data: cultos, error } = await supabase
    .from('culto_registros')
    .select(
      'id, data_culto, tipo_culto, ministry_id, congregacao_id, ' +
      'visitantes_presentes, almas_alcancadas, reconciliacoes, ' +
      'batismos_espirito_santo, curas_divinas, biblias_doadas, ' +
      'literaturas_entregues, membros_cearam, observacoes_encerramento'
    )
    .eq('status', 'Consolidado')
    .is('relatorio_espiritual_id', null)
    .eq('ministry_id', ministryId);

  const cultosList = (cultos as any[]) || [];
  if (error || cultosList.length === 0) return [];

  return cultosList.map((culto: any): IntegrityIssue => {
    const comp = competenciaLabel(culto.data_culto);

    return {
      id: `culto-orfao-${culto.id}`,
      module: 'acolhimento',
      entity: 'culto_registros',
      entityId: culto.id,
      severity: 'warning',
      title: 'Culto consolidado sem registro espiritual',
      description:
        `Culto ${culto.tipo_culto} em ${culto.data_culto} (competência ${comp}) ` +
        `está consolidado mas não possui registro no Relatório Espiritual. ` +
        `Sistema restaurou automaticamente o vínculo referente ao culto ${culto.id}.`,
      autoFixAvailable: true,

      fix: async () => {
        // Passo 1 — verificar se o registro espiritual já existe pelo culto_id
        const { data: existing } = await supabase
          .from('relatorio_espiritual_registros')
          .select('id')
          .eq('culto_id', culto.id)
          .maybeSingle();

        let registroId: string;

        if (existing) {
          // Registro existe: apenas reconectar o vínculo
          registroId = existing.id;
        } else {
          // Registro não existe: criar
          const tipo = culto.tipo_culto === 'Santa Ceia' ? 'Santa Ceia' : 'Culto';

          const { data: novo, error: eInsert } = await supabase
            .from('relatorio_espiritual_registros')
            .insert({
              ministry_id: culto.ministry_id,
              congregacao_id: culto.congregacao_id,
              culto_id: culto.id,
              data_atividade: culto.data_culto,
              tipo_atividade: tipo,
              cultos_realizados: 1,
              visitantes_presentes: culto.visitantes_presentes ?? 0,
              almas_alcancadas:      culto.almas_alcancadas      ?? 0,
              reconciliacoes:        culto.reconciliacoes         ?? 0,
              batismos_espirito_santo: culto.batismos_espirito_santo ?? 0,
              curas_divinas:         culto.curas_divinas          ?? 0,
              biblias_doadas:        culto.biblias_doadas         ?? 0,
              literaturas_entregues: culto.literaturas_entregues  ?? 0,
              membros_cearam:        culto.membros_cearam         ?? 0,
              observacoes: culto.observacoes_encerramento ?? null,
              status: 'Enviado',
            })
            .select('id')
            .single();

          if (eInsert || !novo) {
            throw eInsert ?? new Error('Criação do registro espiritual falhou sem mensagem de erro.');
          }

          registroId = novo.id;
        }

        // Passo 2 — restaurar o vínculo em culto_registros
        const { error: eUpdate } = await supabase
          .from('culto_registros')
          .update({
            relatorio_espiritual_id: registroId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', culto.id);

        if (eUpdate) throw eUpdate;
      },
    };
  });
};

// ---------------------------------------------------------------------------
// Exportação da lista de checks do módulo Acolhimento
// ---------------------------------------------------------------------------

/** Todas as verificações de integridade do módulo Acolhimento. */
export const acolhimentoChecks: IntegrityCheckFn[] = [
  checkCultosOrfaos,
];
