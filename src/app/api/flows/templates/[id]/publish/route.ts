import { NextRequest, NextResponse } from 'next/server';
import { requireFlowAuth, hasRole } from '@/lib/flows/flow-auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, ministryId, userId, roles } = await requireFlowAuth(request);

    if (!hasRole(roles, 'ADMINISTRADOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const definition = body?.definition_json || body?.definition || null;

    const { data: template } = await supabase
      .from('flow_templates')
      .select('*')
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (!template) {
      return NextResponse.json({ error: 'Template nao encontrado' }, { status: 404 });
    }

    let versionToPublish = Number(template.current_version || 1);

    if (definition) {
      versionToPublish = versionToPublish + 1;
      const { error: insertErr } = await supabase
        .from('flow_template_versions')
        .insert({
          template_id: template.id,
          version: versionToPublish,
          definition_json: definition,
          published_by: userId,
          published_at: new Date().toISOString(),
        });

      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 400 });
      }
    } else {
      const { data: publishedRows } = await supabase
        .from('flow_template_versions')
        .update({
          published_by: userId,
          published_at: new Date().toISOString(),
        })
        .eq('template_id', template.id)
        .eq('version', versionToPublish)
        .select('id');

      if (!publishedRows || publishedRows.length === 0) {
        return NextResponse.json({ error: 'RLS bloqueou ou recurso inexistente' }, { status: 403 });
      }
    }

    const { data: templateRows } = await supabase
      .from('flow_templates')
      .update({
        is_published: true,
        current_version: versionToPublish,
        updated_at: new Date().toISOString(),
      })
      .eq('id', template.id)
      .eq('ministry_id', ministryId)
      .select('id');

    if (!templateRows || templateRows.length === 0) {
      return NextResponse.json({ error: 'RLS bloqueou ou recurso inexistente' }, { status: 403 });
    }

    return NextResponse.json({ data: { id: template.id, version: versionToPublish } });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno do servidor';
    if (message === 'NO_MINISTRY') {
      return NextResponse.json({ error: 'Usuario sem vinculo com ministerio' }, { status: 403 });
    }
    const status = message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
