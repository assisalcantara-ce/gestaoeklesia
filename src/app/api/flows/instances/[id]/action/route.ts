import { NextRequest, NextResponse } from 'next/server';
import { requireFlowAuth } from '@/lib/flows/flow-auth';
import { applyAction } from '@/lib/flows/flow-engine';

function resolveAssignedUserId(assigneesJson: any, role?: string | null): string | null {
  if (!role) return null;
  const mapping = assigneesJson?.users_by_role || assigneesJson?.usersByRole;
  if (!mapping || typeof mapping !== 'object') return null;
  const target = String(role).toUpperCase();
  const entries = Object.entries(mapping as Record<string, any>);
  const match = entries.find(([key]) => String(key).toUpperCase() === target);
  if (!match) return null;
  const value = match[1];
  if (Array.isArray(value)) return value[0] ? String(value[0]) : null;
  return value ? String(value) : null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, ministryId, userId, roles } = await requireFlowAuth(request);
    const body = await request.json();

    const { data: instance } = await supabase
      .from('flow_instances')
      .select('*')
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (!instance) {
      return NextResponse.json({ error: 'Instancia nao encontrada' }, { status: 404 });
    }

    const { data: version } = await supabase
      .from('flow_template_versions')
      .select('definition_json')
      .eq('template_id', instance.template_id)
      .eq('version', instance.template_version)
      .maybeSingle();

    if (!version?.definition_json) {
      return NextResponse.json({ error: 'Definicao nao encontrada' }, { status: 404 });
    }

    const result = applyAction(
      {
        id: instance.id,
        status: instance.status,
        data_json: instance.data_json || {},
        current_assignee_role: instance.current_assignee_role,
      },
      version.definition_json as any,
      body?.action,
      roles,
      { data: body?.data_json || {}, note: body?.note }
    );

    const { data: activation } = await supabase
      .from('flow_activations')
      .select('assignees_json')
      .eq('template_id', instance.template_id)
      .eq('ministry_id', ministryId)
      .eq('congregation_id', instance.congregation_id)
      .maybeSingle();

    const nextAssigneeUserId = resolveAssignedUserId(activation?.assignees_json, result.nextAssigneeRole || null);

    const { data: updatedRows, error: updateErr } = await supabase
      .from('flow_instances')
      .update({
        status: result.nextStatus,
        data_json: result.nextData,
        current_assignee_role: result.nextAssigneeRole,
        current_assignee_user_id: nextAssigneeUserId,
        updated_at: new Date().toISOString(),
        closed_at: result.closedAt || null,
      })
      .eq('id', instance.id)
      .eq('ministry_id', ministryId)
      .eq('congregation_id', instance.congregation_id)
      .select('id');

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json({ error: 'RLS bloqueou ou recurso inexistente' }, { status: 403 });
    }

    await supabase
      .from('flow_history')
      .insert({
        instance_id: instance.id,
        action: body?.action,
        from_status: instance.status,
        to_status: result.nextStatus,
        user_id: userId,
        note: body?.note || null,
      });

    return NextResponse.json({ data: { status: result.nextStatus } });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno do servidor';
    const status = message === 'UNAUTHORIZED' ? 401 : 500;
    if (message === 'ACTION_NOT_ALLOWED') {
      return NextResponse.json({ error: 'Acao nao permitida' }, { status: 403 });
    }
    if (message === 'MISSING_FIELDS') {
      return NextResponse.json({ error: 'Campos obrigatorios ausentes' }, { status: 400 });
    }
    if (message === 'NOTE_REQUIRED') {
      return NextResponse.json({ error: 'Nota obrigatoria' }, { status: 400 });
    }
    if (message === 'NO_MINISTRY') {
      return NextResponse.json({ error: 'Usuario sem vinculo com ministerio' }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status });
  }
}
