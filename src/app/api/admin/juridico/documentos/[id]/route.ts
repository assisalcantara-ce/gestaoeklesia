import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { DocumentosJuridicosService } from '@/services/DocumentosJuridicosService';
import { AuditoriaJuridicaService } from '@/services/AuditoriaJuridicaService';

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
    const documento = await service.buscarPorId(id);

    return NextResponse.json({ success: true, data: documento });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Documento não encontrado.' },
      { status: 404 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const service = new DocumentosJuridicosService(auth.ctx.supabaseAdmin);
    const auditoriaService = new AuditoriaJuridicaService(auth.ctx.supabaseAdmin);

    const docAtualizado = await service.atualizarRascunho(id, {
      titulo: body.titulo,
      versao: body.versao,
      conteudo_md: body.conteudo_md,
      conteudo_html: body.conteudo_html,
      obrigatorio: body.obrigatorio,
    });

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
    const userAgent = request.headers.get('user-agent') || null;
    const ministryId = auth.ctx.adminUser?.ministry_id || '00000000-0000-0000-0000-000000000000';

    await auditoriaService.registrarEvento({
      usuario_id: auth.ctx.user.id,
      ministry_id: ministryId,
      documento_id: docAtualizado.id,
      versao: docAtualizado.versao,
      hash_documento: docAtualizado.hash_sha256,
      tipo_evento: 'DOCUMENTO_ATUALIZADO',
      ip_address: ipAddress,
      user_agent: userAgent,
      detalhes: { titulo: docAtualizado.titulo, status: docAtualizado.status },
    });

    return NextResponse.json({ success: true, data: docAtualizado });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao atualizar rascunho de documento.' },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const service = new DocumentosJuridicosService(auth.ctx.supabaseAdmin);
    const auditoriaService = new AuditoriaJuridicaService(auth.ctx.supabaseAdmin);

    const docArquivado = await service.arquivarDocumento(id);

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
    const userAgent = request.headers.get('user-agent') || null;
    const ministryId = auth.ctx.adminUser?.ministry_id || '00000000-0000-0000-0000-000000000000';

    await auditoriaService.registrarEvento({
      usuario_id: auth.ctx.user.id,
      ministry_id: ministryId,
      documento_id: docArquivado.id,
      versao: docArquivado.versao,
      hash_documento: docArquivado.hash_sha256,
      tipo_evento: 'DOCUMENTO_ARQUIVADO',
      ip_address: ipAddress,
      user_agent: userAgent,
      detalhes: { titulo: docArquivado.titulo, status: docArquivado.status },
    });

    return NextResponse.json({ success: true, data: docArquivado });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao arquivar documento.' },
      { status: 400 }
    );
  }
}
