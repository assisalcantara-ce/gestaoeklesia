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
    const body = await request.json();
    const service = new DocumentosJuridicosService(auth.ctx.supabaseAdmin);
    const auditoriaService = new AuditoriaJuridicaService(auth.ctx.supabaseAdmin);

    if (!body.versao || typeof body.versao !== 'string' || body.versao.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'A nova versão ("versao") é obrigatória.' },
        { status: 400 }
      );
    }

    const novaVersaoDoc = await service.criarNovaVersao(
      id,
      body.versao,
      auth.ctx.user.id
    );

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
    const userAgent = request.headers.get('user-agent') || null;
    const ministryId = auth.ctx.adminUser?.ministry_id || '00000000-0000-0000-0000-000000000000';

    await auditoriaService.registrarEvento({
      usuario_id: auth.ctx.user.id,
      ministry_id: ministryId,
      documento_id: novaVersaoDoc.id,
      versao: novaVersaoDoc.versao,
      hash_documento: novaVersaoDoc.hash_sha256 || 'PENDENTE_PUBLICACAO',
      tipo_evento: 'DOCUMENTO_NOVA_VERSAO',
      ip_address: ipAddress,
      user_agent: userAgent,
      detalhes: {
        documento_original_id: id,
        titulo: novaVersaoDoc.titulo,
        tipo: novaVersaoDoc.tipo,
        status: novaVersaoDoc.status,
      },
    });

    return NextResponse.json({ success: true, data: novaVersaoDoc }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao criar nova versão do documento.' },
      { status: 400 }
    );
  }
}
