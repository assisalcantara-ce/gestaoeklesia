import { NextRequest, NextResponse } from 'next/server';
import { requireFlowAuth, hasRole } from '@/lib/flows/flow-auth';
import { getAvailableActions } from '@/lib/flows/flow-engine';

const APPROVAL_TOKENS = ['aprovar', 'rejeitar', 'approve', 'reject'];

function hasApprovalAction(definition: any): boolean {
  const transitions = Array.isArray(definition?.transitions) ? definition.transitions : [];
  return transitions.some((transition: any) => {
    const action = String(transition?.action || '').toLowerCase();
    return APPROVAL_TOKENS.some((token) => action.includes(token));
  });
}

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

export async function GET(request: NextRequest) {
  try {
    const { supabase, ministryId, roles, congregacaoId } = await requireFlowAuth(request);
    const status = request.nextUrl.searchParams.get('status');
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
      .select('id, template_id, template_version, title, status, current_assignee_role, current_assignee_user_id, created_at, updated_at, template:flow_templates(id,name)')
      .eq('ministry_id', ministryId)
      .order('created_at', { ascending: false });

    if (effectiveCongregationId) {
      query = query.eq('congregation_id', effectiveCongregationId);
    }

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (!data || data.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const templateIds = Array.from(new Set(data.map((item) => item.template_id).filter(Boolean)));
    const versions = Array.from(new Set(data.map((item) => item.template_version).filter(Boolean)));

    let definitionMap = new Map<string, any>();
    if (templateIds.length > 0 && versions.length > 0) {
      const { data: definitionRows, error: definitionError } = await supabase
        .from('flow_template_versions')
        .select('template_id, version, definition_json')
        .in('template_id', templateIds)
        .in('version', versions);

      if (!definitionError && definitionRows) {
        definitionRows.forEach((row) => {
          const key = `${row.template_id}:${row.version}`;
          definitionMap.set(key, row.definition_json);
        });
      }
    }

    const enriched = data.map((item) => {
      const key = `${item.template_id}:${item.template_version}`;
      const definition = definitionMap.get(key);
      if (!definition) {
        return { ...item, available_actions: [], has_approval_actions: false };
      }

      const actions = getAvailableActions(
        {
          id: item.id,
          status: item.status,
          data_json: {},
          current_assignee_role: item.current_assignee_role,
        },
        definition,
        roles
      ).map((transition) => transition.action);

      return {
        ...item,
        available_actions: actions,
        has_approval_actions: hasApprovalAction(definition),
      };
    });

    return NextResponse.json({ data: enriched });
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
    const { supabase, ministryId, userId } = await requireFlowAuth(request);
    const body = await request.json();

    const templateId = String(body?.template_id || '').trim();
    const congregationId = String(body?.congregation_id || '').trim();
    if (!templateId) {
      return NextResponse.json({ error: 'template_id obrigatorio' }, { status: 400 });
    }
    if (!congregationId) {
      return NextResponse.json({ error: 'congregation_id obrigatorio' }, { status: 400 });
    }

    const { data: template } = await supabase
      .from('flow_templates')
      .select('id,current_version,is_published,name')
      .eq('id', templateId)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (!template || !template.is_published) {
      return NextResponse.json({ error: 'Template nao publicado' }, { status: 400 });
    }

    const { data: activation } = await supabase
      .from('flow_activations')
      .select('is_active, assignees_json')
      .eq('template_id', templateId)
      .eq('ministry_id', ministryId)
      .eq('congregation_id', congregationId)
      .maybeSingle();

    if (!activation?.is_active) {
      return NextResponse.json({ error: 'Fluxo nao ativo para esta congregacao' }, { status: 403 });
    }

    const { data: version } = await supabase
      .from('flow_template_versions')
      .select('definition_json')
      .eq('template_id', templateId)
      .eq('version', template.current_version)
      .maybeSingle();

    if (!version?.definition_json) {
      return NextResponse.json({ error: 'Definicao nao encontrada' }, { status: 404 });
    }

    const definition = version.definition_json as any;
    const initialStatus = definition.initial_status || 'pendente';
    const initialAssigneeRole = definition.initial_assignee_role || null;
    const initialAssigneeUserId = resolveAssignedUserId(activation?.assignees_json, initialAssigneeRole);

    const { data: instance, error } = await supabase
      .from('flow_instances')
      .insert({
        template_id: templateId,
        template_version: template.current_version,
        ministry_id: ministryId,
        congregation_id: congregationId,
        title: body?.title || template.name,
        status: initialStatus,
        data_json: body?.data_json || {},
        current_assignee_role: initialAssigneeRole,
        current_assignee_user_id: initialAssigneeUserId,
        created_by: userId,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: instance });
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
