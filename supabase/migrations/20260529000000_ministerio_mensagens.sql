-- ============================================================
-- Dashboard 2.0 — Mensagem da Presidência
-- Tabela para mensagens/vídeos institucionais publicados
-- no painel por presidência ou administrador.
-- ============================================================

CREATE TABLE IF NOT EXISTS ministerio_mensagens (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  ministry_id    uuid        NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  titulo         text        NOT NULL,
  conteudo_texto text,
  video_url      text,
  video_tipo     text        CHECK (video_tipo IN ('youtube', 'upload', 'texto')) DEFAULT 'texto',
  roles_visiveis text[]      DEFAULT '{}',    -- vazio = visível para todos os perfis autorizados
  ativo          boolean     DEFAULT true,
  data_inicio    date        NOT NULL DEFAULT CURRENT_DATE,
  data_fim       date        NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  ordem          integer     DEFAULT 0,
  criado_por     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- Índice para buscas frequentes
CREATE INDEX IF NOT EXISTS idx_ministerio_mensagens_ministry
  ON ministerio_mensagens (ministry_id, ativo, data_inicio, data_fim);

-- RLS
ALTER TABLE ministerio_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mensagens_select" ON public.ministerio_mensagens;
DROP POLICY IF EXISTS "mensagens_insert" ON public.ministerio_mensagens;
DROP POLICY IF EXISTS "mensagens_update" ON public.ministerio_mensagens;
DROP POLICY IF EXISTS "mensagens_delete" ON public.ministerio_mensagens;

-- Leitura: usuário pertence ao mesmo ministério
-- e a data atual está dentro do período de exibição
CREATE POLICY "mensagens_select"
  ON ministerio_mensagens FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM ministry_users WHERE user_id = auth.uid()
    )
    AND ativo = true
    AND CURRENT_DATE BETWEEN data_inicio AND data_fim
  );

-- Escrita: apenas administrador ou presidência
CREATE POLICY "mensagens_insert"
  ON ministerio_mensagens FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM ministry_users
      WHERE user_id = auth.uid()
        AND role IN ('administrador', 'presidencia')
    )
  );

CREATE POLICY "mensagens_update"
  ON ministerio_mensagens FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM ministry_users
      WHERE user_id = auth.uid()
        AND role IN ('administrador', 'presidencia')
    )
  );

CREATE POLICY "mensagens_delete"
  ON ministerio_mensagens FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM ministry_users
      WHERE user_id = auth.uid()
        AND role IN ('administrador', 'presidencia')
    )
  );
