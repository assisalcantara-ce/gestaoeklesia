-- ==============================================================================
-- MÓDULO CÉLULAS — LOTE 2: REUNIÕES, FREQUÊNCIA E LINKS TEMPORÁRIOS
-- Especificação: docs/GESTAO_EKLESIA_MODULO_CELULAS_ESPECIFICACAO_V1.md
-- Seções: 6 (Reuniões e Frequência) e 7 (Links Temporários)
-- ==============================================================================
-- Características da Implantação Segura:
-- 1. Transacional com lock_timeout e statement_timeout para proteção contra locks.
-- 2. Operações 100% aditivas e idempotentes (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
-- 3. RLS em todas as novas tabelas com isolamento estrito por ministry_id e congregação.
-- 4. Funções helpers SECURITY DEFINER de autorização integradas ao padrão do Lote 1:
--    - Global: Owner ou ministry_users com cargo geral (admin, secretario_geral, pastor, etc.)
--    - Local: ministry_users vinculados à congregação da célula da reunião.
-- 5. Links temporários armazenados exclusivamente por token_hash criptográfico com expiração.
-- 6. Prevenção de duplicidade de reuniões na mesma célula e data.
-- ==============================================================================

BEGIN;

-- 1. Timeouts de segurança para evitar contenção de locks em produção
SET LOCAL lock_timeout = '4s';
SET LOCAL statement_timeout = '30s';

-- ------------------------------------------------------------------------------
-- 2. Tabela de Reuniões de Células (celulas_reunioes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.celulas_reunioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  celula_id UUID NOT NULL REFERENCES public.celulas(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,

  -- Ciclo de vida e agendamento da reunião
  data_reuniao DATE NOT NULL,
  horario_inicio TIME NOT NULL DEFAULT '20:00:00',
  horario_termino TIME,
  modalidade VARCHAR(30) NOT NULL DEFAULT 'presencial' CHECK (modalidade IN ('presencial', 'online', 'hibrida')),
  status VARCHAR(30) NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada', 'em_andamento', 'finalizada', 'cancelada', 'nao_realizada')),
  motivo_cancelamento TEXT,

  -- Conteúdo do Encontro
  tema_estudo VARCHAR(255),
  estudo_id UUID, -- Referência futura a estudos bíblicos (Lote posterior)
  observacoes TEXT,

  -- Métricas Numéricas Consolidadas (Preenchimento direto ou agregado)
  presentes_membros INT NOT NULL DEFAULT 0 CHECK (presentes_membros >= 0),
  presentes_visitantes INT NOT NULL DEFAULT 0 CHECK (presentes_visitantes >= 0),
  presentes_criancas INT NOT NULL DEFAULT 0 CHECK (presentes_criancas >= 0),
  total_presentes INT GENERATED ALWAYS AS (presentes_membros + presentes_visitantes + presentes_criancas) STORED,

  -- Indicadores Espirituais Complementares
  conversoes_decisoes INT NOT NULL DEFAULT 0 CHECK (conversoes_decisoes >= 0),
  reconciliacoes INT NOT NULL DEFAULT 0 CHECK (reconciliacoes >= 0),
  testemunhos INT NOT NULL DEFAULT 0 CHECK (testemunhos >= 0),
  pedidos_oracao INT NOT NULL DEFAULT 0 CHECK (pedidos_oracao >= 0),

  -- Oferta e Recursos (quando permitido pela configuração do ministério)
  valor_oferta NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (valor_oferta >= 0),

  -- Governança de Encerramento e Auditoria
  finalizada_em TIMESTAMPTZ,
  finalizada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  editada_pos_fechamento BOOLEAN NOT NULL DEFAULT false,
  justificativa_edicao TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT uq_celulas_reunioes_celula_data UNIQUE (celula_id, data_reuniao)
);

CREATE INDEX IF NOT EXISTS idx_celulas_reunioes_ministry ON public.celulas_reunioes(ministry_id);
CREATE INDEX IF NOT EXISTS idx_celulas_reunioes_celula ON public.celulas_reunioes(celula_id);
CREATE INDEX IF NOT EXISTS idx_celulas_reunioes_congregacao ON public.celulas_reunioes(congregacao_id);
CREATE INDEX IF NOT EXISTS idx_celulas_reunioes_data ON public.celulas_reunioes(data_reuniao);
CREATE INDEX IF NOT EXISTS idx_celulas_reunioes_status ON public.celulas_reunioes(status);

-- ------------------------------------------------------------------------------
-- 3. Tabela de Frequência Individual Nominal (celulas_frequencias)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.celulas_frequencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  reuniao_id UUID NOT NULL REFERENCES public.celulas_reunioes(id) ON DELETE CASCADE,
  celula_id UUID NOT NULL REFERENCES public.celulas(id) ON DELETE CASCADE,

  -- Vínculo com Membro ou Identificação Nominal de Visitante
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  nome_participante VARCHAR(255) NOT NULL,
  tipo_participante VARCHAR(30) NOT NULL DEFAULT 'membro' CHECK (tipo_participante IN ('membro', 'congregante', 'visitante', 'crianca')),
  
  -- Presença e Justificativa
  presente BOOLEAN NOT NULL DEFAULT true,
  justificativa_ausencia TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Constraint condicional de unicidade para membros identificados por reunião
CREATE UNIQUE INDEX IF NOT EXISTS uq_celulas_frequencia_reuniao_member 
ON public.celulas_frequencias (reuniao_id, member_id) 
WHERE member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_celulas_freq_ministry ON public.celulas_frequencias(ministry_id);
CREATE INDEX IF NOT EXISTS idx_celulas_freq_reuniao ON public.celulas_frequencias(reuniao_id);
CREATE INDEX IF NOT EXISTS idx_celulas_freq_member ON public.celulas_frequencias(member_id) WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_celulas_freq_celula ON public.celulas_frequencias(celula_id);

-- ------------------------------------------------------------------------------
-- 4. Tabela de Tokens de Chamada e Relatório Rápido por Link Temporário (celulas_chamada_tokens)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.celulas_chamada_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  celula_id UUID NOT NULL REFERENCES public.celulas(id) ON DELETE CASCADE,
  reuniao_id UUID REFERENCES public.celulas_reunioes(id) ON DELETE CASCADE,
  
  -- Armazenamento seguro exclusivamente por HASH do token
  token_hash TEXT NOT NULL UNIQUE,
  tipo_acesso VARCHAR(30) NOT NULL DEFAULT 'frequencia_reuniao' CHECK (tipo_acesso IN ('frequencia_reuniao', 'relatorio_rapido')),
  
  status VARCHAR(30) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'finalizado', 'expirado', 'revogado')),
  expires_at TIMESTAMPTZ NOT NULL,
  finalizado_em TIMESTAMPTZ,
  
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT uq_celulas_tokens_celula_reuniao UNIQUE (celula_id, reuniao_id)
);

CREATE INDEX IF NOT EXISTS idx_celulas_tokens_hash ON public.celulas_chamada_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_celulas_tokens_ministry ON public.celulas_chamada_tokens(ministry_id);
CREATE INDEX IF NOT EXISTS idx_celulas_tokens_celula ON public.celulas_chamada_tokens(celula_id);

-- ------------------------------------------------------------------------------
-- 5. Habilitação de RLS e Políticas de Segurança (Lote 2)
-- ------------------------------------------------------------------------------
ALTER TABLE public.celulas_reunioes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celulas_frequencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celulas_chamada_tokens ENABLE ROW LEVEL SECURITY;

-- --- celulas_reunioes ---
DROP POLICY IF EXISTS "celulas_reunioes_select" ON public.celulas_reunioes;
CREATE POLICY "celulas_reunioes_select" ON public.celulas_reunioes
  FOR SELECT TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
    OR (
      congregacao_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.ministry_users mu
        WHERE mu.user_id = auth.uid()
          AND mu.ministry_id = public.celulas_reunioes.ministry_id
          AND mu.congregacao_id = public.celulas_reunioes.congregacao_id
          AND COALESCE(mu.is_active, true) = true
      )
    )
  );

DROP POLICY IF EXISTS "celulas_reunioes_insert" ON public.celulas_reunioes;
CREATE POLICY "celulas_reunioes_insert" ON public.celulas_reunioes
  FOR INSERT TO authenticated WITH CHECK (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );

DROP POLICY IF EXISTS "celulas_reunioes_update" ON public.celulas_reunioes;
CREATE POLICY "celulas_reunioes_update" ON public.celulas_reunioes
  FOR UPDATE TO authenticated USING (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  ) WITH CHECK (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );

DROP POLICY IF EXISTS "celulas_reunioes_delete" ON public.celulas_reunioes;
CREATE POLICY "celulas_reunioes_delete" ON public.celulas_reunioes
  FOR DELETE TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
  );

-- --- celulas_frequencias ---
DROP POLICY IF EXISTS "celulas_frequencias_select" ON public.celulas_frequencias;
CREATE POLICY "celulas_frequencias_select" ON public.celulas_frequencias
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.celulas_reunioes r
      WHERE r.id = public.celulas_frequencias.reuniao_id
        AND (
          public.celulas_has_global_write(r.ministry_id)
          OR (
            r.congregacao_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.ministry_users mu
              WHERE mu.user_id = auth.uid()
                AND mu.ministry_id = r.ministry_id
                AND mu.congregacao_id = r.congregacao_id
                AND COALESCE(mu.is_active, true) = true
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "celulas_frequencias_modify" ON public.celulas_frequencias;
CREATE POLICY "celulas_frequencias_modify" ON public.celulas_frequencias
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.celulas_reunioes r
      WHERE r.id = public.celulas_frequencias.reuniao_id
        AND public.celulas_has_local_write(r.ministry_id, r.congregacao_id)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.celulas_reunioes r
      WHERE r.id = public.celulas_frequencias.reuniao_id
        AND public.celulas_has_local_write(r.ministry_id, r.congregacao_id)
    )
  );

-- --- celulas_chamada_tokens ---
DROP POLICY IF EXISTS "celulas_chamada_tokens_select" ON public.celulas_chamada_tokens;
CREATE POLICY "celulas_chamada_tokens_select" ON public.celulas_chamada_tokens
  FOR SELECT TO authenticated USING (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );

DROP POLICY IF EXISTS "celulas_chamada_tokens_modify" ON public.celulas_chamada_tokens;
CREATE POLICY "celulas_chamada_tokens_modify" ON public.celulas_chamada_tokens
  FOR ALL TO authenticated USING (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  ) WITH CHECK (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );

COMMIT;
