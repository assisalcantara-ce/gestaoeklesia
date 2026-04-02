import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin } = result.ctx

    const body = await request.json()
    const { pre_registration_id, approve } = body

    if (!pre_registration_id) {
      return NextResponse.json(
        { error: 'ID do pré-cadastro é obrigatório' },
        { status: 400 }
      )
    }

    console.log('[APPROVE_TRIAL] Processando:', { pre_registration_id, approve })

    // Buscar pré-cadastro
    const { data: preReg, error: fetchError } = await supabaseAdmin
      .from('pre_registrations')
      .select('*')
      .eq('id', pre_registration_id)
      .single()

    if (fetchError || !preReg) {
      console.error('[APPROVE_TRIAL] Pré-cadastro não encontrado:', fetchError)
      return NextResponse.json(
        { error: 'Pré-cadastro não encontrado' },
        { status: 404 }
      )
    }

    if (approve === false) {
      // Deletar pré-cadastro (rejeição)
      const { error: deleteError } = await supabaseAdmin
        .from('pre_registrations')
        .delete()
        .eq('id', pre_registration_id)

      if (deleteError) {
        console.error('[APPROVE_TRIAL] Erro ao rejeitar:', deleteError)
        return NextResponse.json(
          { error: 'Erro ao rejeitar pré-cadastro' },
          { status: 400 }
        )
      }

      console.log('[APPROVE_TRIAL] ✅ Pré-cadastro rejeitado:', pre_registration_id)
      return NextResponse.json({
        success: true,
        message: 'Pré-cadastro rejeitado com sucesso',
        action: 'rejected'
      }, { status: 200 })
    }

    if (!preReg.user_id) {
      return NextResponse.json(
        { error: 'Pré-cadastro sem usuário associado. Gere credenciais antes de aprovar.' },
        { status: 400 }
      )
    }

    const slug = String(preReg.ministry_name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 80) || `ministerio-${Date.now()}`

    const { data: existingMinistry } = await supabaseAdmin
      .from('ministries')
      .select('id')
      .eq('user_id', preReg.user_id)
      .maybeSingle()

    let ministryId = existingMinistry?.id || null

    if (!ministryId) {
      const { data: ministry, error: ministryError } = await supabaseAdmin
        .from('ministries')
        .insert({
          user_id: preReg.user_id,
          name: preReg.ministry_name,
          slug,
          email_admin: preReg.email,
          cnpj_cpf: preReg.cpf_cnpj,
          phone: preReg.phone || null,
          website: preReg.website || null,
          description: preReg.description || null,
          plan: preReg.plan || 'starter',
          subscription_status: 'active',
          subscription_start_date: new Date().toISOString(),
          subscription_end_date: preReg.trial_expires_at || null,
          is_active: true,
        })
        .select('id')
        .single()

      if (ministryError || !ministry) {
        console.error('[APPROVE_TRIAL] Erro ao criar ministerio:', ministryError)
        return NextResponse.json(
          { error: 'Erro ao liberar acesso: ' + (ministryError?.message || 'ministerio') },
          { status: 400 }
        )
      }

      ministryId = ministry.id
    }

    if (ministryId) {
      const { data: existingLink } = await supabaseAdmin
        .from('ministry_users')
        .select('id')
        .eq('ministry_id', ministryId)
        .eq('user_id', preReg.user_id)
        .maybeSingle()

      if (!existingLink) {
        const { error: linkError } = await supabaseAdmin
          .from('ministry_users')
          .insert({
            ministry_id: ministryId,
            user_id: preReg.user_id,
            role: 'admin',
            is_active: true,
          })

        if (linkError) {
          console.error('[APPROVE_TRIAL] Erro ao vincular usuario ao ministerio:', linkError)
          return NextResponse.json(
            { error: 'Erro ao vincular usuario ao ministerio: ' + linkError.message },
            { status: 400 }
          )
        }
      }
    }

    // Atualizar status em pre_registrations
    const { error: updateError } = await supabaseAdmin
      .from('pre_registrations')
      .update({ status: 'trial' })
      .eq('id', pre_registration_id)

    if (updateError) {
      console.warn('[APPROVE_TRIAL] Aviso ao atualizar status:', updateError)
      // Não falhar por isso
    }

    // Criar notificação para admin
    await supabaseAdmin
      .from('admin_notifications')
      .insert({
        type: 'trial_approved',
        title: `✅ Acesso Liberado: ${preReg.ministry_name}`,
        message: `Ministério ${preReg.ministry_name} (Pastor: ${preReg.pastor_name}) foi aprovado e agora tem acesso aos 7 dias de teste.`,
        is_read: false,
        created_at: new Date().toISOString(),
      })

    console.log('[APPROVE_TRIAL] ✅ Usuário aprovado:', {
      user_id: preReg.user_id,
      email: preReg.email,
      ministry: preReg.ministry_name,
    })

    return NextResponse.json({
      success: true,
      message: 'Acesso liberado com sucesso! Usuário pode fazer login.',
      data: { ministry_id: ministryId },
      action: 'approved'
    }, { status: 201 })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[APPROVE_TRIAL] Erro geral:', errorMessage)
    return NextResponse.json(
      { error: 'Erro ao processar aprovação: ' + errorMessage },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
}
