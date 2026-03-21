import { NextRequest, NextResponse } from 'next/server';
import { requireFlowAuth, hasRole } from '@/lib/flows/flow-auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, ministryId, roles } = await requireFlowAuth(request);
    const { id } = await params;

    const { data: instance, error } = await supabase
      .from('flow_instances')
      .select('*')
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (error || !instance) {
      return NextResponse.json({ error: 'Instancia nao encontrada' }, { status: 404 });
    }

    const { data: version } = await supabase
      .from('flow_template_versions')
      .select('definition_json')
      .eq('template_id', instance.template_id)
      .eq('version', instance.template_version)
      .maybeSingle();

    const { data: history } = await supabase
      .from('flow_history')
      .select('*')
      .eq('instance_id', instance.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ data: { instance, definition: version?.definition_json || null, history: history || [], roles } });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno do servidor';
    if (message === 'NO_MINISTRY') {
      return NextResponse.json({ error: 'Usuario sem vinculo com ministerio' }, { status: 403 });
    }
    const status = message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, ministryId, roles, congregacaoId } = await requireFlowAuth(request);
    const { id } = await params;
    const body = await request.json();
    const dataJson = body?.data_json || {};

    const { data: instance, error } = await supabase
      .from('flow_instances')
      .select('id, status, congregation_id, data_json')
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (error || !instance) {
      return NextResponse.json({ error: 'Instancia nao encontrada' }, { status: 404 });
    }

    const statusLower = String(instance.status || '').toLowerCase();
    if (!['pendente', 'aguardando'].includes(statusLower)) {
      return NextResponse.json({ error: 'STATUS_LOCKED' }, { status: 409 });
    }

    if (!hasRole(roles, ['OPERADOR', 'ADMINISTRADOR'])) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    if (!hasRole(roles, ['ADMINISTRADOR', 'SUPERVISOR', 'SUPERINTENDENTE']) && congregacaoId) {
      if (String(instance.congregation_id || '') !== String(congregacaoId)) {
        return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('flow_instances')
      .update({ data_json: dataJson })
      .eq('id', id)
      .select('id, data_json')
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message || 'Falha ao atualizar dados' }, { status: 400 });
    }

    return NextResponse.json({ data: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno do servidor';
    if (message === 'NO_MINISTRY') {
      return NextResponse.json({ error: 'Usuario sem vinculo com ministerio' }, { status: 403 });
    }
    const status = message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
