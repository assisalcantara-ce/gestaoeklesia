import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import { PlanningConflictService } from '@/lib/planning-conflict-service';
import { temAcessoEscrita } from '@/lib/access-control';

export const dynamic = 'force-dynamic';

function checkUserPermissions(ctx: any) {
  const isGlobal = ctx.isAdmin || ['administrador', 'secretario_geral', 'presidencia'].includes(ctx.nivel);
  const isLocalSecretary = ['secretaria_local', 'admin_local', 'operador'].includes(ctx.nivel);
  const canWrite = isGlobal || isLocalSecretary || temAcessoEscrita(ctx.nivel, 'agenda');

  return { isGlobal, isLocalSecretary, canWrite };
}

// ─── GET /api/v1/agenda — Lista eventos da agenda ─────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 });
    }

    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'agenda_module');
    if (!isAllowed) {
      return NextResponse.json(
        {
          error: 'A funcionalidade Agenda do Ministério está disponível a partir do Plano Starter.',
          code: 'PLAN_RESTRICTED',
          required_plan: 'starter',
        },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const visualizacao = searchParams.get('visualizacao'); // 'geral' | 'todas' | UUID congregação
    const mes = searchParams.get('mes'); // YYYY-MM opcional

    let query = ctx.admin
      .from('agenda_eventos')
      .select('*, agenda_tipos(*), agenda_planejamentos(*)')
      .eq('ministry_id', ctx.ministryId);

    if (mes) {
      const [yearStr, monthStr] = mes.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      if (year && month) {
        const startOfMonth = new Date(year, month - 1, 1).toISOString();
        const endOfMonth = new Date(year, month, 0, 23, 59, 59).toISOString();
        query = query
          .lte('data_inicio', endOfMonth)
          .or(`data_fim.gte.${startOfMonth},and(data_fim.is.null,data_inicio.gte.${startOfMonth})`);
      }
    }

    if (visualizacao === 'geral') {
      // Eventos gerais do ministério ou que geram bloqueio geral
      query = query.or('church_id.is.null,escopo.eq.organizacao,gera_bloqueio.eq.true');
    } else if (visualizacao && visualizacao !== 'todas') {
      // Congregação específica + eventos gerais que impactam o calendário
      query = query.or(`church_id.eq.${visualizacao},church_id.is.null`);
    }

    const { data: eventos, error } = await query.order('data_inicio', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Erro ao carregar eventos da agenda.', detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: eventos });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}

// ─── POST /api/v1/agenda — Criar evento na agenda com autorização server-side ──
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 });
    }

    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'agenda_module');
    if (!isAllowed) {
      return NextResponse.json(
        {
          error: 'A funcionalidade Agenda do Ministério está disponível a partir do Plano Starter.',
          code: 'PLAN_RESTRICTED',
          required_plan: 'starter',
        },
        { status: 403 }
      );
    }

    const { isLocalSecretary, canWrite } = checkUserPermissions(ctx);

    if (!canWrite) {
      return NextResponse.json({ error: 'Sem permissão para cadastrar compromissos na Agenda.', code: 'FORBIDDEN' }, { status: 403 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 });
    }

    const {
      titulo,
      descricao,
      tipo,
      tipo_id,
      data_inicio,
      data_fim,
      local,
      church_id,
      visibilidade,
      status,
      escopo,
      calendario_oficial,
      gera_bloqueio,
      regra_posicionamento,
      recorrente,
      recorrencia_tipo,
      recorrencia_config,
      planejamento_id,
      filhas,
    } = body || {};

    if (!titulo || !data_inicio) {
      return NextResponse.json({ error: 'Título e Data de Início são obrigatórios.' }, { status: 400 });
    }

    // Validações severas para Secretário Local
    let targetChurchId = church_id || null;
    let targetGeraBloqueio = Boolean(gera_bloqueio);
    let targetCalendarioOficial = Boolean(calendario_oficial);
    let targetEscopo = escopo || 'divisao1';

    if (isLocalSecretary) {
      if (!ctx.congregacaoId) {
        return NextResponse.json({ error: 'Secretário local sem congregação vinculada no perfil.', code: 'LOCAL_NO_CHURCH' }, { status: 403 });
      }
      // Não pode criar evento geral nem em outra congregação
      if (!targetChurchId || targetChurchId !== ctx.congregacaoId) {
        return NextResponse.json(
          { error: 'Secretário local só tem autorização para cadastrar eventos na sua própria congregação.', code: 'CHURCH_SCOPE_VIOLATION' },
          { status: 403 }
        );
      }
      // Não pode criar bloqueios oficiais
      if (targetGeraBloqueio) {
        return NextResponse.json(
          { error: 'Secretário local não tem autorização para criar bloqueios de datas oficiais.', code: 'BLOCK_PERMISSION_DENIED' },
          { status: 403 }
        );
      }
      targetGeraBloqueio = false;
      targetCalendarioOficial = false;
      targetEscopo = 'divisao1';
    }

    // Validação de Conflitos e Bloqueios no Backend
    const conflito = await PlanningConflictService.verificarConflito(
      ctx.admin,
      {
        titulo: String(titulo).trim(),
        data_inicio,
        data_fim: data_fim || null,
        planejamento_id: planejamento_id || null,
        ministry_id: ctx.ministryId,
        church_id: targetChurchId,
        tipo_id: tipo_id || null,
        escopo: targetEscopo,
        prioridade: targetEscopo === 'organizacao' ? 1 : 4,
        calendario_oficial: targetCalendarioOficial,
        gera_bloqueio: targetGeraBloqueio,
      },
      null
    );

    if (conflito.status === 'BLOQUEIO') {
      return NextResponse.json(
        {
          error: conflito.motivo || 'Choque de horário com bloqueio oficial existente.',
          code: 'BLOCK_CONFLICT',
          conflito: conflito.conflito,
        },
        { status: 409 }
      );
    }

    const payload = {
      ministry_id: ctx.ministryId,
      planejamento_id: planejamento_id || null,
      titulo: String(titulo).trim(),
      descricao: descricao ? String(descricao).trim() : null,
      tipo: tipo || 'outro',
      origem: 'manual',
      tipo_id: tipo_id || null,
      data_inicio,
      data_fim: data_fim || null,
      local: local ? String(local).trim() : null,
      visibilidade: visibilidade || 'ministerio',
      church_id: targetChurchId,
      status: status || 'agendado',
      escopo: targetEscopo,
      calendario_oficial: targetCalendarioOficial,
      gera_bloqueio: targetGeraBloqueio,
      regra_posicionamento: regra_posicionamento || null,
      recorrente: Boolean(recorrente),
      recorrencia_tipo: recorrencia_tipo || 'nenhuma',
      recorrencia_config: recorrencia_config || null,
      created_by: ctx.userId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: novoEvento, error } = await ctx.admin
      .from('agenda_eventos')
      .insert([payload])
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Erro ao criar evento na agenda.', detail: error.message }, { status: 500 });
    }

    // Inserção das instâncias filhas de recorrência se houver
    if (novoEvento && Array.isArray(filhas) && filhas.length > 0) {
      const filhasPayload = filhas.map((f: any) => ({
        ministry_id: ctx.ministryId,
        planejamento_id: planejamento_id || null,
        titulo: String(titulo).trim(),
        descricao: descricao ? String(descricao).trim() : null,
        tipo: tipo || 'outro',
        origem: 'manual',
        tipo_id: tipo_id || null,
        data_inicio: f.dataInicio || f.data_inicio,
        data_fim: f.dataFim || f.data_fim || null,
        local: local ? String(local).trim() : null,
        visibilidade: visibilidade || 'ministerio',
        church_id: targetChurchId,
        status: status || 'agendado',
        escopo: targetEscopo,
        calendario_oficial: targetCalendarioOficial,
        gera_bloqueio: targetGeraBloqueio,
        recorrente: true,
        recorrencia_tipo: recorrencia_tipo || 'nenhuma',
        recorrencia_pai_id: novoEvento.id,
        created_by: ctx.userId || null,
        created_at: new Date().toISOString(),
      }));

      await ctx.admin.from('agenda_eventos').insert(filhasPayload);
    }

    return NextResponse.json({ data: novoEvento }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}

// ─── PUT /api/v1/agenda — Atualizar evento na agenda com autorização server-side ─
export async function PUT(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 });
    }

    const { isLocalSecretary, canWrite } = checkUserPermissions(ctx);

    if (!canWrite) {
      return NextResponse.json({ error: 'Sem permissão para alterar compromissos na Agenda.', code: 'FORBIDDEN' }, { status: 403 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 });
    }

    const { id, ...updates } = body || {};
    if (!id) {
      return NextResponse.json({ error: 'ID do evento é obrigatório para atualização.' }, { status: 400 });
    }

    // Busca o evento existente para validar propriedade e escopo
    const { data: existing, error: findError } = await ctx.admin
      .from('agenda_eventos')
      .select('*')
      .eq('id', id)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (findError || !existing) {
      return NextResponse.json({ error: 'Compromisso não encontrado no ministério.', code: 'NOT_FOUND' }, { status: 404 });
    }

    let targetChurchId = updates.church_id !== undefined ? updates.church_id : existing.church_id;
    let targetGeraBloqueio = updates.gera_bloqueio !== undefined ? Boolean(updates.gera_bloqueio) : existing.gera_bloqueio;
    let targetCalendarioOficial = updates.calendario_oficial !== undefined ? Boolean(updates.calendario_oficial) : existing.calendario_oficial;

    if (isLocalSecretary) {
      // Secretário local só pode alterar eventos de sua própria congregação
      if (!existing.church_id || existing.church_id !== ctx.congregacaoId) {
        return NextResponse.json(
          { error: 'Secretário local só tem autorização para editar eventos de sua própria congregação.', code: 'SCOPE_VIOLATION' },
          { status: 403 }
        );
      }
      // Não pode mudar o evento para outra congregação nem geral
      if (targetChurchId !== ctx.congregacaoId) {
        return NextResponse.json(
          { error: 'Não é permitido transferir o compromisso para outra congregação.', code: 'CHURCH_TRANSFER_FORBIDDEN' },
          { status: 403 }
        );
      }
      // Não pode ativar bloqueio
      if (targetGeraBloqueio) {
        return NextResponse.json(
          { error: 'Secretário local não possui permissão para definir bloqueio oficial.', code: 'BLOCK_PERMISSION_DENIED' },
          { status: 403 }
        );
      }
      targetGeraBloqueio = false;
      targetCalendarioOficial = false;
    }

    const dataInicioEfetiva = updates.data_inicio || existing.data_inicio;
    const dataFimEfetiva = updates.data_fim !== undefined ? updates.data_fim : existing.data_fim;

    // Checar conflitos com outros eventos excluindo o próprio
    const conflito = await PlanningConflictService.verificarConflito(
      ctx.admin,
      {
        titulo: updates.titulo || existing.titulo,
        data_inicio: dataInicioEfetiva,
        data_fim: dataFimEfetiva,
        planejamento_id: existing.planejamento_id,
        ministry_id: ctx.ministryId,
        church_id: targetChurchId,
        tipo_id: updates.tipo_id || existing.tipo_id,
        escopo: updates.escopo || existing.escopo,
        prioridade: existing.prioridade || 4,
        calendario_oficial: targetCalendarioOficial,
        gera_bloqueio: targetGeraBloqueio,
      },
      id
    );

    if (conflito.status === 'BLOQUEIO') {
      return NextResponse.json(
        {
          error: conflito.motivo || 'Choque de horário com bloqueio oficial existente.',
          code: 'BLOCK_CONFLICT',
          conflito: conflito.conflito,
        },
        { status: 409 }
      );
    }

    const payloadAtualizacao: any = {
      ...updates,
      church_id: targetChurchId,
      gera_bloqueio: targetGeraBloqueio,
      calendario_oficial: targetCalendarioOficial,
      updated_at: new Date().toISOString(),
    };
    delete payloadAtualizacao.id;
    delete payloadAtualizacao.ministry_id;
    delete payloadAtualizacao.created_at;
    delete payloadAtualizacao.created_by;

    const { data: updatedEvento, error: updateError } = await ctx.admin
      .from('agenda_eventos')
      .update(payloadAtualizacao)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao atualizar compromisso.', detail: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ data: updatedEvento });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}

// ─── DELETE /api/v1/agenda — Excluir evento na agenda com autorização server-side 
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 });
    }

    const { isLocalSecretary, canWrite } = checkUserPermissions(ctx);

    if (!canWrite) {
      return NextResponse.json({ error: 'Sem permissão para excluir compromissos na Agenda.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body?.id;
      } catch {
        // Ignora body vazio
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'ID do evento é obrigatório para exclusão.' }, { status: 400 });
    }

    const { data: existing, error: findError } = await ctx.admin
      .from('agenda_eventos')
      .select('*')
      .eq('id', id)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (findError || !existing) {
      return NextResponse.json({ error: 'Compromisso não encontrado no ministério.', code: 'NOT_FOUND' }, { status: 404 });
    }

    if (isLocalSecretary) {
      if (!existing.church_id || existing.church_id !== ctx.congregacaoId) {
        return NextResponse.json(
          { error: 'Secretário local só tem autorização para excluir compromissos de sua própria congregação.', code: 'SCOPE_VIOLATION' },
          { status: 403 }
        );
      }
      if (existing.gera_bloqueio) {
        return NextResponse.json(
          { error: 'Secretário local não tem autorização para excluir bloqueios oficiais de datas.', code: 'BLOCK_PERMISSION_DENIED' },
          { status: 403 }
        );
      }
      if (existing.escopo === 'organizacao') {
        return NextResponse.json(
          { error: 'Secretário local não tem autorização para excluir eventos de escopo geral da organização.', code: 'ORGANIZATION_SCOPE_VIOLATION' },
          { status: 403 }
        );
      }
    }

    const { error: deleteError } = await ctx.admin
      .from('agenda_eventos')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: 'Erro ao excluir compromisso.', detail: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
