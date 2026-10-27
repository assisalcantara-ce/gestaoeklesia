/**
 * Serviço de Gerenciamento da Fila e Histórico de Envio de Certificados
 * Módulo: Eventos / Gestão Eklésia
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type OrigemEnvioCertificado = 'individual' | 'massa' | 'checkin' | 'segunda_via';

export type StatusEnvioCertificado =
  | 'gerado'
  | 'solicitado'
  | 'aceito_provedor'
  | 'entregue'
  | 'falha';

export type StatusFilaCertificado = 'pendente' | 'processando' | 'enviado' | 'falhou';

export interface EnfileirarCertificadoParams {
  ministryId: string;
  eventoId: string;
  inscricaoId: string;
  templateModeloId: string;
  origem: OrigemEnvioCertificado;
  emailDestinatario: string;
  nomeParticipante: string;
  solicitadoPor?: string | null;
  idempotencyKey?: string;
  permitirSegundaVia?: boolean;
}

export interface RegistrarTentativaEnvioParams {
  ministryId: string;
  eventoId: string;
  inscricaoId: string;
  templateModeloId: string;
  origem: OrigemEnvioCertificado;
  emailDestinatario: string;
  nomeParticipante: string;
  idempotencyKey: string;
  status: StatusEnvioCertificado;
  resendMessageId?: string | null;
  motivoFalha?: string | null;
  dadosSnapshot?: Record<string, any>;
  solicitadoPor?: string | null;
}

export interface ItemFilaCertificado {
  id: string;
  ministry_id: string;
  evento_id: string;
  inscricao_id: string;
  template_modelo_id: string;
  origem: OrigemEnvioCertificado;
  email_destinatario: string;
  nome_participante: string;
  idempotency_key: string;
  status: StatusFilaCertificado;
  tentativas: number;
  max_tentativas: number;
  locked_at?: string | null;
  locked_by?: string | null;
  proxima_tentativa_em: string;
  ultimo_erro?: string | null;
  resend_message_id?: string | null;
  solicitado_por?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Gera uma chave determinística de idempotência.
 * Para operações primárias (individual, massa, check-in), compartilha a mesma base
 * para assegurar proteção cruzada entre canais contra reenvios duplicados.
 * Apenas 'segunda_via' possui sufixo temporal único mediante ação explícita.
 */
export function gerarChaveIdempotencia(
  eventoId: string,
  inscricaoId: string,
  origem: OrigemEnvioCertificado,
  timestampBase?: number
): string {
  if (origem === 'segunda_via') {
    const ts = timestampBase || Date.now();
    return `cert:${eventoId}:${inscricaoId}:segunda_via:${ts}`;
  }
  // Proteção cruzada compartilhada entre canais primários (individual, massa e check-in)
  return `cert:${eventoId}:${inscricaoId}:emissao_primaria`;
}

/**
 * Enfileira uma solicitação de certificado com verificação rigorosa de duplicidade
 */
export async function enfileirarEnvioCertificado(
  supabaseAdmin: SupabaseClient,
  params: EnfileirarCertificadoParams
): Promise<{
  sucesso: boolean;
  filaId?: string;
  ignoradoPorDuplicidade?: boolean;
  motivo?: string;
}> {
  const {
    ministryId,
    eventoId,
    inscricaoId,
    templateModeloId,
    origem,
    emailDestinatario,
    nomeParticipante,
    solicitadoPor,
    permitirSegundaVia,
  } = params;

  if (!emailDestinatario || !emailDestinatario.includes('@')) {
    return { sucesso: false, motivo: 'E-mail do destinatário inválido ou ausente.' };
  }

  // 1. Prevenção de duplicidade: verificar se já existe envio bem-sucedido prévio (salvo se for segunda via explícita)
  if (origem !== 'segunda_via' && !permitirSegundaVia) {
    const { data: envioExistente, error: errEnvio } = await supabaseAdmin
      .from('eventos_certificados_envios')
      .select('id, status, created_at')
      .eq('ministry_id', ministryId)
      .eq('inscricao_id', inscricaoId)
      .in('status', ['aceito_provedor', 'entregue'])
      .maybeSingle();

    if (!errEnvio && envioExistente) {
      return {
        sucesso: true,
        ignoradoPorDuplicidade: true,
        motivo: 'Certificado já foi emitido e aceito pelo provedor para este participante.',
      };
    }
  }

  // 2. Prevenção de concorrência: verificar se já está na fila ativo (pendente ou processando)
  const { data: filaAtiva, error: errFila } = await supabaseAdmin
    .from('eventos_certificados_fila')
    .select('id, status')
    .eq('inscricao_id', inscricaoId)
    .in('status', ['pendente', 'processando'])
    .maybeSingle();

  if (!errFila && filaAtiva) {
    return {
      sucesso: true,
      ignoradoPorDuplicidade: true,
      filaId: filaAtiva.id,
      motivo: 'A solicitação de envio já está em processamento na fila.',
    };
  }

  // 3. Montar chave de idempotência
  const idempotencyKey = params.idempotencyKey || gerarChaveIdempotencia(eventoId, inscricaoId, origem);

  // 4. Inserir na fila
  const { data: novoItem, error: insertErr } = await supabaseAdmin
    .from('eventos_certificados_fila')
    .insert({
      ministry_id: ministryId,
      evento_id: eventoId,
      inscricao_id: inscricaoId,
      template_modelo_id: templateModeloId,
      origem,
      email_destinatario: emailDestinatario.trim(),
      nome_participante: nomeParticipante.trim(),
      idempotency_key: idempotencyKey,
      status: 'pendente',
      solicitado_por: solicitadoPor ?? null,
      proxima_tentativa_em: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertErr) {
    // 23505 = Unique constraint violation
    if (insertErr.code === '23505') {
      return {
        sucesso: true,
        ignoradoPorDuplicidade: true,
        motivo: 'Operação ignorada por chave de idempotência ou registro ativo existente.',
      };
    }
    return { sucesso: false, motivo: insertErr.message };
  }

  return { sucesso: true, filaId: novoItem.id };
}

/**
 * Registra formalmente a tentativa no histórico persistente de auditoria
 */
export async function registrarHistoricoEnvio(
  supabaseAdmin: SupabaseClient,
  params: RegistrarTentativaEnvioParams
): Promise<{ sucesso: boolean; id?: string; erro?: string }> {
  const {
    ministryId,
    eventoId,
    inscricaoId,
    templateModeloId,
    origem,
    emailDestinatario,
    nomeParticipante,
    idempotencyKey,
    status,
    resendMessageId,
    motivoFalha,
    dadosSnapshot,
    solicitadoPor,
  } = params;

  const { data, error } = await supabaseAdmin
    .from('eventos_certificados_envios')
    .insert({
      ministry_id: ministryId,
      evento_id: eventoId,
      inscricao_id: inscricaoId,
      template_modelo_id: templateModeloId,
      origem,
      email_destinatario: emailDestinatario,
      nome_participante: nomeParticipante,
      idempotency_key: idempotencyKey,
      status,
      resend_message_id: resendMessageId ?? null,
      motivo_falha: motivoFalha ?? null,
      dados_snapshot: dadosSnapshot ?? null,
      solicitado_por: solicitadoPor ?? null,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { sucesso: false, erro: 'Idempotência detectada: tentativa já registrada anteriormente.' };
    }
    return { sucesso: false, erro: error.message };
  }

  return { sucesso: true, id: data.id };
}

/**
 * Atualiza o status da tarefa na fila persistente.
 * Se workerId for fornecido, assegura que apenas o worker detentor do lock possa alterar o status,
 * impedindo que workers que sofreram timeout finalizem tarefas que já foram reatribuídas a outro worker.
 */
export async function atualizarStatusFila(
  supabaseAdmin: SupabaseClient,
  filaId: string,
  novoStatus: StatusFilaCertificado,
  dadosExtras?: {
    workerId?: string;
    resendMessageId?: string;
    ultimoErro?: string;
    agendarProximaTentativaMinutos?: number;
  }
): Promise<boolean> {
  const updatePayload: Record<string, any> = {
    status: novoStatus,
    updated_at: new Date().toISOString(),
  };

  if (novoStatus === 'enviado') {
    updatePayload.resend_message_id = dadosExtras?.resendMessageId || null;
    updatePayload.locked_at = null;
    updatePayload.locked_by = null;
  } else if (novoStatus === 'falhou') {
    updatePayload.ultimo_erro = dadosExtras?.ultimoErro || null;
    updatePayload.locked_at = null;
    updatePayload.locked_by = null;
  } else if (novoStatus === 'pendente' && dadosExtras?.agendarProximaTentativaMinutos) {
    const proxima = new Date(Date.now() + dadosExtras.agendarProximaTentativaMinutos * 60 * 1000);
    updatePayload.proxima_tentativa_em = proxima.toISOString();
    updatePayload.locked_at = null;
    updatePayload.locked_by = null;
    if (dadosExtras.ultimoErro) {
      updatePayload.ultimo_erro = dadosExtras.ultimoErro;
    }
  }

  let query = supabaseAdmin
    .from('eventos_certificados_fila')
    .update(updatePayload)
    .eq('id', filaId);

  // Se workerId for informado, exige que o lease ainda pertença a ele
  if (dadosExtras?.workerId) {
    query = query.eq('locked_by', dadosExtras.workerId);
  }

  const { error } = await query;
  return !error;
}
