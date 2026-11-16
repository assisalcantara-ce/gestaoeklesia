/**
 * reunioes-agenda-sync-service.ts
 *
 * Serviço server-side central de sincronização idempotente entre a Agenda Oficial e o Módulo de Reuniões Ministeriais.
 *
 * Invariantes:
 * 1. A Agenda Ministerial é a fonte canônica oficial de data, horário, local e classificação.
 * 2. Reconhecimento estrito por dados estruturados: agenda_tipos.codigo ('reuniao_ministerial', 'reuniao_obreiros',
 *    'reuniao_diretoria', 'assembleia_geral') ou (categoria === 'reuniao' && tipo === 'reuniao').
 * 3. Idempotência absoluta e isolamento por ministry_id: operações concorrentes são tratadas com segurança.
 * 4. Preserva integralmente snapshots, convocações, presenças e quóruns já realizados.
 * 5. Reuniões com check-in registrado ou encerradas NÃO têm data, horário ou snapshots sobrescritos por remarcações posteriores.
 * 6. Cancelamentos marcam a reunião como 'cancelada', sem efetuar exclusão física (DELETE) de registros operacionais.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calcularLimiteCheckinTimestamp,
  isEventoReuniaoMinisterial,
} from './reunioes-utils';

export interface SincronizarEventoAgendaParams {
  admin: SupabaseClient;
  ministryId: string;
  eventoId: string;
  operacao: 'create' | 'update' | 'cancel' | 'delete';
  usuarioId?: string | null;
}

export interface SyncReuniaoResult {
  ok: boolean;
  reuniaoId?: string | null;
  acaoRealizada?: 'criada' | 'atualizada' | 'cancelada' | 'preservada_historico' | 'ignorada_nao_ministerial';
  detalhe?: string;
  error?: string;
}

/**
 * Ponto de entrada para sincronizar um evento da Agenda com a tabela `reunioes`.
 */
export async function sincronizarEventoAgendaComReunioes(
  params: SincronizarEventoAgendaParams
): Promise<SyncReuniaoResult> {
  const { admin, ministryId, eventoId, operacao, usuarioId } = params;

  if (!ministryId || !eventoId) {
    return { ok: false, error: 'ministryId e eventoId são obrigatórios.' };
  }

  try {
    // 1. Consultar evento oficial da Agenda com seus tipos estruturados
    const { data: evento, error: evErr } = await admin
      .from('agenda_eventos')
      .select('*, agenda_tipos(*)')
      .eq('id', eventoId)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (evErr) {
      return { ok: false, error: `Erro ao consultar evento da agenda: ${evErr.message}` };
    }

    // Se o evento foi excluído fisicamente ou não existe mais
    if (!evento && operacao === 'delete') {
      return tratarExclusaoOuCancelamento(admin, ministryId, eventoId, 'Evento excluído da Agenda Oficial.', usuarioId);
    }

    if (!evento) {
      return { ok: false, error: 'Evento da agenda não encontrado.' };
    }

    // 2. Verificar se o evento é estruturalmente classificado como reunião ministerial
    const ehMinisterial = isEventoReuniaoMinisterial({
      tipo: evento.tipo,
      agenda_tipos: evento.agenda_tipos,
    });

    if (!ehMinisterial) {
      return {
        ok: true,
        acaoRealizada: 'ignorada_nao_ministerial',
        detalhe: 'Evento da agenda não classificado como reunião ministerial.',
      };
    }

    // 3. Se a operação for de cancelamento explícito ou status for cancelado
    if (operacao === 'cancel' || evento.status === 'cancelado' || operacao === 'delete') {
      return tratarExclusaoOuCancelamento(admin, ministryId, eventoId, 'Evento cancelado na Agenda Oficial.', usuarioId);
    }

    // 4. Buscar reunião já vinculada ao evento por agenda_evento_id
    const { data: reuniaoExistente, error: rErr } = await admin
      .from('reunioes')
      .select('id, titulo, data_reuniao, horario_inicio, status, total_presentes, encerrada_em')
      .eq('ministry_id', ministryId)
      .eq('agenda_evento_id', eventoId)
      .maybeSingle();

    if (rErr) {
      return { ok: false, error: `Erro ao consultar reunião vinculada: ${rErr.message}` };
    }

    // Extrair data e horário de início da Agenda (UTC-3 Brasil)
    const dataEv = new Date(evento.data_inicio);
    if (isNaN(dataEv.getTime())) {
      return { ok: false, error: 'Data de início inválida no evento da agenda.' };
    }

    const anoEv = dataEv.getFullYear();
    const mesEv = String(dataEv.getMonth() + 1).padStart(2, '0');
    const diaEv = String(dataEv.getDate()).padStart(2, '0');
    const dataReuniaoStr = `${anoEv}-${mesEv}-${diaEv}`;

    const horaEv = String(dataEv.getHours()).padStart(2, '0');
    const minEv = String(dataEv.getMinutes()).padStart(2, '0');
    const horarioInicioStr = `${horaEv}:${minEv}`;

    // Horário limite padrão (30 min após o início)
    const minTotal = dataEv.getHours() * 60 + dataEv.getMinutes() + 30;
    const limHora = String(Math.floor(minTotal / 60) % 24).padStart(2, '0');
    const limMin = String(minTotal % 60).padStart(2, '0');
    const horarioLimiteStr = `${limHora}:${limMin}`;

    let limiteCheckinEm: string;
    try {
      limiteCheckinEm = calcularLimiteCheckinTimestamp(dataReuniaoStr, horarioLimiteStr);
    } catch {
      limiteCheckinEm = `${dataReuniaoStr}T23:59:59-03:00`;
    }

    const tituloSanitizado = (evento.titulo || 'Reunião Ministerial').trim();
    const localSanitizado = (evento.local || 'Templo Central').trim();
    const pautaSanitizada = evento.descricao ? String(evento.descricao).trim() : null;

    // 5. ATUALIZAÇÃO DE REUNIÃO EXISTENTE (Remarcação / Edição de Dados)
    if (reuniaoExistente) {
      // REGRA DE PROTEÇÃO HISTÓRICA: Se a reunião já foi encerrada ou já possui presenças registradas,
      // seus dados operacionais e de quórum NÃO devem ser sobrescritos por alterações tardias de agenda.
      const jaRealizadaOuEmAndamento =
        reuniaoExistente.status === 'encerrada' ||
        (reuniaoExistente.total_presentes || 0) > 0 ||
        Boolean(reuniaoExistente.encerrada_em);

      if (jaRealizadaOuEmAndamento) {
        return {
          ok: true,
          reuniaoId: reuniaoExistente.id,
          acaoRealizada: 'preservada_historico',
          detalhe: 'Reunião com quórum/encerramento já consolidado foi preservada sem modificação.',
        };
      }

      // Reunião futura agendada: atualizar data, horário, título e local
      const { error: updErr } = await admin
        .from('reunioes')
        .update({
          titulo: tituloSanitizado,
          pauta: pautaSanitizada,
          local: localSanitizado,
          data_reuniao: dataReuniaoStr,
          horario_inicio: horarioInicioStr,
          horario_limite_entrada: horarioLimiteStr,
          limite_checkin_em: limiteCheckinEm,
          congregacao_id: evento.church_id || null,
          status: 'agendada',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reuniaoExistente.id)
        .eq('ministry_id', ministryId);

      if (updErr) {
        return { ok: false, error: `Erro ao atualizar reunião: ${updErr.message}` };
      }

      return {
        ok: true,
        reuniaoId: reuniaoExistente.id,
        acaoRealizada: 'atualizada',
        detalhe: 'Reunião ministerial sincronizada e atualizada conforme a Agenda.',
      };
    }

    // 6. CRIAÇÃO DE NOVA REUNIÃO DERIVADA DA AGENDA
    const { data: novaReuniao, error: insErr } = await admin
      .from('reunioes')
      .insert({
        ministry_id: ministryId,
        agenda_evento_id: eventoId,
        congregacao_id: evento.church_id || null,
        titulo: tituloSanitizado,
        pauta: pautaSanitizada,
        local: localSanitizado,
        data_reuniao: dataReuniaoStr,
        horario_inicio: horarioInicioStr,
        horario_limite_entrada: horarioLimiteStr,
        limite_checkin_em: limiteCheckinEm,
        status: 'agendada',
        total_esperados: 0,
        total_presentes: 0,
        total_ausentes: 0,
        total_justificados: 0,
      })
      .select()
      .maybeSingle();

    if (insErr || !novaReuniao) {
      // Se colidiu em unicidade com execução concorrente, busca a reunião criada
      if (insErr?.code === '23505') {
        const { data: concReuniao } = await admin
          .from('reunioes')
          .select('id')
          .eq('ministry_id', ministryId)
          .eq('agenda_evento_id', eventoId)
          .maybeSingle();
        return {
          ok: true,
          reuniaoId: concReuniao?.id,
          acaoRealizada: 'atualizada',
          detalhe: 'Reunião ministerial já inserida concorrentemente.',
        };
      }
      return { ok: false, error: `Erro ao criar reunião ministerial: ${insErr?.message}` };
    }

    // 7. Geração inicial de snapshot de convocados (somente ministros ativos)
    let totalEsperados = 0;
    try {
      let snapQuery = admin
        .from('members')
        .select(`
          id,
          name,
          cargo_ministerial,
          tipo_cadastro,
          status,
          matricula,
          unique_id,
          congregacao_id,
          congregacoes ( id, nome, regiao, supervisao, campo, cidade )
        `)
        .eq('ministry_id', ministryId)
        .eq('status', 'active')
        .eq('tipo_cadastro', 'ministro');

      if (novaReuniao.congregacao_id) {
        snapQuery = snapQuery.eq('congregacao_id', novaReuniao.congregacao_id);
      }

      const { data: ministros, error: mErr } = await snapQuery;

      if (!mErr && ministros && ministros.length > 0) {
        const rows = ministros.map((m: any) => {
          const cong = m.congregacoes;
          const areaNome = cong?.supervisao || cong?.campo || cong?.regiao || cong?.cidade || null;
          return {
            reuniao_id: novaReuniao.id,
            ministry_id: ministryId,
            member_id: m.id,
            nome_ministro_snapshot: m.name || 'Ministro',
            cargo_snapshot: m.cargo_ministerial || 'Ministro',
            congregacao_id_snapshot: m.congregacao_id || null,
            nome_congregacao_snapshot: cong?.nome || null,
            area_snapshot: areaNome,
            carteirinha_numero_snapshot: m.matricula || null,
            unique_id_snapshot: m.unique_id || m.id,
            status_presenca: 'pendente',
          };
        });

        await admin.from('reunioes_participantes').insert(rows);
        totalEsperados = rows.length;

        await admin
          .from('reunioes')
          .update({ total_esperados: totalEsperados })
          .eq('id', novaReuniao.id);
      }
    } catch (snapErr: any) {
      console.error('[ReunioesAgendaSync] Erro na geração inicial de snapshot:', snapErr?.message);
    }

    return {
      ok: true,
      reuniaoId: novaReuniao.id,
      acaoRealizada: 'criada',
      detalhe: `Reunião criada com ${totalEsperados} ministros convocados no snapshot.`,
    };
  } catch (err: any) {
    return { ok: false, error: `Exceção ao sincronizar reunião com agenda: ${err?.message || err}` };
  }
}

/**
 * Trata o cancelamento ou exclusão de um evento da Agenda preservando integralmente o histórico da reunião.
 */
async function tratarExclusaoOuCancelamento(
  admin: SupabaseClient,
  ministryId: string,
  eventoId: string,
  motivo: string,
  _usuarioId?: string | null
): Promise<SyncReuniaoResult> {
  const { data: reuniao, error } = await admin
    .from('reunioes')
    .select('id, status, total_presentes, encerrada_em')
    .eq('ministry_id', ministryId)
    .eq('agenda_evento_id', eventoId)
    .maybeSingle();

  if (error || !reuniao) {
    return { ok: true, detalhe: 'Nenhuma reunião vinculada ao evento para cancelamento.' };
  }

  // Se a reunião já foi encerrada ou já teve presença registrada, preserva seu histórico intacto
  if (reuniao.status === 'encerrada' || (reuniao.total_presentes || 0) > 0 || Boolean(reuniao.encerrada_em)) {
    return {
      ok: true,
      reuniaoId: reuniao.id,
      acaoRealizada: 'preservada_historico',
      detalhe: 'Reunião com registros históricos de presença preservada sem cancelamento.',
    };
  }

  // Marcar como cancelada (SEM deletar da tabela nem afetar snapshots)
  await admin
    .from('reunioes')
    .update({
      status: 'cancelada',
      pauta: reuniao.id ? `[CANCELADA] ${motivo}` : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reuniao.id)
    .eq('ministry_id', ministryId);

  return {
    ok: true,
    reuniaoId: reuniao.id,
    acaoRealizada: 'cancelada',
    detalhe: 'Reunião ministerial cancelada preservando histórico.',
  };
}
