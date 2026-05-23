-- =============================================================================
-- Módulo Eventos MVP
-- Tabela principal de eventos com suporte a multi-tenant, congregações,
-- inscrições opcionais e integração futura com ASAAS (valor_inscricao).
-- =============================================================================

BEGIN;

-- ─── Tabela eventos ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.eventos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id      UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id   UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  -- NULL = evento da sede / geral

  titulo           VARCHAR(255) NOT NULL,
  descricao        TEXT,

  tipo             VARCHAR(50) NOT NULL DEFAULT 'culto_especial',
  -- 'culto_especial' | 'conferencia' | 'retiro' | 'evangelismo' | 'treinamento' | 'social' | 'outro'

  data_inicio      TIMESTAMPTZ NOT NULL,
  data_fim         TIMESTAMPTZ,

  local_nome       VARCHAR(255),
  local_endereco   TEXT,

  capacidade       INTEGER,                        -- NULL = sem limite de vagas
  is_publico       BOOLEAN NOT NULL DEFAULT TRUE,
  aceita_inscricao BOOLEAN NOT NULL DEFAULT FALSE,
  valor_inscricao  NUMERIC(12,2) NOT NULL DEFAULT 0,  -- R$ 0 = gratuito

  status           VARCHAR(20) NOT NULL DEFAULT 'programado',
  -- 'programado' | 'em_andamento' | 'realizado' | 'cancelado'

  criado_por       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT eventos_tipo_valido CHECK (
    tipo IN ('culto_especial','conferencia','retiro','evangelismo','treinamento','social','outro')
  ),
  CONSTRAINT eventos_status_valido CHECK (
    status IN ('programado','em_andamento','realizado','cancelado')
  ),
  CONSTRAINT eventos_valor_positivo CHECK (valor_inscricao >= 0)
);

-- ─── Índices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_eventos_ministry      ON public.eventos(ministry_id);
CREATE INDEX IF NOT EXISTS idx_eventos_congregacao   ON public.eventos(congregacao_id);
CREATE INDEX IF NOT EXISTS idx_eventos_status        ON public.eventos(status);

-- Índice composto principal: cobre consulta por mês/período
CREATE INDEX IF NOT EXISTS idx_eventos_ministry_data
  ON public.eventos(ministry_id, data_inicio DESC);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eventos_select ON public.eventos;
DROP POLICY IF EXISTS eventos_insert ON public.eventos;
DROP POLICY IF EXISTS eventos_update ON public.eventos;
DROP POLICY IF EXISTS eventos_delete ON public.eventos;

-- SELECT: qualquer usuário autenticado do ministério pode ver eventos
CREATE POLICY "eventos_select"
  ON public.eventos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = eventos.ministry_id
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = eventos.ministry_id AND m.user_id = auth.uid()
    )
  );

-- INSERT: ADMINISTRADOR ou SECRETARIO
CREATE POLICY "eventos_insert"
  ON public.eventos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = eventos.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["SECRETARIO"]'::jsonb
          OR mu.role = 'admin'
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = eventos.ministry_id AND m.user_id = auth.uid()
    )
  );

-- UPDATE: ADMINISTRADOR ou SECRETARIO
CREATE POLICY "eventos_update"
  ON public.eventos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = eventos.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["SECRETARIO"]'::jsonb
          OR mu.role = 'admin'
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = eventos.ministry_id AND m.user_id = auth.uid()
    )
  );

-- DELETE: apenas ADMINISTRADOR
CREATE POLICY "eventos_delete"
  ON public.eventos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = eventos.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.role = 'admin'
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = eventos.ministry_id AND m.user_id = auth.uid()
    )
  );

COMMIT;
