import { NextRequest, NextResponse } from 'next/server';
import { requireFlowAuth, hasRole } from '@/lib/flows/flow-auth';
import { createServerClient } from '@/lib/supabase-server';
import { FLOW_SEEDS } from '@/lib/flows/flow-seeds';

export async function GET(request: NextRequest) {
  try {
    const { supabase, ministryId, roles } = await requireFlowAuth(request);

    const { data: templates, error } = await supabase
      .from('flow_templates')
      .select('*')
      .eq('ministry_id', ministryId)
      .order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const allowSeedFallback = process.env.FEATURE_SEED_FALLBACK === 'true';
    if ((!templates || templates.length === 0) && allowSeedFallback) {
      const seedClient = hasRole(roles, 'ADMINISTRADOR') ? supabase : createServerClient();
      const created = await seedFlowTemplates(seedClient, ministryId);
      return NextResponse.json({ data: created });
    }

    const templateIds = (templates || []).map(t => t.id);
    const { data: versions } = await supabase
      .from('flow_template_versions')
      .select('template_id,version,definition_json,published_at')
      .in('template_id', templateIds)
      .order('version', { ascending: false });

    const byTemplate = new Map<string, any>();
    (versions || []).forEach(v => {
      if (!byTemplate.has(v.template_id)) byTemplate.set(v.template_id, v);
    });

    const payload = (templates || []).map(t => ({
      ...t,
      latest_version: byTemplate.get(t.id) || null,
    }));

    return NextResponse.json({ data: payload });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno do servidor';
    if (message === 'TRIAL_EXPIRED') {
      return NextResponse.json({ error: 'Expirado' }, { status: 403 });
    }
    if (message === 'NO_MINISTRY') {
      return NextResponse.json({ error: 'Usuario sem vinculo com ministerio' }, { status: 403 });
    }
    const status = message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, ministryId, userId, roles } = await requireFlowAuth(request);

    if (!hasRole(roles, 'ADMINISTRADOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const name = String(body?.name || '').trim();
    const description = body?.description || null;
    const definition = body?.definition_json || body?.definition || null;

    if (!name || !definition) {
      return NextResponse.json({ error: 'name e definition_json sao obrigatorios' }, { status: 400 });
    }

    const { data: template, error: templateErr } = await supabase
      .from('flow_templates')
      .insert({
        ministry_id: ministryId,
        name,
        description,
        created_by: userId,
        is_published: false,
        current_version: 1,
      })
      .select('*')
      .single();

    if (templateErr || !template) {
      return NextResponse.json({ error: templateErr?.message || 'Falha ao criar template' }, { status: 400 });
    }

    const { error: versionErr } = await supabase
      .from('flow_template_versions')
      .insert({
        template_id: template.id,
        version: 1,
        definition_json: definition,
        published_by: userId,
        published_at: null,
      });

    if (versionErr) {
      return NextResponse.json({ error: versionErr.message }, { status: 400 });
    }

    return NextResponse.json({ data: template });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno do servidor';
    if (message === 'TRIAL_EXPIRED') {
      return NextResponse.json({ error: 'Expirado' }, { status: 403 });
    }
    if (message === 'NO_MINISTRY') {
      return NextResponse.json({ error: 'Usuario sem vinculo com ministerio' }, { status: 403 });
    }
    const status = message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function seedFlowTemplates(supabase: any, ministryId: string) {
  const created: any[] = [];

  for (const seed of FLOW_SEEDS) {
    const { data: template } = await supabase
      .from('flow_templates')
      .insert({
        ministry_id: ministryId,
        name: seed.name,
        description: seed.description,
        current_version: 1,
        is_published: true,
      })
      .select('*')
      .single();

    if (!template) continue;

    await supabase
      .from('flow_template_versions')
      .insert({
        template_id: template.id,
        version: 1,
        definition_json: seed.definition,
        published_at: new Date().toISOString(),
      });

    created.push(template);
  }

  return created;
}
