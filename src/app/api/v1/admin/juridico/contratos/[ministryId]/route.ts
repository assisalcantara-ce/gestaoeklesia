import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { ContratosService } from '@/services/ContratosService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ministryId: string }> | { ministryId: string } }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const resolvedParams = await Promise.resolve(params);
    const ministryId = resolvedParams?.ministryId;

    if (!ministryId || typeof ministryId !== 'string' || ministryId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'O ID do ministério (ministryId) é obrigatório na rota.' },
        { status: 400 }
      );
    }

    // Reutilizar diretamente o método 100% READ-ONLY do ContratosService
    const contratosService = new ContratosService(auth.ctx.supabaseAdmin);
    const detalhes = await contratosService.buscarDetalhesContratoTenant(ministryId.trim());

    return NextResponse.json({
      success: true,
      data: detalhes,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao buscar detalhes contratuais do ministério.' },
      { status: 400 }
    );
  }
}
