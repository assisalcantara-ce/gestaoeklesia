import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { CommercialService } from '@/lib/platform'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // 1. Validar autenticação (responsabilidade da rota)
    const result = await requireAdmin(request)
    if (!result.ok) return result.response
    const { supabaseAdmin } = result.ctx

    // 2. Chamar o serviço de domínio Commercial para obter a listagem agregada e desduplicada
    const commercialService = new CommercialService()
    const oportunidades = await commercialService.list(supabaseAdmin)

    // 3. Contabilizar oportunidades novas para a resposta (mantendo retrocompatibilidade do contador)
    const newCount = oportunidades.filter(
      (opt: any) => String(opt.status).toLowerCase().trim() === 'novo'
    ).length

    return NextResponse.json({
      oportunidades,
      new_count: newCount
    })
  } catch (err: any) {
    console.error('[GET /api/v1/admin/oportunidades] Erro:', err)
    return NextResponse.json({ error: err?.message || 'Erro inesperado' }, { status: 500 })
  }
}
