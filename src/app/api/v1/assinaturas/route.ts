import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { AssinaturasInstitucionaisService, type TipoAssinaturaInstitucional } from '@/services/assinaturas-institucionais-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json(
        { error: 'Ministério não encontrado ou sessão inválida.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') as TipoAssinaturaInstitucional | null;
    const contexto = searchParams.get('contexto') || undefined;
    const memberId = searchParams.get('memberId') || undefined;
    const documentoId = searchParams.get('documentoId') || undefined;
    const isPreview = searchParams.get('isPreview') === 'true';

    if (!tipo || (tipo !== 'assinatura_presidente' && tipo !== 'assinatura_secretario_geral')) {
      return NextResponse.json(
        { error: 'Tipo de assinatura inválido. Utilize "assinatura_presidente" ou "assinatura_secretario_geral".' },
        { status: 400 }
      );
    }

    const resultado = await AssinaturasInstitucionaisService.obterAssinaturaAutorizada({
      ministryId: ctx.ministryId,
      tipoAssinatura: tipo,
      contextoDocumento: contexto,
      memberId,
      documentoId,
      isPreview,
      nivelOperador: ctx.nivel,
    });

    if (!resultado.autorizado) {
      return NextResponse.json(
        {
          autorizado: false,
          motivoBloqueio: resultado.motivoBloqueio,
          error: resultado.motivoBloqueio,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      autorizado: true,
      imagemBase64: resultado.imagemBase64,
      deliberacao: resultado.deliberacao,
    });
  } catch (err: any) {
    console.error('[API /api/v1/assinaturas] Erro:', err);
    if (err?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao recuperar assinatura.' },
      { status: 500 }
    );
  }
}
