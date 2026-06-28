/**
 * agenda-sync-service.ts
 *
 * Serviço central de sincronização entre módulos do Gestão Eklésia e a Agenda.
 * Este serviço é o único ponto de integração oficial com agenda_eventos.
 *
 * Consumidores atuais:
 *   - Secretaria (Batismo, Apresentação de Crianças)
 *
 * Consumidores preparados futuramente:
 *   - Eventos, EBD, Missões, Patrimônio, Tesouraria, Gabinete, Jurídico
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// -------------------------------------------------------
// Tipos públicos do serviço
// -------------------------------------------------------

export type OrigemModulo =
  | 'secretaria'
  | 'eventos'
  | 'ebd'
  | 'missoes'
  | 'patrimonio'
  | 'tesouraria'
  | 'gabinete'
  | 'juridico';

export type OrigemTipo =
  | 'batismo'
  | 'apresentacao_criancas'
  | 'ordenacao'
  | 'posse'
  | 'consagracao'
  | 'reuniao_oficial'
  | 'assembleia'
  | 'congresso'
  | 'aula'
  | 'missao'
  | 'outro';

export type AcaoSync = 'create' | 'update' | 'delete' | 'sync';

export interface SyncPayload {
  /** Módulo de origem (ex: 'secretaria') */
  origem: OrigemModulo;
  /** Tipo do ato de origem (ex: 'batismo') */
  origemTipo: OrigemTipo;
  /** ID do registro no módulo de origem */
  origemId: string;
  /** Operação a executar */
  acao: AcaoSync;
  /** ministry_id do ministério */
  ministryId: string;
  /** Dados do evento a ser criado ou atualizado */
  dados?: SyncDados;
}

export interface SyncDados {
  /** Título do evento na Agenda */
  titulo: string;
  /** Descrição opcional */
  descricao?: string | null;
  /** Data/hora de início (ISO 8601) */
  dataInicio: string;
  /** Data/hora de fim (ISO 8601), opcional */
  dataFim?: string | null;
  /** Local do ato */
  local?: string | null;
}

export interface SyncResult {
  ok: boolean;
  eventoId?: string;
  error?: string;
}

/** Tipo interno: SyncPayload sem 'acao', passado para as funções de operação */
type SyncPayloadInternal = Omit<SyncPayload, 'acao'>;


// Rótulos exibidos na Agenda por módulo de origem
export const ORIGEM_LABELS: Record<OrigemModulo, string> = {
  secretaria: 'Secretaria',
  eventos:    'Eventos',
  ebd:        'EBD',
  missoes:    'Missões',
  patrimonio: 'Patrimônio',
  tesouraria: 'Tesouraria',
  gabinete:   'Gabinete',
  juridico:   'Jurídico',
};

// -------------------------------------------------------
// Funções internas auxiliares
// -------------------------------------------------------

/**
 * Obtém ou cria silenciosamente o Planejamento Anual (rascunho) do ano informado.
 */
async function resolveOrCreatePlanejamento(
  supabase: SupabaseClient,
  ministryId: string,
  ano: number
): Promise<string | null> {
  try {
    const { data: existing } = await supabase
      .from('agenda_planejamentos')
      .select('id')
      .eq('ministry_id', ministryId)
      .eq('ano', ano)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: created, error } = await supabase
      .from('agenda_planejamentos')
      .insert({
        ministry_id: ministryId,
        ano,
        nome: `Planejamento Anual ${ano}`,
        status: 'rascunho',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[agenda-sync] Erro ao criar planejamento:', error.message);
      return null;
    }
    return created.id;
  } catch (e: any) {
    console.error('[agenda-sync] resolveOrCreatePlanejamento exception:', e);
    return null;
  }
}

/**
 * Localiza um evento existente pelo par (origem_tipo, origem_id, ministry_id).
 */
async function findEventByOrigem(
  supabase: SupabaseClient,
  ministryId: string,
  origemTipo: OrigemTipo,
  origemId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('agenda_eventos')
    .select('id')
    .eq('ministry_id', ministryId)
    .eq('origem_tipo', origemTipo)
    .eq('origem_id', origemId)
    .maybeSingle();

  return data?.id ?? null;
}

// -------------------------------------------------------
// Operações públicas
// -------------------------------------------------------

/**
 * Cria um compromisso na Agenda a partir de um ato originado em outro módulo.
 */
async function create(
  supabase: SupabaseClient,
  payload: SyncPayloadInternal
): Promise<SyncResult> {
  if (!payload.dados) return { ok: false, error: 'Dados do evento são obrigatórios para create.' };

  const ano = new Date(payload.dados.dataInicio).getFullYear();
  const planejamentoId = await resolveOrCreatePlanejamento(supabase, payload.ministryId, ano);

  const insert = {
    ministry_id: payload.ministryId,
    planejamento_id: planejamentoId,
    titulo: payload.dados.titulo,
    descricao: payload.dados.descricao ?? null,
    tipo: 'outro' as const,
    origem: payload.origem,
    origem_tipo: payload.origemTipo,
    origem_id: payload.origemId,
    data_inicio: payload.dados.dataInicio,
    data_fim: payload.dados.dataFim ?? null,
    local: payload.dados.local ?? null,
    visibilidade: 'lideranca' as const,
    status: 'agendado' as const,
    escopo: 'organizacao' as const,
    prioridade: 1,
    calendario_oficial: true,
    gera_bloqueio: true,
    bloqueado: true,
    recorrente: false,
  };

  const { data, error } = await supabase
    .from('agenda_eventos')
    .insert(insert)
    .select('id')
    .single();

  if (error) {
    console.error('[agenda-sync] create error:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, eventoId: data.id };
}

async function update(
  supabase: SupabaseClient,
  payload: SyncPayloadInternal
): Promise<SyncResult> {
  if (!payload.dados) return { ok: false, error: 'Dados do evento são obrigatórios para update.' };

  const eventoId = await findEventByOrigem(
    supabase, payload.ministryId, payload.origemTipo, payload.origemId
  );

  if (!eventoId) {
    // Evento não existe ainda – cria
    return create(supabase, payload);
  }

  const patch = {
    titulo: payload.dados.titulo,
    descricao: payload.dados.descricao ?? null,
    data_inicio: payload.dados.dataInicio,
    data_fim: payload.dados.dataFim ?? null,
    local: payload.dados.local ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('agenda_eventos')
    .update(patch)
    .eq('id', eventoId);

  if (error) {
    console.error('[agenda-sync] update error:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, eventoId };
}

async function remove(
  supabase: SupabaseClient,
  payload: SyncPayloadInternal
): Promise<SyncResult> {
  const eventoId = await findEventByOrigem(
    supabase, payload.ministryId, payload.origemTipo, payload.origemId
  );

  if (!eventoId) return { ok: true }; // Nada a fazer

  const { error } = await supabase
    .from('agenda_eventos')
    .update({ status: 'cancelado', updated_at: new Date().toISOString() })
    .eq('id', eventoId);

  if (error) {
    console.error('[agenda-sync] delete error:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, eventoId };
}

async function sync(
  supabase: SupabaseClient,
  payload: SyncPayloadInternal
): Promise<SyncResult> {
  const eventoId = await findEventByOrigem(
    supabase, payload.ministryId, payload.origemTipo, payload.origemId
  );
  return eventoId ? update(supabase, payload) : create(supabase, payload);
}

// -------------------------------------------------------
// Interface pública unificada
// -------------------------------------------------------

/**
 * Ponto de entrada único para sincronização de módulos com a Agenda.
 *
 * @example
 * await sincronizarAgenda({
 *   supabase,
 *   origem:     'secretaria',
 *   origemTipo: 'batismo',
 *   origemId:   registro.id,
 *   acao:       'create',
 *   ministryId: ministryId!,
 *   dados: {
 *     titulo:    `Batismo: ${registro.candidato_nome}`,
 *     dataInicio: registro.data_batismo,
 *     local:      registro.local_batismo,
 *   },
 * });
 */
export async function sincronizarAgenda(
  args: SyncPayload & { supabase: SupabaseClient }
): Promise<SyncResult> {
  const { supabase, acao, ...payload } = args;

  switch (acao) {
    case 'create': return create(supabase, payload);
    case 'update': return update(supabase, payload);
    case 'delete': return remove(supabase, payload);
    case 'sync':   return sync(supabase, payload);
    default:
      return { ok: false, error: `Ação desconhecida: ${acao}` };
  }
}
