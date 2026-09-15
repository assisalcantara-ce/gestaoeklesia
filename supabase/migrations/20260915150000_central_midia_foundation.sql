-- ═══════════════════════════════════════════════════════════════════════════════
-- Migração: Fundação Oficial da Central de Mídia
-- Tabelas: midia_albuns, midia_fotos, midia_videos, midia_configuracoes
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Tabela: midia_albuns (Álbuns de fotos de eventos, cultos e congressos)
CREATE TABLE IF NOT EXISTS public.midia_albuns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id      UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id   UUID REFERENCES public.congregacoes(id) ON DELETE CASCADE,
  evento_id        UUID REFERENCES public.eventos(id) ON DELETE SET NULL,
  
  titulo           VARCHAR(255) NOT NULL,
  descricao        TEXT,
  capa_url         TEXT,
  data_evento      DATE,
  publicado_em     TIMESTAMPTZ,
  ativo            BOOLEAN NOT NULL DEFAULT true,
  
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Índices para midia_albuns
CREATE INDEX IF NOT EXISTS idx_midia_albuns_ministry 
  ON public.midia_albuns (ministry_id);

CREATE INDEX IF NOT EXISTS idx_midia_albuns_congregacao 
  ON public.midia_albuns (congregacao_id);

CREATE INDEX IF NOT EXISTS idx_midia_albuns_evento 
  ON public.midia_albuns (evento_id);

CREATE INDEX IF NOT EXISTS idx_midia_albuns_feed 
  ON public.midia_albuns (ministry_id, congregacao_id, ativo, publicado_em DESC);

-- 2. Tabela: midia_fotos (Fotos pertencentes a um álbum)
CREATE TABLE IF NOT EXISTS public.midia_fotos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id         UUID NOT NULL REFERENCES public.midia_albuns(id) ON DELETE CASCADE,
  ministry_id      UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  
  foto_url         TEXT NOT NULL,
  legenda          TEXT,
  ordem            INTEGER NOT NULL DEFAULT 0,
  
  created_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Índices para midia_fotos
CREATE INDEX IF NOT EXISTS idx_midia_fotos_album 
  ON public.midia_fotos (album_id, ordem ASC);

CREATE INDEX IF NOT EXISTS idx_midia_fotos_ministry 
  ON public.midia_fotos (ministry_id);

-- 3. Tabela: midia_videos (Catálogo de sermões, mensagens e transmissões gravadas)
CREATE TABLE IF NOT EXISTS public.midia_videos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id      UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id   UUID REFERENCES public.congregacoes(id) ON DELETE CASCADE,
  evento_id        UUID REFERENCES public.eventos(id) ON DELETE SET NULL,
  
  titulo           VARCHAR(255) NOT NULL,
  descricao        TEXT,
  categoria        VARCHAR(50) NOT NULL DEFAULT 'culto',
  
  video_url        TEXT NOT NULL,
  youtube_video_id VARCHAR(100),
  thumbnail_url    TEXT,
  pregador_nome    VARCHAR(255),
  
  data_publicacao  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ativo            BOOLEAN NOT NULL DEFAULT true,
  
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT midia_videos_categoria_check 
    CHECK (categoria IN ('culto', 'estudo', 'evento', 'musica', 'outro'))
);

-- Índices para midia_videos
CREATE INDEX IF NOT EXISTS idx_midia_videos_feed 
  ON public.midia_videos (ministry_id, congregacao_id, ativo, data_publicacao DESC);

CREATE INDEX IF NOT EXISTS idx_midia_videos_categoria 
  ON public.midia_videos (categoria);

CREATE INDEX IF NOT EXISTS idx_midia_videos_evento 
  ON public.midia_videos (evento_id);

-- 4. Tabela: midia_configuracoes (Configurações da Web Rádio e Canal de Transmissão Ao Vivo)
CREATE TABLE IF NOT EXISTS public.midia_configuracoes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id        UUID NOT NULL UNIQUE REFERENCES public.ministries(id) ON DELETE CASCADE,
  
  radio_nome         VARCHAR(255),
  radio_stream_url   TEXT,
  radio_ativa        BOOLEAN NOT NULL DEFAULT false,
  
  canal_youtube_url  TEXT,
  live_url_atual     TEXT,
  live_provider      VARCHAR(50) NOT NULL DEFAULT 'youtube',
  is_aovivo          BOOLEAN NOT NULL DEFAULT false,
  
  updated_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT midia_configuracoes_provider_check 
    CHECK (live_provider IN ('youtube', 'vimeo', 'facebook', 'hls', 'outro'))
);

CREATE INDEX IF NOT EXISTS idx_midia_configuracoes_ministry 
  ON public.midia_configuracoes (ministry_id);

-- Triggers de updated_at
CREATE OR REPLACE FUNCTION public.set_midia_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_midia_albuns_updated_at ON public.midia_albuns;
CREATE TRIGGER trg_midia_albuns_updated_at
  BEFORE UPDATE ON public.midia_albuns
  FOR EACH ROW EXECUTE FUNCTION public.set_midia_updated_at();

DROP TRIGGER IF EXISTS trg_midia_videos_updated_at ON public.midia_videos;
CREATE TRIGGER trg_midia_videos_updated_at
  BEFORE UPDATE ON public.midia_videos
  FOR EACH ROW EXECUTE FUNCTION public.set_midia_updated_at();

DROP TRIGGER IF EXISTS trg_midia_configuracoes_updated_at ON public.midia_configuracoes;
CREATE TRIGGER trg_midia_configuracoes_updated_at
  BEFORE UPDATE ON public.midia_configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.set_midia_updated_at();

-- ─── ROW LEVEL SECURITY (RLS) ──────────────────────────────────────────────────
ALTER TABLE public.midia_albuns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.midia_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.midia_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.midia_configuracoes ENABLE ROW LEVEL SECURITY;

-- 1. Políticas para midia_albuns
DROP POLICY IF EXISTS "midia_albuns_select" ON public.midia_albuns;
DROP POLICY IF EXISTS "midia_albuns_insert" ON public.midia_albuns;
DROP POLICY IF EXISTS "midia_albuns_update" ON public.midia_albuns;
DROP POLICY IF EXISTS "midia_albuns_delete" ON public.midia_albuns;

CREATE POLICY "midia_albuns_select" ON public.midia_albuns FOR SELECT USING (
  -- Staff administrativo do tenant
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
  OR
  -- Membro autenticado
  (
    ativo = true
    AND publicado_em IS NOT NULL
    AND publicado_em <= now()
    AND (
      -- Álbum geral do ministério
      (
        congregacao_id IS NULL
        AND ministry_id IN (
          SELECT ministry_id FROM public.members WHERE auth_user_id = auth.uid()
        )
      )
      OR
      -- Álbum específico da congregação do membro
      (
        congregacao_id IS NOT NULL
        AND congregacao_id IN (
          SELECT congregacao_id FROM public.members WHERE auth_user_id = auth.uid()
        )
        AND ministry_id IN (
          SELECT ministry_id FROM public.members WHERE auth_user_id = auth.uid()
        )
      )
    )
  )
);

CREATE POLICY "midia_albuns_insert" ON public.midia_albuns FOR INSERT WITH CHECK (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users
    WHERE user_id = auth.uid()
      AND (
        role IN ('admin', 'manager', 'presidencia')
        OR permissions @> '["ADMINISTRADOR"]'::jsonb
        OR permissions @> '["GESTAO"]'::jsonb
        OR permissions @> '["SECRETARIA"]'::jsonb
        OR permissions @> '["COMUNICACAO"]'::jsonb
      )
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
);

CREATE POLICY "midia_albuns_update" ON public.midia_albuns FOR UPDATE USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users
    WHERE user_id = auth.uid()
      AND (
        role IN ('admin', 'manager', 'presidencia')
        OR permissions @> '["ADMINISTRADOR"]'::jsonb
        OR permissions @> '["GESTAO"]'::jsonb
        OR permissions @> '["SECRETARIA"]'::jsonb
        OR permissions @> '["COMUNICACAO"]'::jsonb
      )
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
);

CREATE POLICY "midia_albuns_delete" ON public.midia_albuns FOR DELETE USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users
    WHERE user_id = auth.uid()
      AND (
        role IN ('admin', 'manager', 'presidencia')
        OR permissions @> '["ADMINISTRADOR"]'::jsonb
        OR permissions @> '["GESTAO"]'::jsonb
        OR permissions @> '["SECRETARIA"]'::jsonb
        OR permissions @> '["COMUNICACAO"]'::jsonb
      )
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
);

-- 2. Políticas para midia_fotos
DROP POLICY IF EXISTS "midia_fotos_select" ON public.midia_fotos;
DROP POLICY IF EXISTS "midia_fotos_insert" ON public.midia_fotos;
DROP POLICY IF EXISTS "midia_fotos_update" ON public.midia_fotos;
DROP POLICY IF EXISTS "midia_fotos_delete" ON public.midia_fotos;

CREATE POLICY "midia_fotos_select" ON public.midia_fotos FOR SELECT USING (
  -- Staff administrativo
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
  OR
  -- Membro autenticado com acesso ao álbum pai
  EXISTS (
    SELECT 1 FROM public.midia_albuns a
    WHERE a.id = midia_fotos.album_id
      AND a.ativo = true
      AND a.publicado_em IS NOT NULL
      AND a.publicado_em <= now()
      AND a.ministry_id IN (
        SELECT ministry_id FROM public.members WHERE auth_user_id = auth.uid()
      )
      AND (
        a.congregacao_id IS NULL
        OR a.congregacao_id IN (
          SELECT congregacao_id FROM public.members WHERE auth_user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "midia_fotos_insert" ON public.midia_fotos FOR INSERT WITH CHECK (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users
    WHERE user_id = auth.uid()
      AND (
        role IN ('admin', 'manager', 'presidencia')
        OR permissions @> '["ADMINISTRADOR"]'::jsonb
        OR permissions @> '["GESTAO"]'::jsonb
        OR permissions @> '["SECRETARIA"]'::jsonb
        OR permissions @> '["COMUNICACAO"]'::jsonb
      )
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
);

CREATE POLICY "midia_fotos_update" ON public.midia_fotos FOR UPDATE USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users
    WHERE user_id = auth.uid()
      AND (
        role IN ('admin', 'manager', 'presidencia')
        OR permissions @> '["ADMINISTRADOR"]'::jsonb
        OR permissions @> '["GESTAO"]'::jsonb
        OR permissions @> '["SECRETARIA"]'::jsonb
        OR permissions @> '["COMUNICACAO"]'::jsonb
      )
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
);

CREATE POLICY "midia_fotos_delete" ON public.midia_fotos FOR DELETE USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users
    WHERE user_id = auth.uid()
      AND (
        role IN ('admin', 'manager', 'presidencia')
        OR permissions @> '["ADMINISTRADOR"]'::jsonb
        OR permissions @> '["GESTAO"]'::jsonb
        OR permissions @> '["SECRETARIA"]'::jsonb
        OR permissions @> '["COMUNICACAO"]'::jsonb
      )
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
);

-- 3. Políticas para midia_videos
DROP POLICY IF EXISTS "midia_videos_select" ON public.midia_videos;
DROP POLICY IF EXISTS "midia_videos_insert" ON public.midia_videos;
DROP POLICY IF EXISTS "midia_videos_update" ON public.midia_videos;
DROP POLICY IF EXISTS "midia_videos_delete" ON public.midia_videos;

CREATE POLICY "midia_videos_select" ON public.midia_videos FOR SELECT USING (
  -- Staff administrativo
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
  OR
  -- Membro autenticado
  (
    ativo = true
    AND (
      (
        congregacao_id IS NULL
        AND ministry_id IN (
          SELECT ministry_id FROM public.members WHERE auth_user_id = auth.uid()
        )
      )
      OR
      (
        congregacao_id IS NOT NULL
        AND congregacao_id IN (
          SELECT congregacao_id FROM public.members WHERE auth_user_id = auth.uid()
        )
        AND ministry_id IN (
          SELECT ministry_id FROM public.members WHERE auth_user_id = auth.uid()
        )
      )
    )
  )
);

CREATE POLICY "midia_videos_insert" ON public.midia_videos FOR INSERT WITH CHECK (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users
    WHERE user_id = auth.uid()
      AND (
        role IN ('admin', 'manager', 'presidencia')
        OR permissions @> '["ADMINISTRADOR"]'::jsonb
        OR permissions @> '["GESTAO"]'::jsonb
        OR permissions @> '["SECRETARIA"]'::jsonb
        OR permissions @> '["COMUNICACAO"]'::jsonb
      )
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
);

CREATE POLICY "midia_videos_update" ON public.midia_videos FOR UPDATE USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users
    WHERE user_id = auth.uid()
      AND (
        role IN ('admin', 'manager', 'presidencia')
        OR permissions @> '["ADMINISTRADOR"]'::jsonb
        OR permissions @> '["GESTAO"]'::jsonb
        OR permissions @> '["SECRETARIA"]'::jsonb
        OR permissions @> '["COMUNICACAO"]'::jsonb
      )
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
);

CREATE POLICY "midia_videos_delete" ON public.midia_videos FOR DELETE USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users
    WHERE user_id = auth.uid()
      AND (
        role IN ('admin', 'manager', 'presidencia')
        OR permissions @> '["ADMINISTRADOR"]'::jsonb
        OR permissions @> '["GESTAO"]'::jsonb
        OR permissions @> '["SECRETARIA"]'::jsonb
        OR permissions @> '["COMUNICACAO"]'::jsonb
      )
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
);

-- 4. Políticas para midia_configuracoes
DROP POLICY IF EXISTS "midia_configuracoes_select" ON public.midia_configuracoes;
DROP POLICY IF EXISTS "midia_configuracoes_insert" ON public.midia_configuracoes;
DROP POLICY IF EXISTS "midia_configuracoes_update" ON public.midia_configuracoes;
DROP POLICY IF EXISTS "midia_configuracoes_delete" ON public.midia_configuracoes;

CREATE POLICY "midia_configuracoes_select" ON public.midia_configuracoes FOR SELECT USING (
  -- Staff administrativo ou membro do ministério
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
    UNION
    SELECT ministry_id FROM public.members WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "midia_configuracoes_insert" ON public.midia_configuracoes FOR INSERT WITH CHECK (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users
    WHERE user_id = auth.uid()
      AND (
        role IN ('admin', 'manager', 'presidencia')
        OR permissions @> '["ADMINISTRADOR"]'::jsonb
        OR permissions @> '["GESTAO"]'::jsonb
      )
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
);

CREATE POLICY "midia_configuracoes_update" ON public.midia_configuracoes FOR UPDATE USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users
    WHERE user_id = auth.uid()
      AND (
        role IN ('admin', 'manager', 'presidencia')
        OR permissions @> '["ADMINISTRADOR"]'::jsonb
        OR permissions @> '["GESTAO"]'::jsonb
      )
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
);

CREATE POLICY "midia_configuracoes_delete" ON public.midia_configuracoes FOR DELETE USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users
    WHERE user_id = auth.uid()
      AND (
        role IN ('admin', 'manager', 'presidencia')
        OR permissions @> '["ADMINISTRADOR"]'::jsonb
        OR permissions @> '["GESTAO"]'::jsonb
      )
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
);

COMMIT;
