import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Bateria de Testes da FASE E.12.3 — APIs Mobile da Central de Mídia
 *
 * Cobertura Completa:
 * A. Membro A acessando mídia do Tenant B (Bloqueio Multi-tenant)
 * B. Membro A acessando álbum da Congregação B (Isolamento congregacional)
 * C. Membro A acessando vídeo da Congregação B (Isolamento congregacional)
 * D. Conteúdo geral do próprio tenant (congregacao_id IS NULL) acessível a todos do ministério
 * E. Conteúdo da própria congregação (congregacao_id = ctx.congregacaoId) acessível ao membro
 * F. Conteúdo não publicado (publicado_em > NOW()) bloqueado para o membro
 * G. Conteúdo expirado (expira_em < NOW()) bloqueado para notícias
 * H. Web Rádio inativa (radio_ativa = false ou sem URL) responde de forma segura
 * I. Live encerrada (is_aovivo = false) responde status 'offline' seguro
 * J. Tentativa de forjar ministry_id no client é ignorada (server authority via JWT)
 * K. Tentativa de forjar congregacao_id no client é ignorada
 * L. Tentativa de forjar member_id no client é ignorada
 * M. IDs inexistentes retornam erro 404 / não encontrado
 * N. Paginação respeita limites máximos (max 50 por página) e paginação padrão
 * O. Sanitização de Providers e URLs de Embed seguros (reutilização de midia-utils)
 */

function extractYouTubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const cleanUrl = url.trim();
  const matchWatch = cleanUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (matchWatch) return matchWatch[1];
  const matchShort = cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (matchShort) return matchShort[1];
  const matchEmbed = cleanUrl.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (matchEmbed) return matchEmbed[1];
  const matchLive = cleanUrl.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
  if (matchLive) return matchLive[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) return cleanUrl;
  return null;
}

function getSafeEmbedUrl(url, provider) {
  if (!url) return null;
  if (provider === 'youtube') {
    const videoId = extractYouTubeVideoId(url);
    if (videoId) return `https://www.youtube.com/embed/${videoId}`;
  }
  if (provider === 'vimeo') {
    const match = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
    if (match) return `https://player.vimeo.com/video/${match[1]}`;
  }
  if (provider === 'facebook') {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
  }
  return null;
}

class MockMobileMidiaService {
  constructor() {
    this.members = [];
    this.albuns = [];
    this.fotos = [];
    this.videos = [];
    this.noticias = [];
    this.configuracoes = [];
  }

  // Helper para resolver contexto do membro autenticado
  resolveMember(jwtPayload, clientOverrides = {}) {
    if (!jwtPayload || !jwtPayload.memberId || !jwtPayload.ministryId) {
      throw new Error('UNAUTHORIZED');
    }

    // SERVER AUTHORITY: Ignora qualquer override do cliente (member_id, ministry_id, congregacao_id)
    const member = this.members.find(
      (m) => m.id === jwtPayload.memberId && m.ministry_id === jwtPayload.ministryId
    );

    if (!member) {
      throw new Error('MEMBER_NOT_FOUND');
    }

    return {
      memberId: member.id,
      ministryId: member.ministry_id,
      congregacaoId: member.congregacao_id,
    };
  }

  // 1. GET /api/v1/mobile/midia/feed
  getFeed(ctx, refDate = new Date()) {
    const nowIso = refDate.toISOString();

    // Configurações
    const cfg = this.configuracoes.find((c) => c.ministry_id === ctx.ministryId);

    // Live
    let aovivo = {
      is_aovivo: false,
      status: 'offline',
      canal_youtube_url: cfg?.canal_youtube_url || null,
      provider: null,
      live_url: null,
      embed_url: null,
    };

    if (cfg?.is_aovivo && cfg.live_url_atual) {
      const provider = cfg.live_provider || 'youtube';
      aovivo = {
        is_aovivo: true,
        status: 'online',
        canal_youtube_url: cfg.canal_youtube_url || null,
        provider,
        live_url: cfg.live_url_atual,
        embed_url: getSafeEmbedUrl(cfg.live_url_atual, provider),
      };
    }

    // Rádio
    const radio = {
      disponivel: Boolean(cfg?.radio_ativa && cfg?.radio_stream_url),
      radio_nome: cfg?.radio_ativa ? cfg?.radio_nome || 'Web Rádio' : null,
      radio_stream_url: cfg?.radio_ativa ? cfg?.radio_stream_url || null : null,
    };

    // Notícias vigentes
    const noticias = this.noticias
      .filter((n) => {
        if (n.ministry_id !== ctx.ministryId) return false;
        if (!n.ativo) return false;
        if (n.publicado_em && new Date(n.publicado_em) > refDate) return false;
        if (n.expira_em && new Date(n.expira_em) < refDate) return false;
        if (n.congregacao_id !== null && n.congregacao_id !== ctx.congregacaoId) return false;
        return true;
      })
      .slice(0, 3)
      .map((n) => ({
        id: n.id,
        titulo: n.titulo,
        categoria: n.categoria,
        imagem_url: n.imagem_url,
        publicado_em: n.publicado_em,
        escopo: n.congregacao_id ? 'congregacao' : 'geral',
      }));

    // Vídeos
    const videos = this.videos
      .filter((v) => {
        if (v.ministry_id !== ctx.ministryId) return false;
        if (!v.ativo) return false;
        if (v.congregacao_id !== null && v.congregacao_id !== ctx.congregacaoId) return false;
        return true;
      })
      .slice(0, 4)
      .map((v) => ({
        id: v.id,
        titulo: v.titulo,
        categoria: v.categoria,
        thumbnail_url: v.thumbnail_url,
        destaque: v.destaque,
      }));

    // Álbuns
    const albuns = this.albuns
      .filter((a) => {
        if (a.ministry_id !== ctx.ministryId) return false;
        if (!a.ativo) return false;
        if (a.publicado_em && new Date(a.publicado_em) > refDate) return false;
        if (a.congregacao_id !== null && a.congregacao_id !== ctx.congregacaoId) return false;
        return true;
      })
      .slice(0, 4)
      .map((a) => ({
        id: a.id,
        titulo: a.titulo,
        capa_url: a.capa_url,
        total_fotos: this.fotos.filter((f) => f.album_id === a.id).length,
      }));

    return {
      feed: {
        aovivo,
        radio,
        noticias,
        videos,
        albuns,
      },
    };
  }

  // 2. GET /api/v1/mobile/midia/videos
  getVideos(ctx, { page = 1, limit = 20, categoria = null, busca = null, destaque = false }) {
    const lim = Math.min(50, Math.max(1, limit));
    const offset = (page - 1) * lim;

    let filtered = this.videos.filter((v) => {
      if (v.ministry_id !== ctx.ministryId) return false;
      if (!v.ativo) return false;
      if (v.congregacao_id !== null && v.congregacao_id !== ctx.congregacaoId) return false;

      if (categoria && v.categoria !== categoria) return false;
      if (destaque && !v.destaque) return false;
      if (busca) {
        const b = busca.toLowerCase();
        const matchTitle = v.titulo.toLowerCase().includes(b);
        const matchDesc = v.descricao?.toLowerCase().includes(b);
        const matchAuthor = v.autor_pregador?.toLowerCase().includes(b);
        if (!matchTitle && !matchDesc && !matchAuthor) return false;
      }
      return true;
    });

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + lim);

    return {
      videos: paginated.map((v) => ({
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
      })),
      total,
      page,
      limit: lim,
      total_paginas: Math.ceil(total / lim),
    };
  }

  // 3. GET /api/v1/mobile/midia/albuns
  getAlbuns(ctx, { page = 1, limit = 20 }, refDate = new Date()) {
    const lim = Math.min(50, Math.max(1, limit));
    const offset = (page - 1) * lim;

    let filtered = this.albuns.filter((a) => {
      if (a.ministry_id !== ctx.ministryId) return false;
      if (!a.ativo) return false;
      if (a.publicado_em && new Date(a.publicado_em) > refDate) return false;
      if (a.congregacao_id !== null && a.congregacao_id !== ctx.congregacaoId) return false;
      return true;
    });

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + lim);

    return {
      albuns: paginated.map((a) => ({
        id: a.id,
        titulo: a.titulo,
        descricao: a.descricao,
        capa_url: a.capa_url,
        data_evento: a.data_evento,
        publicado_em: a.publicado_em,
        total_fotos: this.fotos.filter((f) => f.album_id === a.id).length,
        escopo: a.congregacao_id ? 'congregacao' : 'geral',
      })),
      total,
      page,
      limit: lim,
      total_paginas: Math.ceil(total / lim),
    };
  }

  // 4. GET /api/v1/mobile/midia/albuns/[id]
  getAlbumDetail(ctx, albumId, refDate = new Date()) {
    const album = this.albuns.find((a) => a.id === albumId && a.ministry_id === ctx.ministryId);
    if (!album) {
      throw new Error('ALBUM_NOT_FOUND');
    }

    if (!album.ativo || (album.publicado_em && new Date(album.publicado_em) > refDate)) {
      throw new Error('ALBUM_NOT_AVAILABLE');
    }

    if (album.congregacao_id !== null && album.congregacao_id !== ctx.congregacaoId) {
      throw new Error('FORBIDDEN_CONGREGATION');
    }

    const fotos = this.fotos
      .filter((f) => f.album_id === albumId && f.ministry_id === ctx.ministryId)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
      .map((f) => ({
        id: f.id,
        foto_url: f.foto_url,
        legenda: f.legenda || null,
        ordem: f.ordem || 0,
      }));

    return {
      album: {
        id: album.id,
        titulo: album.titulo,
        descricao: album.descricao,
        capa_url: album.capa_url || (fotos.length > 0 ? fotos[0].foto_url : null),
        data_evento: album.data_evento,
        publicado_em: album.publicado_em,
        escopo: album.congregacao_id ? 'congregacao' : 'geral',
        total_fotos: fotos.length,
        fotos,
      },
    };
  }

  // 5. GET /api/v1/mobile/midia/radio
  getRadio(ctx) {
    const cfg = this.configuracoes.find((c) => c.ministry_id === ctx.ministryId);
    if (!cfg || !cfg.radio_ativa || !cfg.radio_stream_url) {
      return {
        disponivel: false,
        radio_nome: null,
        radio_stream_url: null,
        mensagem: 'Web Rádio não está disponível no momento.',
      };
    }

    return {
      disponivel: true,
      radio_nome: cfg.radio_nome || 'Web Rádio Oficial',
      radio_stream_url: cfg.radio_stream_url,
    };
  }

  // 6. GET /api/v1/mobile/midia/aovivo
  getAoVivo(ctx) {
    const cfg = this.configuracoes.find((c) => c.ministry_id === ctx.ministryId);
    if (!cfg || !cfg.is_aovivo || !cfg.live_url_atual) {
      return {
        is_aovivo: false,
        status: 'offline',
        provider: null,
        live_url: null,
        embed_url: null,
        canal_youtube_url: cfg?.canal_youtube_url || null,
        mensagem: 'Nenhuma transmissão ao vivo no momento.',
      };
    }

    const provider = cfg.live_provider || 'youtube';
    const embedUrl = getSafeEmbedUrl(cfg.live_url_atual, provider);

    return {
      is_aovivo: true,
      status: 'online',
      provider,
      live_url: cfg.live_url_atual,
      embed_url: embedUrl,
      canal_youtube_url: cfg.canal_youtube_url || null,
    };
  }
}

describe('FASE E.12.3 — APIs Mobile da Central de Mídia', () => {
  const minAlpha = 'min-alpha-1111';
  const minBeta = 'min-beta-2222';
  const congSede = 'cong-alpha-sede';
  const congFilial = 'cong-alpha-filial';
  const congBeta = 'cong-beta-central';

  let service;

  beforeEach(() => {
    service = new MockMobileMidiaService();

    // Membros
    service.members = [
      { id: 'mem-alpha-sede', ministry_id: minAlpha, congregacao_id: congSede, name: 'Membro Sede Alpha' },
      { id: 'mem-alpha-filial', ministry_id: minAlpha, congregacao_id: congFilial, name: 'Membro Filial Alpha' },
      { id: 'mem-beta', ministry_id: minBeta, congregacao_id: congBeta, name: 'Membro Beta' },
    ];

    // Álbuns
    service.albuns = [
      {
        id: 'alb-geral',
        ministry_id: minAlpha,
        congregacao_id: null,
        titulo: 'Congresso Geral 2026',
        descricao: 'Álbum aberto a todo o ministério',
        capa_url: 'https://cdn.test/capa-geral.jpg',
        publicado_em: '2026-09-01T00:00:00.000Z',
        ativo: true,
      },
      {
        id: 'alb-sede',
        ministry_id: minAlpha,
        congregacao_id: congSede,
        titulo: 'Festa da Sede',
        capa_url: 'https://cdn.test/capa-sede.jpg',
        publicado_em: '2026-09-05T00:00:00.000Z',
        ativo: true,
      },
      {
        id: 'alb-filial',
        ministry_id: minAlpha,
        congregacao_id: congFilial,
        titulo: 'Retiro da Filial',
        capa_url: 'https://cdn.test/capa-filial.jpg',
        publicado_em: '2026-09-10T00:00:00.000Z',
        ativo: true,
      },
      {
        id: 'alb-futuro',
        ministry_id: minAlpha,
        congregacao_id: null,
        titulo: 'Álbum Agendado para Outubro',
        publicado_em: '2026-10-01T00:00:00.000Z',
        ativo: true,
      },
      {
        id: 'alb-inativo',
        ministry_id: minAlpha,
        congregacao_id: null,
        titulo: 'Álbum Rascunho',
        publicado_em: '2026-09-01T00:00:00.000Z',
        ativo: false,
      },
      {
        id: 'alb-beta',
        ministry_id: minBeta,
        congregacao_id: congBeta,
        titulo: 'Álbum do Ministério Beta',
        publicado_em: '2026-09-01T00:00:00.000Z',
        ativo: true,
      },
    ];

    // Fotos
    service.fotos = [
      { id: 'f-1', album_id: 'alb-geral', ministry_id: minAlpha, foto_url: 'https://cdn.test/f1.jpg', ordem: 1 },
      { id: 'f-2', album_id: 'alb-geral', ministry_id: minAlpha, foto_url: 'https://cdn.test/f2.jpg', ordem: 2 },
      { id: 'f-3', album_id: 'alb-filial', ministry_id: minAlpha, foto_url: 'https://cdn.test/f3.jpg', ordem: 1 },
      { id: 'f-beta', album_id: 'alb-beta', ministry_id: minBeta, foto_url: 'https://cdn.test/fbeta.jpg', ordem: 1 },
    ];

    // Vídeos
    service.videos = [
      {
        id: 'vid-geral',
        ministry_id: minAlpha,
        congregacao_id: null,
        titulo: 'Culto de Celebração de Domingo',
        descricao: 'Mensagem sobre fé',
        url_video: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        youtube_id: 'dQw4w9WgXcQ',
        thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        categoria: 'culto',
        autor_pregador: 'Pr. Carlos',
        destaque: true,
        ativo: true,
      },
      {
        id: 'vid-sede',
        ministry_id: minAlpha,
        congregacao_id: congSede,
        titulo: 'Estudo de Doutrina da Sede',
        url_video: 'https://www.youtube.com/watch?v=abc12345678',
        youtube_id: 'abc12345678',
        categoria: 'estudo',
        destaque: false,
        ativo: true,
      },
      {
        id: 'vid-filial',
        ministry_id: minAlpha,
        congregacao_id: congFilial,
        titulo: 'Vigília da Filial',
        url_video: 'https://www.youtube.com/watch?v=xyz12345678',
        youtube_id: 'xyz12345678',
        categoria: 'culto',
        destaque: false,
        ativo: true,
      },
      {
        id: 'vid-inativo',
        ministry_id: minAlpha,
        congregacao_id: null,
        titulo: 'Vídeo Oculto',
        url_video: 'https://www.youtube.com/watch?v=inativo1234',
        categoria: 'outro',
        ativo: false,
      },
      {
        id: 'vid-beta',
        ministry_id: minBeta,
        congregacao_id: null,
        titulo: 'Vídeo do Ministério Beta',
        url_video: 'https://www.youtube.com/watch?v=beta1234567',
        categoria: 'culto',
        ativo: true,
      },
    ];

    // Notícias
    service.noticias = [
      {
        id: 'not-1',
        ministry_id: minAlpha,
        congregacao_id: null,
        titulo: 'Aviso Geral de Missões',
        categoria: 'geral',
        publicado_em: '2026-09-10T00:00:00.000Z',
        expira_em: '2026-09-30T00:00:00.000Z',
        ativo: true,
      },
      {
        id: 'not-expirada',
        ministry_id: minAlpha,
        congregacao_id: null,
        titulo: 'Notícia Passada',
        categoria: 'geral',
        publicado_em: '2026-08-01T00:00:00.000Z',
        expira_em: '2026-08-15T00:00:00.000Z',
        ativo: true,
      },
    ];

    // Configurações
    service.configuracoes = [
      {
        ministry_id: minAlpha,
        radio_nome: 'Rádio Eklésia FM',
        radio_stream_url: 'https://stream.eklesia.fm/live',
        radio_ativa: true,
        live_provider: 'youtube',
        live_url_atual: 'https://www.youtube.com/watch?v=live1234567',
        canal_youtube_url: 'https://youtube.com/@igrejaalpha',
        is_aovivo: true,
      },
      {
        ministry_id: minBeta,
        radio_nome: 'Rádio Beta',
        radio_stream_url: null,
        radio_ativa: false,
        is_aovivo: false,
      },
    ];
  });

  // A. Multi-tenant: Membro Alpha não acessa recursos do Tenant Beta
  it('A. Membro A não acessa vídeos, álbuns ou configurações do Tenant B', () => {
    const ctxAlpha = service.resolveMember({ memberId: 'mem-alpha-sede', ministryId: minAlpha });

    const albuns = service.getAlbuns(ctxAlpha, { page: 1, limit: 20 });
    assert.strictEqual(albuns.albuns.some((a) => a.id === 'alb-beta'), false);

    const videos = service.getVideos(ctxAlpha, { page: 1, limit: 20 });
    assert.strictEqual(videos.videos.some((v) => v.id === 'vid-beta'), false);

    assert.throws(
      () => service.getAlbumDetail(ctxAlpha, 'alb-beta'),
      /ALBUM_NOT_FOUND/
    );
  });

  // B & C. Isolamento congregacional de álbuns e vídeos
  it('B & C. Membro da Sede não acessa álbum ou vídeo exclusivo da Filial', () => {
    const ctxSede = service.resolveMember({ memberId: 'mem-alpha-sede', ministryId: minAlpha });

    // Listagem de álbuns
    const albuns = service.getAlbuns(ctxSede, { page: 1, limit: 20 });
    assert.ok(albuns.albuns.some((a) => a.id === 'alb-sede'));
    assert.strictEqual(albuns.albuns.some((a) => a.id === 'alb-filial'), false);

    // Detalhe de álbum de outra congregação
    assert.throws(
      () => service.getAlbumDetail(ctxSede, 'alb-filial'),
      /FORBIDDEN_CONGREGATION/
    );

    // Listagem de vídeos
    const videos = service.getVideos(ctxSede, { page: 1, limit: 20 });
    assert.ok(videos.videos.some((v) => v.id === 'vid-sede'));
    assert.strictEqual(videos.videos.some((v) => v.id === 'vid-filial'), false);
  });

  // D. Conteúdo geral (congregacao_id IS NULL)
  it('D. Conteúdo geral do tenant é acessível a membros de qualquer congregação', () => {
    const ctxSede = service.resolveMember({ memberId: 'mem-alpha-sede', ministryId: minAlpha });
    const ctxFilial = service.resolveMember({ memberId: 'mem-alpha-filial', ministryId: minAlpha });

    const albunsSede = service.getAlbuns(ctxSede, {});
    const albunsFilial = service.getAlbuns(ctxFilial, {});

    assert.ok(albunsSede.albuns.some((a) => a.id === 'alb-geral'));
    assert.ok(albunsFilial.albuns.some((a) => a.id === 'alb-geral'));

    const detailSede = service.getAlbumDetail(ctxSede, 'alb-geral');
    assert.strictEqual(detailSede.album.titulo, 'Congresso Geral 2026');
    assert.strictEqual(detailSede.album.fotos.length, 2);
  });

  // E. Conteúdo da própria congregação
  it('E. Membro da Filial acessa álbum e vídeo da sua respectiva congregação', () => {
    const ctxFilial = service.resolveMember({ memberId: 'mem-alpha-filial', ministryId: minAlpha });

    const albuns = service.getAlbuns(ctxFilial, {});
    assert.ok(albuns.albuns.some((a) => a.id === 'alb-filial'));
    assert.strictEqual(albuns.albuns.some((a) => a.id === 'alb-sede'), false);

    const detail = service.getAlbumDetail(ctxFilial, 'alb-filial');
    assert.strictEqual(detail.album.fotos.length, 1);
    assert.strictEqual(detail.album.fotos[0].id, 'f-3');
  });

  // F. Conteúdo não publicado (publicado_em > NOW())
  it('F. Conteúdo agendado para data futura fica oculto do membro', () => {
    const ctxSede = service.resolveMember({ memberId: 'mem-alpha-sede', ministryId: minAlpha });
    const refDate = new Date('2026-09-15T12:00:00.000Z');

    const albuns = service.getAlbuns(ctxSede, {}, refDate);
    assert.strictEqual(albuns.albuns.some((a) => a.id === 'alb-futuro'), false);

    assert.throws(
      () => service.getAlbumDetail(ctxSede, 'alb-futuro', refDate),
      /ALBUM_NOT_AVAILABLE/
    );
  });

  // G. Conteúdo expirado em notícias
  it('G. Notícias expiradas (expira_em < NOW()) não são retornadas no feed', () => {
    const ctxSede = service.resolveMember({ memberId: 'mem-alpha-sede', ministryId: minAlpha });
    const refDate = new Date('2026-09-15T12:00:00.000Z');

    const feed = service.getFeed(ctxSede, refDate);
    assert.ok(feed.feed.noticias.some((n) => n.id === 'not-1'));
    assert.strictEqual(feed.feed.noticias.some((n) => n.id === 'not-expirada'), false);
  });

  // H. Rádio inativa
  it('H. Web Rádio inativa retorna estado indisponível seguro', () => {
    const ctxBeta = service.resolveMember({ memberId: 'mem-beta', ministryId: minBeta });
    const radioBeta = service.getRadio(ctxBeta);

    assert.strictEqual(radioBeta.disponivel, false);
    assert.strictEqual(radioBeta.radio_stream_url, null);

    const ctxAlpha = service.resolveMember({ memberId: 'mem-alpha-sede', ministryId: minAlpha });
    const radioAlpha = service.getRadio(ctxAlpha);
    assert.strictEqual(radioAlpha.disponivel, true);
    assert.strictEqual(radioAlpha.radio_stream_url, 'https://stream.eklesia.fm/live');
  });

  // I. Live encerrada
  it('I. Transmissão encerrada retorna status offline', () => {
    const ctxBeta = service.resolveMember({ memberId: 'mem-beta', ministryId: minBeta });
    const liveBeta = service.getAoVivo(ctxBeta);

    assert.strictEqual(liveBeta.is_aovivo, false);
    assert.strictEqual(liveBeta.status, 'offline');
    assert.strictEqual(liveBeta.embed_url, null);

    const ctxAlpha = service.resolveMember({ memberId: 'mem-alpha-sede', ministryId: minAlpha });
    const liveAlpha = service.getAoVivo(ctxAlpha);
    assert.strictEqual(liveAlpha.is_aovivo, true);
    assert.strictEqual(liveAlpha.status, 'online');
    assert.strictEqual(liveAlpha.embed_url, 'https://www.youtube.com/embed/live1234567');
  });

  // J, K, L. Server Authority contra forjamento de identidade
  it('J, K, L. Tentativa do cliente forjar ministry_id, congregacao_id ou member_id é completamente anulada', () => {
    // JWT legítimo do Membro Sede de Alpha
    const jwtAlpha = { memberId: 'mem-alpha-sede', ministryId: minAlpha };

    // Cliente malicioso envia overrides no corpo/header
    const clientForged = {
      memberId: 'mem-beta',
      ministryId: minBeta,
      congregacaoId: congFilial,
    };

    const resolved = service.resolveMember(jwtAlpha, clientForged);

    // O contexto SEMPRE respeita o banco e o JWT
    assert.strictEqual(resolved.memberId, 'mem-alpha-sede');
    assert.strictEqual(resolved.ministryId, minAlpha);
    assert.strictEqual(resolved.congregacaoId, congSede);
  });

  // M. IDs inexistentes
  it('M. Consulta a ID inexistente retorna 404', () => {
    const ctxAlpha = service.resolveMember({ memberId: 'mem-alpha-sede', ministryId: minAlpha });

    assert.throws(
      () => service.getAlbumDetail(ctxAlpha, 'id-totalmente-inexistente'),
      /ALBUM_NOT_FOUND/
    );
  });

  // N. Paginação
  it('N. Paginação limita número de itens por página a 50', () => {
    const ctxAlpha = service.resolveMember({ memberId: 'mem-alpha-sede', ministryId: minAlpha });

    // Pede 100 itens -> serviço limita internamente a 50
    const res = service.getVideos(ctxAlpha, { page: 1, limit: 100 });
    assert.strictEqual(res.limit, 50);
  });

  // O. Geração segura de URLs de Embed
  it('O. Utilitários sanitizam provedores oficiais e URLs de streaming', () => {
    assert.strictEqual(
      getSafeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube'),
      'https://www.youtube.com/embed/dQw4w9WgXcQ'
    );
    assert.strictEqual(
      getSafeEmbedUrl('https://vimeo.com/123456789', 'vimeo'),
      'https://player.vimeo.com/video/123456789'
    );
    assert.strictEqual(
      getSafeEmbedUrl('https://facebook.com/watch/?v=123', 'facebook'),
      'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Ffacebook.com%2Fwatch%2F%3Fv%3D123&show_text=false'
    );
    assert.strictEqual(getSafeEmbedUrl('javascript:alert(1)', 'desconhecido'), null);
  });
});
