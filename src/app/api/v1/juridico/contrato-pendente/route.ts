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

    // 1. Obter o ministério vinculado ao usuário
    const { data: ministryUser } = await supabaseAdmin
      .from('ministry_users')
      .select('ministry_id, ministries(id, subscription_status, is_active)')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (!ministryUser || !ministryUser.ministry_id) {
      return NextResponse.json({ success: true, pendente: false, reason: 'Sem ministério vinculado' });
    }

    const ministry = ministryUser.ministries as any;
    const isCommercialActive = ministry?.subscription_status === 'active' || ministry?.is_active === true;

    // Se o tenant NÃO tiver assinatura comercial ativa (ex: trial puro sem ativacao), nao ha pendencia de contrato comercial
    if (!isCommercialActive) {
      return NextResponse.json({ success: true, pendente: false, reason: 'Tenant em Trial ou inativo' });
    }

    // 2. Reutilizar ContratosService.verificarContratoPendenteAssinatura()
    const contratosService = new ContratosService(supabaseAdmin);
    const contratoPendente = await contratosService.verificarContratoPendenteAssinatura(ministryUser.ministry_id);

    return NextResponse.json({
      success: true,
      pendente: Boolean(contratoPendente),
      contrato: contratoPendente || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao verificar contrato pendente.' },
      { status: 400 }
    );
  }
}