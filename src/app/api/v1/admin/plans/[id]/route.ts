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
    const result = await requireAdmin(request, { requiredModule: 'planos' });
    if (!result.ok) return result.response;

    const { supabaseAdmin: supabase, adminUser } = result.ctx;
    const body = await request.json();

    const name = String(body?.name || '').trim();
    const slug = String(body?.slug || '').trim();
    const priceMonthly = Number(body?.price_monthly);
    const priceAnnually = Number(body?.price_annually || 0);
    const setupFee = Number(body?.setup_fee || 0);
    const additionalChurchMonthlyFee = Number(body?.additional_church_monthly_fee ?? 50);
    const additionalAdminsPerChurch = Number(body?.additional_admin_users_per_church ?? 2);

    const rawMaxUsers = body?.max_users;
    const rawMaxMinisterios = body?.max_ministerios;
    const rawMaxMembers = body?.max_members;

    const resolvedMaxMinisterios = Number.isFinite(Number(rawMaxMinisterios)) && Number(rawMaxMinisterios) > 0
      ? Number(rawMaxMinisterios)
      : 1;

    const resolvedMaxUsers = Number.isFinite(Number(rawMaxUsers)) && Number(rawMaxUsers) > 0
      ? Number(rawMaxUsers)
      : Math.max(2, resolvedMaxMinisterios * 2);

    const resolvedMaxMembers = Number.isFinite(Number(rawMaxMembers)) && Number(rawMaxMembers) >= 0
      ? Number(rawMaxMembers)
      : 0;

    if (!name || !slug) {
      return NextResponse.json({ error: 'Nome do plano e identificador (slug) são obrigatórios.' }, { status: 400 });
    }

    if (!Number.isFinite(priceMonthly) || priceMonthly < 0) {
      return NextResponse.json({ error: 'Preço mensal inválido. Informe um valor numérico maior ou igual a zero.' }, { status: 400 });
    }

    if (rawMaxUsers !== undefined && rawMaxUsers !== null && rawMaxUsers !== '' && !Number.isNaN(Number(rawMaxUsers)) && Number(rawMaxUsers) <= 0) {
      return NextResponse.json({ error: 'Limite de usuários administradores inválido (deve ser maior que zero).' }, { status: 400 });
    }

    if (rawMaxMinisterios !== undefined && rawMaxMinisterios !== null && rawMaxMinisterios !== '' && !Number.isNaN(Number(rawMaxMinisterios)) && Number(rawMaxMinisterios) <= 0) {
      return NextResponse.json({ error: 'Quantidade de igrejas inclusas inválida (deve ser no mínimo 1).' }, { status: 400 });
    }

    if (rawMaxMembers !== undefined && rawMaxMembers !== null && rawMaxMembers !== '' && !Number.isNaN(Number(rawMaxMembers)) && Number(rawMaxMembers) < 0) {
      return NextResponse.json({ error: 'Máximo de membros inválido (informe um valor numérico ou 0 para ilimitado).' }, { status: 400 });
    }

    if (!Number.isFinite(resolvedMaxUsers) || resolvedMaxUsers <= 0) {
      return NextResponse.json({ error: 'Limite de usuários administradores inválido (deve ser maior que zero).' }, { status: 400 });
    }

    if (!Number.isFinite(resolvedMaxMinisterios) || resolvedMaxMinisterios <= 0) {
      return NextResponse.json({ error: 'Quantidade de igrejas inclusas inválida (deve ser no mínimo 1).' }, { status: 400 });
    }

    if (!Number.isFinite(resolvedMaxMembers) || resolvedMaxMembers < 0) {
      return NextResponse.json({ error: 'Máximo de membros inválido (informe um valor numérico ou 0 para ilimitado).' }, { status: 400 });
    }

    if (!Number.isFinite(additionalChurchMonthlyFee) || additionalChurchMonthlyFee < 0) {
      return NextResponse.json({ error: 'Taxa mensal por igreja adicional inválida.' }, { status: 400 });
    }

    if (!Number.isFinite(additionalAdminsPerChurch) || additionalAdminsPerChurch < 0) {
      return NextResponse.json({ error: 'Quantidade de administradores adicionais por igreja inválida.' }, { status: 400 });
    }

    const payload = {
      name,
      slug,
      description: body.description,
      price_monthly: priceMonthly,
      price_annually: Number.isFinite(priceAnnually) ? priceAnnually : 0,
      setup_fee: Number.isFinite(setupFee) ? setupFee : 0,
      max_users: resolvedMaxUsers,
      max_storage_bytes: body.max_storage_bytes ?? 0,
      max_members: resolvedMaxMembers,
      max_ministerios: resolvedMaxMinisterios,
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
      is_price_on_request: body.is_price_on_request || false,
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
    const result = await requireAdmin(request, { requiredModule: 'planos' });
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
