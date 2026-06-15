import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireAdmin(request, { requiredCapability: 'can_manage_ministries' })
    if (!result.ok) return result.response
    const { supabaseAdmin, adminUser } = result.ctx

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID do ministério é obrigatório' }, { status: 400 })
    }

    const body = await request.json()
    const modo = body?.modo
    const planSlug = body?.plano_slug
    const validityMonths = Number(body?.validade_meses ?? 12)

    if (modo !== 'direto') {
      return NextResponse.json({ error: 'Apenas ativação direta é permitida nesta entrega' }, { status: 400 })
    }

    if (!planSlug || !['starter', 'intermediario', 'profissional'].includes(planSlug)) {
      return NextResponse.json({ error: 'Plano inválido selecionado' }, { status: 400 })
    }

    // 1. Buscar ministério atual para auditoria
    const { data: ministry, error: fetchError } = await supabaseAdmin
      .from('ministries')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !ministry) {
      return NextResponse.json({ error: 'Ministério não encontrado' }, { status: 404 })
    }

    // 2. Buscar plano correspondente para associar subscription_plan_id
    const { data: planRow } = await supabaseAdmin
      .from('subscription_plans')
      .select('id')
      .eq('slug', planSlug)
      .maybeSingle()

    // Calcular datas
    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + validityMonths)

    // Atualizar ministério
    const { data: updatedMinistry, error: updateError } = await supabaseAdmin
      .from('ministries')
      .update({
        subscription_status: 'active',
        plan: planSlug,
        subscription_plan_id: planRow?.id || null,
        subscription_start_date: startDate.toISOString(),
        subscription_end_date: endDate.toISOString(),
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: `Erro ao atualizar ministério: ${updateError.message}` }, { status: 400 })
    }

    // 3. Buscar e atualizar pre_registrations usando robustez (ministry_id com fallback para user_id)
    let preRegData = null
    try {
      const { data } = await supabaseAdmin
        .from('pre_registrations')
        .select('id, user_id')
        .eq('ministry_id', id)
        .maybeSingle()
      preRegData = data
    } catch {
      // Ignorar erro se coluna ministry_id não existir
    }

    if (!preRegData && ministry.user_id) {
      const { data } = await supabaseAdmin
        .from('pre_registrations')
        .select('id, user_id')
        .eq('user_id', ministry.user_id)
        .maybeSingle()
      preRegData = data
    }

    let hasPreRegUpdated = false
    if (preRegData?.id) {
      const { error: preRegUpdateError } = await supabaseAdmin
        .from('pre_registrations')
        .update({ status: 'efetivado' })
        .eq('id', preRegData.id)
      if (!preRegUpdateError) {
        hasPreRegUpdated = true
      }
    }

    // 4. Registrar logs detalhados
    const changesLog = {
      status_anterior: ministry.subscription_status,
      plano_anterior: ministry.plan,
      subscription_end_date_anterior: ministry.subscription_end_date,
      novo_plano: planSlug,
      nova_validade_meses: validityMonths,
      admin_responsavel: adminUser.email,
      modo: 'direto',
      observacao: body.observacao || '',
      pre_registration_vinculado_atualizado: hasPreRegUpdated
    }

    await supabaseAdmin
      .from('admin_audit_logs')
      .insert([{
        admin_user_id: adminUser.id,
        action: 'ACTIVATE_MINISTRY',
        entity_type: 'ministries',
        entity_id: id,
        changes: changesLog,
        status: 'success',
      }])

    return NextResponse.json({
      success: true,
      data: updatedMinistry,
      message: 'Ministério ativado com sucesso!'
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
