import { NextRequest, NextResponse } from 'next/server';
import { requireFlowAuth, hasRole } from '@/lib/flows/flow-auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, ministryId, userId, roles } = await requireFlowAuth(request);

    if (!hasRole(roles, 'ADMINISTRADOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const name = body?.name;
    const description = body?.description;
    const definition = body?.definition_json || body?.definition || null;

    const { data: template, error: templateErr } = await supabase
      .from('flow_templates')
      .select('*')
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (templateErr || !template) {
      return NextResponse.json({ error: 'Template nao encontrado' }, { status: 404 });
    }

    if (name || description) {
      const { data: updatedRows, error: updateErr } = await supabase
        .from('flow_templates')
        .update({
          name: name ?? template.name,
          description: description ?? template.description,
          updated_at: new Date().toISOString(),
        })
        .eq('id', template.id)
        .eq('ministry_id', ministryId)
        .select('id');

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 });
      }

      if (!updatedRows || updatedRows.length === 0) {
        return NextResponse.json({ error: 'RLS bloqueou ou recurso inexistente' }, { status: 403 });
      }
    }

    if (definition) {
      const nextVersion = Number(template.current_version || 1) + 1;
      const { error: versionErr } = await supabase
        .from('flow_template_versions')
        .insert({
          template_id: template.id,
          version: nextVersion,
          definition_json: definition,
          published_by: userId,
          published_at: null,
        });

      if (versionErr) {
        return NextResponse.json({ error: versionErr.message }, { status: 400 });
      }

      const { data: versionUpdateRows } = await supabase
        .from('flow_templates')
        .update({
          current_version: nextVersion,
          is_published: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', template.id)
        .eq('ministry_id', ministryId)
        .select('id');

      if (!versionUpdateRows || versionUpdateRows.length === 0) {
        return NextResponse.json({ error: 'RLS bloqueou ou recurso inexistente' }, { status: 403 });
      }
    }

    return NextResponse.json({ data: { id: template.id } });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno do servidor';
    if (message === 'NO_MINISTRY') {
      return NextResponse.json({ error: 'Usuario sem vinculo com ministerio' }, { status: 403 });
    }
    const status = message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
