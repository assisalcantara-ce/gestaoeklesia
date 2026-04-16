-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo EBD (Escola Bíblica Dominical)
-- Estrutura escalável: multi-tenant (ministry_id) + multi-church (church_id)
-- ═══════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ─── Helper macro de permissão EBD ────────────────────────────────────────────
-- Usada em todas as políticas RLS do módulo
-- Acesso: ADMINISTRADOR ou usuário com permissão EBD, ou owner do ministério

-- ─── 1. ebd_classes ──────────────────────────────────────────────────────────
-- Faixas etárias (padrão ou personalizadas por ministério)
CREATE TABLE IF NOT EXISTS public.ebd_classes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id      UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  nome             TEXT NOT NULL,
  faixa_etaria_min SMALLINT,
  faixa_etaria_max SMALLINT,
  descricao        TEXT,
  cor              TEXT DEFAULT '#3b82f6',
  ordem            SMALLINT DEFAULT 0,
  padrao           BOOLEAN DEFAULT false,
  ativo            BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (ministry_id, nome)
);
CREATE INDEX IF NOT EXISTS idx_ebd_classes_ministry ON public.ebd_classes(ministry_id);
CREATE INDEX IF NOT EXISTS idx_ebd_classes_ativo    ON public.ebd_classes(ministry_id, ativo);

-- ─── 2. ebd_professores ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ebd_professores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  church_id   UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  member_id   UUID REFERENCES public.members(id) ON DELETE SET NULL,
  nome        TEXT NOT NULL,
  telefone    TEXT,
  email       TEXT,
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ebd_professores_ministry ON public.ebd_professores(ministry_id, church_id);
CREATE INDEX IF NOT EXISTS idx_ebd_professores_member   ON public.ebd_professores(member_id);

-- ─── 3. ebd_turmas ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ebd_turmas (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id          UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  church_id            UUID NOT NULL REFERENCES public.congregacoes(id) ON DELETE CASCADE,
  classe_id            UUID REFERENCES public.ebd_classes(id) ON DELETE SET NULL,
  nome                 TEXT NOT NULL,
  professor_titular_id UUID REFERENCES public.ebd_professores(id) ON DELETE SET NULL,
  sala                 TEXT,
  capacidade_max       SMALLINT,
  ativo                BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ebd_turmas_ministry ON public.ebd_turmas(ministry_id, church_id);
CREATE INDEX IF NOT EXISTS idx_ebd_turmas_church   ON public.ebd_turmas(church_id, ativo);
CREATE INDEX IF NOT EXISTS idx_ebd_turmas_classe   ON public.ebd_turmas(classe_id);

-- ─── 4. ebd_turma_professores (junction N:N) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ebd_turma_professores (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id  UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  turma_id     UUID NOT NULL REFERENCES public.ebd_turmas(id) ON DELETE CASCADE,
  professor_id UUID NOT NULL REFERENCES public.ebd_professores(id) ON DELETE CASCADE,
  funcao       TEXT NOT NULL DEFAULT 'auxiliar',
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (turma_id, professor_id),
  CONSTRAINT ebd_turma_prof_funcao CHECK (funcao IN ('titular','auxiliar','substituto'))
);
CREATE INDEX IF NOT EXISTS idx_ebd_turma_prof_turma ON public.ebd_turma_professores(turma_id);
CREATE INDEX IF NOT EXISTS idx_ebd_turma_prof_prof  ON public.ebd_turma_professores(professor_id);

-- ─── 5. ebd_alunos ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ebd_alunos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id          UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  church_id            UUID NOT NULL REFERENCES public.congregacoes(id) ON DELETE CASCADE,
  member_id            UUID REFERENCES public.members(id) ON DELETE SET NULL,
  nome                 TEXT NOT NULL,
  data_nascimento      DATE,
  sexo                 CHAR(1),
  responsavel_nome     TEXT,
  responsavel_telefone TEXT,
  ativo                BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT ebd_aluno_sexo CHECK (sexo IN ('M','F'))
);
CREATE INDEX IF NOT EXISTS idx_ebd_alunos_ministry    ON public.ebd_alunos(ministry_id, church_id);
CREATE INDEX IF NOT EXISTS idx_ebd_alunos_member      ON public.ebd_alunos(member_id);
CREATE INDEX IF NOT EXISTS idx_ebd_alunos_church_ativo ON public.ebd_alunos(church_id, ativo);

-- ─── 6. ebd_matriculas ───────────────────────────────────────────────────────
-- Histórico de matrículas; apenas 1 ativa por aluno (data_fim IS NULL)
CREATE TABLE IF NOT EXISTS public.ebd_matriculas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id  UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  aluno_id     UUID NOT NULL REFERENCES public.ebd_alunos(id) ON DELETE CASCADE,
  turma_id     UUID NOT NULL REFERENCES public.ebd_turmas(id) ON DELETE CASCADE,
  data_inicio  DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim     DATE,
  motivo_saida TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ebd_matriculas_aluno ON public.ebd_matriculas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_ebd_matriculas_turma ON public.ebd_matriculas(turma_id);
-- Garante no máximo 1 matrícula ativa por aluno
CREATE UNIQUE INDEX IF NOT EXISTS idx_ebd_matriculas_ativa_unica
  ON public.ebd_matriculas(aluno_id) WHERE data_fim IS NULL;

-- ─── 7. ebd_aulas ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ebd_aulas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id      UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  turma_id         UUID NOT NULL REFERENCES public.ebd_turmas(id) ON DELETE CASCADE,
  data_aula        DATE NOT NULL,
  trimestre        SMALLINT,
  ano              SMALLINT NOT NULL,
  licao_numero     SMALLINT,
  tema             TEXT,
  professor_id     UUID REFERENCES public.ebd_professores(id) ON DELETE SET NULL,
  total_presentes  SMALLINT DEFAULT 0,
  total_visitantes SMALLINT DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'planejada',
  observacoes      TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (turma_id, data_aula),
  CONSTRAINT ebd_aula_trimestre CHECK (trimestre IS NULL OR trimestre BETWEEN 1 AND 4),
  CONSTRAINT ebd_aula_status    CHECK (status IN ('planejada','realizada','cancelada'))
);
CREATE INDEX IF NOT EXISTS idx_ebd_aulas_turma   ON public.ebd_aulas(turma_id, data_aula DESC);
CREATE INDEX IF NOT EXISTS idx_ebd_aulas_ministry ON public.ebd_aulas(ministry_id, ano, trimestre);
CREATE INDEX IF NOT EXISTS idx_ebd_aulas_status  ON public.ebd_aulas(status);

-- ─── 8. ebd_frequencias ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ebd_frequencias (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  aula_id     UUID NOT NULL REFERENCES public.ebd_aulas(id) ON DELETE CASCADE,
  aluno_id    UUID NOT NULL REFERENCES public.ebd_alunos(id) ON DELETE CASCADE,
  presente    BOOLEAN DEFAULT false,
  observacoes TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (aula_id, aluno_id)
);
CREATE INDEX IF NOT EXISTS idx_ebd_freq_aula         ON public.ebd_frequencias(aula_id);
CREATE INDEX IF NOT EXISTS idx_ebd_freq_aluno        ON public.ebd_frequencias(aluno_id);
CREATE INDEX IF NOT EXISTS idx_ebd_freq_aula_presente ON public.ebd_frequencias(aula_id, presente);

-- ─── 9. ebd_visitantes_aula ──────────────────────────────────────────────────
-- Separado de ebd_frequencias: visitante não tem aluno_id → preserva UNIQUE
CREATE TABLE IF NOT EXISTS public.ebd_visitantes_aula (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  aula_id     UUID NOT NULL REFERENCES public.ebd_aulas(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  telefone    TEXT,
  member_id   UUID REFERENCES public.members(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ebd_visitantes_aula ON public.ebd_visitantes_aula(aula_id);

-- ─── 10. ebd_revistas ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ebd_revistas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id    UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  classe_id      UUID REFERENCES public.ebd_classes(id) ON DELETE SET NULL,
  titulo         TEXT NOT NULL,
  editora        TEXT,
  trimestre      SMALLINT,
  ano            SMALLINT NOT NULL,
  preco_unitario NUMERIC(10,2),
  capa_url       TEXT,
  ativo          BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT ebd_revista_trimestre CHECK (trimestre IS NULL OR trimestre BETWEEN 1 AND 4)
);
CREATE INDEX IF NOT EXISTS idx_ebd_revistas_ministry ON public.ebd_revistas(ministry_id, ano, trimestre);
CREATE INDEX IF NOT EXISTS idx_ebd_revistas_classe   ON public.ebd_revistas(classe_id);

-- ─── 11. ebd_pedidos_revistas ────────────────────────────────────────────────
-- tipo = 'local' (por igreja) | 'consolidado' (ministerial, agrega igrejas)
CREATE TABLE IF NOT EXISTS public.ebd_pedidos_revistas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id           UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  church_id             UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  tipo                  TEXT NOT NULL DEFAULT 'local',
  trimestre             SMALLINT,
  ano                   SMALLINT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'rascunho',
  data_pedido           DATE,
  data_entrega_prevista DATE,
  data_entrega_real     DATE,
  valor_total           NUMERIC(10,2) DEFAULT 0,
  observacoes           TEXT,
  criado_por            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT ebd_pedido_tipo      CHECK (tipo IN ('local','consolidado')),
  CONSTRAINT ebd_pedido_status    CHECK (status IN ('rascunho','enviado','confirmado','recebido','cancelado')),
  CONSTRAINT ebd_pedido_trimestre CHECK (trimestre IS NULL OR trimestre BETWEEN 1 AND 4)
);
CREATE INDEX IF NOT EXISTS idx_ebd_pedidos_ministry ON public.ebd_pedidos_revistas(ministry_id, ano, trimestre);
CREATE INDEX IF NOT EXISTS idx_ebd_pedidos_church   ON public.ebd_pedidos_revistas(church_id, status);
CREATE INDEX IF NOT EXISTS idx_ebd_pedidos_status   ON public.ebd_pedidos_revistas(status);

-- ─── 12. ebd_pedidos_itens ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ebd_pedidos_itens (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id           UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  pedido_id             UUID NOT NULL REFERENCES public.ebd_pedidos_revistas(id) ON DELETE CASCADE,
  revista_id            UUID NOT NULL REFERENCES public.ebd_revistas(id),
  quantidade_solicitada SMALLINT NOT NULL CHECK (quantidade_solicitada > 0),
  quantidade_recebida   SMALLINT DEFAULT 0,
  preco_unitario        NUMERIC(10,2),  -- snapshot do preço na data do pedido
  created_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (pedido_id, revista_id)
);
CREATE INDEX IF NOT EXISTS idx_ebd_itens_pedido  ON public.ebd_pedidos_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_ebd_itens_revista ON public.ebd_pedidos_itens(revista_id);

-- ─── 13. ebd_ofertas ─────────────────────────────────────────────────────────
-- Rastreável: lancamento_tesouraria_id é preenchido na integração contábil
CREATE TABLE IF NOT EXISTS public.ebd_ofertas (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id              UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  church_id                UUID NOT NULL REFERENCES public.congregacoes(id) ON DELETE CASCADE,
  aula_id                  UUID REFERENCES public.ebd_aulas(id) ON DELETE SET NULL,
  data_oferta              DATE NOT NULL,
  trimestre                SMALLINT,
  ano                      SMALLINT NOT NULL,
  valor                    NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  forma_pagamento          TEXT DEFAULT 'dinheiro',
  destino                  TEXT NOT NULL DEFAULT 'tesouraria_local',
  lancamento_tesouraria_id UUID REFERENCES public.tesouraria_lancamentos(id) ON DELETE SET NULL,
  observacoes              TEXT,
  criado_por               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT ebd_oferta_forma      CHECK (forma_pagamento IN ('dinheiro','pix','cartao','transferencia','cheque')),
  CONSTRAINT ebd_oferta_destino    CHECK (destino IN ('tesouraria_local','tesouraria_geral','missoes')),
  CONSTRAINT ebd_oferta_trimestre  CHECK (trimestre IS NULL OR trimestre BETWEEN 1 AND 4)
);
CREATE INDEX IF NOT EXISTS idx_ebd_ofertas_ministry   ON public.ebd_ofertas(ministry_id, church_id, data_oferta DESC);
CREATE INDEX IF NOT EXISTS idx_ebd_ofertas_aula       ON public.ebd_ofertas(aula_id);
CREATE INDEX IF NOT EXISTS idx_ebd_ofertas_church     ON public.ebd_ofertas(church_id, ano, trimestre);
CREATE INDEX IF NOT EXISTS idx_ebd_ofertas_tesouraria ON public.ebd_ofertas(lancamento_tesouraria_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNÇÃO: Seed de classes padrão por ministério (chamável via UI)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ebd_seed_classes_padrao(p_ministry_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.ebd_classes (ministry_id, nome, faixa_etaria_min, faixa_etaria_max, cor, ordem, padrao)
  VALUES
    (p_ministry_id, 'Berçário',      0,   3, '#ec4899', 1, true),
    (p_ministry_id, 'Maternal',      4,   5, '#f97316', 2, true),
    (p_ministry_id, 'Primários',     6,   8, '#eab308', 3, true),
    (p_ministry_id, 'Juniores',      9,  11, '#22c55e', 4, true),
    (p_ministry_id, 'Adolescentes', 12,  17, '#3b82f6', 5, true),
    (p_ministry_id, 'Jovens',       18,  25, '#8b5cf6', 6, true),
    (p_ministry_id, 'Adultos',      26,  59, '#123b63', 7, true),
    (p_ministry_id, 'Melhor Idade', 60, NULL,'#6b7280', 8, true)
  ON CONFLICT (ministry_id, nome) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ebd_seed_classes_padrao TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS — Row Level Security
-- Padrão: admin/EBD do ministério + owner direto
-- ═══════════════════════════════════════════════════════════════════════════════

-- Helper inline usado em todas as políticas:
-- EXISTS (SELECT 1 FROM ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = X
--           AND (mu.permissions @> '["ADMINISTRADOR"]' OR mu.permissions @> '["EBD"]'))
-- OR EXISTS (SELECT 1 FROM ministries m WHERE m.id = X AND m.user_id = auth.uid())

-- ── ebd_classes ───────────────────────────────────────────────────────────────
ALTER TABLE public.ebd_classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ebd_classes_select ON public.ebd_classes;
DROP POLICY IF EXISTS ebd_classes_insert ON public.ebd_classes;
DROP POLICY IF EXISTS ebd_classes_update ON public.ebd_classes;
DROP POLICY IF EXISTS ebd_classes_delete ON public.ebd_classes;

CREATE POLICY "ebd_classes_select" ON public.ebd_classes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_classes.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_classes.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_classes_insert" ON public.ebd_classes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_classes.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_classes.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_classes_update" ON public.ebd_classes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_classes.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_classes.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_classes_delete" ON public.ebd_classes FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_classes.ministry_id
    AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb)
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_classes.ministry_id AND m.user_id = auth.uid())
);

-- ── ebd_professores ───────────────────────────────────────────────────────────
ALTER TABLE public.ebd_professores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ebd_professores_select ON public.ebd_professores;
DROP POLICY IF EXISTS ebd_professores_insert ON public.ebd_professores;
DROP POLICY IF EXISTS ebd_professores_update ON public.ebd_professores;
DROP POLICY IF EXISTS ebd_professores_delete ON public.ebd_professores;

CREATE POLICY "ebd_professores_select" ON public.ebd_professores FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_professores.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_professores.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_professores_insert" ON public.ebd_professores FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_professores.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_professores.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_professores_update" ON public.ebd_professores FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_professores.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_professores.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_professores_delete" ON public.ebd_professores FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_professores.ministry_id
    AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb)
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_professores.ministry_id AND m.user_id = auth.uid())
);

-- ── ebd_turmas ────────────────────────────────────────────────────────────────
ALTER TABLE public.ebd_turmas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ebd_turmas_select ON public.ebd_turmas;
DROP POLICY IF EXISTS ebd_turmas_insert ON public.ebd_turmas;
DROP POLICY IF EXISTS ebd_turmas_update ON public.ebd_turmas;
DROP POLICY IF EXISTS ebd_turmas_delete ON public.ebd_turmas;

CREATE POLICY "ebd_turmas_select" ON public.ebd_turmas FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_turmas.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_turmas.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_turmas_insert" ON public.ebd_turmas FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_turmas.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_turmas.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_turmas_update" ON public.ebd_turmas FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_turmas.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_turmas.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_turmas_delete" ON public.ebd_turmas FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_turmas.ministry_id
    AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb)
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_turmas.ministry_id AND m.user_id = auth.uid())
);

-- ── ebd_turma_professores ─────────────────────────────────────────────────────
ALTER TABLE public.ebd_turma_professores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ebd_tp_select ON public.ebd_turma_professores;
DROP POLICY IF EXISTS ebd_tp_insert ON public.ebd_turma_professores;
DROP POLICY IF EXISTS ebd_tp_delete ON public.ebd_turma_professores;

CREATE POLICY "ebd_tp_select" ON public.ebd_turma_professores FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_turma_professores.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_turma_professores.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_tp_insert" ON public.ebd_turma_professores FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_turma_professores.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_turma_professores.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_tp_delete" ON public.ebd_turma_professores FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_turma_professores.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_turma_professores.ministry_id AND m.user_id = auth.uid())
);

-- ── ebd_alunos ────────────────────────────────────────────────────────────────
ALTER TABLE public.ebd_alunos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ebd_alunos_select ON public.ebd_alunos;
DROP POLICY IF EXISTS ebd_alunos_insert ON public.ebd_alunos;
DROP POLICY IF EXISTS ebd_alunos_update ON public.ebd_alunos;
DROP POLICY IF EXISTS ebd_alunos_delete ON public.ebd_alunos;

CREATE POLICY "ebd_alunos_select" ON public.ebd_alunos FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_alunos.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_alunos.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_alunos_insert" ON public.ebd_alunos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_alunos.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_alunos.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_alunos_update" ON public.ebd_alunos FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_alunos.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_alunos.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_alunos_delete" ON public.ebd_alunos FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_alunos.ministry_id
    AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb)
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_alunos.ministry_id AND m.user_id = auth.uid())
);

-- ── ebd_matriculas ────────────────────────────────────────────────────────────
ALTER TABLE public.ebd_matriculas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ebd_matriculas_select ON public.ebd_matriculas;
DROP POLICY IF EXISTS ebd_matriculas_insert ON public.ebd_matriculas;
DROP POLICY IF EXISTS ebd_matriculas_update ON public.ebd_matriculas;

CREATE POLICY "ebd_matriculas_select" ON public.ebd_matriculas FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_matriculas.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_matriculas.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_matriculas_insert" ON public.ebd_matriculas FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_matriculas.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_matriculas.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_matriculas_update" ON public.ebd_matriculas FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_matriculas.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_matriculas.ministry_id AND m.user_id = auth.uid())
);

-- ── ebd_aulas ─────────────────────────────────────────────────────────────────
ALTER TABLE public.ebd_aulas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ebd_aulas_select ON public.ebd_aulas;
DROP POLICY IF EXISTS ebd_aulas_insert ON public.ebd_aulas;
DROP POLICY IF EXISTS ebd_aulas_update ON public.ebd_aulas;
DROP POLICY IF EXISTS ebd_aulas_delete ON public.ebd_aulas;

CREATE POLICY "ebd_aulas_select" ON public.ebd_aulas FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_aulas.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_aulas.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_aulas_insert" ON public.ebd_aulas FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_aulas.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_aulas.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_aulas_update" ON public.ebd_aulas FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_aulas.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_aulas.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_aulas_delete" ON public.ebd_aulas FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_aulas.ministry_id
    AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb)
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_aulas.ministry_id AND m.user_id = auth.uid())
);

-- ── ebd_frequencias ───────────────────────────────────────────────────────────
ALTER TABLE public.ebd_frequencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ebd_freq_select ON public.ebd_frequencias;
DROP POLICY IF EXISTS ebd_freq_insert ON public.ebd_frequencias;
DROP POLICY IF EXISTS ebd_freq_update ON public.ebd_frequencias;
DROP POLICY IF EXISTS ebd_freq_delete ON public.ebd_frequencias;

CREATE POLICY "ebd_freq_select" ON public.ebd_frequencias FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_frequencias.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_frequencias.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_freq_insert" ON public.ebd_frequencias FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_frequencias.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_frequencias.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_freq_update" ON public.ebd_frequencias FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_frequencias.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_frequencias.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_freq_delete" ON public.ebd_frequencias FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_frequencias.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_frequencias.ministry_id AND m.user_id = auth.uid())
);

-- ── ebd_visitantes_aula ───────────────────────────────────────────────────────
ALTER TABLE public.ebd_visitantes_aula ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ebd_visit_select ON public.ebd_visitantes_aula;
DROP POLICY IF EXISTS ebd_visit_insert ON public.ebd_visitantes_aula;
DROP POLICY IF EXISTS ebd_visit_delete ON public.ebd_visitantes_aula;

CREATE POLICY "ebd_visit_select" ON public.ebd_visitantes_aula FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_visitantes_aula.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_visitantes_aula.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_visit_insert" ON public.ebd_visitantes_aula FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_visitantes_aula.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_visitantes_aula.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_visit_delete" ON public.ebd_visitantes_aula FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_visitantes_aula.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_visitantes_aula.ministry_id AND m.user_id = auth.uid())
);

-- ── ebd_revistas ──────────────────────────────────────────────────────────────
ALTER TABLE public.ebd_revistas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ebd_revistas_select ON public.ebd_revistas;
DROP POLICY IF EXISTS ebd_revistas_insert ON public.ebd_revistas;
DROP POLICY IF EXISTS ebd_revistas_update ON public.ebd_revistas;
DROP POLICY IF EXISTS ebd_revistas_delete ON public.ebd_revistas;

CREATE POLICY "ebd_revistas_select" ON public.ebd_revistas FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_revistas.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_revistas.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_revistas_insert" ON public.ebd_revistas FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_revistas.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_revistas.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_revistas_update" ON public.ebd_revistas FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_revistas.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_revistas.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_revistas_delete" ON public.ebd_revistas FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_revistas.ministry_id
    AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb)
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_revistas.ministry_id AND m.user_id = auth.uid())
);

-- ── ebd_pedidos_revistas ──────────────────────────────────────────────────────
ALTER TABLE public.ebd_pedidos_revistas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ebd_pedidos_select ON public.ebd_pedidos_revistas;
DROP POLICY IF EXISTS ebd_pedidos_insert ON public.ebd_pedidos_revistas;
DROP POLICY IF EXISTS ebd_pedidos_update ON public.ebd_pedidos_revistas;

CREATE POLICY "ebd_pedidos_select" ON public.ebd_pedidos_revistas FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_pedidos_revistas.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_pedidos_revistas.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_pedidos_insert" ON public.ebd_pedidos_revistas FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_pedidos_revistas.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_pedidos_revistas.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_pedidos_update" ON public.ebd_pedidos_revistas FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_pedidos_revistas.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_pedidos_revistas.ministry_id AND m.user_id = auth.uid())
);

-- ── ebd_pedidos_itens ─────────────────────────────────────────────────────────
ALTER TABLE public.ebd_pedidos_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ebd_itens_select ON public.ebd_pedidos_itens;
DROP POLICY IF EXISTS ebd_itens_insert ON public.ebd_pedidos_itens;
DROP POLICY IF EXISTS ebd_itens_update ON public.ebd_pedidos_itens;
DROP POLICY IF EXISTS ebd_itens_delete ON public.ebd_pedidos_itens;

CREATE POLICY "ebd_itens_select" ON public.ebd_pedidos_itens FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_pedidos_itens.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_pedidos_itens.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_itens_insert" ON public.ebd_pedidos_itens FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_pedidos_itens.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_pedidos_itens.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_itens_update" ON public.ebd_pedidos_itens FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_pedidos_itens.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_pedidos_itens.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_itens_delete" ON public.ebd_pedidos_itens FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_pedidos_itens.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_pedidos_itens.ministry_id AND m.user_id = auth.uid())
);

-- ── ebd_ofertas ───────────────────────────────────────────────────────────────
ALTER TABLE public.ebd_ofertas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ebd_ofertas_select ON public.ebd_ofertas;
DROP POLICY IF EXISTS ebd_ofertas_insert ON public.ebd_ofertas;
DROP POLICY IF EXISTS ebd_ofertas_update ON public.ebd_ofertas;
DROP POLICY IF EXISTS ebd_ofertas_delete ON public.ebd_ofertas;

CREATE POLICY "ebd_ofertas_select" ON public.ebd_ofertas FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_ofertas.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_ofertas.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_ofertas_insert" ON public.ebd_ofertas FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_ofertas.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_ofertas.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_ofertas_update" ON public.ebd_ofertas FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_ofertas.ministry_id
    AND (mu.permissions @> '["ADMINISTRADOR"]'::jsonb OR mu.permissions @> '["EBD"]'::jsonb))
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_ofertas.ministry_id AND m.user_id = auth.uid())
);
CREATE POLICY "ebd_ofertas_delete" ON public.ebd_ofertas FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.ministry_users mu WHERE mu.user_id = auth.uid() AND mu.ministry_id = ebd_ofertas.ministry_id
    AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb)
  OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ebd_ofertas.ministry_id AND m.user_id = auth.uid())
);

COMMIT;
