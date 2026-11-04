import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { DiscipuladoService } from '@/services/discipulado-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const telefone = searchParams.get('telefone');

    if (!telefone) {
      return NextResponse.json(
        { error: 'Parâmetro telefone é obrigatório para busca.' },
        { status: 400 }
      );
    }

    // Obter ministry_id do usuário logado
    const { data: mu } = await supabase
      .from('ministry_users')
      .select('ministry_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const ministryId = mu?.ministry_id;
    if (!ministryId) {
      return NextResponse.json(
        { error: 'Ministério não encontrado para o usuário.' },
        { status: 403 }
      );
    }

    const visitantes = await DiscipuladoService.buscarVisitantesPorTelefone(
      supabase,
      ministryId,
      telefone
    );

    return NextResponse.json({ visitantes });
  } catch (err: any) {
    console.error('[GET /api/v1/discipulado/visitantes]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao buscar visitante por telefone.' },
      { status: 500 }
    );
  }
}
