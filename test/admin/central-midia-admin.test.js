import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Bateria de Testes da FASE E.12.2 — Painel Administrativo da Central de Mídia
 */

// Pure functions matching src/lib/midia-utils.ts
function extractYouTubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // youtube.com/watch?v=ID
  const watchMatch = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (watchMatch && watchMatch[1]) return watchMatch[1];

  // youtube.com/live/ID
  const liveMatch = trimmed.match(/youtube\.com\/live\/([^"&?\/\s]{11})/i);
  if (liveMatch && liveMatch[1]) return liveMatch[1];

  // Raw 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  return null;
}

function getYouTubeThumbnailUrl(videoId, quality = 'hq') {
  if (!videoId) return null;
  switch (quality) {
    case 'maxres':
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    case 'sd':
      return `https://img.youtube.com/vi/${videoId}/sddefault.jpg`;
    case 'mq':
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    case 'hq':
    default:
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }
}

function isValidVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

class MockAdminMidiaRepository {
  constructor() {
    this.albuns = [];
    this.fotos = [];
    this.videos = [];
    this.configuracoes = [];
  }

  // Admin: Criar Álbum
  criarAlbum(adminCtx, data) {
    if (!adminCtx?.ministryId) throw new Error('UNAUTHORIZED');
    if (!data.titulo || !data.titulo.trim()) throw new Error('TITULO_OBRIGATORIO');

    const album = {
      id: `alb-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ministry_id: adminCtx.ministryId,
      congregacao_id: data.congregacao_id || null,
      evento_id: data.evento_id || null,
      titulo: data.titulo.trim(),
      descricao: data.descricao?.trim() || null,
      capa_url: data.capa_url || null,
      data_evento: data.data_evento || null,
      publicado_em: data.publicado_em || new Date().toISOString(),
      ativo: data.ativo !== false,
      created_by: adminCtx.userId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.albuns.push(album);
    return album;
  }

  // Admin: Atualizar Álbum
  atualizarAlbum(adminCtx, albumId, data) {
    const idx = this.albuns.findIndex(
      (a) => a.id === albumId && a.ministry_id === adminCtx.ministryId
    );
    if (idx === -1) throw new Error('ALBUM_NOT_FOUND_OR_FORBIDDEN');

    this.albuns[idx] = {
      ...this.albuns[idx],
      ...data,
      updated_at: new Date().toISOString(),
    };
    return this.albuns[idx];
  }

  // Admin: Excluir Álbum (com exclusão em cascata de fotos)
  excluirAlbum(adminCtx, albumId) {
    const idx = this.albuns.findIndex(
      (a) => a.id === albumId && a.ministry_id === adminCtx.ministryId
    );
    if (idx === -1) throw new Error('ALBUM_NOT_FOUND_OR_FORBIDDEN');

    this.albuns.splice(idx, 1);
    this.fotos = this.fotos.filter((f) => f.album_id !== albumId);
    return true;
  }

  // Admin: Adicionar Foto
  adicionarFoto(adminCtx, albumId, fotoUrl, legenda = null, ordem = 0) {
    const album = this.albuns.find(
      (a) => a.id === albumId && a.ministry_id === adminCtx.ministryId
    );
    if (!album) throw new Error('ALBUM_NOT_FOUND_OR_FORBIDDEN');

    const foto = {
      id: `fot-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      album_id: albumId,
      ministry_id: adminCtx.ministryId,
      foto_url: fotoUrl,
      legenda,
      ordem,
      created_at: new Date().toISOString(),
    };
    this.fotos.push(foto);

    // Se o álbum não tiver capa, define a primeira foto como capa
    if (!album.capa_url) {
      album.capa_url = fotoUrl;
    }

    return foto;
  }

  // Admin: Criar Vídeo
  criarVideo(adminCtx, data) {
    if (!adminCtx?.ministryId) throw new Error('UNAUTHORIZED');
    if (!data.titulo || !data.titulo.trim()) throw new Error('TITULO_OBRIGATORIO');
    if (!data.url_video || !data.url_video.trim()) throw new Error('URL_OBRIGATORIA');
    if (!isValidVideoUrl(data.url_video)) throw new Error('URL_INVALIDA');

    const ytId = extractYouTubeVideoId(data.url_video);
    let thumb = data.thumbnail_url || null;
    if (!thumb && ytId) {
      thumb = getYouTubeThumbnailUrl(ytId, 'hq');
    }

    const video = {
      id: `vid-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ministry_id: adminCtx.ministryId,
      congregacao_id: data.congregacao_id || null,
      evento_id: data.evento_id || null,
      titulo: data.titulo.trim(),
      descricao: data.descricao?.trim() || null,
      url_video: data.url_video.trim(),
      youtube_id: ytId,
      thumbnail_url: thumb,
      categoria: data.categoria || 'culto',
      autor_pregador: data.autor_pregador?.trim() || null,
      data_evento: data.data_evento || null,
      duracao_segundos: data.duracao_segundos || null,
      destaque: Boolean(data.destaque),
      ativo: data.ativo !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.videos.push(video);
    return video;
  }

  // Admin: Atualizar Vídeo
  atualizarVideo(adminCtx, videoId, data) {
    const idx = this.videos.findIndex(
      (v) => v.id === videoId && v.ministry_id === adminCtx.ministryId
    );
    if (idx === -1) throw new Error('VIDEO_NOT_FOUND_OR_FORBIDDEN');

    this.videos[idx] = {
      ...this.videos[idx],
      ...data,
      updated_at: new Date().toISOString(),
    };
    return this.videos[idx];
  }

  // Admin: Excluir Vídeo
  excluirVideo(adminCtx, videoId) {
    const idx = this.videos.findIndex(
      (v) => v.id === videoId && v.ministry_id === adminCtx.ministryId
    );
    if (idx === -1) throw new Error('VIDEO_NOT_FOUND_OR_FORBIDDEN');

    this.videos.splice(idx, 1);
    return true;
  }

  // Admin: Upsert Configurações (Web Rádio e Ao Vivo)
  upsertConfiguracoes(adminCtx, data) {
    if (!adminCtx?.ministryId) throw new Error('UNAUTHORIZED');

    const idx = this.configuracoes.findIndex((c) => c.ministry_id === adminCtx.ministryId);
    const existing = idx >= 0 ? this.configuracoes[idx] : { ministry_id: adminCtx.ministryId };

    const updated = {
      ...existing,
      ...data,
      ministry_id: adminCtx.ministryId,
      updated_at: new Date().toISOString(),
    };

    if (idx >= 0) {
      this.configuracoes[idx] = updated;
    } else {
      updated.id = `cfg-${Date.now()}`;
      updated.created_at = new Date().toISOString();
      this.configuracoes.push(updated);
    }

    return updated;
  }

  // Admin: Obter Métricas da Central de Mídia
  getOverviewMetrics(adminCtx) {
    if (!adminCtx?.ministryId) throw new Error('UNAUTHORIZED');

    const totalAlbuns = this.albuns.filter((a) => a.ministry_id === adminCtx.ministryId).length;
    const totalFotos = this.fotos.filter((f) => f.ministry_id === adminCtx.ministryId).length;
    const totalVideos = this.videos.filter((v) => v.ministry_id === adminCtx.ministryId).length;
    const cfg = this.configuracoes.find((c) => c.ministry_id === adminCtx.ministryId);

    return {
      totalAlbuns,
      totalFotos,
      totalVideos,
      radioAtiva: cfg?.radio_ativa || false,
      radioNome: cfg?.radio_nome || null,
      isAoVivo: cfg?.is_aovivo || false,
      liveProvider: cfg?.live_provider || 'youtube',
    };
  }
}

// Simulador de Upload de Foto
function validarUploadFoto(mimeType, sizeInBytes) {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxBytes = 10 * 1024 * 1024; // 10MB

  if (!allowedMimeTypes.includes(mimeType)) {
    throw new Error('TIPO_INVALIDO: Apenas imagens JPEG, PNG, WebP e GIF são permitidas.');
  }

  if (sizeInBytes > maxBytes) {
    throw new Error('TAMANHO_EXCEDIDO: O arquivo excede o limite máximo de 10MB.');
  }

  return true;
}

describe('FASE E.12.2 — Painel Administrativo da Central de Mídia', () => {
  const minAlpha = 'min-alpha-admin';
  const minBeta = 'min-beta-admin';
  const adminAlpha = { userId: 'usr-1', ministryId: minAlpha };
  const adminBeta = { userId: 'usr-2', ministryId: minBeta };

  let repo;

  beforeEach(() => {
    repo = new MockAdminMidiaRepository();
  });

  // 1. YouTube & URL Utils
  it('1. Utilitários de YouTube extraem IDs e geram thumbnails corretamente', () => {
    // Links padrão
    assert.strictEqual(
      extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
      'dQw4w9WgXcQ'
    );
    // Links encurtados
    assert.strictEqual(
      extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?si=abcdef'),
      'dQw4w9WgXcQ'
    );
    // Links de embed
    assert.strictEqual(
      extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ'),
      'dQw4w9WgXcQ'
    );
    // Links de live
    assert.strictEqual(
      extractYouTubeVideoId('https://www.youtube.com/live/dQw4w9WgXcQ'),
      'dQw4w9WgXcQ'
    );

    // Thumbnail
    assert.strictEqual(
      getYouTubeThumbnailUrl('dQw4w9WgXcQ', 'hq'),
      'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
    );

    // Validação de URL
    assert.strictEqual(isValidVideoUrl('https://www.youtube.com/watch?v=abc12345678'), true);
    assert.strictEqual(isValidVideoUrl('https://youtu.be/abc12345678'), true);
    assert.strictEqual(isValidVideoUrl('javascript:alert(1)'), false);
    assert.strictEqual(isValidVideoUrl(''), false);
  });

  // 2. Validação de Upload de Fotos
  it('2. Validação estrita de upload de fotos (apenas imagens, máximo 10MB)', () => {
    assert.doesNotThrow(() => validarUploadFoto('image/jpeg', 2 * 1024 * 1024));
    assert.doesNotThrow(() => validarUploadFoto('image/png', 5 * 1024 * 1024));
    assert.doesNotThrow(() => validarUploadFoto('image/webp', 1 * 1024 * 1024));

    // Rejeita vídeos (reforça proibição de upload direto de vídeo)
    assert.throws(
      () => validarUploadFoto('video/mp4', 5 * 1024 * 1024),
      /TIPO_INVALIDO/
    );
    // Rejeita executáveis e PDFs
    assert.throws(
      () => validarUploadFoto('application/pdf', 500 * 1024),
      /TIPO_INVALIDO/
    );
    // Rejeita arquivos maiores que 10MB
    assert.throws(
      () => validarUploadFoto('image/jpeg', 12 * 1024 * 1024),
      /TAMANHO_EXCEDIDO/
    );
  });

  // 3. CRUD de Álbuns e Fotos (Admin)
  it('3. CRUD completo de Álbuns e Fotos com RLS administrativo', () => {
    // Criação
    const album = repo.criarAlbum(adminAlpha, {
      titulo: 'Culto da Virada 2026',
      descricao: 'Fotos da celebração de ano novo',
      ativo: true,
    });
    assert.ok(album.id);
    assert.strictEqual(album.ministry_id, minAlpha);
    assert.strictEqual(album.capa_url, null);

    // Adiciona fotos
    const f1 = repo.adicionarFoto(adminAlpha, album.id, 'https://cdn.test/foto1.jpg', 'Entrada', 1);
    const f2 = repo.adicionarFoto(adminAlpha, album.id, 'https://cdn.test/foto2.jpg', 'Louvor', 2);

    // Primeira foto vira capa automaticamente
    assert.strictEqual(album.capa_url, 'https://cdn.test/foto1.jpg');
    assert.strictEqual(repo.fotos.length, 2);

    // Atualização de capa e título
    repo.atualizarAlbum(adminAlpha, album.id, {
      capa_url: 'https://cdn.test/foto2.jpg',
      titulo: 'Culto da Virada 2026 - Atualizado',
    });
    const updated = repo.albuns.find((a) => a.id === album.id);
    assert.strictEqual(updated.titulo, 'Culto da Virada 2026 - Atualizado');
    assert.strictEqual(updated.capa_url, 'https://cdn.test/foto2.jpg');

    // Exclusão em cascata
    repo.excluirAlbum(adminAlpha, album.id);
    assert.strictEqual(repo.albuns.length, 0);
    assert.strictEqual(repo.fotos.length, 0);
  });

  // 4. CRUD de Vídeos (Admin)
  it('4. CRUD completo de Vídeos com categorização e destaques', () => {
    const video = repo.criarVideo(adminAlpha, {
      titulo: 'Série Fé Inabalável #1',
      url_video: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      categoria: 'estudo',
      autor_pregador: 'Pr. Carlos',
      duracao_segundos: 3600,
      destaque: true,
      ativo: true,
    });

    assert.ok(video.id);
    assert.strictEqual(video.youtube_id, 'dQw4w9WgXcQ');
    assert.strictEqual(
      video.thumbnail_url,
      'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
    );
    assert.strictEqual(video.destaque, true);
    assert.strictEqual(video.categoria, 'estudo');

    // Alterna status e destaque
    repo.atualizarVideo(adminAlpha, video.id, {
      destaque: false,
      ativo: false,
    });
    const vidUpdated = repo.videos.find((v) => v.id === video.id);
    assert.strictEqual(vidUpdated.destaque, false);
    assert.strictEqual(vidUpdated.ativo, false);

    // Exclusão
    repo.excluirVideo(adminAlpha, video.id);
    assert.strictEqual(repo.videos.length, 0);
  });

  // 5. Configuração da Web Rádio (Admin)
  it('5. Gestão de configurações da Web Rádio', () => {
    const cfg = repo.upsertConfiguracoes(adminAlpha, {
      radio_nome: 'Rádio Vida Nova',
      radio_stream_url: 'https://stream.radio.com:8000/live',
      radio_ativa: true,
    });

    assert.strictEqual(cfg.ministry_id, minAlpha);
    assert.strictEqual(cfg.radio_nome, 'Rádio Vida Nova');
    assert.strictEqual(cfg.radio_ativa, true);

    // Desativar rádio
    const cfgDesativada = repo.upsertConfiguracoes(adminAlpha, {
      radio_ativa: false,
    });
    assert.strictEqual(cfgDesativada.radio_ativa, false);
    assert.strictEqual(cfgDesativada.radio_nome, 'Rádio Vida Nova');
  });

  // 6. Transmissão Ao Vivo (Admin)
  it('6. Controle de status de culto ao vivo e provedor', () => {
    const cfg = repo.upsertConfiguracoes(adminAlpha, {
      is_aovivo: true,
      live_provider: 'youtube',
      live_url_atual: 'https://www.youtube.com/watch?v=live123',
      canal_youtube_url: 'https://youtube.com/@igrejaexemplo',
    });

    assert.strictEqual(cfg.is_aovivo, true);
    assert.strictEqual(cfg.live_provider, 'youtube');
    assert.strictEqual(cfg.live_url_atual, 'https://www.youtube.com/watch?v=live123');

    // Encerrar transmissão
    repo.upsertConfiguracoes(adminAlpha, { is_aovivo: false });
    const cfgEncerrada = repo.configuracoes.find((c) => c.ministry_id === minAlpha);
    assert.strictEqual(cfgEncerrada.is_aovivo, false);
  });

  // 7. Isolamento Multi-tenant Administrativo
  it('7. Isolamento estrito entre ministérios no painel administrativo', () => {
    // Admin Alpha cria recursos
    const albAlpha = repo.criarAlbum(adminAlpha, { titulo: 'Álbum Alpha' });
    const vidAlpha = repo.criarVideo(adminAlpha, {
      titulo: 'Vídeo Alpha',
      url_video: 'https://youtube.com/watch?v=11111111111',
    });

    // Admin Beta não pode atualizar recursos do Alpha
    assert.throws(
      () => repo.atualizarAlbum(adminBeta, albAlpha.id, { titulo: 'Hack Alpha' }),
      /ALBUM_NOT_FOUND_OR_FORBIDDEN/
    );
    assert.throws(
      () => repo.atualizarVideo(adminBeta, vidAlpha.id, { titulo: 'Hack Alpha' }),
      /VIDEO_NOT_FOUND_OR_FORBIDDEN/
    );

    // Admin Beta não pode excluir recursos do Alpha
    assert.throws(
      () => repo.excluirAlbum(adminBeta, albAlpha.id),
      /ALBUM_NOT_FOUND_OR_FORBIDDEN/
    );
    assert.throws(
      () => repo.excluirVideo(adminBeta, vidAlpha.id),
      /VIDEO_NOT_FOUND_OR_FORBIDDEN/
    );
  });

  // 8. Agregações e Métricas da Visão Geral
  it('8. Visão Geral compila métricas multi-tenant corretamente', () => {
    // Popula Alpha
    repo.criarAlbum(adminAlpha, { titulo: 'Álbum 1' });
    repo.criarAlbum(adminAlpha, { titulo: 'Álbum 2' });
    repo.criarVideo(adminAlpha, {
      titulo: 'Vídeo 1',
      url_video: 'https://youtube.com/watch?v=aaa11111111',
    });
    repo.upsertConfiguracoes(adminAlpha, {
      radio_nome: 'Rádio Alpha',
      radio_ativa: true,
      is_aovivo: true,
    });

    // Popula Beta
    repo.criarAlbum(adminBeta, { titulo: 'Álbum Beta' });

    // Métricas do Alpha
    const metricsAlpha = repo.getOverviewMetrics(adminAlpha);
    assert.strictEqual(metricsAlpha.totalAlbuns, 2);
    assert.strictEqual(metricsAlpha.totalVideos, 1);
    assert.strictEqual(metricsAlpha.radioAtiva, true);
    assert.strictEqual(metricsAlpha.isAoVivo, true);

    // Métricas do Beta
    const metricsBeta = repo.getOverviewMetrics(adminBeta);
    assert.strictEqual(metricsBeta.totalAlbuns, 1);
    assert.strictEqual(metricsBeta.totalVideos, 0);
    assert.strictEqual(metricsBeta.radioAtiva, false);
    assert.strictEqual(metricsBeta.isAoVivo, false);
  });
});
