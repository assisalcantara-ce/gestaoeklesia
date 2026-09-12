import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { CorporateFinanceService, CorporateFinancialReportFilter } from '@/lib/platform/finance'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredModule: 'pagamentos' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase } = result.ctx

    const searchParams = request.nextUrl.searchParams
    const periodo = (searchParams.get('periodo') as any) || 'este_mes'
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const ministryId = searchParams.get('ministryId') || undefined
    const planoSlug = searchParams.get('planoSlug') || undefined
    const statusCobranca = searchParams.get('statusCobranca') || undefined

    const filter: CorporateFinancialReportFilter = {
      periodo,
      startDate,
      endDate,
      ministryId,
      planoSlug,
      statusCobranca,
    }

    const statement = await CorporateFinanceService.getExecutiveStatement(supabase, filter)

    return NextResponse.json({
      success: true,
      filter,
      data: statement,
    })
  } catch (err: any) {
    console.error('Erro na API Corporate Finance Executive Statement:', err)
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 })
  }
}