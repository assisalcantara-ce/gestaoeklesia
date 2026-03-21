import { NextRequest, NextResponse } from 'next/server';
import { requireFlowAuth } from '@/lib/flows/flow-auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, ministryId, userId } = await requireFlowAuth(request);
    const body = await request.json();
    const congregationId = String(body?.congregation_id || '').trim();
    if (!congregationId) {
      return NextResponse.json({ error: 'congregation_id obrigatorio' }, { status: 400 });
    }
    if (congregationId === 'all') {
      return NextResponse.json({ error: 'congregation_id invalido' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('flow_activations')
      .upsert({
        template_id: id,
        ministry_id: ministryId,
        congregation_id: congregationId,
        is_active: true,
        assignees_json: body?.assignees_json || {},
        settings_json: body?.settings_json || {},
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'ministry_id,congregation_id,template_id' })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data?.id) {
      return NextResponse.json({ error: 'RLS bloqueou ou recurso inexistente' }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno do servidor';
    if (message === 'NO_MINISTRY') {
      return NextResponse.json({ error: 'Usuario sem vinculo com ministerio' }, { status: 403 });
    }
    const status = message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
