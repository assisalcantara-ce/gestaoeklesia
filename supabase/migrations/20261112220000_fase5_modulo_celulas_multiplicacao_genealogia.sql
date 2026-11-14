-- ==============================================================================
-- MÓDULO CÉLULAS — LOTE 5: MULTIPLICAÇÃO ASSISTIDA E GENEALOGIA
-- Especificação: docs/GESTAO_EKLESIA_MODULO_CELULAS_ESPECIFICACAO_V1.md
-- Seções: 12 (Multiplicação Assistida)
-- ==============================================================================
-- Características da Implantação Segura:
-- 1. Transacional com lock_timeout e statement_timeout para proteção contra locks.
-- 2. Operações 100% aditivas e idempotentes (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
-- 3. RLS em todas as novas tabelas com isolamento estrito por ministry_id e congregação.
-- 4. Funções helpers SECURITY DEFINER de autorização integradas aos lotes anteriores.
-- 5. Fluxo de governança: solicitada -> em_avaliacao -> aprovada -> efetivada (ou rejeitada/cancelada).
-- 6. Histórico auditável de multiplicação preservando genealogia (`celula_mae_id` -> nova célula filha).
-- ==============================================================================

BEGIN;

-- 1. Timeouts de segurança para evitar contenção de locks em produção
SET LOCAL lock_timeout = '4s';
SET LOCAL statement_timeout = '30s';

-- ------------------------------------------------------------------------------
-- 2. Tabela de Processos de Multiplicação (celulas_multiplicacoes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.celulas_multiplicacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,

  -- Célula de origem (mãe) e célula gerada (filha)
  celula_origem_id UUID NOT NULL REFERENCES public.celulas(id) ON DELETE CASCADE,
  celula_filha_id UUID REFERENCES public.celulas(id) ON DELETE SET NULL,

  -- Dados de planejamento da nova célula
  nome_nova_celula VARCHAR(150) NOT NULL,
  novo_lider_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  novo_vice_lider_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  novo_anfitriao_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  dia_reuniao INT CHECK (dia_reuniao IS NULL OR (dia_reuniao BETWEEN 0 AND 6)),
  horario_reuniao TIME,
  endereco_local TEXT,

  -- Fluxo de governança e aprovação
  status VARCHAR(30) NOT NULL DEFAULT 'solicitada' CHECK (status IN ('solicitada', 'em_avaliacao', 'aprovada', 'efetivada', 'rejeitada', 'cancelada')),
  data_planejada DATE,
  data_efetivacao TIMESTAMPTZ,
  
  -- Motivação e justificativas
  motivo_planejamento TEXT,
  justificativa_aprovacao TEXT,
  motivo_rejeicao TEXT,

  -- Auditoria e responsáveis
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

-- ------------------------------------------------------------------------------
-- 3. Tabela de Participantes Destinados à Nova Célula (celulas_multiplicacao_participantes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.celulas_multiplicacao_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  multiplicacao_id UUID NOT NULL REFERENCES public.celulas_multiplicacoes(id) ON DELETE CASCADE,
  participante_id UUID NOT NULL REFERENCES public.celulas_participantes(id) ON DELETE CASCADE,
  
  -- Papel planejado na nova célula
  papel_planejado VARCHAR(30) NOT NULL DEFAULT 'membro' CHECK (papel_planejado IN ('lider', 'vice_lider', 'anfitriao', 'lider_em_treinamento', 'membro', 'congregante', 'visitante_regular', 'crianca')),
  transferido_efetivo BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_celulas_mult_part_mult ON public.celulas_multiplicacao_participantes(multiplicacao_id);
CREATE INDEX IF NOT EXISTS idx_celulas_mult_part_part ON public.celulas_multiplicacao_participantes(participante_id);

-- ------------------------------------------------------------------------------
-- 4. Habilitação de RLS e Políticas de Segurança (Lote 5)
-- ------------------------------------------------------------------------------
ALTER TABLE public.celulas_multiplicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celulas_multiplicacao_participantes ENABLE ROW LEVEL SECURITY;

-- --- celulas_multiplicacoes ---
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

-- --- celulas_multiplicacao_participantes ---
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
  ) WITH CHECK (
    public.celulas_has_global_write(ministry_id)
  );

-- ------------------------------------------------------------------------------
-- 5. RPC Transacional de Efetivação de Multiplicação (Garantia de Atomicidade)
-- ------------------------------------------------------------------------------
-- Efetua em uma única transação atômica do banco de dados:
--  1. Validação de autorização (global write ou local write da congregação)
--  2. Lock pessimista (FOR UPDATE) da solicitação para evitar execução concorrente dupla
--  3. Validação do status 'aprovada'
--  4. Criação da nova célula-filha com genealogia íntegra (celula_mae_id)
--  5. Transferência atômica dos participantes planejados
--  6. Gravação no log auditável celulas_transferencias
--  7. Atualização atômica do status para 'efetivada' com vínculo da celula_filha_id
-- ------------------------------------------------------------------------------
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
  v_mult public.celulas_multiplicacoes%ROWTYPE;
  v_mae public.celulas%ROWTYPE;
  v_nova_celula_id UUID;
  v_part RECORD;
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
  SELECT * INTO v_mult
  FROM public.celulas_multiplicacoes
  WHERE id = p_multiplicacao_id AND ministry_id = p_ministry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo de multiplicação não encontrado.';
  END IF;

  IF v_mult.status = 'efetivada' THEN
    RAISE EXCEPTION 'Esta multiplicação já foi efetivada anteriormente.';
  END IF;

  IF v_mult.status <> 'aprovada' THEN
    RAISE EXCEPTION 'Apenas processos com status ''aprovada'' podem ser efetivados (Status atual: %)', v_mult.status;
  END IF;

  -- 3. Obter dados da célula mãe
  SELECT * INTO v_mae
  FROM public.celulas
  WHERE id = v_mult.celula_origem_id AND ministry_id = p_ministry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Célula mãe não encontrada.';
  END IF;

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
    COALESCE(v_mult.congregacao_id, v_mae.congregacao_id),
    v_mae.rede_id,
    v_mult.nome_nova_celula,
    v_mae.id, -- Genealogia preservada sem ciclos
    v_mult.novo_lider_member_id,
    v_mult.novo_vice_lider_member_id,
    v_mult.novo_anfitriao_member_id,
    COALESCE(v_mult.dia_reuniao, v_mae.dia_semana),
    COALESCE(v_mult.horario_reuniao, v_mae.horario),
    COALESCE(v_mult.endereco_local, v_mae.endereco),
    'ativa',
    CURRENT_DATE
  )
  RETURNING id INTO v_nova_celula_id;

  -- 5. Transferência atômica de participantes planejados e gravação no histórico
  FOR v_part IN
    SELECT mp.id AS planejado_id, mp.participante_id, mp.papel_planejado, cp.member_id
    FROM public.celulas_multiplicacao_participantes mp
    JOIN public.celulas_participantes cp ON cp.id = mp.participante_id
    WHERE mp.multiplicacao_id = v_mult.id AND mp.ministry_id = p_ministry_id
  LOOP
    -- Atualizar vínculo do participante para a nova célula
    UPDATE public.celulas_participantes
    SET
      celula_id = v_nova_celula_id,
      congregacao_id = COALESCE(v_mult.congregacao_id, v_mae.congregacao_id),
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
      v_mae.id,
      v_nova_celula_id,
      'Multiplicação da célula: ' || v_mult.nome_nova_celula,
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
  WHERE id = v_mult.id;

  -- 7. Retorno dos dados consolidados
  SELECT jsonb_build_object(
    'multiplicacao_id', v_mult.id,
    'nova_celula_id', v_nova_celula_id,
    'nome_nova_celula', v_mult.nome_nova_celula,
    'celula_mae_id', v_mae.id,
    'status', 'efetivada'
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMIT;
