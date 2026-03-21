import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// Tipos de status disponíveis
export const ATTENDANCE_STATUSES = {
  NOT_CONTACTED: 'not_contacted',
  IN_PROGRESS: 'in_progress',
  BUDGET_SENT: 'budget_sent',
  CONTRACT_GENERATING: 'contract_generating',
  FINALIZED_POSITIVE: 'finalized_positive',
  FINALIZED_NEGATIVE: 'finalized_negative',
} as const;

// Labels em português
export const STATUS_LABELS: Record<string, string> = {
  not_contacted: '❌ Não Atendido',
  in_progress: '📞 Em Atendimento',
  budget_sent: '💰 Orçamento Enviado',
  contract_generating: '📄 Gerando Contrato',
  finalized_positive: '✅ Finalizado - Positivo',
  finalized_negative: '❌ Finalizado - Negativo',
};

// GET /api/v1/admin/attendance - Listar todos os atendimentos
export async function GET(request: NextRequest) {
  try {
    const guard = await requireAdmin(request, { requiredRole: 'admin' })
    if (!guard.ok) return guard.response

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Construir query base
    let query = supabaseAdmin
      .from('attendance_status')
      .select(`
        *,
        pre_registration:pre_registrations(
          id,
          ministry_name,
          pastor_name,
          email,
          whatsapp,
          cpf_cnpj,
          quantity_temples,
          quantity_members,
          status,
          trial_expires_at,
          created_at
        ),
        attendance_history(id, to_status, changed_by, created_at)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Filtrar por status se fornecido
    if (status && Object.values(ATTENDANCE_STATUSES).includes(status as any)) {
      query = query.eq('status', status);
    }

    // Aplicar paginação
    const { data, count, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching attendance status:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      meta: {
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/v1/admin/attendance:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/v1/admin/attendance - Criar novo atendimento
export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin(request, { requiredRole: 'admin' })
    if (!guard.ok) return guard.response

    const body = await request.json();
    const { pre_registration_id, status, notes, assigned_to } = body;

    // Validações
    if (!pre_registration_id) {
      return NextResponse.json(
        { success: false, error: 'pre_registration_id é obrigatório' },
        { status: 400 }
      );
    }

    if (status && !Object.values(ATTENDANCE_STATUSES).includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Status inválido' },
        { status: 400 }
      );
    }

    // Verificar se pré-registro existe
    const { data: preReg, error: preRegError } = await supabaseAdmin
      .from('pre_registrations')
      .select('id')
      .eq('id', pre_registration_id)
      .single();

    if (preRegError || !preReg) {
      return NextResponse.json(
        { success: false, error: 'Pré-registro não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se já existe attendance_status
    const { data: existing } = await supabaseAdmin
      .from('attendance_status')
      .select('id')
      .eq('pre_registration_id', pre_registration_id)
      .single();

    let result;
    if (existing) {
      // Atualizar existente
      const { data, error } = await supabaseAdmin
        .from('attendance_status')
        .update({
          status: status || ATTENDANCE_STATUSES.NOT_CONTACTED,
          notes: notes || null,
          assigned_to: assigned_to || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Criar novo
      const { data, error } = await supabaseAdmin
        .from('attendance_status')
        .insert({
          pre_registration_id,
          status: status || ATTENDANCE_STATUSES.NOT_CONTACTED,
          notes: notes || null,
          assigned_to: assigned_to || null,
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json({
      success: true,
      data: result,
      meta: { action: existing ? 'updated' : 'created' },
    });
  } catch (error) {
    console.error('Error in POST /api/v1/admin/attendance:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/v1/admin/attendance/:id - Atualizar atendimento
export async function PUT(request: NextRequest) {
  try {
    const guard = await requireAdmin(request, { requiredRole: 'admin' })
    if (!guard.ok) return guard.response

    const body = await request.json();
    const { id, status, notes, assigned_to, next_followup_at, last_contact_at } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id é obrigatório' },
        { status: 400 }
      );
    }

    // Obter status atual
    const { data: current, error: currentError } = await supabaseAdmin
      .from('attendance_status')
      .select('status, pre_registration_id')
      .eq('id', id)
      .single();

    if (currentError || !current) {
      return NextResponse.json(
        { success: false, error: 'Atendimento não encontrado' },
        { status: 404 }
      );
    }

    // Atualizar attendance_status
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('attendance_status')
      .update({
        status: status || current.status,
        notes: notes !== undefined ? notes : null,
        assigned_to: assigned_to || null,
        last_contact_at: last_contact_at || new Date().toISOString(),
        next_followup_at: next_followup_at || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Registrar mudança de status no histórico
    if (status && status !== current.status) {
      const { error: historyError } = await supabaseAdmin
        .from('attendance_history')
        .insert({
          attendance_status_id: id,
          from_status: current.status,
          to_status: status,
          changed_by: 'system', // Em produção, usar auth.uid()
          notes: notes || null,
        });

      if (historyError) console.error('Error recording history:', historyError);
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Error in PUT /api/v1/admin/attendance:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
