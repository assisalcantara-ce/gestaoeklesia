import { NextRequest, NextResponse } from 'next/server';
import { requireFlowAuth, hasRole } from '@/lib/flows/flow-auth';

const FALLBACK_TERMINAL = ['concluido', 'rejeitado', 'cancelado'];
const PENDING_STATUSES = ['pendente', 'aguardando', 'em_analise'];

function normalizeStatusList(list: any): Set<string> {
  if (!Array.isArray(list)) return new Set();
  return new Set(list.map((s) => String(s || '').toLowerCase()).filter(Boolean));
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, ministryId, roles, congregacaoId } = await requireFlowAuth(request);
    const congregationId = request.nextUrl.searchParams.get('congregation_id');
    const allowAll = hasRole(roles, ['ADMINISTRADOR', 'SUPERVISOR', 'SUPERINTENDENTE']);
    const wantsAll = congregationId === 'all';

    let effectiveCongregationId: string | null = null;
    if (wantsAll) {
      if (!allowAll) effectiveCongregationId = congregacaoId || null;
    } else if (congregationId) {
      effectiveCongregationId = allowAll ? congregationId : (congregacaoId || congregationId);
    } else if (!allowAll) {
      effectiveCongregationId = congregacaoId || null;
    }

    if (!allowAll && !effectiveCongregationId) {
      return NextResponse.json({ error: 'congregation_id obrigatorio' }, { status: 400 });
    }

    let query = supabase
      .from('flow_instances')
      .select('status, template_id, template_version')
      .eq('ministry_id', ministryId);

    if (effectiveCongregationId) {
      query = query.eq('congregation_id', effectiveCongregationId);
    }

    const { data: instances, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const templateIds = Array.from(new Set((instances || []).map(i => i.template_id).filter(Boolean)));
    const versionMap = new Map<string, any>();

    if (templateIds.length > 0) {
      const { data: versions } = await supabase
        .from('flow_template_versions')
        .select('template_id, version, definition_json')
        .in('template_id', templateIds);

      (versions || []).forEach(v => {
        const key = `${v.template_id}:${v.version}`;
        if (!versionMap.has(key)) versionMap.set(key, v.definition_json || null);
      });
    }

    let ativos = 0;
    let pendentes = 0;
    let concluidos = 0;

    (instances || []).forEach(i => {
      const status = String(i.status || '').toLowerCase();
      const key = `${i.template_id}:${i.template_version}`;
      const definition = versionMap.get(key);
      const terminalSet = normalizeStatusList(definition?.final_statuses);
      const isTerminal = terminalSet.size > 0
        ? terminalSet.has(status)
        : FALLBACK_TERMINAL.includes(status);

      if (isTerminal) {
        concluidos += 1;
      } else if (PENDING_STATUSES.includes(status)) {
        pendentes += 1;
      } else {
        ativos += 1;
      }
    });

    return NextResponse.json({ data: { ativos, pendentes, concluidos } });
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
