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

    const name = String(body?.name || '').trim();
    const slug = String(body?.slug || '').trim();
    const priceMonthly = Number(body?.price_monthly);
    const priceAnnually = Number(body?.price_annually || 0);
    const setupFee = Number(body?.setup_fee || 0);
    const maxUsers = Number(body?.max_users);
    const maxMembers = Number(body?.max_members ?? 0);
    const maxMinisterios = Number(body?.max_ministerios);
    const additionalChurchMonthlyFee = Number(body?.additional_church_monthly_fee ?? 50);
    const additionalAdminsPerChurch = Number(body?.additional_admin_users_per_church ?? 2);

    if (!name || !slug) {
      return NextResponse.json({ error: 'Campos obrigatórios: name, slug' }, { status: 400 });
    }

    if (!Number.isFinite(priceMonthly) || priceMonthly <= 0) {
      return NextResponse.json({ error: 'price_monthly inválido' }, { status: 400 });
    }

    if (!Number.isFinite(maxUsers) || maxUsers <= 0) {
      return NextResponse.json({ error: 'max_users inválido' }, { status: 400 });
    }

    if (!Number.isFinite(maxMinisterios) || maxMinisterios <= 0) {
      return NextResponse.json({ error: 'max_ministerios inválido' }, { status: 400 });
    }

    if (!Number.isFinite(maxMembers) || maxMembers < 0) {
      return NextResponse.json({ error: 'max_members inválido (use 0 para ilimitado)' }, { status: 400 });
    }

    if (!Number.isFinite(additionalChurchMonthlyFee) || additionalChurchMonthlyFee < 0) {
      return NextResponse.json({ error: 'additional_church_monthly_fee inválido' }, { status: 400 });
    }

    if (!Number.isFinite(additionalAdminsPerChurch) || additionalAdminsPerChurch < 0) {
      return NextResponse.json({ error: 'additional_admin_users_per_church inválido' }, { status: 400 });
    }

    const payload = {
      name,
      slug,
      description: body.description,
      price_monthly: priceMonthly,
      price_annually: Number.isFinite(priceAnnually) ? priceAnnually : 0,
      setup_fee: Number.isFinite(setupFee) ? setupFee : 0,
      max_users: maxUsers,
      max_storage_bytes: body.max_storage_bytes ?? 0,
      max_members: maxMembers,
      max_ministerios: maxMinisterios,
      additional_church_monthly_fee: additionalChurchMonthlyFee,
      additional_admin_users_per_church: additionalAdminsPerChurch,
      max_divisao2: body.max_divisao2 ?? undefined,
      max_divisao3: body.max_divisao3 ?? undefined,
      has_api_access: body.has_api_access || false,
      has_custom_domain: body.has_custom_domain || false,
      has_advanced_reports: body.has_advanced_reports || false,
      has_priority_support: body.has_priority_support || false,
      has_modulo_financeiro: body.has_modulo_financeiro || false,
      has_modulo_eventos: body.has_modulo_eventos || false,
      has_modulo_reunioes: body.has_modulo_reunioes || false,
      has_white_label: body.has_white_label || false,
      has_automation: body.has_automation || false,
      modulos: Array.isArray(body.modulos) ? body.modulos : [],
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await requireAdmin(request, { requiredRole: 'admin' });
    if (!result.ok) return result.response;

    const { supabaseAdmin: supabase, adminUser } = result.ctx;

    const { data, error } = await supabase
      .from('subscription_plans')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, name, is_active')
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || 'Falha ao desativar plano' },
        { status: 400 }
      );
    }

    await logAuditAction(supabase, adminUser.id, 'DEACTIVATE_PLAN', 'subscription_plans', id, {
      is_active: false,
    });

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
