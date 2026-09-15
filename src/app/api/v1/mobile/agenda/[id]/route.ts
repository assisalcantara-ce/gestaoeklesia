import { NextRequest, NextResponse } from 'next/server';
import { resolveMobileMember, mobileMemberErrorResponse } from '@/lib/mobile-member-auth';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/mobile/agenda/[id]
 * Retorna os detalhes de um evento/culto da agenda do membro:
 * - Proteção estrita anti-IDOR por tenant, congregação e visibilidade
 * - Formatação completa de localização e link direto para aplicativo de mapas
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
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

    // 2. Buscar evento garantindo isolamento por ministério
    const { data: evento, error } = await admin
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
      .eq('id', id)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (error || !evento) {
      return NextResponse.json(
        { error: 'Evento não encontrado.', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 3. Validação de visibilidade e privacidade
    const visibilidadesPermitidas = ['publico', 'igreja', 'ministerio'];
    if (!visibilidadesPermitidas.includes(evento.visibilidade)) {
      return NextResponse.json(
        { error: 'Evento restrito ou não disponível.', code: 'EVENT_FORBIDDEN' },
        { status: 404 }
      );
    }

    // 4. Validação congregacional
    if (evento.church_id && memberCongregacaoId && evento.church_id !== memberCongregacaoId) {
      return NextResponse.json(
        { error: 'Evento exclusivo de outra congregação.', code: 'EVENT_FORBIDDEN' },
        { status: 404 }
      );
    }

    // 5. Montar endereço e query para mapas
    const cong = evento.congregacoes as any;
    let enderecoCompleto = evento.local || '';
    let mapsQuery = '';

    if (cong) {
      const partes = [cong.nome, cong.endereco, cong.cidade, cong.uf].filter(Boolean);
      enderecoCompleto = partes.join(' — ');
      mapsQuery = encodeURIComponent(
        `${cong.nome}, ${cong.endereco || ''} ${cong.cidade || ''} ${cong.uf || ''}`.trim()
      );
    } else if (evento.local) {
      mapsQuery = encodeURIComponent(evento.local);
    }

    const mapsUrl = mapsQuery
      ? `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`
      : null;

    return NextResponse.json({
      id: evento.id,
      titulo: evento.titulo,
      descricao: evento.descricao,
      tipo: evento.tipo,
      tipo_info: evento.agenda_tipos,
      data_inicio: evento.data_inicio,
      data_fim: evento.data_fim,
      status: evento.status,
      visibilidade: evento.visibilidade,
      local: evento.local,
      congregação: cong ? { id: cong.id, nome: cong.nome, endereco: cong.endereco, cidade: cong.cidade, uf: cong.uf } : null,
      endereco_completo: enderecoCompleto,
      maps_url: mapsUrl,
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao consultar detalhes do evento.', detail: String(error) },
      { status: 500 }
    );
  }
}
