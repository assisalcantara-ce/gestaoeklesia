import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AcceptanceValidationService } from '@/services/AcceptanceValidationService';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return NextResponse.json({ success: false, error: 'Não autorizado.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ministryId = searchParams.get('ministry_id')?.trim();

    if (!ministryId) {
      return NextResponse.json(
        { success: false, error: 'O parâmetro "ministry_id" é obrigatório.' },
        { status: 400 }
      );
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

    const validationService = new AcceptanceValidationService(supabaseAdmin);
    const statusAceites = await validationService.verificarPendenciasAceite(authData.user.id, ministryId);

    return NextResponse.json({
      success: true,
      data: {
        pode_prosseguir: !statusAceites.possui_pendencias,
        ...statusAceites,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao verificar pendências de aceite no onboarding.' },
      { status: 400 }
    );
  }
}
