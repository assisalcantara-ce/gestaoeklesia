import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { DocumentosJuridicosService } from '@/services/DocumentosJuridicosService';
import { AuditoriaJuridicaService } from '@/services/AuditoriaJuridicaService';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const service = new DocumentosJuridicosService(auth.ctx.supabaseAdmin);
    const auditoriaService = new AuditoriaJuridicaService(auth.ctx.supabaseAdmin);

    // 1. Executa a publicação no serviço (valida se é RASCUNHO e altera status/publicado_em)
    const docPublicado = await service.publicarDocumento(id);

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
    const userAgent = request.headers.get('user-agent') || null;
    const ministryId = auth.ctx.adminUser?.ministry_id || '00000000-0000-0000-0000-000000000000';

    // 2. Registrar auditoria obrigatória antes da resposta HTTP
    await auditoriaService.registrarEvento({
      usuario_id: auth.ctx.user.id,
      ministry_id: ministryId,
      documento_id: docPublicado.id,
      versao: docPublicado.versao,
      hash_documento: docPublicado.hash_sha256,
      tipo_evento: 'DOCUMENTO_PUBLICADO',
      ip_address: ipAddress,
      user_agent: userAgent,
      detalhes: {
        titulo: docPublicado.titulo,
        tipo: docPublicado.tipo,
        publicado_em: docPublicado.publicado_em,
      },
    });

    return NextResponse.json({ success: true, data: docPublicado });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao publicar documento.' },
      { status: 400 }
    );
  }
}
