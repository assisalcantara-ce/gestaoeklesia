-- =============================================================================
-- Módulo Eventos MVP — Inscrições
-- Tabela de inscrições com check-in embutido (presente + checkin_em + checkin_por).
-- Elimina a necessidade de tabela separada eventos_checkin.
-- =============================================================================

BEGIN;

-- ─── Tabela eventos_inscricoes ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.eventos_inscricoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id      UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  ministry_id    UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  -- ministry_id denormalizado para simplificar RLS sem JOIN

  -- Participante: membro cadastrado OU externo (nome/email)
  member_id      UUID REFERENCES public.members(id) ON DELETE SET NULL,
  nome_externo   VARCHAR(255),     -- para participantes não cadastrados como membros
  email_externo  VARCHAR(255),
  telefone       VARCHAR(30),

  status         VARCHAR(20) NOT NULL DEFAULT 'confirmado',
  -- 'confirmado' | 'cancelado' | 'lista_espera'

  observacoes    TEXT,

  -- ── Check-in embutido (sem tabela separada) ─────────────────────────────────
  presente       BOOLEAN NOT NULL DEFAULT FALSE,
  checkin_em     TIMESTAMPTZ,
  checkin_por    UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  criado_por     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Garante unicidade: mesmo membro não pode se inscrever duas vezes no mesmo evento
  UNIQUE (evento_id, member_id),

  CONSTRAINT inscricao_status_valido CHECK (
    status IN ('confirmado', 'cancelado', 'lista_espera')
  ),
  -- Ao menos um dos dois campos deve ser informado
  CONSTRAINT inscricao_participante_valido CHECK (
    member_id IS NOT NULL OR nome_externo IS NOT NULL
  )
);

-- ─── Índices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inscricoes_evento    ON public.eventos_inscricoes(evento_id);
CREATE INDEX IF NOT EXISTS idx_inscricoes_ministry  ON public.eventos_inscricoes(ministry_id);
CREATE INDEX IF NOT EXISTS idx_inscricoes_member    ON public.eventos_inscricoes(member_id);

-- Índice para consultas de check-in do dia (presente = true)
CREATE INDEX IF NOT EXISTS idx_inscricoes_presente
  ON public.eventos_inscricoes(evento_id, presente)
  WHERE presente = TRUE;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.eventos_inscricoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inscricoes_select ON public.eventos_inscricoes;
DROP POLICY IF EXISTS inscricoes_insert ON public.eventos_inscricoes;
DROP POLICY IF EXISTS inscricoes_update ON public.eventos_inscricoes;
DROP POLICY IF EXISTS inscricoes_delete ON public.eventos_inscricoes;

-- SELECT: qualquer usuário autenticado do ministério pode ver inscrições
CREATE POLICY "inscricoes_select"
  ON public.eventos_inscricoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = eventos_inscricoes.ministry_id
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = eventos_inscricoes.ministry_id AND m.user_id = auth.uid()
    )
  );

-- INSERT: ADMINISTRADOR, SECRETARIO
CREATE POLICY "inscricoes_insert"
  ON public.eventos_inscricoes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = eventos_inscricoes.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["SECRETARIO"]'::jsonb
          OR mu.role = 'admin'
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = eventos_inscricoes.ministry_id AND m.user_id = auth.uid()
    )
  );

-- UPDATE: ADMINISTRADOR, SECRETARIO (inclui check-in: toggle presente)
CREATE POLICY "inscricoes_update"
  ON public.eventos_inscricoes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = eventos_inscricoes.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["SECRETARIO"]'::jsonb
          OR mu.role = 'admin'
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = eventos_inscricoes.ministry_id AND m.user_id = auth.uid()
    )
  );

-- DELETE: ADMINISTRADOR ou SECRETARIO
CREATE POLICY "inscricoes_delete"
  ON public.eventos_inscricoes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = eventos_inscricoes.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["SECRETARIO"]'::jsonb
          OR mu.role = 'admin'
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = eventos_inscricoes.ministry_id AND m.user_id = auth.uid()
    )
  );

COMMIT;
