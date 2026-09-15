import { NextRequest, NextResponse } from 'next/server';
import { resolveMobileMember, mobileMemberErrorResponse } from '@/lib/mobile-member-auth';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/mobile/agenda
 * Retorna a programação oficial (cultos, eventos, reuniões públicas) destinada ao membro:
 * - Filtra por visibilidade permitida ao membro ('publico', 'igreja', 'ministerio')
 * - Bloqueia compromissos administrativos privados ('privado', 'lideranca')
 * - Isola por tenant (ministry_id) e por congregação do membro (church_id NULL ou church_id do membro)
 * - Agrupa em 'hoje', 'esta_semana' e 'proximos'
 * - Destaca o 'proximo_culto'
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    // 1. Obter congregação do membro
    const { data: member, error: memberErr } = await admin
      .from('members')
      .select('id, congregacao_id')
      .eq('id', ctx.memberId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json(
        { error: 'Membro não encontrado.', code: 'MEMBER_NOT_FOUND' },
        { status: 404 }
      );
    }

    const memberCongregacaoId = member.congregacao_id;

    // 2. Parâmetros de busca opcionais
    const searchParams = request.nextUrl.searchParams;
    const tipoFiltro = searchParams.get('tipo'); // 'culto', 'evento', etc.
    const apenasCongregacao = searchParams.get('apenas_congregacao') === 'true';

    // 3. Buscar eventos a partir de hoje (início do dia atual UTC/local)
    const agora = new Date();
    agora.setHours(0, 0, 0, 0);
    const dataLimiteInferior = agora.toISOString();

    let query = admin
      .from('agenda_eventos')
      .select(`
        id,
        ministry_id,
        church_id,
        titulo,
        descricao,
        tipo,
        origem,
        data_inicio,
        data_fim,
        local,
        visibilidade,
        status,
        recorrente,
        agenda_tipos ( id, nome, categoria, cor, icone ),
        congregacoes ( id, nome, endereco, cidade, uf, cep, latitude, longitude )
      `)
      .eq('ministry_id', ctx.ministryId)
      .in('visibilidade', ['publico', 'igreja', 'ministerio'])
      .neq('status', 'cancelado')
      .gte('data_inicio', dataLimiteInferior)
      .order('data_inicio', { ascending: true });

    if (tipoFiltro) {
      query = query.eq('tipo', tipoFiltro);
    }

    const { data: eventos, error: eventosErr } = await query;

    if (eventosErr) {
      return NextResponse.json(
        { error: 'Erro ao consultar programação.', detail: eventosErr.message },
        { status: 500 }
      );
    }

    // 4. Filtrar por congregação do membro (eventos da sede/geral com church_id null OU da congregação do membro)
    const eventosFiltrados = (eventos || []).filter((e) => {
      if (apenasCongregacao && memberCongregacaoId) {
        return e.church_id === memberCongregacaoId;
      }
      if (!e.church_id) return true; // Geral do ministério
      if (!memberCongregacaoId) return true; // Membro sem congregação vê geral e públicas
      return e.church_id === memberCongregacaoId;
    });

    // 5. Agrupamento temporal inteligente
    const hojeStart = new Date();
    hojeStart.setHours(0, 0, 0, 0);
    const hojeEnd = new Date();
    hojeEnd.setHours(23, 59, 59, 999);

    const seteDiasEnd = new Date();
    seteDiasEnd.setDate(seteDiasEnd.getDate() + 7);
    seteDiasEnd.setHours(23, 59, 59, 999);

    const listaHoje: any[] = [];
    const listaEstaSemana: any[] = [];
    const listaProximos: any[] = [];
    let proximoCulto: any = null;

    for (const e of eventosFiltrados) {
      const dt = new Date(e.data_inicio);
      const isCulto =
        e.tipo === 'culto' || (e.agenda_tipos as any)?.categoria === 'culto';

      if (!proximoCulto && isCulto && dt >= new Date()) {
        proximoCulto = e;
      }

      if (dt >= hojeStart && dt <= hojeEnd) {
        listaHoje.push(e);
      } else if (dt > hojeEnd && dt <= seteDiasEnd) {
        listaEstaSemana.push(e);
      } else if (dt > seteDiasEnd) {
        listaProximos.push(e);
      }
    }

    return NextResponse.json({
      total: eventosFiltrados.length,
      proximo_culto: proximoCulto,
      hoje: listaHoje,
      esta_semana: listaEstaSemana,
      proximos: listaProximos,
      todos: eventosFiltrados,
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao consultar agenda.', detail: String(error) },
      { status: 500 }
    );
  }
}
