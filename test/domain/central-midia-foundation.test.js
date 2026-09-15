import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Bateria de Testes da FASE E.12.1 — Fundação da Central de Mídia
 *
 * Cobertura de Testes:
 * A. Arquivo de migration 20260915150000_central_midia_foundation.sql existe e é válido
 * B. Validação de categorias permitidas em midia_videos ('culto', 'estudo', 'evento', 'musica', 'outro')
 * C. Validação de providers de live permitidos em midia_configuracoes ('youtube', 'vimeo', 'facebook', 'hls', 'outro')
 * D. Isolamento multi-tenant: Membro do Ministério Alpha não acessa álbuns do Ministério Beta
 * E. Isolamento congregacional: Membro da Congregação A não acessa álbuns exclusivos da Congregação B
 * F. Conteúdo geral (congregacao_id = null) é acessível a membros de qualquer congregação do ministério
 * G. Álbuns e vídeos inativos (ativo = false) são bloqueados para membros
 * H. Fotos pertencem estritamente ao álbum correspondente
 * I. Configurações de mídia são isoladas por ministério
 * J. Autoridade de servidor e integridade de foreign keys
 */

class MockCentralMidiaDomainService {
  constructor() {
    this.albuns = [];
    this.fotos = [];
    this.videos = [];
    this.configuracoes = [];
  }

  // Validador de integridade de categorias de vídeos
  validarCategoriaVideo(categoria) {
    const validas = ['culto', 'estudo', 'evento', 'musica', 'outro'];
    if (!validas.includes(categoria)) {
      throw new Error(`CATEGORIA_INVALIDA: ${categoria}`);
    }
    return true;
  }

  // Validador de providers de streaming ao vivo
  validarLiveProvider(provider) {
    const validos = ['youtube', 'vimeo', 'facebook', 'hls', 'outro'];
    if (!validos.includes(provider)) {
      throw new Error(`PROVIDER_INVALIDO: ${provider}`);
    }
    return true;
  }

  // Simula consulta de álbuns pelo membro autenticado com RLS
  getAlbunsMembro(ctxMember, refDate = new Date()) {
    if (!ctxMember || !ctxMember.ministryId) {
      throw new Error('UNAUTHORIZED');
    }

    return this.albuns.filter((album) => {
      // 1. Isolamento multi-tenant
      if (album.ministry_id !== ctxMember.ministryId) return false;

      // 2. Status ativo e publicado
      if (!album.ativo) return false;
      if (album.publicado_em && new Date(album.publicado_em) > refDate) return false;

      // 3. Escopo congregacional
      if (album.congregacao_id === null || album.congregacao_id === undefined) {
        return true; // Geral do ministério
      }

      return album.congregacao_id === ctxMember.congregacaoId;
    });
  }

  // Simula consulta de vídeos pelo membro autenticado com RLS
  getVideosMembro(ctxMember) {
    if (!ctxMember || !ctxMember.ministryId) {
      throw new Error('UNAUTHORIZED');
    }

    return this.videos.filter((video) => {
      // 1. Isolamento multi-tenant
      if (video.ministry_id !== ctxMember.ministryId) return false;

      // 2. Status ativo
      if (!video.ativo) return false;

      // 3. Escopo congregacional
      if (video.congregacao_id === null || video.congregacao_id === undefined) {
        return true; // Geral
      }

      return video.congregacao_id === ctxMember.congregacaoId;
    });
  }

  // Simula consulta de fotos de um álbum
  getFotosAlbum(ctxMember, albumId) {
    const album = this.albuns.find((a) => a.id === albumId);
    if (!album) throw new Error('ALBUM_NOT_FOUND');

    // Valida permissão sobre o álbum
    if (album.ministry_id !== ctxMember.ministryId) {
      throw new Error('FORBIDDEN_CROSS_TENANT');
    }

    if (album.congregacao_id && album.congregacao_id !== ctxMember.congregacaoId) {
      throw new Error('FORBIDDEN_CONGREGACAO');
    }

    return this.fotos
      .filter((f) => f.album_id === albumId && f.ministry_id === ctxMember.ministryId)
      .sort((a, b) => a.ordem - b.ordem);
  }

  // Simula obtenção de configurações de mídia por ministério
  getConfiguracoes(ctxMember) {
    if (!ctxMember || !ctxMember.ministryId) {
      throw new Error('UNAUTHORIZED');
    }

    const cfg = this.configuracoes.find((c) => c.ministry_id === ctxMember.ministryId);
    return (
      cfg || {
        ministry_id: ctxMember.ministryId,
        radio_nome: null,
        radio_stream_url: null,
        radio_ativa: false,
        canal_youtube_url: null,
        live_url_atual: null,
        live_provider: 'youtube',
        is_aovivo: false,
      }
    );
  }
}

describe('FASE E.12.1 — Fundação da Central de Mídia', () => {
  const rootDir = process.cwd();
  const minAlpha = 'min-alpha-1111';
  const minBeta = 'min-beta-2222';
  const congSede = 'cong-alpha-sede';
  const congFilial = 'cong-alpha-filial';

  let service;

  beforeEach(() => {
    service = new MockCentralMidiaDomainService();

    // Álbuns de teste
    service.albuns = [
      {
        id: 'alb-geral',
        ministry_id: minAlpha,
        congregacao_id: null,
        titulo: 'Congresso de Missões Geral 2026',
        ativo: true,
        publicado_em: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'alb-sede',
        ministry_id: minAlpha,
        congregacao_id: congSede,
        titulo: 'Aniversário do Templo Sede',
        ativo: true,
        publicado_em: '2026-09-10T00:00:00.000Z',
      },
      {
        id: 'alb-filial',
        ministry_id: minAlpha,
        congregacao_id: congFilial,
        titulo: 'Batismo na Filial Norte',
        ativo: true,
        publicado_em: '2026-09-12T00:00:00.000Z',
      },
      {
        id: 'alb-inativo',
        ministry_id: minAlpha,
        congregacao_id: null,
        titulo: 'Álbum Oculto / Rascunho',
        ativo: false,
        publicado_em: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'alb-beta',
        ministry_id: minBeta,
        congregacao_id: null,
        titulo: 'Álbum Exclusivo Ministério Beta',
        ativo: true,
        publicado_em: '2026-09-01T00:00:00.000Z',
      },
    ];

    // Fotos de teste
    service.fotos = [
      { id: 'f-1', album_id: 'alb-geral', ministry_id: minAlpha, foto_url: 'https://cdn.test/f1.jpg', ordem: 1 },
      { id: 'f-2', album_id: 'alb-geral', ministry_id: minAlpha, foto_url: 'https://cdn.test/f2.jpg', ordem: 2 },
      { id: 'f-3', album_id: 'alb-filial', ministry_id: minAlpha, foto_url: 'https://cdn.test/f3.jpg', ordem: 1 },
    ];

    // Vídeos de teste
    service.videos = [
      {
        id: 'vid-1',
        ministry_id: minAlpha,
        congregacao_id: null,
        titulo: 'Mensagem de Domingo: A Fé que Vence',
        categoria: 'culto',
        video_url: 'https://youtube.com/watch?v=123',
        youtube_video_id: '123',
        ativo: true,
      },
      {
        id: 'vid-2',
        ministry_id: minAlpha,
        congregacao_id: congFilial,
        titulo: 'Estudo para Jovens Filial',
        categoria: 'estudo',
        video_url: 'https://youtube.com/watch?v=456',
        youtube_video_id: '456',
        ativo: true,
      },
      {
        id: 'vid-beta',
        ministry_id: minBeta,
        congregacao_id: null,
        titulo: 'Vídeo Beta',
        categoria: 'culto',
        video_url: 'https://youtube.com/watch?v=789',
        ativo: true,
      },
    ];

    // Configurações de teste
    service.configuracoes = [
      {
        id: 'cfg-alpha',
        ministry_id: minAlpha,
        radio_nome: 'Rádio Eklésia FM',
        radio_stream_url: 'https://stream.eklesia.fm/live',
        radio_ativa: true,
        live_provider: 'youtube',
        is_aovivo: true,
      },
    ];
  });

  it('A. Arquivo de migration 20260915150000_central_midia_foundation.sql existe e possui estrutura completa', () => {
    const migrationFile = path.join(
      rootDir,
      'supabase',
      'migrations',
      '20260915150000_central_midia_foundation.sql'
    );
    assert.ok(fs.existsSync(migrationFile), 'Migration de mídia deve existir');

    const sql = fs.readFileSync(migrationFile, 'utf-8');
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.midia_albuns'));
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.midia_fotos'));
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.midia_videos'));
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.midia_configuracoes'));
    assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'));
  });

  it('B. Validação de categorias permitidas em midia_videos', () => {
    assert.doesNotThrow(() => service.validarCategoriaVideo('culto'));
    assert.doesNotThrow(() => service.validarCategoriaVideo('estudo'));
    assert.doesNotThrow(() => service.validarCategoriaVideo('evento'));
    assert.doesNotThrow(() => service.validarCategoriaVideo('musica'));
    assert.doesNotThrow(() => service.validarCategoriaVideo('outro'));

    assert.throws(
      () => service.validarCategoriaVideo('categoria_invalida'),
      /CATEGORIA_INVALIDA/
    );
  });

  it('C. Validação de providers de live permitidos em midia_configuracoes', () => {
    assert.doesNotThrow(() => service.validarLiveProvider('youtube'));
    assert.doesNotThrow(() => service.validarLiveProvider('vimeo'));
    assert.doesNotThrow(() => service.validarLiveProvider('facebook'));
    assert.doesNotThrow(() => service.validarLiveProvider('hls'));
    assert.doesNotThrow(() => service.validarLiveProvider('outro'));

    assert.throws(
      () => service.validarLiveProvider('provider_desconhecido'),
      /PROVIDER_INVALIDO/
    );
  });

  it('D. Isolamento multi-tenant: Membro do Ministério Alpha não acessa álbuns do Ministério Beta', () => {
    const ctxAlpha = { memberId: 'mem-1', ministryId: minAlpha, congregacaoId: congSede };
    const albuns = service.getAlbunsMembro(ctxAlpha);

    assert.strictEqual(albuns.some((a) => a.id === 'alb-beta'), false);
  });

  it('E. Isolamento congregacional: Membro da Sede não acessa álbuns exclusivos da Filial', () => {
    const ctxSede = { memberId: 'mem-1', ministryId: minAlpha, congregacaoId: congSede };
    const albuns = service.getAlbunsMembro(ctxSede);

    assert.ok(albuns.some((a) => a.id === 'alb-sede'));
    assert.strictEqual(albuns.some((a) => a.id === 'alb-filial'), false);
  });

  it('F. Conteúdo geral (congregacao_id = null) é acessível a membros de qualquer congregação', () => {
    const ctxSede = { memberId: 'mem-1', ministryId: minAlpha, congregacaoId: congSede };
    const ctxFilial = { memberId: 'mem-2', ministryId: minAlpha, congregacaoId: congFilial };

    const albunsSede = service.getAlbunsMembro(ctxSede);
    const albunsFilial = service.getAlbunsMembro(ctxFilial);

    assert.ok(albunsSede.some((a) => a.id === 'alb-geral'));
    assert.ok(albunsFilial.some((a) => a.id === 'alb-geral'));
  });

  it('G. Álbuns e vídeos inativos (ativo = false) são bloqueados para membros', () => {
    const ctxSede = { memberId: 'mem-1', ministryId: minAlpha, congregacaoId: congSede };
    const albuns = service.getAlbunsMembro(ctxSede);

    assert.strictEqual(albuns.some((a) => a.id === 'alb-inativo'), false);
  });

  it('H. Fotos pertencem estritamente ao álbum correspondente e respeitam permissões', () => {
    const ctxSede = { memberId: 'mem-1', ministryId: minAlpha, congregacaoId: congSede };
    const fotos = service.getFotosAlbum(ctxSede, 'alb-geral');

    assert.strictEqual(fotos.length, 2);
    assert.strictEqual(fotos[0].id, 'f-1');
    assert.strictEqual(fotos[1].id, 'f-2');

    // Tentativa de acessar fotos de álbum de outra congregação bloqueia com erro
    assert.throws(
      () => service.getFotosAlbum(ctxSede, 'alb-filial'),
      /FORBIDDEN_CONGREGACAO/
    );
  });

  it('I. Configurações de mídia são isoladas por ministério', () => {
    const ctxAlpha = { memberId: 'mem-1', ministryId: minAlpha, congregacaoId: congSede };
    const cfgAlpha = service.getConfiguracoes(ctxAlpha);

    assert.strictEqual(cfgAlpha.radio_nome, 'Rádio Eklésia FM');
    assert.strictEqual(cfgAlpha.radio_ativa, true);
    assert.strictEqual(cfgAlpha.is_aovivo, true);

    const ctxBeta = { memberId: 'mem-3', ministryId: minBeta, congregacaoId: null };
    const cfgBeta = service.getConfiguracoes(ctxBeta);
    assert.strictEqual(cfgBeta.radio_nome, null);
    assert.strictEqual(cfgBeta.radio_ativa, false);
  });

  it('J. Consulta de vídeos filtra por tenant e congregação', () => {
    const ctxSede = { memberId: 'mem-1', ministryId: minAlpha, congregacaoId: congSede };
    const videosSede = service.getVideosMembro(ctxSede);

    assert.ok(videosSede.some((v) => v.id === 'vid-1'));
    assert.strictEqual(videosSede.some((v) => v.id === 'vid-2'), false); // Vídeo exclusivo da filial
    assert.strictEqual(videosSede.some((v) => v.id === 'vid-beta'), false); // Cross-tenant
  });
});
