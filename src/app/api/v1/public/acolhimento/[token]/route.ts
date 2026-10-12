import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/public/acolhimento/[token]
 * Valida o token público de acolhimento e retorna os dados seguros do culto sem expor IDs sensíveis.
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

    // 1. Buscar registro do token com join no culto e congregação
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
          congregacao_id,
          congregacoes (
            nome
          ),
          ministries (
            name
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

    // 2. Verificar se está ativo
    if (!tokenRecord.is_active) {
      return NextResponse.json(
        { error: 'Este link de acolhimento foi desativado.', code: 'TOKEN_INATIVO' },
        { status: 410 }
      );
    }

    // 3. Verificar expiração
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) <= new Date()) {
      return NextResponse.json(
        { error: 'Este link de acolhimento expirou.', code: 'TOKEN_EXPIRADO' },
        { status: 410 }
      );
    }

    // 4. Verificar existência e status do culto
    const culto = tokenRecord.culto_registros as any;
    if (!culto) {
      return NextResponse.json(
        { error: 'Culto vinculado a este link não foi encontrado.', code: 'CULTO_NAO_ENCONTRADO' },
        { status: 404 }
      );
    }

    if (culto.status !== 'Aberto') {
      const statusLabel = culto.status ? culto.status.toLowerCase() : 'finalizado';
      return NextResponse.json(
        {
          error: `O culto já foi ${statusLabel} e não está mais aceitando novos registros de acolhimento.`,
          code: 'CULTO_ENCERRADO',
        },
        { status: 410 }
      );
    }

    // 5. Buscar nome da igreja e configurações do ministério (church_profile)
    let igrejaNome = 'Gestão Eklésia';
    let appUrl: string | null = null;

    // Busca dados em configurations (church_profile)
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

    // Fallback de nome da igreja
    if (churchProfile.nome && typeof churchProfile.nome === 'string' && churchProfile.nome.trim()) {
      igrejaNome = churchProfile.nome.trim();
    } else if (culto.ministries?.name) {
      igrejaNome = culto.ministries.name;
    }

    // 6. Retornar APENAS dados públicos seguros (sem IDs internos de ministry, congregacao ou culto)
    return NextResponse.json({
      valido: true,
      culto: {
        tipo_culto: culto.tipo_culto,
        data_culto: culto.data_culto,
        horario_culto: culto.horario_culto,
        congregacao_nome: culto.congregacoes?.nome || 'Congregação Local',
        igreja_nome: igrejaNome,
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
