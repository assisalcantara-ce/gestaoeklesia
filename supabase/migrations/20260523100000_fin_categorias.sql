-- =============================================================================
-- Fase 1 — Fundação Financeira: Plano de Contas / Categorias
-- =============================================================================
-- fin_categorias: categorias financeiras configuráveis por ministério
-- ministry_id NULL = categoria padrão do sistema (is_sistema = TRUE)
-- ministry_id NOT NULL = categoria customizada do ministério
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.fin_categorias (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id      UUID REFERENCES public.ministries(id) ON DELETE CASCADE,
  nome             VARCHAR(100) NOT NULL,
  tipo_movimento   VARCHAR(10)  NOT NULL DEFAULT 'entrada',
  codigo           VARCHAR(20),
  categoria_pai_id UUID REFERENCES public.fin_categorias(id) ON DELETE SET NULL,
  cor              VARCHAR(7),
  icone            VARCHAR(50),
  is_sistema       BOOLEAN NOT NULL DEFAULT false,
  is_ativa         BOOLEAN NOT NULL DEFAULT true,
  modulo_origem    VARCHAR(30),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fin_cat_tipo_check   CHECK (tipo_movimento IN ('entrada','saida','ambos')),
  CONSTRAINT fin_cat_modulo_check CHECK (
    modulo_origem IS NULL OR
    modulo_origem IN ('tesouraria','ebd','missoes','eventos','dizimo','gateway','loja','curso')
  )
);

CREATE INDEX IF NOT EXISTS idx_fin_cat_ministry ON public.fin_categorias(ministry_id);
CREATE INDEX IF NOT EXISTS idx_fin_cat_tipo     ON public.fin_categorias(tipo_movimento);
CREATE INDEX IF NOT EXISTS idx_fin_cat_pai      ON public.fin_categorias(categoria_pai_id);

-- UNIQUE parcial para garantir idempotência do seed de categorias do sistema.
-- ministry_id IS NULL = categoria do sistema; codigo deve ser único nesse escopo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_cat_sistema_codigo
  ON public.fin_categorias(codigo)
  WHERE ministry_id IS NULL;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.fin_categorias ENABLE ROW LEVEL SECURITY;

-- SELECT: categorias do sistema (ministry_id IS NULL) ou do ministério do usuário
DROP POLICY IF EXISTS fin_categorias_select ON public.fin_categorias;
CREATE POLICY "fin_categorias_select" ON public.fin_categorias FOR SELECT USING (
  ministry_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid() AND mu.ministry_id = fin_categorias.ministry_id
  )
  OR EXISTS (
    SELECT 1 FROM public.ministries m
    WHERE m.id = fin_categorias.ministry_id AND m.user_id = auth.uid()
  )
);

-- INSERT: ADMINISTRADOR ou FINANCEIRO, nunca is_sistema=true
DROP POLICY IF EXISTS fin_categorias_insert ON public.fin_categorias;
CREATE POLICY "fin_categorias_insert" ON public.fin_categorias FOR INSERT WITH CHECK (
  NOT is_sistema
  AND ministry_id IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid() AND mu.ministry_id = fin_categorias.ministry_id
        AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["FINANCEIRO"]'::jsonb)
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = fin_categorias.ministry_id AND m.user_id = auth.uid()
    )
  )
);

-- UPDATE: ADMINISTRADOR ou FINANCEIRO, nunca alterar categorias do sistema
DROP POLICY IF EXISTS fin_categorias_update ON public.fin_categorias;
CREATE POLICY "fin_categorias_update" ON public.fin_categorias FOR UPDATE USING (
  NOT is_sistema
  AND ministry_id IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid() AND mu.ministry_id = fin_categorias.ministry_id
        AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["FINANCEIRO"]'::jsonb)
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = fin_categorias.ministry_id AND m.user_id = auth.uid()
    )
  )
);

-- DELETE: apenas ADMINISTRADOR
DROP POLICY IF EXISTS fin_categorias_delete ON public.fin_categorias;
CREATE POLICY "fin_categorias_delete" ON public.fin_categorias FOR DELETE USING (
  NOT is_sistema
  AND ministry_id IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid() AND mu.ministry_id = fin_categorias.ministry_id
        AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = fin_categorias.ministry_id AND m.user_id = auth.uid()
    )
  )
);

-- ─── Seed: categorias padrão do sistema ──────────────────────────────────────
-- ministry_id = NULL, is_sistema = TRUE — não podem ser editadas nem excluídas
-- por nenhum ministério

INSERT INTO public.fin_categorias
  (ministry_id, nome, tipo_movimento, codigo, cor, icone, is_sistema, is_ativa)
VALUES
  -- Entradas
  (NULL, 'Dízimo',                 'entrada', '1.1',  '#22c55e', '💚', true, true),
  (NULL, 'Oferta Geral',           'entrada', '1.2',  '#3b82f6', '🙏', true, true),
  (NULL, 'Oferta de Missões',      'entrada', '1.3',  '#8b5cf6', '🌍', true, true),
  (NULL, 'Oferta EBD',             'entrada', '1.4',  '#f59e0b', '📖', true, true),
  (NULL, 'Evento',                 'entrada', '1.5',  '#06b6d4', '🎉', true, true),
  (NULL, 'Campanha',               'entrada', '1.6',  '#f97316', '📣', true, true),
  (NULL, 'Doação',                 'entrada', '1.7',  '#ec4899', '❤️', true, true),
  (NULL, 'Contribuição',           'entrada', '1.8',  '#14b8a6', '🤝', true, true),
  (NULL, 'Outros (Entrada)',       'entrada', '1.9',  '#6b7280', '➕', true, true),
  -- Saídas
  (NULL, 'Aluguel',                'saida',   '2.1',  '#ef4444', '🏠', true, true),
  (NULL, 'Água / Luz / Internet',  'saida',   '2.2',  '#f97316', '💡', true, true),
  (NULL, 'Material',               'saida',   '2.3',  '#eab308', '📦', true, true),
  (NULL, 'Pessoal / Salários',     'saida',   '2.4',  '#dc2626', '👥', true, true),
  (NULL, 'Manutenção',             'saida',   '2.5',  '#78716c', '🔧', true, true),
  (NULL, 'Missões (repasse)',      'saida',   '2.6',  '#7c3aed', '🌍', true, true),
  (NULL, 'Eventos (despesa)',      'saida',   '2.7',  '#0891b2', '🎪', true, true),
  (NULL, 'Cursos',                 'saida',   '2.8',  '#0d9488', '📚', true, true),
  (NULL, 'Dízimo enviado ao campo','saida',   '2.9',  '#16a34a', '⛪', true, true),
  (NULL, 'Outros (Saída)',         'saida',   '2.10', '#6b7280', '➖', true, true)
ON CONFLICT (codigo) WHERE ministry_id IS NULL DO NOTHING;

COMMIT;
