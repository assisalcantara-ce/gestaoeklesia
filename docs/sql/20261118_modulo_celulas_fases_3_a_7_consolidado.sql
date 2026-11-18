-- ==============================================================================
-- GESTÃO EKLÉSIA — MÓDULO CÉLULAS (LOTES 3 A 7 CONSOLIDADOS)
-- Arquivo: docs/sql/20261118_modulo_celulas_fases_3_a_7_consolidado.sql
--
-- Descrição:
--   Script idempotente, seguro e transacional contendo as 5 migrations pendentes
--   do Módulo Células para execução controlada no SQL Editor do Supabase Cloud:
--     1. Fase 3: Participantes, Vínculos e Transferências (20261112180000)
--     2. Fase 4: Estudos Bíblicos e Supervisão Pastoral (20261112200000)
--     3. Fase 5: Multiplicação Assistida e Genealogia (20261112220000)
--     4. Fase 6: Comunicação Ministerial e Notificações (20261113170000)
--     5. Fase 7: Índices Analíticos de Inteligência Pastoral (20261113200000)
--
-- Invariantes de Segurança:
--   - Execução 100% transacional (BEGIN ... COMMIT).
--   - Timeouts estritos (lock_timeout 4s, statement_timeout 60s) para evitar locks em produção.
--   - Todas as operações são aditivas e idempotentes (CREATE TABLE/INDEX IF NOT EXISTS).
--   - Nenhuma remoção de dados (DROP TABLE, TRUNCATE, DELETE FROM inexistentes).
--   - Row Level Security (RLS) habilitada em todas as tabelas criadas com políticas por ministry_id.
--   - Validações de pré-condição e pós-condição integradas via blocos DO $$.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. CONFIGURAÇÃO DE TIME-OUTS DE SEGURANÇA CONTRA CONTENÇÃO DE LOCKS
-- ------------------------------------------------------------------------------
SET LOCAL lock_timeout = '4s';
SET LOCAL statement_timeout = '60s';

-- ------------------------------------------------------------------------------
-- 1. VERIFICAÇÃO DE PRÉ-CONDIÇÕES (FASES 1 E 2 PRESENTES NO BANCO)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'celulas') THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: A tabela public.celulas (Fase 1) não foi encontrada no banco.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'celulas_configuracoes') THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: A tabela public.celulas_configuracoes (Fase 1) não foi encontrada no banco.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'celulas_reunioes') THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: A tabela public.celulas_reunioes (Fase 2) não foi encontrada no banco.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'celulas_has_global_write') THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: A função public.celulas_has_global_write (Fase 1) não foi encontrada no banco.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'celulas_has_local_write') THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: A função public.celulas_has_local_write (Fase 1) não foi encontrada no banco.';
  END IF;

  RAISE NOTICE 'PRÉ-CONDIÇÕES APROVADAS: Estrutura base de Células (Fases 1 e 2) confirmada.';
END $$;


-- ==============================================================================
-- 2. FASE 3: PARTICIPANTES, VÍNCULOS E HISTÓRICO DE TRANSFERÊNCIA (20261112180000)
-- ==============================================================================

-- 2.1 Tabela de Vínculo de Participantes da Célula (celulas_participantes)
CREATE TABLE IF NOT EXISTS public.celulas_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  celula_id UUID NOT NULL REFERENCES public.celulas(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,

  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  nome_completo VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telefone VARCHAR(30),

  papel VARCHAR(30) NOT NULL DEFAULT 'membro' CHECK (papel IN ('lider', 'vice_lider', 'anfitriao', 'lider_em_treinamento', 'membro', 'congregante', 'visitante_regular', 'crianca')),
  status VARCHAR(30) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'transferido', 'desligado')),
  data_ingresso DATE NOT NULL DEFAULT CURRENT_DATE,
  data_saida DATE,
  motivo_saida TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_celulas_part_ministry ON public.celulas_participantes(ministry_id);
CREATE INDEX IF NOT EXISTS idx_celulas_part_celula ON public.celulas_participantes(celula_id);
CREATE INDEX IF NOT EXISTS idx_celulas_part_congregacao ON public.celulas_participantes(congregacao_id);
CREATE INDEX IF NOT EXISTS idx_celulas_part_member ON public.celulas_participantes(member_id) WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_celulas_part_status ON public.celulas_participantes(status);

-- Índice único parcial: no máximo um vínculo 'ativo' por membro dentro do mesmo ministério
CREATE UNIQUE INDEX IF NOT EXISTS uq_celula_membro_ativo_ministry
ON public.celulas_participantes (ministry_id, member_id)
WHERE member_id IS NOT NULL AND status = 'ativo';

-- 2.2 Tabela de Histórico de Transferências de Célula (celulas_transferencias)
CREATE TABLE IF NOT EXISTS public.celulas_transferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  participante_id UUID NOT NULL REFERENCES public.celulas_participantes(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,

  celula_origem_id UUID NOT NULL REFERENCES public.celulas(id) ON DELETE CASCADE,
  celula_destino_id UUID NOT NULL REFERENCES public.celulas(id) ON DELETE CASCADE,

  data_transferencia TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  motivo TEXT,
  solicitado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT chk_celulas_transferencia_origem_destino CHECK (celula_origem_id <> celula_destino_id)
);

CREATE INDEX IF NOT EXISTS idx_celulas_transf_ministry ON public.celulas_transferencias(ministry_id);
CREATE INDEX IF NOT EXISTS idx_celulas_transf_participante ON public.celulas_transferencias(participante_id);
CREATE INDEX IF NOT EXISTS idx_celulas_transf_origem ON public.celulas_transferencias(celula_origem_id);
CREATE INDEX IF NOT EXISTS idx_celulas_transf_destino ON public.celulas_transferencias(celula_destino_id);

-- 2.3 RLS e Políticas de Segurança (Fase 3)
ALTER TABLE public.celulas_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celulas_transferencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "celulas_participantes_select" ON public.celulas_participantes;
CREATE POLICY "celulas_participantes_select" ON public.celulas_participantes
  FOR SELECT TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
    OR (
      congregacao_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.ministry_users mu
        WHERE mu.user_id = auth.uid()
          AND mu.ministry_id = public.celulas_participantes.ministry_id
          AND mu.congregacao_id = public.celulas_participantes.congregacao_id
          AND COALESCE(mu.is_active, true) = true
      )
    )
  );

DROP POLICY IF EXISTS "celulas_participantes_insert" ON public.celulas_participantes;
CREATE POLICY "celulas_participantes_insert" ON public.celulas_participantes
  FOR INSERT TO authenticated WITH CHECK (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );

DROP POLICY IF EXISTS "celulas_participantes_update" ON public.celulas_participantes;
CREATE POLICY "celulas_participantes_update" ON public.celulas_participantes
  FOR UPDATE TO authenticated USING (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  ) WITH CHECK (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );

DROP POLICY IF EXISTS "celulas_participantes_delete" ON public.celulas_participantes;
CREATE POLICY "celulas_participantes_delete" ON public.celulas_participantes
  FOR DELETE TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
  );

DROP POLICY IF EXISTS "celulas_transferencias_select" ON public.celulas_transferencias;
CREATE POLICY "celulas_transferencias_select" ON public.celulas_transferencias
  FOR SELECT TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
    OR EXISTS (
      SELECT 1 FROM public.celulas c
      JOIN public.ministry_users mu ON mu.user_id = auth.uid() 
        AND mu.ministry_id = c.ministry_id 
        AND mu.congregacao_id = c.congregacao_id
        AND COALESCE(mu.is_active, true) = true
      WHERE (c.id = public.celulas_transferencias.celula_origem_id OR c.id = public.celulas_transferencias.celula_destino_id)
    )
  );

DROP POLICY IF EXISTS "celulas_transferencias_modify" ON public.celulas_transferencias;
CREATE POLICY "celulas_transferencias_modify" ON public.celulas_transferencias
  FOR ALL TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
  ) WITH CHECK (
    public.celulas_has_global_write(ministry_id)
  );


-- ==============================================================================
-- 3. FASE 4: ESTUDOS BÍBLICOS E SUPERVISÃO PASTORAL (20261112200000)
-- ==============================================================================

-- 3.1 Tabela de Estudos Bíblicos / Materiais (celulas_estudos)
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
  
  objetivo TEXT,
  quebra_gelo TEXT,
  introducao TEXT,
  desenvolvimento TEXT NOT NULL,
  perguntas_discussao TEXT,
  aplicacao_pratica TEXT,
  conclusao TEXT,
  oracao_final TEXT,

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

-- 3.2 Tabela de Supervisão Pastoral e Visitas (celulas_supervisoes)
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

-- 3.3 RLS e Políticas de Segurança (Fase 4)
ALTER TABLE public.celulas_estudos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celulas_supervisoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "celulas_estudos_select" ON public.celulas_estudos;
CREATE POLICY "celulas_estudos_select" ON public.celulas_estudos
  FOR SELECT TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
    OR (
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


-- ==============================================================================
-- 4. FASE 5: MULTIPLICAÇÃO ASSISTIDA E GENEALOGIA (20261112220000)
-- ==============================================================================

-- 4.1 Tabela de Processos de Multiplicação (celulas_multiplicacoes)
CREATE TABLE IF NOT EXISTS public.celulas_multiplicacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,

  celula_origem_id UUID NOT NULL REFERENCES public.celulas(id) ON DELETE CASCADE,
  celula_filha_id UUID REFERENCES public.celulas(id) ON DELETE SET NULL,

  nome_nova_celula VARCHAR(150) NOT NULL,
  novo_lider_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  novo_vice_lider_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  novo_anfitriao_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  dia_reuniao INT CHECK (dia_reuniao IS NULL OR (dia_reuniao BETWEEN 0 AND 6)),
  horario_reuniao TIME,
  endereco_local TEXT,

  status VARCHAR(30) NOT NULL DEFAULT 'solicitada' CHECK (status IN ('solicitada', 'em_avaliacao', 'aprovada', 'efetivada', 'rejeitada', 'cancelada')),
  data_planejada DATE,
  data_efetivacao TIMESTAMPTZ,
  
  motivo_planejamento TEXT,
  justificativa_aprovacao TEXT,
  motivo_rejeicao TEXT,

  solicitado_por_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  avaliado_por_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  efetivado_por_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_celulas_mult_ministry ON public.celulas_multiplicacoes(ministry_id);
CREATE INDEX IF NOT EXISTS idx_celulas_mult_congregacao ON public.celulas_multiplicacoes(congregacao_id);
CREATE INDEX IF NOT EXISTS idx_celulas_mult_origem ON public.celulas_multiplicacoes(celula_origem_id);
CREATE INDEX IF NOT EXISTS idx_celulas_mult_filha ON public.celulas_multiplicacoes(celula_filha_id);
CREATE INDEX IF NOT EXISTS idx_celulas_mult_status ON public.celulas_multiplicacoes(status);

-- 4.2 Tabela de Participantes Destinados à Nova Célula (celulas_multiplicacao_participantes)
CREATE TABLE IF NOT EXISTS public.celulas_multiplicacao_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  multiplicacao_id UUID NOT NULL REFERENCES public.celulas_multiplicacoes(id) ON DELETE CASCADE,
  participante_id UUID NOT NULL REFERENCES public.celulas_participantes(id) ON DELETE CASCADE,
  
  papel_planejado VARCHAR(30) NOT NULL DEFAULT 'membro' CHECK (papel_planejado IN ('lider', 'vice_lider', 'anfitriao', 'lider_em_treinamento', 'membro', 'congregante', 'visitante_regular', 'crianca')),
  transferido_efetivo BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_celulas_mult_part_mult ON public.celulas_multiplicacao_participantes(multiplicacao_id);
CREATE INDEX IF NOT EXISTS idx_celulas_mult_part_part ON public.celulas_multiplicacao_participantes(participante_id);

-- 4.3 RLS e Políticas de Segurança (Fase 5)
ALTER TABLE public.celulas_multiplicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celulas_multiplicacao_participantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "celulas_multiplicacoes_select" ON public.celulas_multiplicacoes;
CREATE POLICY "celulas_multiplicacoes_select" ON public.celulas_multiplicacoes
  FOR SELECT TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
    OR (
      congregacao_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.ministry_users mu
        WHERE mu.user_id = auth.uid()
          AND mu.ministry_id = public.celulas_multiplicacoes.ministry_id
          AND mu.congregacao_id = public.celulas_multiplicacoes.congregacao_id
          AND COALESCE(mu.is_active, true) = true
      )
    )
  );

DROP POLICY IF EXISTS "celulas_multiplicacoes_insert" ON public.celulas_multiplicacoes;
CREATE POLICY "celulas_multiplicacoes_insert" ON public.celulas_multiplicacoes
  FOR INSERT TO authenticated WITH CHECK (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );

DROP POLICY IF EXISTS "celulas_multiplicacoes_update" ON public.celulas_multiplicacoes;
CREATE POLICY "celulas_multiplicacoes_update" ON public.celulas_multiplicacoes
  FOR UPDATE TO authenticated USING (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  ) WITH CHECK (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );

DROP POLICY IF EXISTS "celulas_multiplicacoes_delete" ON public.celulas_multiplicacoes;
CREATE POLICY "celulas_multiplicacoes_delete" ON public.celulas_multiplicacoes
  FOR DELETE TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
  );

DROP POLICY IF EXISTS "celulas_mult_part_select" ON public.celulas_multiplicacao_participantes;
CREATE POLICY "celulas_mult_part_select" ON public.celulas_multiplicacao_participantes
  FOR SELECT TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
    OR EXISTS (
      SELECT 1 FROM public.celulas_multiplicacoes cm
      JOIN public.ministry_users mu ON mu.user_id = auth.uid() 
        AND mu.ministry_id = cm.ministry_id 
        AND mu.congregacao_id = cm.congregacao_id
        AND COALESCE(mu.is_active, true) = true
      WHERE cm.id = public.celulas_multiplicacao_participantes.multiplicacao_id
    )
  );

DROP POLICY IF EXISTS "celulas_mult_part_modify" ON public.celulas_multiplicacao_participantes;
CREATE POLICY "celulas_mult_part_modify" ON public.celulas_multiplicacao_participantes
  FOR ALL TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
    OR EXISTS (
      SELECT 1 FROM public.celulas_multiplicacoes cm
      JOIN public.ministry_users mu ON mu.user_id = auth.uid() 
        AND mu.ministry_id = cm.ministry_id 
        AND mu.congregacao_id = cm.congregacao_id
        AND COALESCE(mu.is_active, true) = true
      WHERE cm.id = public.celulas_multiplicacao_participantes.multiplicacao_id
    )
  ) WITH CHECK (
    public.celulas_has_global_write(ministry_id)
    OR EXISTS (
      SELECT 1 FROM public.celulas_multiplicacoes cm
      JOIN public.ministry_users mu ON mu.user_id = auth.uid() 
        AND mu.ministry_id = cm.ministry_id 
        AND mu.congregacao_id = cm.congregacao_id
        AND COALESCE(mu.is_active, true) = true
      WHERE cm.id = public.celulas_multiplicacao_participantes.multiplicacao_id
    )
  );

-- 4.4 Função Atômica Transacional de Efetivação de Multiplicação (efetivar_multiplicacao_celula)
CREATE OR REPLACE FUNCTION public.efetivar_multiplicacao_celula(
  p_ministry_id UUID,
  p_multiplicacao_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  -- Campos escalares do processo de multiplicação
  v_mult_found BOOLEAN := false;
  v_status VARCHAR(30);
  v_celula_origem_id UUID;
  v_mult_congregacao_id UUID;
  v_nome_nova_celula VARCHAR(150);
  v_novo_lider_member_id UUID;
  v_novo_vice_lider_member_id UUID;
  v_novo_anfitriao_member_id UUID;
  v_dia_reuniao INT;
  v_horario_reuniao TIME;
  v_endereco_local TEXT;

  -- Campos escalares da célula mãe
  v_mae_found BOOLEAN := false;
  v_mae_congregacao_id UUID;
  v_mae_rede_id UUID;
  v_mae_dia_semana INT;
  v_mae_horario TIME;
  v_mae_endereco TEXT;

  -- Variáveis operacionais
  v_nova_celula_id UUID;
  v_target_congregacao_id UUID;
  v_part RECORD;
  r_mult RECORD;
  r_mae RECORD;
  v_result JSONB;
BEGIN
  -- 1. Validação de Autorização via helpers SECURITY DEFINER
  IF NOT (
    public.celulas_has_global_write(p_ministry_id)
    OR EXISTS (
      SELECT 1 FROM public.celulas_multiplicacoes m
      JOIN public.ministry_users mu ON mu.user_id = auth.uid()
        AND mu.ministry_id = m.ministry_id
        AND mu.congregacao_id = m.congregacao_id
        AND COALESCE(mu.is_active, true) = true
      WHERE m.id = p_multiplicacao_id
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado: você não tem permissão para efetivar esta multiplicação.';
  END IF;

  -- 2. Lock pessimista para proteção contra execução simultânea/duplicada
  FOR r_mult IN
    SELECT
      status,
      celula_origem_id,
      congregacao_id,
      nome_nova_celula,
      novo_lider_member_id,
      novo_vice_lider_member_id,
      novo_anfitriao_member_id,
      dia_reuniao,
      horario_reuniao,
      endereco_local
    FROM public.celulas_multiplicacoes
    WHERE id = p_multiplicacao_id AND ministry_id = p_ministry_id
    FOR UPDATE
  LOOP
    v_mult_found := true;
    v_status := r_mult.status;
    v_celula_origem_id := r_mult.celula_origem_id;
    v_mult_congregacao_id := r_mult.congregacao_id;
    v_nome_nova_celula := r_mult.nome_nova_celula;
    v_novo_lider_member_id := r_mult.novo_lider_member_id;
    v_novo_vice_lider_member_id := r_mult.novo_vice_lider_member_id;
    v_novo_anfitriao_member_id := r_mult.novo_anfitriao_member_id;
    v_dia_reuniao := r_mult.dia_reuniao;
    v_horario_reuniao := r_mult.horario_reuniao;
    v_endereco_local := r_mult.endereco_local;
  END LOOP;

  IF NOT v_mult_found THEN
    RAISE EXCEPTION 'Processo de multiplicação não encontrado.';
  END IF;

  IF v_status = 'efetivada' THEN
    RAISE EXCEPTION 'Esta multiplicação já foi efetivada anteriormente.';
  END IF;

  IF v_status <> 'aprovada' THEN
    RAISE EXCEPTION 'Apenas processos com status ''aprovada'' podem ser efetivados (Status atual: %)', v_status;
  END IF;

  -- 3. Obter dados da célula mãe
  FOR r_mae IN
    SELECT
      congregacao_id,
      rede_id,
      dia_semana,
      horario,
      endereco
    FROM public.celulas
    WHERE id = v_celula_origem_id AND ministry_id = p_ministry_id
  LOOP
    v_mae_found := true;
    v_mae_congregacao_id := r_mae.congregacao_id;
    v_mae_rede_id := r_mae.rede_id;
    v_mae_dia_semana := r_mae.dia_semana;
    v_mae_horario := r_mae.horario;
    v_mae_endereco := r_mae.endereco;
  END LOOP;

  IF NOT v_mae_found THEN
    RAISE EXCEPTION 'Célula mãe não encontrada.';
  END IF;

  v_target_congregacao_id := COALESCE(v_mult_congregacao_id, v_mae_congregacao_id);

  -- 4. Criação da Célula-Filha em transação
  INSERT INTO public.celulas (
    ministry_id,
    congregacao_id,
    rede_id,
    nome,
    celula_mae_id,
    lider_member_id,
    vice_lider_member_id,
    anfitriao_member_id,
    dia_semana,
    horario,
    endereco,
    status,
    data_inicio
  ) VALUES (
    p_ministry_id,
    v_target_congregacao_id,
    v_mae_rede_id,
    v_nome_nova_celula,
    v_celula_origem_id, -- Genealogia preservada sem ciclos
    v_novo_lider_member_id,
    v_novo_vice_lider_member_id,
    v_novo_anfitriao_member_id,
    COALESCE(v_dia_reuniao, v_mae_dia_semana),
    COALESCE(v_horario_reuniao, v_mae_horario),
    COALESCE(v_endereco_local, v_mae_endereco),
    'ativa',
    CURRENT_DATE
  )
  RETURNING id INTO v_nova_celula_id;

  -- 5. Transferência atômica de participantes planejados e gravação no histórico
  FOR v_part IN
    SELECT mp.id AS planejado_id, mp.participante_id, mp.papel_planejado, cp.member_id
    FROM public.celulas_multiplicacao_participantes mp
    JOIN public.celulas_participantes cp ON cp.id = mp.participante_id
    WHERE mp.multiplicacao_id = p_multiplicacao_id AND mp.ministry_id = p_ministry_id
  LOOP
    -- Atualizar vínculo do participante para a nova célula
    UPDATE public.celulas_participantes
    SET
      celula_id = v_nova_celula_id,
      congregacao_id = v_target_congregacao_id,
      papel = v_part.papel_planejado,
      updated_at = timezone('utc'::text, now())
    WHERE id = v_part.participante_id AND ministry_id = p_ministry_id;

    -- Inserir log auditável de transferência
    INSERT INTO public.celulas_transferencias (
      ministry_id,
      participante_id,
      member_id,
      celula_origem_id,
      celula_destino_id,
      motivo,
      solicitado_por
    ) VALUES (
      p_ministry_id,
      v_part.participante_id,
      v_part.member_id,
      v_celula_origem_id,
      v_nova_celula_id,
      'Multiplicação da célula: ' || v_nome_nova_celula,
      p_user_id
    );

    -- Marcar item planejado como efetivado
    UPDATE public.celulas_multiplicacao_participantes
    SET transferido_efetivo = true
    WHERE id = v_part.planejado_id;
  END LOOP;

  -- 6. Atualizar status do processo de multiplicação
  UPDATE public.celulas_multiplicacoes
  SET
    celula_filha_id = v_nova_celula_id,
    status = 'efetivada',
    data_efetivacao = timezone('utc'::text, now()),
    efetivado_por_user_id = p_user_id,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_multiplicacao_id;

  -- 7. Retorno dos dados consolidados
  v_result := jsonb_build_object(
    'multiplicacao_id', p_multiplicacao_id,
    'nova_celula_id', v_nova_celula_id,
    'nome_nova_celula', v_nome_nova_celula,
    'celula_mae_id', v_celula_origem_id,
    'status', 'efetivada'
  );

  RETURN v_result;
END;
$$;


-- ==============================================================================
-- 5. FASE 6: COMUNICAÇÃO MINISTERIAL E NOTIFICAÇÕES (20261113170000)
-- ==============================================================================

-- 5.1 Tabela de Comunicados das Células (celulas_comunicados)
CREATE TABLE IF NOT EXISTS public.celulas_comunicados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  rede_id UUID REFERENCES public.celulas_redes(id) ON DELETE SET NULL,
  celula_id UUID REFERENCES public.celulas(id) ON DELETE CASCADE,

  publico_alvo VARCHAR(30) NOT NULL DEFAULT 'todos' CHECK (publico_alvo IN ('todos', 'lideres', 'supervisores', 'participantes', 'anfitrioes')),
  titulo VARCHAR(255) NOT NULL,
  conteudo TEXT NOT NULL,
  prioridade VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  status VARCHAR(30) NOT NULL DEFAULT 'publicado' CHECK (status IN ('rascunho', 'publicado', 'arquivado')),
  data_expiracao DATE,

  autor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_celulas_comun_ministry ON public.celulas_comunicados(ministry_id);
CREATE INDEX IF NOT EXISTS idx_celulas_comun_congregacao ON public.celulas_comunicados(congregacao_id);
CREATE INDEX IF NOT EXISTS idx_celulas_comun_rede ON public.celulas_comunicados(rede_id);
CREATE INDEX IF NOT EXISTS idx_celulas_comun_celula ON public.celulas_comunicados(celula_id);
CREATE INDEX IF NOT EXISTS idx_celulas_comun_status ON public.celulas_comunicados(status);

-- 5.2 Tabela de Modelos / Templates de Mensagens (celulas_templates_mensagens)
CREATE TABLE IF NOT EXISTS public.celulas_templates_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('lembrete_reuniao', 'boas_vindas', 'apoio_pastoral', 'chamada_estudo', 'comunicado_geral')),
  titulo VARCHAR(150) NOT NULL,
  corpo_texto TEXT NOT NULL,
  variaveis_disponiveis TEXT[],
  
  is_ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_celulas_templ_ministry ON public.celulas_templates_mensagens(ministry_id);
CREATE INDEX IF NOT EXISTS idx_celulas_templ_tipo ON public.celulas_templates_mensagens(tipo);

-- 5.3 Tabela de Registro de Disparos / Logs de Mensagens (celulas_mensagens_logs)
CREATE TABLE IF NOT EXISTS public.celulas_mensagens_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  celula_id UUID REFERENCES public.celulas(id) ON DELETE SET NULL,
  
  canal VARCHAR(30) NOT NULL DEFAULT 'whatsapp_manual' CHECK (canal IN ('whatsapp_manual', 'notificacao_app', 'email', 'sms')),
  destinatario_nome VARCHAR(255) NOT NULL,
  destinatario_contato VARCHAR(100),
  
  conteudo_enviado TEXT NOT NULL,
  status_envio VARCHAR(30) NOT NULL DEFAULT 'preparado' CHECK (status_envio IN ('preparado', 'enviado', 'falha')),
  
  enviado_por_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_celulas_msg_ministry ON public.celulas_mensagens_logs(ministry_id);
CREATE INDEX IF NOT EXISTS idx_celulas_msg_celula ON public.celulas_mensagens_logs(celula_id);
CREATE INDEX IF NOT EXISTS idx_celulas_msg_status ON public.celulas_mensagens_logs(status_envio);

-- 5.4 RLS e Políticas de Segurança (Fase 6)
ALTER TABLE public.celulas_comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celulas_templates_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celulas_mensagens_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "celulas_comunicados_select" ON public.celulas_comunicados;
CREATE POLICY "celulas_comunicados_select" ON public.celulas_comunicados
  FOR SELECT TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
    OR (
      congregacao_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.ministry_users mu
        WHERE mu.user_id = auth.uid()
          AND mu.ministry_id = public.celulas_comunicados.ministry_id
          AND mu.congregacao_id = public.celulas_comunicados.congregacao_id
          AND COALESCE(mu.is_active, true) = true
          AND (
            public.celulas_comunicados.publico_alvo IN ('todos', 'participantes')
            OR LOWER(COALESCE(mu.role, '')) IN (
              'admin', 'administrador', 'pastor', 'secretario_geral', 'supervisor', 
              'coordenador', 'lider', 'secretaria_local', 'admin_local'
            )
          )
      )
    )
    OR (
      congregacao_id IS NULL AND celula_id IS NULL AND status = 'publicado' AND EXISTS (
        SELECT 1 FROM public.ministry_users mu
        WHERE mu.user_id = auth.uid() 
          AND mu.ministry_id = public.celulas_comunicados.ministry_id
          AND COALESCE(mu.is_active, true) = true
          AND (
            public.celulas_comunicados.publico_alvo IN ('todos', 'participantes')
            OR LOWER(COALESCE(mu.role, '')) IN (
              'admin', 'administrador', 'pastor', 'secretario_geral', 'supervisor', 
              'coordenador', 'lider', 'secretaria_local', 'admin_local'
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS "celulas_comunicados_insert" ON public.celulas_comunicados;
CREATE POLICY "celulas_comunicados_insert" ON public.celulas_comunicados
  FOR INSERT TO authenticated WITH CHECK (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );

DROP POLICY IF EXISTS "celulas_comunicados_update" ON public.celulas_comunicados;
CREATE POLICY "celulas_comunicados_update" ON public.celulas_comunicados
  FOR UPDATE TO authenticated USING (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  ) WITH CHECK (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );

DROP POLICY IF EXISTS "celulas_comunicados_delete" ON public.celulas_comunicados;
CREATE POLICY "celulas_comunicados_delete" ON public.celulas_comunicados
  FOR DELETE TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
  );

DROP POLICY IF EXISTS "celulas_templates_select" ON public.celulas_templates_mensagens;
CREATE POLICY "celulas_templates_select" ON public.celulas_templates_mensagens
  FOR SELECT TO authenticated USING (
    ministry_id IN (
      SELECT mu.ministry_id FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid() AND COALESCE(mu.is_active, true) = true
    )
  );

DROP POLICY IF EXISTS "celulas_templates_modify" ON public.celulas_templates_mensagens;
CREATE POLICY "celulas_templates_modify" ON public.celulas_templates_mensagens
  FOR ALL TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
  ) WITH CHECK (
    public.celulas_has_global_write(ministry_id)
  );

DROP POLICY IF EXISTS "celulas_msg_logs_select" ON public.celulas_mensagens_logs;
CREATE POLICY "celulas_msg_logs_select" ON public.celulas_mensagens_logs
  FOR SELECT TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
    OR (
      congregacao_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.ministry_users mu
        WHERE mu.user_id = auth.uid()
          AND mu.ministry_id = public.celulas_mensagens_logs.ministry_id
          AND mu.congregacao_id = public.celulas_mensagens_logs.congregacao_id
          AND COALESCE(mu.is_active, true) = true
      )
    )
  );

DROP POLICY IF EXISTS "celulas_msg_logs_insert" ON public.celulas_mensagens_logs;
CREATE POLICY "celulas_msg_logs_insert" ON public.celulas_mensagens_logs
  FOR INSERT TO authenticated WITH CHECK (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );


-- ==============================================================================
-- 6. FASE 7: ÍNDICES ANALÍTICOS DE INTELIGÊNCIA PASTORAL (20261113200000)
-- ==============================================================================

-- 6.1 Otimização de consultas temporais de reuniões finalizadas
CREATE INDEX IF NOT EXISTS idx_celulas_reunioes_intel_periodo 
  ON public.celulas_reunioes (ministry_id, congregacao_id, data_reuniao) 
  WHERE status = 'finalizada';

CREATE INDEX IF NOT EXISTS idx_celulas_reunioes_intel_celula_data 
  ON public.celulas_reunioes (ministry_id, celula_id, data_reuniao) 
  WHERE status = 'finalizada';

-- 6.2 Otimização de contagem e acompanhamento de participantes ativos
CREATE INDEX IF NOT EXISTS idx_celulas_participantes_intel_ativo 
  ON public.celulas_participantes (ministry_id, congregacao_id, celula_id, status)
  WHERE status = 'ativo';

-- 6.3 Otimização de busca de supervisões e solicitações de apoio pastoral
CREATE INDEX IF NOT EXISTS idx_celulas_supervisoes_intel_apoio 
  ON public.celulas_supervisoes (ministry_id, congregacao_id, status, solicitou_apoio_pastoral);

-- 6.4 Otimização de histórico de multiplicações para genealogia
CREATE INDEX IF NOT EXISTS idx_celulas_multiplicacoes_intel_periodo
  ON public.celulas_multiplicacoes (ministry_id, congregacao_id, status, data_efetivacao);


-- ------------------------------------------------------------------------------
-- 7. VERIFICAÇÃO DE PÓS-CONDIÇÕES (CONFIRMAÇÃO DE TABELAS E RLS)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing TEXT := '';
  v_rls_missing TEXT := '';
  t RECORD;
  t_names TEXT[] := ARRAY[
    'celulas_participantes',
    'celulas_transferencias',
    'celulas_estudos',
    'celulas_supervisoes',
    'celulas_multiplicacoes',
    'celulas_multiplicacao_participantes',
    'celulas_comunicados',
    'celulas_templates_mensagens',
    'celulas_mensagens_logs'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY t_names LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      v_missing := v_missing || tbl || ', ';
    END IF;
  END LOOP;

  IF v_missing <> '' THEN
    RAISE EXCEPTION 'PÓS-CONDIÇÃO FALHOU: As seguintes tabelas não foram criadas: %', v_missing;
  END IF;

  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY(t_names)
      AND c.relrowsecurity = false
  LOOP
    v_rls_missing := v_rls_missing || t.relname || ', ';
  END LOOP;

  IF v_rls_missing <> '' THEN
    RAISE EXCEPTION 'PÓS-CONDIÇÃO FALHOU: As seguintes tabelas estão sem RLS habilitado: %', v_rls_missing;
  END IF;

  RAISE NOTICE 'PÓS-CONDIÇÕES APROVADAS: Todas as 9 tabelas das Fases 3 a 7 foram criadas com RLS habilitada.';
END $$;

-- ------------------------------------------------------------------------------
-- 8. SINCRONIZAÇÃO DO HISTÓRICO DE MIGRATIONS DO SUPABASE
-- ------------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version) VALUES
  ('20261112180000'),
  ('20261112200000'),
  ('20261112220000'),
  ('20261113170000'),
  ('20261113200000')
ON CONFLICT (version) DO NOTHING;

-- Concluir transação atômica
COMMIT;
