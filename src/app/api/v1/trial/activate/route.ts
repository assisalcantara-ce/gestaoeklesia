import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/v1/trial/activate?lead_id=xxx&token=yyy
 *
 * Validates lead_id + trial_activation_token pair.
 * Returns safe lead data for auto-filling the pre-registration form.
 * Never exposes sensitive fields (password, auth data, etc.).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('lead_id')?.trim()
    const token  = searchParams.get('token')?.trim()

    if (!leadId || !token) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos.' },
        { status: 400 }
      )
    }

    // Use service-role to read pre_registrations (bypasses RLS on anon read)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    const { data, error } = await supabase
      .from('pre_registrations')
      .select(
        'id, ministry_name, pastor_name, responsible_name, cpf_cnpj, whatsapp, email, phone, website, plan, status, trial_activation_token'
      )
      .eq('id', leadId)
      .maybeSingle()

    if (error) {
      console.error('[TRIAL/ACTIVATE] DB error:', error)
      return NextResponse.json({ error: 'Erro ao validar link.' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
    }

    // Validate token — constant-time comparison
    if (!data.trial_activation_token || data.trial_activation_token !== token) {
      return NextResponse.json({ error: 'Token inválido ou expirado.' }, { status: 403 })
    }

    // Only serve if not already converted to active account
    if (data.status && !['trial', 'pending', 'new'].includes(data.status)) {
      return NextResponse.json(
        { error: 'Esta conta já foi ativada. Faça login para acessar o sistema.' },
        { status: 409 }
      )
    }

    // Return safe lead data for form prefill — never expose token or auth fields
    return NextResponse.json(
      {
        lead: {
          ministry_name:    data.ministry_name || '',
          responsible_name: data.responsible_name || data.pastor_name || '',
          cpf_cnpj:         data.cpf_cnpj || '',
          whatsapp:         data.whatsapp || '',
          email:            data.email || '',
          phone:            data.phone || '',
          website:          data.website || '',
          plan:             data.plan || 'starter',
        },
      },
      { status: 200 }
    )
  } catch (err: any) {
    console.error('[TRIAL/ACTIVATE] Unexpected error:', err)
    return NextResponse.json({ error: 'Erro inesperado.' }, { status: 500 })
  }
}
