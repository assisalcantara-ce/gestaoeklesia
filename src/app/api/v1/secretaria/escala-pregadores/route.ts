import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import { EscalaPregadoresService } from '@/services/escala-pregadores-service';
import { temAcessoEscrita } from '@/lib/access-control';

export const dynamic = 'force-dynamic';

function checkUserPermissions(ctx: any) {
  const isGlobal = ctx.isOwner || ctx.isAdmin || ['administrador', 'secretario_geral', 'presidencia'].includes(ctx.nivel);
  const isLocalSecretary = ['secretaria_local', 'admin_local', 'operador'].includes(ctx.nivel);
  const canWrite = isGlobal || isLocalSecretary || temAcessoEscrita(ctx.nivel, 'gestao');

  return { isGlobal, isLocalSecretary, canWrite };
}

// ─── GET /api/v1/secretaria/escala-pregadores ─────────────────────────────────
// Suporta:
// 1. ?acao=eventos -> Lista eventos da agenda com escalas
// 2. ?acao=ministros -> Lista ministros ativos com rodízio
// 3. ?acao=historico -> Lista histórico de escalas
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);
    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 });
    }

    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'agenda_module');
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Módulo de Escala de Pregadores indisponível para o plano atual.', code: 'PLAN_RESTRICTED' },
        { status: 403 }
      );
    }

    const { isLocalSecretary } = checkUserPermissions(ctx);
    const searchParams = request.nextUrl.searchParams;
    const acao = searchParams.get('acao') || 'eventos';

    // 1. Listagem de Eventos com Escala
    if (acao === 'eventos') {
      let churchId = searchParams.get('church_id') || undefined;

      // Secretaria Local restrita à sua congregação oficial
      if (isLocalSecretary) {
        if (!ctx.congregacaoId) {
          return NextResponse.json({ error: 'Secretário local sem congregação vinculada.', code: 'LOCAL_NO_CHURCH' }, { status: 403 });
        }
        churchId = ctx.congregacaoId;
      }

      const eventos = await EscalaPregadoresService.listarEventosComEscala(ctx.supabase, {
        ministryId: ctx.ministryId,
        anoMes: searchParams.get('ano_mes') || undefined,
        dataInicioIso: searchParams.get('data_inicio') || undefined,
        dataFimIso: searchParams.get('data_fim') || undefined,
        churchId,
        filtroTitulo: searchParams.get('filtro_titulo') || undefined,
        apenasSemPregador: searchParams.get('apenas_sem_pregador') === 'true',
      });

      return NextResponse.json({ data: eventos });
    }

    // 2. Busca Dinâmica de Ministros Ativos com Rodízio
    if (acao === 'ministros') {
      const termo = searchParams.get('busca') || undefined;
      const ministros = await EscalaPregadoresService.listarMinistrosComRodizio(
        ctx.supabase,
        ctx.ministryId,
        termo
      );

      return NextResponse.json({ data: ministros });
    }

    // 3. Consulta de Histórico de Escalas
    if (acao === 'historico') {
      const agendaEventoId = searchParams.get('agenda_evento_id') || undefined;
      const memberId = searchParams.get('member_id') || undefined;
      const limite = searchParams.get('limite') ? parseInt(searchParams.get('limite')!, 10) : 50;

      const historico = await EscalaPregadoresService.consultarHistorico(ctx.supabase, {
        ministryId: ctx.ministryId,
        agendaEventoId,
        memberId,
        limite,
      });

      return NextResponse.json({ data: historico });
    }

    return NextResponse.json({ error: 'Ação não reconhecida.', code: 'INVALID_ACTION' }, { status: 400 });
  } catch (err: any) {
    console.error('Erro em GET /api/v1/secretaria/escala-pregadores:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}

// ─── POST /api/v1/secretaria/escala-pregadores ────────────────────────────────
// Atribuir novo pregador a um evento da Agenda Oficial
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);
    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 });
    }

    const { canWrite, isLocalSecretary } = checkUserPermissions(ctx);
    if (!canWrite) {
      return NextResponse.json({ error: 'Sem permissão para atribuir pregadores.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await request.json();
    const { agenda_evento_id, member_id, status, tema_mensagem, texto_biblico, observacoes } = body || {};

    if (!agenda_evento_id || !member_id) {
      return NextResponse.json(
        { error: 'ID do Evento da Agenda e ID do Ministro são obrigatórios.', code: 'MISSING_FIELDS' },
        { status: 400 }
      );
    }

    // Validação de congregação para Secretário Local
    if (isLocalSecretary) {
      if (!ctx.congregacaoId) {
        return NextResponse.json({ error: 'Secretário local sem congregação vinculada.', code: 'LOCAL_NO_CHURCH' }, { status: 403 });
      }

      const { data: evento, error: errEvt } = await ctx.admin
        .from('agenda_eventos')
        .select('church_id')
        .eq('id', agenda_evento_id)
        .eq('ministry_id', ctx.ministryId)
        .single();

      if (errEvt || !evento || evento.church_id !== ctx.congregacaoId) {
        return NextResponse.json(
          { error: 'Secretário local só tem autorização para escalar pregadores na sua própria congregação.', code: 'CHURCH_SCOPE_VIOLATION' },
          { status: 403 }
        );
      }
    }

    const novaEscala = await EscalaPregadoresService.atribuirPregador(ctx.supabase, {
      ministryId: ctx.ministryId,
      agendaEventoId: agenda_evento_id,
      memberId: member_id,
      status: status || 'escalado',
      temaMensagem: tema_mensagem,
      textoBiblico: texto_biblico,
      observacoes,
      userId: ctx.userId,
    });

    return NextResponse.json({ data: novaEscala }, { status: 201 });
  } catch (err: any) {
    console.error('Erro em POST /api/v1/secretaria/escala-pregadores:', err);
    return NextResponse.json({ error: err?.message || 'Erro ao atribuir pregador.' }, { status: 500 });
  }
}

// ─── PUT /api/v1/secretaria/escala-pregadores ─────────────────────────────────
// Suporta:
// 1. Substituir pregador ou editar dados
// 2. Remanejar ministro para outro evento
export async function PUT(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);
    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 });
    }

    const { canWrite, isLocalSecretary } = checkUserPermissions(ctx);
    if (!canWrite) {
      return NextResponse.json({ error: 'Sem permissão para alterar escalas de pregadores.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await request.json();
    const { operacao = 'editar', escala_id, novo_member_id, motivo_alteracao, status, tema_mensagem, texto_biblico, observacoes, novo_agenda_evento_id } = body || {};

    if (!escala_id) {
      return NextResponse.json({ error: 'ID da escala é obrigatório.', code: 'MISSING_ID' }, { status: 400 });
    }

    // Validação de congregação para Secretário Local
    if (isLocalSecretary) {
      const { data: escalaAtual } = await ctx.admin
        .from('agenda_escala_pregadores')
        .select('evento_church_id_snapshot')
        .eq('id', escala_id)
        .eq('ministry_id', ctx.ministryId)
        .single();

      if (!escalaAtual || escalaAtual.evento_church_id_snapshot !== ctx.congregacaoId) {
        return NextResponse.json(
          { error: 'Secretário local só tem autorização para modificar escalas na sua própria congregação.', code: 'CHURCH_SCOPE_VIOLATION' },
          { status: 403 }
        );
      }
    }

    // Operação 1: Remanejar pregador para outro evento existente
    if (operacao === 'remanejar') {
      if (!novo_agenda_evento_id) {
        return NextResponse.json({ error: 'Novo evento da agenda é obrigatório para remanejamento.', code: 'MISSING_TARGET_EVENT' }, { status: 400 });
      }

      const remanejado = await EscalaPregadoresService.remanejarPregador(ctx.supabase, {
        escalaOrigemId: escala_id,
        novoAgendaEventoId: novo_agenda_evento_id,
        ministryId: ctx.ministryId,
        motivoRemanejamento: motivo_alteracao || 'Remanejamento de escala',
        userId: ctx.userId,
      });

      return NextResponse.json({ data: remanejado });
    }

    // Operação 2: Editar escala (ou substituir ministro)
    const atualizada = await EscalaPregadoresService.editarEscala(ctx.supabase, {
      escalaId: escala_id,
      ministryId: ctx.ministryId,
      novoMemberId: novo_member_id,
      motivoSubstituicao: motivo_alteracao,
      status,
      temaMensagem: tema_mensagem,
      textoBiblico: texto_biblico,
      observacoes,
      userId: ctx.userId,
    });

    return NextResponse.json({ data: atualizada });
  } catch (err: any) {
    console.error('Erro em PUT /api/v1/secretaria/escala-pregadores:', err);
    return NextResponse.json({ error: err?.message || 'Erro ao atualizar escala.' }, { status: 500 });
  }
}

// ─── DELETE /api/v1/secretaria/escala-pregadores ──────────────────────────────
// Desfazer escala (cancelamento de atribuição deixando o evento livre)
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);
    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 });
    }

    const { canWrite, isLocalSecretary } = checkUserPermissions(ctx);
    if (!canWrite) {
      return NextResponse.json({ error: 'Sem permissão para cancelar escalas de pregadores.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const escalaId = searchParams.get('id');
    const motivoCancelamento = searchParams.get('motivo') || 'Cancelamento administrativo de escala';

    if (!escalaId) {
      return NextResponse.json({ error: 'ID da escala é obrigatório para cancelamento.', code: 'MISSING_ID' }, { status: 400 });
    }

    // Validação de congregação para Secretário Local
    if (isLocalSecretary) {
      const { data: escalaAtual } = await ctx.admin
        .from('agenda_escala_pregadores')
        .select('evento_church_id_snapshot')
        .eq('id', escalaId)
        .eq('ministry_id', ctx.ministryId)
        .single();

      if (!escalaAtual || escalaAtual.evento_church_id_snapshot !== ctx.congregacaoId) {
        return NextResponse.json(
          { error: 'Secretário local só tem autorização para cancelar escalas na sua própria congregação.', code: 'CHURCH_SCOPE_VIOLATION' },
          { status: 403 }
        );
      }
    }

    const cancelada = await EscalaPregadoresService.desfazerEscala(ctx.supabase, {
      escalaId,
      ministryId: ctx.ministryId,
      motivoCancelamento,
    });

    return NextResponse.json({ data: cancelada, message: 'Escala desfeita com sucesso. O evento está disponível para nova designação.' });
  } catch (err: any) {
    console.error('Erro em DELETE /api/v1/secretaria/escala-pregadores:', err);
    return NextResponse.json({ error: err?.message || 'Erro ao cancelar escala.' }, { status: 500 });
  }
}
