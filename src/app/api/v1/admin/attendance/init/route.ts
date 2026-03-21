/**
 * POST /api/v1/admin/attendance/init
 * 
 * Inicializa um atendimento quando um pré-cadastro é aprovado
 * Cria o registro de attendance_status e redireciona para o painel
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response

    const body = await request.json()
    const { pre_registration_id } = body

    if (!pre_registration_id) {
      return NextResponse.json(
        { success: false, error: 'pre_registration_id é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Verificar se já existe um attendance_status para este pré-cadastro
    const { data: existingAttendance } = await supabase
      .from('attendance_status')
      .select('id')
      .eq('pre_registration_id', pre_registration_id)
      .single()

    if (existingAttendance) {
      // Já existe, retorna o ID
      return NextResponse.json({
        success: true,
        data: { id: existingAttendance.id },
        message: 'Atendimento já existente'
      })
    }

    // Criar novo registro de attendance_status
    const { data: newAttendance } = await supabase
      .from('attendance_status')
      .insert([
        {
          pre_registration_id,
          status: 'in_progress', // Começar como "Em atendimento"
          notes: 'Atendimento iniciado via aprovação do pré-cadastro'
        }
      ])
      .select('id')
      .single()

    if (!newAttendance) {
      console.error('[ATTENDANCE_INIT] Erro ao criar atendimento')
      return NextResponse.json(
        { 
          success: false, 
          error: 'Erro ao inicializar atendimento',
        },
        { status: 500 }
      )
    }

    console.log('[ATTENDANCE_INIT] ✅ Atendimento criado:', newAttendance.id)

    return NextResponse.json({
      success: true,
      data: newAttendance,
      message: 'Atendimento inicializado com sucesso'
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[ATTENDANCE_INIT] Erro:', errorMessage)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
