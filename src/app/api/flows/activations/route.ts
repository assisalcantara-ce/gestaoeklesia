import { NextRequest, NextResponse } from 'next/server';
import { requireFlowAuth, hasRole } from '@/lib/flows/flow-auth';

export async function GET(request: NextRequest) {
  try {
    const { supabase, ministryId, roles, congregacaoId } = await requireFlowAuth(request);
    const congregationId = request.nextUrl.searchParams.get('congregation_id');
    const allowAll = hasRole(roles, ['ADMINISTRADOR', 'SUPERVISOR', 'SUPERINTENDENTE']);
    const wantsAll = congregationId === 'all';

    let effectiveCongregationId: string | null = null;
    if (wantsAll) {
      if (!allowAll) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (congregationId) {
      effectiveCongregationId = allowAll ? congregationId : (congregacaoId || congregationId);
    } else if (!allowAll) {
      effectiveCongregationId = congregacaoId || null;
    }

    if (!allowAll && !effectiveCongregationId) {
      return NextResponse.json({ error: 'congregation_id obrigatorio' }, { status: 400 });
    }

    let query = supabase
      .from('flow_activations')
      .select('id, template_id, is_active, assignees_json, settings_json, updated_at, template:flow_templates(id,name,description,is_published,current_version)')
      .eq('ministry_id', ministryId)
      .order('updated_at', { ascending: false });

    if (effectiveCongregationId) {
      query = query.eq('congregation_id', effectiveCongregationId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data || [] });
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
