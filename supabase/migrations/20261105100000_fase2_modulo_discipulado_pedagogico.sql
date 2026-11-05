-- ==============================================================================
-- FASE 2.1: CURRÍCULO, TURMAS, MATRÍCULAS, CHAMADAS E PROGRESSO PEDAGÓGICO
-- Módulo Discipulado — Gestão Eklésia
-- ==============================================================================
-- Características da Implantação:
-- 1. 100% Aditiva e Retrocompatível: Preserva integralmente a Fase 1 e Secretaria.
-- 2. Catálogo Oficial CPAD: 26 lições canônicas (Vol 1: 01 a 13; Vol 2: 14 a 26) com rótulos neutros.
-- 3. Separação Estrita: Frequência/Chamada (assiduidade) x Validação Pedagógica (aprendizado).
-- 4. Isolamento Multi-tenant Absoluto:
--    - Constraints únicas compostas com ministry_id garantem integridade relacional entre tenants.
--    - Políticas RLS fecham qualquer brecha de vazamento entre diferentes ministérios.
-- 5. RPCs SECURITY DEFINER Blindadas:
--    - Identificam o operador exclusivamente a partir de auth.uid() e validam se o validador pertence ao mesmo ministry_id.
--    - Bloco de exceção PL/pgSQL rigorosamente com sintaxe canônica `END;`.
-- 6. Transição de Fase Responsável: Ao validar 26 lições, avança fase para 'preparacao_batismo' SEM alterar status para 'concluido'.
-- ==============================================================================

BEGIN;

SET LOCAL lock_timeout = '4s';
SET LOCAL statement_timeout = '30s';

-- ------------------------------------------------------------------------------
-- 1. ADIÇÃO CONTROLADA NA TABELA DA FASE 1: discipulado_jornadas
-- ------------------------------------------------------------------------------
ALTER TABLE public.discipulado_jornadas
  ADD COLUMN IF NOT EXISTS licoes_concluidas SMALLINT NOT NULL DEFAULT 0;

-- Constraint de unicidade composta para integridade multi-tenant em FKs compostas
CREATE UNIQUE INDEX IF NOT EXISTS uq_discipulado_jornadas_tenant_id
  ON public.discipulado_jornadas(ministry_id, id);

-- ------------------------------------------------------------------------------
-- 2. CATÁLOGO DAS 26 LIÇÕES CPAD (Rótulos Neutros / Não Violação Autoral)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discipulado_licoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volume SMALLINT NOT NULL CHECK (volume IN (1, 2)),
  numero SMALLINT NOT NULL CHECK (numero BETWEEN 1 AND 26),
  identificador_referencia VARCHAR(30) NOT NULL,
  titulo_padrao VARCHAR(150) NOT NULL,
  titulo_sugerido VARCHAR(150),
  titulo_validado BOOLEAN NOT NULL DEFAULT false,
  descricao_tematica TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  CONSTRAINT discipulado_licoes_numero_key UNIQUE (numero),
  CONSTRAINT discipulado_licoes_volume_numero_idx UNIQUE (volume, numero),
  CONSTRAINT discipulado_licoes_identificador_key UNIQUE (identificador_referencia)
);

-- Seed Idempotente das 26 Lições
INSERT INTO public.discipulado_licoes (volume, numero, identificador_referencia, titulo_padrao, titulo_validado)
VALUES
  (1, 1, 'VOL1-LIC01', 'Lição 01 - Volume 1', false),
  (1, 2, 'VOL1-LIC02', 'Lição 02 - Volume 1', false),
  (1, 3, 'VOL1-LIC03', 'Lição 03 - Volume 1', false),
  (1, 4, 'VOL1-LIC04', 'Lição 04 - Volume 1', false),
  (1, 5, 'VOL1-LIC05', 'Lição 05 - Volume 1', false),
  (1, 6, 'VOL1-LIC06', 'Lição 06 - Volume 1', false),
  (1, 7, 'VOL1-LIC07', 'Lição 07 - Volume 1', false),
  (1, 8, 'VOL1-LIC08', 'Lição 08 - Volume 1', false),
  (1, 9, 'VOL1-LIC09', 'Lição 09 - Volume 1', false),
  (1, 10, 'VOL1-LIC10', 'Lição 10 - Volume 1', false),
  (1, 11, 'VOL1-LIC11', 'Lição 11 - Volume 1', false),
  (1, 12, 'VOL1-LIC12', 'Lição 12 - Volume 1', false),
  (1, 13, 'VOL1-LIC13', 'Lição 13 - Volume 1', false),
  (2, 14, 'VOL2-LIC14', 'Lição 14 - Volume 2', false),
  (2, 15, 'VOL2-LIC15', 'Lição 15 - Volume 2', false),
  (2, 16, 'VOL2-LIC16', 'Lição 16 - Volume 2', false),
  (2, 17, 'VOL2-LIC17', 'Lição 17 - Volume 2', false),
  (2, 18, 'VOL2-LIC18', 'Lição 18 - Volume 2', false),
  (2, 19, 'VOL2-LIC19', 'Lição 19 - Volume 2', false),
  (2, 20, 'VOL2-LIC20', 'Lição 20 - Volume 2', false),
  (2, 21, 'VOL2-LIC21', 'Lição 21 - Volume 2', false),
  (2, 22, 'VOL2-LIC22', 'Lição 22 - Volume 2', false),
  (2, 23, 'VOL2-LIC23', 'Lição 23 - Volume 2', false),
  (2, 24, 'VOL2-LIC24', 'Lição 24 - Volume 2', false),
  (2, 25, 'VOL2-LIC25', 'Lição 25 - Volume 2', false),
  (2, 26, 'VOL2-LIC26', 'Lição 26 - Volume 2', false)
ON CONFLICT (numero) DO UPDATE
  SET volume = EXCLUDED.volume,
      identificador_referencia = EXCLUDED.identificador_referencia;

-- ------------------------------------------------------------------------------
-- 3. EQUIPE AUTORIZADA DE DISCIPULADO E PROFESSORES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discipulado_equipe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  papel VARCHAR(30) NOT NULL CHECK (papel IN ('discipulador', 'professor', 'coordenador')),
  autorizado_por_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  data_autorizacao DATE NOT NULL DEFAULT CURRENT_DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  data_inativacao DATE,
  motivo_inativacao TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  CONSTRAINT discipulado_equipe_ministry_member_papel_key UNIQUE (ministry_id, member_id, papel)
);

CREATE INDEX IF NOT EXISTS idx_discipulado_equipe_lookup
  ON public.discipulado_equipe(ministry_id, papel, ativo);

CREATE INDEX IF NOT EXISTS idx_discipulado_equipe_member
  ON public.discipulado_equipe(member_id);

-- ------------------------------------------------------------------------------
-- 4. TURMAS DE DISCIPULADO (LOCAIS E INTERCONGREGACIONAIS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discipulado_turmas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  nome VARCHAR(120) NOT NULL,
  professor_titular_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  professor_adjunto_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  modalidade VARCHAR(20) NOT NULL DEFAULT 'presencial' CHECK (modalidade IN ('presencial', 'online', 'hibrido')),
  is_intercongregacional BOOLEAN NOT NULL DEFAULT false,
  dias_horarios VARCHAR(100),
  local_sala VARCHAR(100),
  capacidade INTEGER CHECK (capacidade IS NULL OR capacidade > 0),
  data_inicio DATE,
  data_previsao_fim DATE,
  data_encerramento DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada', 'ativa', 'concluida', 'cancelada')),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  CONSTRAINT uq_discipulado_turmas_tenant_id UNIQUE (ministry_id, id)
);

CREATE INDEX IF NOT EXISTS idx_discipulado_turmas_tenant_status
  ON public.discipulado_turmas(ministry_id, status);

CREATE INDEX IF NOT EXISTS idx_discipulado_turmas_congregacao
  ON public.discipulado_turmas(ministry_id, congregacao_id)
  WHERE congregacao_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 5. MATRÍCULAS E HISTÓRICO DE TURMAS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discipulado_turma_alunos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  turma_id UUID NOT NULL,
  jornada_id UUID NOT NULL,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  data_matricula DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'concluido', 'transferido', 'desistente', 'trancado')),
  motivo_desligamento TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  CONSTRAINT discipulado_turma_alunos_turma_jornada_key UNIQUE (turma_id, jornada_id),
  CONSTRAINT uq_discipulado_turma_alunos_tenant_id UNIQUE (ministry_id, id),
  -- Integridade relacional composta multi-tenant:
  CONSTRAINT fk_turma_alunos_turma_tenant FOREIGN KEY (ministry_id, turma_id)
    REFERENCES public.discipulado_turmas(ministry_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_turma_alunos_jornada_tenant FOREIGN KEY (ministry_id, jornada_id)
    REFERENCES public.discipulado_jornadas(ministry_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_discipulado_turma_alunos_jornada
  ON public.discipulado_turma_alunos(jornada_id);

CREATE INDEX IF NOT EXISTS idx_discipulado_turma_alunos_tenant
  ON public.discipulado_turma_alunos(ministry_id, status);

CREATE TABLE IF NOT EXISTS public.discipulado_turma_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  matricula_id UUID NOT NULL,
  turma_origem_id UUID,
  turma_destino_id UUID,
  tipo_evento VARCHAR(30) NOT NULL CHECK (tipo_evento IN ('matricula_inicial', 'transferencia', 'trancamento', 'reativacao', 'desligamento')),
  motivo TEXT,
  registrado_por_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  CONSTRAINT fk_turma_historico_matricula_tenant FOREIGN KEY (ministry_id, matricula_id)
    REFERENCES public.discipulado_turma_alunos(ministry_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_turma_historico_origem_tenant FOREIGN KEY (ministry_id, turma_origem_id)
    REFERENCES public.discipulado_turmas(ministry_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_turma_historico_destino_tenant FOREIGN KEY (ministry_id, turma_destino_id)
    REFERENCES public.discipulado_turmas(ministry_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_discipulado_turma_historico_matricula
  ON public.discipulado_turma_historico(matricula_id);

-- ------------------------------------------------------------------------------
-- 6. ENCONTROS / AULAS DA TURMA E FREQUÊNCIA (CHAMADA)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discipulado_turma_aulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  turma_id UUID NOT NULL,
  licao_id UUID NOT NULL REFERENCES public.discipulado_licoes(id) ON DELETE RESTRICT,
  professor_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  data_aula DATE NOT NULL DEFAULT CURRENT_DATE,
  status_aula VARCHAR(20) NOT NULL DEFAULT 'realizada' CHECK (status_aula IN ('agendada', 'realizada', 'cancelada', 'remanejada')),
  motivo_cancelamento TEXT,
  conteudo_ministrado TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  CONSTRAINT uq_discipulado_turma_aulas_tenant_id UNIQUE (ministry_id, id),
  CONSTRAINT fk_turma_aulas_turma_tenant FOREIGN KEY (ministry_id, turma_id)
    REFERENCES public.discipulado_turmas(ministry_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_discipulado_turma_aulas_turma_data
  ON public.discipulado_turma_aulas(turma_id, data_aula DESC);

CREATE TABLE IF NOT EXISTS public.discipulado_turma_chamadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  aula_id UUID NOT NULL,
  turma_id UUID NOT NULL,
  jornada_id UUID NOT NULL,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  status_presenca VARCHAR(20) NOT NULL DEFAULT 'presente' CHECK (status_presenca IN ('presente', 'ausente', 'falta_justificada')),
  justificativa TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  CONSTRAINT discipulado_turma_chamadas_aula_jornada_key UNIQUE (aula_id, jornada_id),
  CONSTRAINT fk_turma_chamadas_aula_tenant FOREIGN KEY (ministry_id, aula_id)
    REFERENCES public.discipulado_turma_aulas(ministry_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_turma_chamadas_turma_tenant FOREIGN KEY (ministry_id, turma_id)
    REFERENCES public.discipulado_turmas(ministry_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_turma_chamadas_jornada_tenant FOREIGN KEY (ministry_id, jornada_id)
    REFERENCES public.discipulado_jornadas(ministry_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_discipulado_turma_chamadas_jornada
  ON public.discipulado_turma_chamadas(jornada_id);

CREATE INDEX IF NOT EXISTS idx_discipulado_turma_chamadas_aula
  ON public.discipulado_turma_chamadas(aula_id, status_presenca);

-- ------------------------------------------------------------------------------
-- 7. PROGRESSO PEDAGÓGICO INDIVIDUAL (VALIDAÇÃO EFETIVA DE LIÇÕES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discipulado_progresso_licoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  jornada_id UUID NOT NULL,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  licao_id UUID NOT NULL REFERENCES public.discipulado_licoes(id) ON DELETE RESTRICT,
  aula_origem_id UUID,
  chamada_origem_id UUID REFERENCES public.discipulado_turma_chamadas(id) ON DELETE SET NULL,
  modalidade_conclusao VARCHAR(30) NOT NULL DEFAULT 'aula_turma' 
    CHECK (modalidade_conclusao IN ('aula_turma', 'discipulado_individual', 'reposicao_individual', 'reposicao_turma_externa', 'aproveitamento_estudos')),
  data_validacao DATE NOT NULL DEFAULT CURRENT_DATE,
  validador_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  aproveitamento_nota NUMERIC(4,2),
  observacoes_pedagogicas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  -- RN-02: Garantia irrestrita de anti-duplicidade da lição por jornada
  CONSTRAINT discipulado_progresso_jornada_licao_key UNIQUE (jornada_id, licao_id),
  CONSTRAINT fk_progresso_jornada_tenant FOREIGN KEY (ministry_id, jornada_id)
    REFERENCES public.discipulado_jornadas(ministry_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_progresso_aula_tenant FOREIGN KEY (ministry_id, aula_origem_id)
    REFERENCES public.discipulado_turma_aulas(ministry_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_discipulado_progresso_member
  ON public.discipulado_progresso_licoes(member_id);

CREATE INDEX IF NOT EXISTS idx_discipulado_progresso_tenant
  ON public.discipulado_progresso_licoes(ministry_id);

-- ------------------------------------------------------------------------------
-- 8. TRIGGER DE SINCRONIZAÇÃO PEDAGÓGICA (INSERT, UPDATE, DELETE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sincronizar_progresso_pedagogico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jornada_id UUID;
  v_total_validadas INT;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_jornada_id := OLD.jornada_id;
  ELSE
    v_jornada_id := NEW.jornada_id;
  END IF;

  -- Se for UPDATE com alteração de jornada_id, sincroniza a antiga primeiro
  IF (TG_OP = 'UPDATE' AND OLD.jornada_id IS DISTINCT FROM NEW.jornada_id) THEN
    SELECT COUNT(DISTINCT licao_id) INTO v_total_validadas
    FROM public.discipulado_progresso_licoes
    WHERE jornada_id = OLD.jornada_id;

    UPDATE public.discipulado_jornadas
    SET licoes_concluidas = v_total_validadas,
        updated_at = timezone('utc', now())
    WHERE id = OLD.jornada_id;
  END IF;

  -- Recalcula para a jornada corrente
  SELECT COUNT(DISTINCT licao_id) INTO v_total_validadas
  FROM public.discipulado_progresso_licoes
  WHERE jornada_id = v_jornada_id;

  UPDATE public.discipulado_jornadas
  SET licoes_concluidas = v_total_validadas,
      -- Ao concluir 26 lições, avança para 'preparacao_batismo', MAS PRESERVA status = 'ativo'
      fase = CASE 
        WHEN v_total_validadas >= 26 AND fase IN ('primeiros_passos', 'fundamentos') 
          THEN 'preparacao_batismo'
        ELSE fase
      END,
      updated_at = timezone('utc', now())
  WHERE id = v_jornada_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_progresso_pedagogico_sync ON public.discipulado_progresso_licoes;
CREATE TRIGGER trg_progresso_pedagogico_sync
AFTER INSERT OR UPDATE OR DELETE ON public.discipulado_progresso_licoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_sincronizar_progresso_pedagogico();

-- ------------------------------------------------------------------------------
-- 9. HABILITAÇÃO DE ROW LEVEL SECURITY (RLS) COM ISOLAMENTO RIGOROSO
-- ------------------------------------------------------------------------------
ALTER TABLE public.discipulado_licoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipulado_equipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipulado_turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipulado_turma_alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipulado_turma_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipulado_turma_aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipulado_turma_chamadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipulado_progresso_licoes ENABLE ROW LEVEL SECURITY;

-- 9.1 Políticas para discipulado_licoes (Catálogo canônico público para leitura autenticada)
DROP POLICY IF EXISTS "discipulado_licoes_select_all" ON public.discipulado_licoes;
CREATE POLICY "discipulado_licoes_select_all" ON public.discipulado_licoes
  FOR SELECT TO authenticated USING (true);

-- 9.2 Políticas para discipulado_equipe
DROP POLICY IF EXISTS "discipulado_equipe_select_tenant" ON public.discipulado_equipe;
CREATE POLICY "discipulado_equipe_select_tenant" ON public.discipulado_equipe
  FOR SELECT TO authenticated USING (
    public.discipulado_has_global_write(ministry_id)
    OR (
      congregacao_id IS NOT NULL AND public.discipulado_has_local_write(ministry_id, congregacao_id)
    )
    OR member_id IN (
      SELECT m.id FROM public.members m WHERE m.ministry_id = discipulado_equipe.ministry_id AND m.email = auth.jwt()->>'email'
    )
  );

DROP POLICY IF EXISTS "discipulado_equipe_manage_global" ON public.discipulado_equipe;
CREATE POLICY "discipulado_equipe_manage_global" ON public.discipulado_equipe
  FOR ALL TO authenticated USING (
    public.discipulado_has_global_write(ministry_id)
  ) WITH CHECK (
    public.discipulado_has_global_write(ministry_id)
  );

-- 9.3 Políticas para discipulado_turmas
-- CORREÇÃO CRÍTICA: is_intercongregacional = true é SEMPRE condicionado ao mesmo ministry_id!
DROP POLICY IF EXISTS "discipulado_turmas_select_tenant" ON public.discipulado_turmas;
CREATE POLICY "discipulado_turmas_select_tenant" ON public.discipulado_turmas
  FOR SELECT TO authenticated USING (
    (
      public.discipulado_has_global_write(ministry_id)
      OR (
        is_intercongregacional = true AND EXISTS (
          SELECT 1 FROM public.ministry_users mu
          WHERE mu.user_id = auth.uid()
            AND mu.ministry_id = discipulado_turmas.ministry_id
            AND COALESCE(mu.is_active, true) = true
        )
      )
      OR (
        congregacao_id IS NOT NULL AND public.discipulado_has_local_write(ministry_id, congregacao_id)
      )
      OR professor_titular_id IN (
        SELECT m.id FROM public.members m WHERE m.ministry_id = discipulado_turmas.ministry_id AND m.email = auth.jwt()->>'email'
      )
    )
  );

DROP POLICY IF EXISTS "discipulado_turmas_write_policy" ON public.discipulado_turmas;
CREATE POLICY "discipulado_turmas_write_policy" ON public.discipulado_turmas
  FOR ALL TO authenticated USING (
    public.discipulado_has_global_write(ministry_id)
    OR (
      congregacao_id IS NOT NULL AND public.discipulado_has_local_write(ministry_id, congregacao_id)
    )
  ) WITH CHECK (
    public.discipulado_has_global_write(ministry_id)
    OR (
      congregacao_id IS NOT NULL AND public.discipulado_has_local_write(ministry_id, congregacao_id)
    )
  );

-- 9.4 Políticas para discipulado_turma_alunos e histórico
DROP POLICY IF EXISTS "discipulado_turma_alunos_select" ON public.discipulado_turma_alunos;
CREATE POLICY "discipulado_turma_alunos_select" ON public.discipulado_turma_alunos
  FOR SELECT TO authenticated USING (
    public.discipulado_has_global_write(ministry_id)
    OR EXISTS (
      SELECT 1 FROM public.discipulado_turmas t
      WHERE t.id = discipulado_turma_alunos.turma_id
        AND t.ministry_id = discipulado_turma_alunos.ministry_id
        AND (
          (t.is_intercongregacional = true AND EXISTS (
            SELECT 1 FROM public.ministry_users mu
            WHERE mu.user_id = auth.uid()
              AND mu.ministry_id = t.ministry_id
              AND COALESCE(mu.is_active, true) = true
          ))
          OR public.discipulado_has_local_write(t.ministry_id, t.congregacao_id)
        )
    )
  );

DROP POLICY IF EXISTS "discipulado_turma_alunos_write" ON public.discipulado_turma_alunos;
CREATE POLICY "discipulado_turma_alunos_write" ON public.discipulado_turma_alunos
  FOR ALL TO authenticated USING (
    public.discipulado_has_global_write(ministry_id)
  ) WITH CHECK (
    public.discipulado_has_global_write(ministry_id)
  );

DROP POLICY IF EXISTS "discipulado_turma_historico_select" ON public.discipulado_turma_historico;
CREATE POLICY "discipulado_turma_historico_select" ON public.discipulado_turma_historico
  FOR SELECT TO authenticated USING (
    public.discipulado_has_global_write(ministry_id)
  );

-- 9.5 Políticas para aulas e chamadas
DROP POLICY IF EXISTS "discipulado_turma_aulas_select" ON public.discipulado_turma_aulas;
CREATE POLICY "discipulado_turma_aulas_select" ON public.discipulado_turma_aulas
  FOR SELECT TO authenticated USING (
    public.discipulado_has_global_write(ministry_id)
    OR EXISTS (
      SELECT 1 FROM public.discipulado_turmas t
      WHERE t.id = discipulado_turma_aulas.turma_id
        AND t.ministry_id = discipulado_turma_aulas.ministry_id
        AND (
          (t.is_intercongregacional = true AND EXISTS (
            SELECT 1 FROM public.ministry_users mu
            WHERE mu.user_id = auth.uid()
              AND mu.ministry_id = t.ministry_id
              AND COALESCE(mu.is_active, true) = true
          ))
          OR public.discipulado_has_local_write(t.ministry_id, t.congregacao_id)
        )
    )
  );

DROP POLICY IF EXISTS "discipulado_turma_chamadas_select" ON public.discipulado_turma_chamadas;
CREATE POLICY "discipulado_turma_chamadas_select" ON public.discipulado_turma_chamadas
  FOR SELECT TO authenticated USING (
    public.discipulado_has_global_write(ministry_id)
    OR EXISTS (
      SELECT 1 FROM public.discipulado_turmas t
      WHERE t.id = discipulado_turma_chamadas.turma_id
        AND t.ministry_id = discipulado_turma_chamadas.ministry_id
        AND (
          (t.is_intercongregacional = true AND EXISTS (
            SELECT 1 FROM public.ministry_users mu
            WHERE mu.user_id = auth.uid()
              AND mu.ministry_id = t.ministry_id
              AND COALESCE(mu.is_active, true) = true
          ))
          OR public.discipulado_has_local_write(t.ministry_id, t.congregacao_id)
        )
    )
  );

-- 9.6 Políticas para progresso pedagógico
DROP POLICY IF EXISTS "discipulado_progresso_select" ON public.discipulado_progresso_licoes;
CREATE POLICY "discipulado_progresso_select" ON public.discipulado_progresso_licoes
  FOR SELECT TO authenticated USING (
    public.discipulado_has_global_write(ministry_id)
    OR EXISTS (
      SELECT 1 FROM public.discipulado_jornadas j
      WHERE j.id = discipulado_progresso_licoes.jornada_id
        AND j.ministry_id = discipulado_progresso_licoes.ministry_id
        AND (j.congregacao_id IS NULL OR public.discipulado_has_local_write(j.ministry_id, j.congregacao_id))
    )
  );

-- ------------------------------------------------------------------------------
-- 10. RPC SECURITY DEFINER BLINDADA: REGISTRO DE AULA E CHAMADA
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_aula_e_chamada_turma_rpc(
  p_turma_id UUID,
  p_licao_id UUID,
  p_professor_id UUID,
  p_data_aula DATE,
  p_status_aula VARCHAR(20),
  p_motivo_cancelamento TEXT,
  p_chamadas JSONB, -- Array: [{"jornada_id": UUID, "member_id": UUID, "status": "presente"|"ausente", "justificativa": TEXT}]
  p_validar_pedagogico_presentes BOOLEAN DEFAULT false,
  p_conteudo_ministrado TEXT DEFAULT NULL,
  p_obs TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_turma_rec RECORD;
  v_aula_id UUID;
  v_chamada JSONB;
  v_presentes_count INT := 0;
  v_validadas_count INT := 0;
  v_is_global BOOLEAN := FALSE;
  v_is_local BOOLEAN := FALSE;
  v_is_prof_autorizado BOOLEAN := FALSE;
  v_caller_is_professor BOOLEAN := FALSE;
  v_target_jornada RECORD;
BEGIN
  -- 1. Obter e autenticar operador
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Operação não autorizada. Sessão expirada ou usuário não autenticado.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Localizar turma
  SELECT * INTO v_turma_rec
  FROM public.discipulado_turmas
  WHERE id = p_turma_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turma não encontrada.' USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- 3. Validação de Autorização do Operador no Banco
  v_is_global := public.discipulado_has_global_write(v_turma_rec.ministry_id);
  IF v_turma_rec.congregacao_id IS NOT NULL THEN
    v_is_local := public.discipulado_has_local_write(v_turma_rec.ministry_id, v_turma_rec.congregacao_id);
  END IF;

  -- Checar se o professor informado é membro ativo da equipe de discipulado DESTE ministério
  SELECT EXISTS (
    SELECT 1 FROM public.discipulado_equipe
    WHERE ministry_id = v_turma_rec.ministry_id
      AND member_id = p_professor_id
      AND papel IN ('professor', 'coordenador')
      AND ativo = true
  ) INTO v_is_prof_autorizado;

  IF NOT v_is_prof_autorizado THEN
    RAISE EXCEPTION 'O professor informado não possui autorização ativa na equipe de discipulado deste ministério.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- O operador autenticado pode ser o próprio professor titular/adjunto ou ter permissão de gestão
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = p_professor_id
      AND m.ministry_id = v_turma_rec.ministry_id
      AND m.email = auth.jwt()->>'email'
  ) INTO v_caller_is_professor;

  IF NOT (v_is_global OR v_is_local OR v_caller_is_professor) THEN
    RAISE EXCEPTION 'Operador não possui permissão para gerenciar chamadas desta turma.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 4. Registrar Aula
  INSERT INTO public.discipulado_turma_aulas (
    ministry_id,
    turma_id,
    licao_id,
    professor_id,
    data_aula,
    status_aula,
    motivo_cancelamento,
    conteudo_ministrado,
    observacoes
  ) VALUES (
    v_turma_rec.ministry_id,
    p_turma_id,
    p_licao_id,
    p_professor_id,
    COALESCE(p_data_aula, CURRENT_DATE),
    COALESCE(p_status_aula, 'realizada'),
    p_motivo_cancelamento,
    p_conteudo_ministrado,
    p_obs
  ) RETURNING id INTO v_aula_id;

  -- Se aula cancelada, encerra o diário
  IF p_status_aula = 'cancelada' THEN
    RETURN jsonb_build_object(
      'sucesso', true,
      'aula_id', v_aula_id,
      'status_aula', 'cancelada',
      'presentes', 0,
      'validadas_pedagogicamente', 0,
      'mensagem', 'Aula registrada como cancelada.'
    );
  END IF;

  -- 5. Processar Chamada e Presença dos Alunos
  IF p_chamadas IS NOT NULL AND jsonb_array_length(p_chamadas) > 0 THEN
    FOR v_chamada IN SELECT * FROM jsonb_array_elements(p_chamadas)
    LOOP
      -- Validar integridade da jornada e garantir que pertence ao mesmo ministry_id da turma
      SELECT * INTO v_target_jornada
      FROM public.discipulado_jornadas
      WHERE id = (v_chamada->>'jornada_id')::UUID
        AND ministry_id = v_turma_rec.ministry_id;

      IF FOUND THEN
        INSERT INTO public.discipulado_turma_chamadas (
          ministry_id,
          aula_id,
          turma_id,
          jornada_id,
          member_id,
          status_presenca,
          justificativa
        ) VALUES (
          v_turma_rec.ministry_id,
          v_aula_id,
          p_turma_id,
          v_target_jornada.id,
          v_target_jornada.member_id,
          COALESCE(v_chamada->>'status', 'presente'),
          v_chamada->>'justificativa'
        )
        ON CONFLICT (aula_id, jornada_id) DO UPDATE
          SET status_presenca = EXCLUDED.status_presenca,
              justificativa = EXCLUDED.justificativa;

        IF COALESCE(v_chamada->>'status', 'presente') = 'presente' THEN
          v_presentes_count := v_presentes_count + 1;

          -- Validação Pedagógica Efetiva (Somente se explicitamente solicitada)
          IF p_validar_pedagogico_presentes THEN
            INSERT INTO public.discipulado_progresso_licoes (
              ministry_id,
              jornada_id,
              member_id,
              licao_id,
              aula_origem_id,
              modalidade_conclusao,
              data_validacao,
              validador_id
            ) VALUES (
              v_turma_rec.ministry_id,
              v_target_jornada.id,
              v_target_jornada.member_id,
              p_licao_id,
              v_aula_id,
              'aula_turma',
              COALESCE(p_data_aula, CURRENT_DATE),
              p_professor_id
            )
            ON CONFLICT (jornada_id, licao_id) DO NOTHING;

            v_validadas_count := v_validadas_count + 1;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'aula_id', v_aula_id,
    'status_aula', COALESCE(p_status_aula, 'realizada'),
    'presentes', v_presentes_count,
    'validadas_pedagogicamente', v_validadas_count,
    'mensagem', 'Diário de classe e frequência processados com segurança.'
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 11. RPC SECURITY DEFINER BLINDADA: VALIDAÇÃO PEDAGÓGICA INDIVIDUAL / REPOSIÇÃO
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_licao_individual_rpc(
  p_jornada_id UUID,
  p_licao_id UUID,
  p_validador_id UUID,
  p_modalidade VARCHAR(30), -- 'reposicao_individual', 'discipulado_individual', etc.
  p_data_validacao DATE,
  p_nota NUMERIC(4,2) DEFAULT NULL,
  p_obs TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_jornada_rec RECORD;
  v_progresso_id UUID;
  v_is_validador_autorizado BOOLEAN := FALSE;
  v_is_global BOOLEAN := FALSE;
  v_is_local BOOLEAN := FALSE;
  v_caller_is_validador BOOLEAN := FALSE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Operação não autorizada. Sessão expirada ou usuário não autenticado.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_jornada_rec
  FROM public.discipulado_jornadas
  WHERE id = p_jornada_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jornada de discipulado não encontrada.' USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- Checar autorização da equipe no mesmo tenant
  SELECT EXISTS (
    SELECT 1 FROM public.discipulado_equipe
    WHERE ministry_id = v_jornada_rec.ministry_id
      AND member_id = p_validador_id
      AND papel IN ('discipulador', 'professor', 'coordenador')
      AND ativo = true
  ) INTO v_is_validador_autorizado;

  IF NOT v_is_validador_autorizado THEN
    RAISE EXCEPTION 'O validador informado não possui autorização ativa na equipe de discipulado deste ministério.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_is_global := public.discipulado_has_global_write(v_jornada_rec.ministry_id);
  IF v_jornada_rec.congregacao_id IS NOT NULL THEN
    v_is_local := public.discipulado_has_local_write(v_jornada_rec.ministry_id, v_jornada_rec.congregacao_id);
  END IF;

  -- Verifica se o operador autenticado é o próprio discipulador validador
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = p_validador_id
      AND m.ministry_id = v_jornada_rec.ministry_id
      AND m.email = auth.jwt()->>'email'
  ) INTO v_caller_is_validador;

  IF NOT (v_is_global OR v_is_local OR v_caller_is_validador OR v_jornada_rec.responsavel_id = p_validador_id) THEN
    RAISE EXCEPTION 'Operador não possui permissão para validar lição nesta jornada.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Inserção com bloco de exceção estrito em PostgreSQL (terminado em END;)
  BEGIN
    INSERT INTO public.discipulado_progresso_licoes (
      ministry_id,
      jornada_id,
      member_id,
      licao_id,
      modalidade_conclusao,
      data_validacao,
      validador_id,
      aproveitamento_nota,
      observacoes_pedagogicas
    ) VALUES (
      v_jornada_rec.ministry_id,
      v_jornada_rec.id,
      v_jornada_rec.member_id,
      p_licao_id,
      COALESCE(p_modalidade, 'reposicao_individual'),
      COALESCE(p_data_validacao, CURRENT_DATE),
      p_validador_id,
      p_nota,
      p_obs
    ) RETURNING id INTO v_progresso_id;

  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Esta lição já se encontra concluída e validada para este discípulo.'
      USING ERRCODE = 'check_violation';
  END;

  RETURN jsonb_build_object(
    'sucesso', true,
    'progresso_id', v_progresso_id,
    'jornada_id', v_jornada_rec.id,
    'licao_id', p_licao_id,
    'mensagem', 'Lição validada pedagogicamente com sucesso.'
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 12. PERMISSÕES E HARDENING
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.registrar_aula_e_chamada_turma_rpc FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_aula_e_chamada_turma_rpc FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_aula_e_chamada_turma_rpc TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_aula_e_chamada_turma_rpc TO service_role;

REVOKE ALL ON FUNCTION public.validar_licao_individual_rpc FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validar_licao_individual_rpc FROM anon;
GRANT EXECUTE ON FUNCTION public.validar_licao_individual_rpc TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_licao_individual_rpc TO service_role;

COMMIT;
