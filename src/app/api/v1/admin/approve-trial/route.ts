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

    // APROVEÇAR: Criar usuário em administração_usuarios
    const { data: adminUser, error: createError } = await supabaseAdmin
      .from('administração_usuarios')
      .insert({
        user_id: preReg.user_id,
        email: preReg.email,
        nome: preReg.pastor_name,
        ministerio: preReg.ministry_name,
        cpf_cnpj: preReg.cpf_cnpj,
        whatsapp: preReg.whatsapp,
        status: 'active',
        trial_expires_at: preReg.trial_expires_at,
        trial_days: 7,
        data_aprovacao: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (createError) {
      console.error('[APPROVE_TRIAL] Erro ao criar usuário admin:', createError)
      return NextResponse.json(
        { error: 'Erro ao liberar acesso: ' + createError.message },
        { status: 400 }
      )
    }

    // Atualizar status em pre_registrations
    const { error: updateError } = await supabaseAdmin
      .from('pre_registrations')
      .update({ status: 'active' })
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
      data: adminUser,
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
