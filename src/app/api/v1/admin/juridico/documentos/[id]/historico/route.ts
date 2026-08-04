import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { DocumentosJuridicosService } from '@/services/DocumentosJuridicosService';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const service = new DocumentosJuridicosService(auth.ctx.supabaseAdmin);

    const historico = await service.listarHistoricoVersoes(id);

    return NextResponse.json({ success: true, data: historico });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao consultar histórico de versões do documento.' },
      { status: 400 }
    );
  }
}
