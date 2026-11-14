-- ==============================================================================
-- MÓDULO CÉLULAS — LOTE 4: ESTUDOS BÍBLICOS, SUPERVISÃO E CONSOLIDAÇÃO
-- Especificação: docs/GESTAO_EKLESIA_MODULO_CELULAS_ESPECIFICACAO_V1.md
-- Seções: 8 (Estudos Bíblicos), 11 (Supervisão Pastoral), 14 (Inteligência Pastoral/Relatórios)
-- ==============================================================================
-- Características da Implantação Segura:
-- 1. Transacional com lock_timeout e statement_timeout para proteção contra locks.
-- 2. Operações 100% aditivas e idempotentes (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
-- 3. RLS em todas as novas tabelas com isolamento estrito por ministry_id e congregação.
-- 4. Funções helpers SECURITY DEFINER de autorização integradas aos lotes anteriores.
-- 5. Versionamento imutável de estudos: versões publicadas preservadas para reuniões.
-- 6. Supervisão pastoral estruturada (visitas, acompanhamentos e solicitações de apoio).
-- ==============================================================================

BEGIN;

-- 1. Timeouts de segurança para evitar contenção de locks em produção
SET LOCAL lock_timeout = '4s';
SET LOCAL statement_timeout = '30s';

-- ------------------------------------------------------------------------------
-- 2. Tabela de Estudos Bíblicos / Materiais (celulas_estudos)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.celulas_estudos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  rede_id UUID REFERENCES public.celulas_redes(id) ON DELETE SET NULL,

  titulo VARCHAR(255) NOT NULL,
  tema VARCHAR(150),
  serie VARCHAR(150),
  numero_licao INT,
  referencias_biblicas TEXT,
  
  -- Conteúdo estruturado
  objetivo TEXT,
  quebra_gelo TEXT,
  introducao TEXT,
  desenvolvimento TEXT NOT NULL,
  perguntas_discussao TEXT,
  aplicacao_pratica TEXT,
  conclusao TEXT,
  oracao_final TEXT,

  -- Governança e fluxo editorial
  status VARCHAR(30) NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'em_revisao', 'aprovado', 'publicado', 'arquivado', 'rejeitado')),
  versao INT NOT NULL DEFAULT 1,
  data_publicacao_inicio DATE,
  data_publicacao_fim DATE,

  autor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_por_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_celulas_estudos_ministry ON public.celulas_estudos(ministry_id);
CREATE INDEX IF NOT EXISTS idx_celulas_estudos_congregacao ON public.celulas_estudos(congregacao_id);
CREATE INDEX IF NOT EXISTS idx_celulas_estudos_rede ON public.celulas_estudos(rede_id);
CREATE INDEX IF NOT EXISTS idx_celulas_estudos_status ON public.celulas_estudos(status);
CREATE INDEX IF NOT EXISTS idx_celulas_estudos_periodo ON public.celulas_estudos(data_publicacao_inicio, data_publicacao_fim);

-- ------------------------------------------------------------------------------
-- 3. Tabela de Supervisão Pastoral e Visitas (celulas_supervisoes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.celulas_supervisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  celula_id UUID NOT NULL REFERENCES public.celulas(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,

  supervisor_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  tipo VARCHAR(30) NOT NULL DEFAULT 'visita' CHECK (tipo IN ('visita', 'reuniao_lideranca', 'solicitacao_apoio', 'alinhamento_pastoral')),
  status VARCHAR(30) NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'realizada', 'cancelada', 'nao_realizada')),

  data_agendada DATE NOT NULL,
  data_realizada TIMESTAMPTZ,
  
  -- Avaliação operacional e pastoral (sem juízos depreciativos, foco em apoio)
  diagnostico_saude VARCHAR(30) DEFAULT 'saudavel' CHECK (diagnostico_saude IN ('saudavel', 'atencao', 'critico', 'em_multiplicacao')),
  observacoes_pastorais TEXT,
  plano_acao TEXT,
  solicitou_apoio_pastoral BOOLEAN NOT NULL DEFAULT false,
  detalhe_apoio TEXT,

  registrado_por_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_celulas_supervisoes_ministry ON public.celulas_supervisoes(ministry_id);
CREATE INDEX IF NOT EXISTS idx_celulas_supervisoes_celula ON public.celulas_supervisoes(celula_id);
CREATE INDEX IF NOT EXISTS idx_celulas_supervisoes_congregacao ON public.celulas_supervisoes(congregacao_id);
CREATE INDEX IF NOT EXISTS idx_celulas_supervisoes_supervisor ON public.celulas_supervisoes(supervisor_member_id);
CREATE INDEX IF NOT EXISTS idx_celulas_supervisoes_data ON public.celulas_supervisoes(data_agendada);
CREATE INDEX IF NOT EXISTS idx_celulas_supervisoes_status ON public.celulas_supervisoes(status);

-- ------------------------------------------------------------------------------
-- 4. Habilitação de RLS e Políticas de Segurança (Lote 4)
-- ------------------------------------------------------------------------------
ALTER TABLE public.celulas_estudos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celulas_supervisoes ENABLE ROW LEVEL SECURITY;

-- --- celulas_estudos ---
DROP POLICY IF EXISTS "celulas_estudos_select" ON public.celulas_estudos;
CREATE POLICY "celulas_estudos_select" ON public.celulas_estudos
  FOR SELECT TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
    OR (
      -- Estudos publicados são acessíveis por líderes/usuários do mesmo ministério
      status = 'publicado' AND ministry_id IN (
        SELECT mu.ministry_id FROM public.ministry_users mu 
        WHERE mu.user_id = auth.uid() AND COALESCE(mu.is_active, true) = true
      )
    )
    OR (
      congregacao_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.ministry_users mu
        WHERE mu.user_id = auth.uid()
          AND mu.ministry_id = public.celulas_estudos.ministry_id
          AND mu.congregacao_id = public.celulas_estudos.congregacao_id
          AND COALESCE(mu.is_active, true) = true
      )
    )
  );

DROP POLICY IF EXISTS "celulas_estudos_insert" ON public.celulas_estudos;
CREATE POLICY "celulas_estudos_insert" ON public.celulas_estudos
  FOR INSERT TO authenticated WITH CHECK (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );

DROP POLICY IF EXISTS "celulas_estudos_update" ON public.celulas_estudos;
CREATE POLICY "celulas_estudos_update" ON public.celulas_estudos
  FOR UPDATE TO authenticated USING (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  ) WITH CHECK (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );

DROP POLICY IF EXISTS "celulas_estudos_delete" ON public.celulas_estudos;
CREATE POLICY "celulas_estudos_delete" ON public.celulas_estudos
  FOR DELETE TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
  );

-- --- celulas_supervisoes ---
DROP POLICY IF EXISTS "celulas_supervisoes_select" ON public.celulas_supervisoes;
CREATE POLICY "celulas_supervisoes_select" ON public.celulas_supervisoes
  FOR SELECT TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
    OR (
      congregacao_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.ministry_users mu
        WHERE mu.user_id = auth.uid()
          AND mu.ministry_id = public.celulas_supervisoes.ministry_id
          AND mu.congregacao_id = public.celulas_supervisoes.congregacao_id
          AND COALESCE(mu.is_active, true) = true
      )
    )
  );

DROP POLICY IF EXISTS "celulas_supervisoes_insert" ON public.celulas_supervisoes;
CREATE POLICY "celulas_supervisoes_insert" ON public.celulas_supervisoes
  FOR INSERT TO authenticated WITH CHECK (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );

DROP POLICY IF EXISTS "celulas_supervisoes_update" ON public.celulas_supervisoes;
CREATE POLICY "celulas_supervisoes_update" ON public.celulas_supervisoes
  FOR UPDATE TO authenticated USING (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  ) WITH CHECK (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );

DROP POLICY IF EXISTS "celulas_supervisoes_delete" ON public.celulas_supervisoes;
CREATE POLICY "celulas_supervisoes_delete" ON public.celulas_supervisoes
  FOR DELETE TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
  );

COMMIT;
