-- ==============================================================================
-- MÓDULO CÉLULAS — LOTE 3: PARTICIPANTES, VÍNCULOS E HISTÓRICO DE TRANSFERÊNCIA
-- Especificação: docs/GESTAO_EKLESIA_MODULO_CELULAS_ESPECIFICACAO_V1.md
-- Seções: 5 (Participantes e Identidade)
-- ==============================================================================
-- Características da Implantação Segura:
-- 1. Transacional com lock_timeout e statement_timeout para proteção contra locks.
-- 2. Operações 100% aditivas e idempotentes (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
-- 3. RLS em todas as novas tabelas com isolamento estrito por ministry_id e congregação.
-- 4. Funções helpers SECURITY DEFINER de autorização integradas aos lotes anteriores.
-- 5. Sem duplicidade cadastral: vínculo de membros aponta para public.members do mesmo ministério.
-- 6. Garantia de unicidade de vínculo ATIVO por membro (1 célula ativa principal por membro).
-- 7. Registro de participantes externos/visitantes regulares e histórico de transferências.
-- ==============================================================================

BEGIN;

-- 1. Timeouts de segurança para evitar contenção de locks em produção
SET LOCAL lock_timeout = '4s';
SET LOCAL statement_timeout = '30s';

-- ------------------------------------------------------------------------------
-- 2. Tabela de Vínculo de Participantes da Célula (celulas_participantes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.celulas_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  celula_id UUID NOT NULL REFERENCES public.celulas(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,

  -- Vínculo com cadastro de membro existente ou identificação externa
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  nome_completo VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telefone VARCHAR(30),

  -- Papel / Categoria de participação
  papel VARCHAR(30) NOT NULL DEFAULT 'membro' CHECK (papel IN ('lider', 'vice_lider', 'anfitriao', 'lider_em_treinamento', 'membro', 'congregante', 'visitante_regular', 'crianca')),
  
  -- Situação do vínculo
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

-- ------------------------------------------------------------------------------
-- 3. Tabela de Histórico de Transferências de Célula (celulas_transferencias)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 4. Habilitação de RLS e Políticas de Segurança (Lote 3)
-- ------------------------------------------------------------------------------
ALTER TABLE public.celulas_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celulas_transferencias ENABLE ROW LEVEL SECURITY;

-- --- celulas_participantes ---
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

-- --- celulas_transferencias ---
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

COMMIT;
