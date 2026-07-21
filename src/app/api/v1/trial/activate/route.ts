import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TrialService, TrialError } from '@/lib/platform'

/**
 * GET /api/v1/trial/activate?lead_id=xxx&token=yyy
 *
 * Validates lead_id + trial_activation_token pair.
 * Returns safe lead data for auto-filling the pre-registration form.
 * Never exposes sensitive fields (password, auth data, etc.).
 */
export async function GET(request: NextRequest) {
  try {
    // Leitura da requisição — responsabilidade da rota
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('lead_id')?.trim()
    const token  = searchParams.get('token')?.trim()

    if (!leadId || !token) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos.' },
        { status: 400 }
      )
    }

    // Supabase com service-role para leitura de pre_registrations (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Delega ao TrialService toda a lógica de validação e elegibilidade
    const trialService = new TrialService()
    const result = await trialService.activateTrial(supabase, leadId, token)

    return NextResponse.json({ lead: result.lead }, { status: 200 })
  } catch (err: any) {
    if (err instanceof TrialError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[TRIAL/ACTIVATE] Unexpected error:', err)
    return NextResponse.json({ error: 'Erro inesperado.' }, { status: 500 })
  }
}
