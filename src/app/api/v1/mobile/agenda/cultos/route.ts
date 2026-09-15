import { NextRequest, NextResponse } from 'next/server';
import { resolveMobileMember, mobileMemberErrorResponse } from '@/lib/mobile-member-auth';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/mobile/agenda/cultos
 * Retorna exclusivamente os cultos programados da congregação do membro e do ministério:
 * - Filtra tipo 'culto' ou categoria 'culto' em agenda_tipos
 * - Visibilidade permitida ao membro ('publico', 'igreja', 'ministerio')
 * - Isola por tenant e congregação
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    // 1. Obter congregação do membro
    const { data: member } = await admin
      .from('members')
      .select('id, congregacao_id')
      .eq('id', ctx.memberId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    const memberCongregacaoId = member?.congregacao_id;

    // 2. Data inicial (hoje 00:00)
    const agora = new Date();
    agora.setHours(0, 0, 0, 0);

    const { data: eventos, error } = await admin
      .from('agenda_eventos')
      .select(`
        id,
        ministry_id,
        church_id,
        titulo,
        descricao,
        tipo,
        data_inicio,
        data_fim,
        local,
        visibilidade,
        status,
        agenda_tipos ( id, nome, categoria, cor, icone ),
        congregacoes ( id, nome, endereco, cidade, uf, cep, latitude, longitude )
      `)
      .eq('ministry_id', ctx.ministryId)
      .in('visibilidade', ['publico', 'igreja', 'ministerio'])
      .neq('status', 'cancelado')
      .gte('data_inicio', agora.toISOString())
      .order('data_inicio', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao consultar cultos.', detail: error.message },
        { status: 500 }
      );
    }

    // 3. Filtrar cultos compatíveis com a congregação do membro
    const cultos = (eventos || []).filter((e) => {
      const isCulto =
        e.tipo === 'culto' || (e.agenda_tipos as any)?.categoria === 'culto';
      if (!isCulto) return false;

      if (!e.church_id) return true; // Geral
      if (!memberCongregacaoId) return true;
      return e.church_id === memberCongregacaoId;
    });

    return NextResponse.json({
      total: cultos.length,
      cultos,
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao consultar cultos.', detail: String(error) },
      { status: 500 }
    );
  }
}
