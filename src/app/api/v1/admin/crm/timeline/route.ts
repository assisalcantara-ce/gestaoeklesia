import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { CrmService } from '@/lib/platform/crm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Validar autenticação
    const result = await requireAdmin(request);
    if (!result.ok) return result.response;
    const { supabaseAdmin } = result.ctx;

    // 2. Extrair parâmetros da query string (ministryId é opcional)
    const { searchParams } = new URL(request.url);
    const ministryId = searchParams.get('ministryId') || '';

    // 3. Instanciar CrmService e obter a linha do tempo correspondente
    const crmService = new CrmService();
    const timeline = await crmService.getTimeline(supabaseAdmin, ministryId);

    // 4. Retornar JSON
    return NextResponse.json(timeline);
  } catch (error: any) {
    console.error('[GET /api/v1/admin/crm/timeline] Erro:', error);
    return NextResponse.json({ error: error?.message || 'Erro ao buscar timeline do CRM' }, { status: 500 });
  }
}
