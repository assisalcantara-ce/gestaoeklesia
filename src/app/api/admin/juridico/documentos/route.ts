import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { DocumentosJuridicosService } from '@/services/DocumentosJuridicosService';
import { AuditoriaJuridicaService } from '@/services/AuditoriaJuridicaService';
import type { TipoDocumentoJuridico, StatusDocumentoJuridico } from '@/types/juridico';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') as TipoDocumentoJuridico | null;
    const status = searchParams.get('status') as StatusDocumentoJuridico | null;
    const ativoStr = searchParams.get('ativo');
    const ativo = ativoStr !== null ? ativoStr === 'true' : undefined;

    const service = new DocumentosJuridicosService(auth.ctx.supabaseAdmin);
    const documentos = await service.listarDocumentos({
      tipo: tipo || undefined,
      status: status || undefined,
      ativo,
    });

    return NextResponse.json({ success: true, data: documentos });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao listar documentos jurídicos.' },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const service = new DocumentosJuridicosService(auth.ctx.supabaseAdmin);
    const auditoriaService = new AuditoriaJuridicaService(auth.ctx.supabaseAdmin);

    const novoDoc = await service.criarDocumento({
      tipo: body.tipo,
      titulo: body.titulo,
      versao: body.versao,
      conteudo_md: body.conteudo_md,
      conteudo_html: body.conteudo_html,
      obrigatorio: body.obrigatorio,
      criado_por: auth.ctx.user.id,
    });

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
    const userAgent = request.headers.get('user-agent') || null;

    // Obter o ministry_id do contexto administrativo ou usuário
    const ministryId = auth.ctx.adminUser?.ministry_id || '00000000-0000-0000-0000-000000000000';

    await auditoriaService.registrarEvento({
      usuario_id: auth.ctx.user.id,
      ministry_id: ministryId,
      documento_id: novoDoc.id,
      versao: novoDoc.versao,
      hash_documento: novoDoc.hash_sha256 || 'PENDENTE_PUBLICACAO',
      tipo_evento: 'DOCUMENTO_CRIADO',
      ip_address: ipAddress,
      user_agent: userAgent,
      detalhes: { titulo: novoDoc.titulo, tipo: novoDoc.tipo },
    });

    return NextResponse.json({ success: true, data: novoDoc }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao criar documento jurídico.' },
      { status: 400 }
    );
  }
}
