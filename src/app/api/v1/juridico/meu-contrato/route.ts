import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ContratosService } from '@/services/ContratosService';

export async function GET(request: NextRequest) {
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

    const userId = authData.user.id;

    // 1. Resolver o ministério vinculado ao usuário autenticado (nunca aceita ministry_id livre)
    const { data: ministryUser } = await supabaseAdmin
      .from('ministry_users')
      .select('ministry_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    let ministryId: string | null = ministryUser?.ministry_id ? String(ministryUser.ministry_id) : null;

    if (!ministryId) {
      const { data: ownedMinistry } = await supabaseAdmin
        .from('ministries')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (ownedMinistry?.id) {
        ministryId = String(ownedMinistry.id);
      }
    }

    if (!ministryId) {
      return NextResponse.json({
        success: true,
        data: {
          contrato: null,
          documento_base: null,
          assinado_por_usuario: null,
          conteudo_efetivo: null,
          historico_documentos: [],
        },
      });
    }

    // Validar vinculo com o ministério obtido
    const { validarVinculoUsuarioMinisterio } = await import('@/lib/tenant-auth');
    const temVinculo = await validarVinculoUsuarioMinisterio(supabaseAdmin, userId, ministryId);

    if (!temVinculo) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado: você não possui vínculo com este ministério.' },
        { status: 403 }
      );
    }

    // 2. Buscar detalhes do contrato via ContratosService
    const contratosService = new ContratosService(supabaseAdmin);
    const detalhes = await contratosService.buscarDetalhesContratoTenant(ministryId);

    return NextResponse.json({
      success: true,
      data: detalhes,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao consultar contrato do tenant.' },
      { status: 400 }
    );
  }
}
