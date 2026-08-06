import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AceitesService } from '@/services/AceitesService';
import { DocumentosJuridicosService } from '@/services/DocumentosJuridicosService';
import { AuditoriaJuridicaService } from '@/services/AuditoriaJuridicaService';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return NextResponse.json({ success: false, error: 'Não autorizado.' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ success: false, error: 'Servidor não configurado.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData?.user?.id) {
      return NextResponse.json({ success: false, error: 'Sessão inválida ou expirada.' }, { status: 401 });
    }

    const body = await request.json();
    const { documento_id, ministry_id } = body;

    if (!documento_id || typeof documento_id !== 'string' || documento_id.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'O ID do documento ("documento_id") é obrigatório.' },
        { status: 400 }
      );
    }
    if (!ministry_id || typeof ministry_id !== 'string' || ministry_id.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'O ID do ministério/tenant ("ministry_id") é obrigatório.' },
        { status: 400 }
      );
    }

    const userId = authData.user.id;
    const cleanDocumentoId = documento_id.trim();
    const cleanMinistryId = ministry_id.trim();

    // 1. Localizar o documento e verificar se está PUBLICADO
    const docsService = new DocumentosJuridicosService(supabaseAdmin);
    const doc = await docsService.buscarPorId(cleanDocumentoId);

    if (doc.status !== 'PUBLICADO' || !doc.ativo) {
      return NextResponse.json(
        { success: false, error: 'Apenas documentos publicados e ativos podem ser aceitos.' },
        { status: 400 }
      );
    }

    // 2. Registrar o aceite via AceitesService
    const aceitesService = new AceitesService(supabaseAdmin);
    const auditoriaService = new AuditoriaJuridicaService(supabaseAdmin);

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
    const userAgent = request.headers.get('user-agent') || null;

    const registroAceite = await aceitesService.registrarAceite({
      ministry_id: cleanMinistryId,
      user_id: userId,
      documento_id: doc.id,
      versao_aceita: doc.versao,
      hash_documento: doc.hash_sha256 || 'HASH_INICIAL_PUBLICADO',
      ip_address: ipAddress,
      user_agent: userAgent,
      payload_aceite: { origem: 'TELA_ACEITE_JURIDICO' },
    });

    // 3. Registrar auditoria jurídica obrigatória
    await auditoriaService.registrarEvento({
      usuario_id: userId,
      ministry_id: cleanMinistryId,
      documento_id: doc.id,
      versao: doc.versao,
      hash_documento: doc.hash_sha256 || 'HASH_INICIAL_PUBLICADO',
      tipo_evento: 'ACEITE_REGISTRADO',
      ip_address: ipAddress,
      user_agent: userAgent,
      detalhes: {
        aceite_id: registroAceite.id,
        origem: 'TELA_ACEITE_JURIDICO',
      },
    });

    return NextResponse.json({ success: true, data: registroAceite }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao registrar aceite do documento.' },
      { status: 400 }
    );
  }
}