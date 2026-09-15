import { NextRequest, NextResponse } from 'next/server';
import { resolveMobileMember, mobileMemberErrorResponse } from '@/lib/mobile-member-auth';
import { createServerClient } from '@/lib/supabase-server';
import { getSafeEmbedUrl } from '@/lib/midia-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/mobile/midia/aovivo
 *
 * Retorna as informações do culto ou transmissão ao vivo atualmente ativa:
 * - Se is_aovivo = true e live_url_atual preenchida: retorna status 'online' com URL de embed segura
 * - Se fora do ar: retorna status 'offline' com o canal do YouTube opcional
 * - Nunca expõe chaves privadas ou dados administrativos
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    const { data: cfg, error } = await admin
      .from('midia_configuracoes')
      .select('is_aovivo, live_provider, live_url_atual, canal_youtube_url')
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao consultar status da transmissão ao vivo.' },
        { status: 500 }
      );
    }

    if (!cfg || !cfg.is_aovivo || !cfg.live_url_atual) {
      return NextResponse.json({
        is_aovivo: false,
        status: 'offline',
        provider: null,
        live_url: null,
        embed_url: null,
        canal_youtube_url: cfg?.canal_youtube_url || null,
        mensagem: 'Nenhuma transmissão ao vivo no momento.',
      });
    }

    const provider = cfg.live_provider || 'youtube';
    const embedUrl = getSafeEmbedUrl(cfg.live_url_atual, provider);

    return NextResponse.json({
      is_aovivo: true,
      status: 'online',
      provider,
      live_url: cfg.live_url_atual,
      embed_url: embedUrl,
      canal_youtube_url: cfg.canal_youtube_url || null,
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao consultar transmissão ao vivo.' },
      { status: 500 }
    );
  }
}
