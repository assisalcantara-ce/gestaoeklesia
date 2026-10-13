import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { isCultoAbertoHoje } from '@/lib/timezone-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/public/acolhimento/[token]
 * Valida o token público de acolhimento e retorna os dados seguros do culto sem expor IDs sensíveis.
 * Aplica validação server-side de expiração: data local de hoje, status operacional e janela do culto.
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token: rawToken } = await props.params;

    if (!rawToken || typeof rawToken !== 'string') {
      return NextResponse.json(
        { error: 'Token de acolhimento inválido.', code: 'TOKEN_INVALIDO' },
        { status: 400 }
      );
    }

    const admin = createServerClient();

    // 1. Buscar registro do token com join no culto, congregação e ministério
    const { data: tokenRecord, error: tokenErr } = await admin
      .from('culto_tokens')
      .select(`
        id,
        token,
        is_active,
        expires_at,
        ministry_id,
        culto_id,
        culto_registros (
          id,
          tipo_culto,
          data_culto,
          horario_culto,
          status,
          agenda_evento_id,
          congregacao_id,
          congregacoes (
            nome
          ),
          ministries (
            name,
            logo_url
          )
        )
      `)
      .eq('token', rawToken.trim())
      .maybeSingle();

    if (tokenErr || !tokenRecord) {
      return NextResponse.json(
        { error: 'Este link de acolhimento não foi encontrado ou é inválido.', code: 'TOKEN_NAO_ENCONTRADO' },
        { status: 404 }
      );
    }

    // 2. Buscar configurações do ministério (church_profile) para logo e app_url
    let appUrl: string | null = null;
    let logoUrl: string | null = null;
    let igrejaNome = 'Gestão Eklésia';

    const { data: configRow } = await admin
      .from('configurations')
      .select('church_profile')
      .eq('ministry_id', tokenRecord.ministry_id)
      .maybeSingle();

    const churchProfile = (configRow as any)?.church_profile || {};
    if (churchProfile.app_url && typeof churchProfile.app_url === 'string' && churchProfile.app_url.trim()) {
      appUrl = churchProfile.app_url.trim();
    } else if (churchProfile.aplicativo_url && typeof churchProfile.aplicativo_url === 'string' && churchProfile.aplicativo_url.trim()) {
      appUrl = churchProfile.aplicativo_url.trim();
    }

    const culto = tokenRecord.culto_registros as any;

    if (churchProfile.logo && typeof churchProfile.logo === 'string' && churchProfile.logo.trim()) {
      logoUrl = churchProfile.logo.trim();
    } else if (culto?.ministries?.logo_url) {
      logoUrl = culto.ministries.logo_url;
    }

    if (churchProfile.nome && typeof churchProfile.nome === 'string' && churchProfile.nome.trim()) {
      igrejaNome = churchProfile.nome.trim();
    } else if (culto?.ministries?.name) {
      igrejaNome = culto.ministries.name;
    }

    // 3. Verificar se o token está ativo
    if (!tokenRecord.is_active) {
      return NextResponse.json(
        {
          error: 'Este link de acolhimento foi desativado.',
          code: 'TOKEN_INATIVO',
          app_url: appUrl,
          igreja_nome: igrejaNome,
          logo_url: logoUrl,
        },
        { status: 410 }
      );
    }

    // 4. Verificar expiração do token (timestamp)
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) <= new Date()) {
      return NextResponse.json(
        {
          error: 'Este link de acolhimento expirou.',
          code: 'TOKEN_EXPIRADO',
          app_url: appUrl,
          igreja_nome: igrejaNome,
          logo_url: logoUrl,
        },
        { status: 410 }
      );
    }

    // 5. Verificar existência e dados do culto
    if (!culto) {
      return NextResponse.json(
        { error: 'Culto vinculado a este link não foi encontrado.', code: 'CULTO_NAO_ENCONTRADO' },
        { status: 404 }
      );
    }

    // 5.1 Verificar se o culto foi cancelado
    if (culto.status === 'Cancelado') {
      return NextResponse.json(
        {
          error: 'Este culto foi cancelado e não está mais disponível para acolhimento.',
          code: 'CULTO_CANCELADO',
          app_url: appUrl,
          igreja_nome: igrejaNome,
          logo_url: logoUrl,
        },
        { status: 410 }
      );
    }

    // 5.2 Validação da Agenda Oficial: se o culto estiver aberto mas o evento da agenda foi excluído ou cancelado
    if (culto.status !== 'Encerrado' && culto.status !== 'Consolidado') {
      if (!culto.agenda_evento_id) {
        // Evento da Agenda foi excluído (foreign key ficou nula)
        await admin.from('culto_tokens').update({ is_active: false }).eq('id', tokenRecord.id);
        return NextResponse.json(
          {
            error: 'O evento deste culto não está mais disponível na Agenda Oficial.',
            code: 'EVENTO_AGENDA_CANCELADO',
            app_url: appUrl,
            igreja_nome: igrejaNome,
            logo_url: logoUrl,
          },
          { status: 410 }
        );
      }

      const { data: agendaEv } = await admin
        .from('agenda_eventos')
        .select('id, status')
        .eq('id', culto.agenda_evento_id)
        .eq('ministry_id', tokenRecord.ministry_id)
        .maybeSingle();

      if (!agendaEv || agendaEv.status === 'cancelado') {
        await admin.from('culto_tokens').update({ is_active: false }).eq('id', tokenRecord.id);
        return NextResponse.json(
          {
            error: 'O evento deste culto foi removido ou cancelado na Agenda Oficial.',
            code: 'EVENTO_AGENDA_CANCELADO',
            app_url: appUrl,
            igreja_nome: igrejaNome,
            logo_url: logoUrl,
          },
          { status: 410 }
        );
      }
    }

    // 6. Validação estrita de janela do culto (Data local de hoje e Status)
    const validacaoJanela = isCultoAbertoHoje(culto.data_culto, culto.status);

    if (!validacaoJanela.elegivel) {
      if (validacaoJanela.motivo === 'CULTO_ENCERRADO') {
        const statusLabel = culto.status ? culto.status.toLowerCase() : 'finalizado';
        return NextResponse.json(
          {
            error: `O culto já foi ${statusLabel} e não está mais aceitando novos registros de acolhimento.`,
            code: 'CULTO_ENCERRADO',
            app_url: appUrl,
            igreja_nome: igrejaNome,
            logo_url: logoUrl,
          },
          { status: 410 }
        );
      }

      if (validacaoJanela.motivo === 'CULTO_PASSADO') {
        return NextResponse.json(
          {
            error: 'A janela de acolhimento para este culto já foi encerrada.',
            code: 'CULTO_PASSADO',
            app_url: appUrl,
            igreja_nome: igrejaNome,
            logo_url: logoUrl,
          },
          { status: 410 }
        );
      }

      if (validacaoJanela.motivo === 'CULTO_FUTURO') {
        return NextResponse.json(
          {
            error: 'Este culto está programado para uma data futura. O acolhimento será aberto na data do culto.',
            code: 'CULTO_FUTURO',
            app_url: appUrl,
            igreja_nome: igrejaNome,
            logo_url: logoUrl,
          },
          { status: 403 }
        );
      }
    }

    // 7. Retornar APENAS dados públicos seguros (sem expor IDs de tenants ou PKs)
    return NextResponse.json({
      valido: true,
      app_url: appUrl,
      igreja_nome: igrejaNome,
      logo_url: logoUrl,
      culto: {
        tipo_culto: culto.tipo_culto,
        data_culto: culto.data_culto,
        horario_culto: culto.horario_culto,
        congregacao_nome: culto.congregacoes?.nome || 'Congregação Local',
        igreja_nome: igrejaNome,
        logo_url: logoUrl,
        app_url: appUrl,
      },
    });
  } catch (err: any) {
    console.error('[PublicAcolhimento GET] Erro inesperado:', err);
    return NextResponse.json(
      { error: 'Erro interno ao validar acolhimento.' },
      { status: 500 }
    );
  }
}
