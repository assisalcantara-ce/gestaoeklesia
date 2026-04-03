'use server';

/**
 * API ROUTE: Subscription Plans Management (by id)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await requireAdmin(request, { requiredRole: 'admin' });
    if (!result.ok) return result.response;

    const { supabaseAdmin: supabase, adminUser } = result.ctx;
    const body = await request.json();

    const payload = {
      name: body.name,
      slug: body.slug,
      description: body.description,
      price_monthly: body.price_monthly,
      price_annually: body.price_annually,
      setup_fee: body.setup_fee || 0,
      max_users: body.max_users,
      max_storage_bytes: body.max_storage_bytes,
      max_members: body.max_members,
      max_ministerios: body.max_ministerios || 1,
      max_divisao1: body.max_divisao1 ?? undefined,
      max_divisao2: body.max_divisao2 ?? undefined,
      max_divisao3: body.max_divisao3 ?? undefined,
      has_api_access: body.has_api_access || false,
      has_custom_domain: body.has_custom_domain || false,
      has_advanced_reports: body.has_advanced_reports || false,
      has_priority_support: body.has_priority_support || false,
      has_white_label: body.has_white_label || false,
      has_automation: body.has_automation || false,
      display_order: body.display_order || 0,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('subscription_plans')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || 'Falha ao atualizar plano' },
        { status: 400 }
      );
    }

    await logAuditAction(supabase, adminUser.id, 'UPDATE_PLAN', 'subscription_plans', id, payload);

    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function logAuditAction(
  supabase: any,
  adminUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  changes: any
) {
  try {
    await supabase
      .from('admin_audit_logs')
      .insert([
        {
          admin_user_id: adminUserId,
          action,
          entity_type: entityType,
          entity_id: entityId,
          changes,
          status: 'success',
        },
      ]);
  } catch (err) {
    console.error('Erro ao fazer log de auditoria:', err);
  }
}
