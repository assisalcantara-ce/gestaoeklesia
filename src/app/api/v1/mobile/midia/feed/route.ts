import { NextRequest, NextResponse } from 'next/server';
import { resolveMobileMember, mobileMemberErrorResponse } from '@/lib/mobile-member-auth';
import { createServerClient } from '@/lib/supabase-server';
import { getSafeEmbedUrl } from '@/lib/midia-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/mobile/midia/feed
 *
 * Retorna o feed consolidado da Central de Mídia:
 * - Transmissão Ao Vivo (se ativa)
 * - Estado da Web Rádio
 * - Últimos comunicados/notícias (reutiliza secretaria_comunicados)
 * - Últimos vídeos publicados
 * - Últimos álbuns de fotos com contagem de fotos
 *
 * Segurança & Multi-tenant:
 * - resolveMobileMember obrigatório
 * - ministry_id = ctx.ministryId
 * - congregacao_id IS NULL ou congregacao_id = member.congregacao_id
 * - Apenas registros com ativo = true e publicado_em <= NOW()
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    // 1. Obter congregação oficial do membro
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
    const agora = new Date().toISOString();

    // 2. Configurações de Mídia (Web Rádio e Ao Vivo)
    const { data: cfg } = await admin
      .from('midia_configuracoes')
      .select('radio_nome, radio_stream_url, radio_ativa, canal_youtube_url, live_url_atual, live_provider, is_aovivo')
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    // Formatação segura de Transmissão Ao Vivo
    let aovivo = {
      is_aovivo: false,
      status: 'offline',
      canal_youtube_url: cfg?.canal_youtube_url || null,
      provider: null as string | null,
      live_url: null as string | null,
      embed_url: null as string | null,
    };

    if (cfg?.is_aovivo && cfg.live_url_atual) {
      const provider = cfg.live_provider || 'youtube';
      const embedUrl = getSafeEmbedUrl(cfg.live_url_atual, provider);
      aovivo = {
        is_aovivo: true,
        status: 'online',
        canal_youtube_url: cfg.canal_youtube_url || null,
        provider,
        live_url: cfg.live_url_atual,
        embed_url: embedUrl,
      };
    }

    // Formatação segura de Web Rádio
    const radio = {
      disponivel: Boolean(cfg?.radio_ativa && cfg?.radio_stream_url),
      radio_nome: cfg?.radio_ativa ? cfg?.radio_nome || 'Web Rádio' : null,
      radio_stream_url: cfg?.radio_ativa ? cfg?.radio_stream_url || null : null,
    };

    // 3. Últimas Notícias (secretaria_comunicados)
    let noticiasQuery = admin
      .from('secretaria_comunicados')
      .select(`
        id,
        titulo,
        conteudo,
        categoria,
        imagem_url,
        publicado_em,
        expira_em,
        congregacao_id
      `)
      .eq('ministry_id', ctx.ministryId)
      .eq('ativo', true)
      .not('publicado_em', 'is', null)
      .lte('publicado_em', agora)
      .or(`expira_em.is.null,expira_em.gte.${agora}`);

    if (memberCongregacaoId) {
      noticiasQuery = noticiasQuery.or(`congregacao_id.is.null,congregacao_id.eq.${memberCongregacaoId}`);
    } else {
      noticiasQuery = noticiasQuery.is('congregacao_id', null);
    }

    const { data: noticiasRaw } = await noticiasQuery
      .order('publicado_em', { ascending: false })
      .limit(3);

    const noticias = (noticiasRaw || []).map((n: any) => ({
      id: n.id,
      titulo: n.titulo,
      conteudo: n.conteudo,
      categoria: n.categoria,
      imagem_url: n.imagem_url,
      publicado_em: n.publicado_em,
      escopo: n.congregacao_id ? 'congregacao' : 'geral',
    }));

    // 4. Últimos Vídeos (midia_videos)
    let videosQuery = admin
      .from('midia_videos')
      .select(`
        id,
        titulo,
        descricao,
        url_video,
        youtube_id,
        thumbnail_url,
        categoria,
        autor_pregador,
        data_evento,
        duracao_segundos,
        destaque,
        congregacao_id,
        created_at
      `)
      .eq('ministry_id', ctx.ministryId)
      .eq('ativo', true);

    if (memberCongregacaoId) {
      videosQuery = videosQuery.or(`congregacao_id.is.null,congregacao_id.eq.${memberCongregacaoId}`);
    } else {
      videosQuery = videosQuery.is('congregacao_id', null);
    }

    const { data: videosRaw } = await videosQuery
      .order('destaque', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(4);

    const videos = (videosRaw || []).map((v: any) => ({
      id: v.id,
      titulo: v.titulo,
      descricao: v.descricao,
      url_video: v.url_video,
      youtube_id: v.youtube_id,
      thumbnail_url: v.thumbnail_url,
      categoria: v.categoria,
      autor_pregador: v.autor_pregador,
      data_evento: v.data_evento,
      duracao_segundos: v.duracao_segundos,
      destaque: v.destaque,
      escopo: v.congregacao_id ? 'congregacao' : 'geral',
      created_at: v.created_at,
    }));

    // 5. Últimos Álbuns (midia_albuns) com contagem de fotos
    let albunsQuery = admin
      .from('midia_albuns')
      .select(`
        id,
        titulo,
        descricao,
        capa_url,
        data_evento,
        publicado_em,
        congregacao_id,
        created_at
      `)
      .eq('ministry_id', ctx.ministryId)
      .eq('ativo', true)
      .not('publicado_em', 'is', null)
      .lte('publicado_em', agora);

    if (memberCongregacaoId) {
      albunsQuery = albunsQuery.or(`congregacao_id.is.null,congregacao_id.eq.${memberCongregacaoId}`);
    } else {
      albunsQuery = albunsQuery.is('congregacao_id', null);
    }

    const { data: albunsRaw } = await albunsQuery
      .order('publicado_em', { ascending: false })
      .limit(4);

    const albumIds = (albunsRaw || []).map((a: any) => a.id);
    let photoCounts: Record<string, number> = {};

    if (albumIds.length > 0) {
      const { data: fotosData } = await admin
        .from('midia_fotos')
        .select('album_id')
        .eq('ministry_id', ctx.ministryId)
        .in('album_id', albumIds);

      if (fotosData) {
        for (const f of fotosData) {
          photoCounts[f.album_id] = (photoCounts[f.album_id] || 0) + 1;
        }
      }
    }

    const albuns = (albunsRaw || []).map((a: any) => ({
      id: a.id,
      titulo: a.titulo,
      descricao: a.descricao,
      capa_url: a.capa_url,
      data_evento: a.data_evento,
      publicado_em: a.publicado_em,
      total_fotos: photoCounts[a.id] || 0,
      escopo: a.congregacao_id ? 'congregacao' : 'geral',
      created_at: a.created_at,
    }));

    return NextResponse.json({
      feed: {
        aovivo,
        radio,
        noticias,
        videos,
        albuns,
      },
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao carregar feed de mídia.' },
      { status: 500 }
    );
  }
}
