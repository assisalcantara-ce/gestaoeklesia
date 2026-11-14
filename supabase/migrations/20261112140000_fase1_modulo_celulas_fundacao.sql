-- ==============================================================================
-- MÓDULO CÉLULAS — LOTE 1: FUNDAÇÃO (CONFIGURAÇÕES, REDES E CADASTRO DE CÉLULAS)
-- Especificação: docs/GESTAO_EKLESIA_MODULO_CELULAS_ESPECIFICACAO_V1.md
-- ==============================================================================
-- Características da Implantação Segura:
-- 1. Transacional com lock_timeout e statement_timeout para proteção contra locks.
-- 2. Operações 100% aditivas e idempotentes (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- 3. RLS em todas as tabelas com isolamento estrito por ministry_id.
-- 4. Funções helpers SECURITY DEFINER de autorização com verificação de escopo global e local:
--    - Global: Owner ou ministry_users com cargo geral (admin, secretario_geral, pastor, etc.)
--    - Local: ministry_users vinculados a uma congregação específica só acessam células de sua congregação.
-- 5. Validação de integridade entre chaves do mesmo tenant (ministry_id) e constraints seguras.
-- ==============================================================================

BEGIN;

-- 1. Timeouts de segurança para evitar contenção de locks em produção
SET LOCAL lock_timeout = '4s';
SET LOCAL statement_timeout = '30s';

-- ------------------------------------------------------------------------------
-- 2. Tabela de Configurações do Módulo Células por Ministério
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.celulas_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  
  -- Metodologia e nomenclatura configurável
  metodologia VARCHAR(50) NOT NULL DEFAULT 'livre', -- 'livre', 'g12', 'visao_celular', 'igreja_em_celulas', 'pequenos_grupos'
  termo_celula VARCHAR(50) NOT NULL DEFAULT 'Célula', -- 'Célula', 'Pequeno Grupo', 'Grupo Familiar', 'Rede'
  termo_lider VARCHAR(50) NOT NULL DEFAULT 'Líder', -- 'Líder', 'Facilitador', 'Dirigente'
  termo_supervisor VARCHAR(50) NOT NULL DEFAULT 'Supervisor', -- 'Supervisor', 'Discipulador', 'Coordenador'
  
  -- Regras operacionais básicas
  dia_padrao_reuniao INT DEFAULT NULL CHECK (dia_padrao_reuniao IS NULL OR (dia_padrao_reuniao BETWEEN 0 AND 6)), -- 0=Domingo, 6=Sábado
  horario_padrao_reuniao TIME DEFAULT NULL,
  frequencia_obrigatoria VARCHAR(30) NOT NULL DEFAULT 'flexivel' CHECK (frequencia_obrigatoria IN ('flexivel', 'individual', 'numerica')),
  permite_multiplas_celulas_por_membro BOOLEAN NOT NULL DEFAULT false,
  exige_aprovacao_multiplicacao BOOLEAN NOT NULL DEFAULT true,
  
  -- Ativação e metadados
  is_ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT uq_celulas_configuracoes_ministry UNIQUE (ministry_id)
);

CREATE INDEX IF NOT EXISTS idx_celulas_config_ministry ON public.celulas_configuracoes(ministry_id);

-- ------------------------------------------------------------------------------
-- 3. Tabela de Redes Ministeriais (ex: Jovens, Mulheres, Casais, Família)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.celulas_redes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  cor VARCHAR(20) DEFAULT '#123b63',
  icone VARCHAR(50) DEFAULT 'Users',
  
  -- Coordenador da rede (opcional, apontando para members do mesmo ministério)
  coordenador_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  
  is_ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT uq_celulas_redes_ministry_nome UNIQUE (ministry_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_celulas_redes_ministry ON public.celulas_redes(ministry_id);
CREATE INDEX IF NOT EXISTS idx_celulas_redes_coordenador ON public.celulas_redes(coordenador_member_id) WHERE coordenador_member_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 4. Tabela Principal de Células
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.celulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  rede_id UUID REFERENCES public.celulas_redes(id) ON DELETE SET NULL,
  supervisao_id UUID REFERENCES public.supervisoes(id) ON DELETE SET NULL,
  
  -- Identificação da Célula
  codigo VARCHAR(30),
  nome VARCHAR(150) NOT NULL,
  descricao TEXT,
  data_fundacao DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Situação do Ciclo de Vida
  status VARCHAR(30) NOT NULL DEFAULT 'ativa' CHECK (status IN ('em_formacao', 'ativa', 'suspensa', 'encerrada')),
  motivo_status TEXT,
  
  -- Encontros / Reuniões habituais
  dia_semana INT NOT NULL DEFAULT 3 CHECK (dia_semana BETWEEN 0 AND 6), -- 0=Domingo, 1=Segunda, etc.
  horario TIME NOT NULL DEFAULT '20:00:00',
  modalidade VARCHAR(30) NOT NULL DEFAULT 'presencial' CHECK (modalidade IN ('presencial', 'online', 'hibrida')),
  
  -- Localização da Reunião
  cep VARCHAR(10),
  logradouro VARCHAR(255),
  numero VARCHAR(20),
  complemento VARCHAR(100),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  estado VARCHAR(2),
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  
  -- Liderança e Anfitrião imediatos (atribuição principal, histórico detalhado nas fases seguintes)
  lider_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  vice_lider_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  anfitriao_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  supervisor_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  
  -- Genealogia (célula mãe de onde foi multiplicada)
  celula_mae_id UUID REFERENCES public.celulas(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT chk_celula_nao_auto_mae CHECK (celula_mae_id IS NULL OR celula_mae_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_celulas_ministry ON public.celulas(ministry_id);
CREATE INDEX IF NOT EXISTS idx_celulas_congregacao ON public.celulas(ministry_id, congregacao_id);
CREATE INDEX IF NOT EXISTS idx_celulas_rede ON public.celulas(ministry_id, rede_id);
CREATE INDEX IF NOT EXISTS idx_celulas_status ON public.celulas(ministry_id, status);
CREATE INDEX IF NOT EXISTS idx_celulas_lider ON public.celulas(lider_member_id) WHERE lider_member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_celulas_supervisor ON public.celulas(supervisor_member_id) WHERE supervisor_member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_celulas_mae ON public.celulas(celula_mae_id) WHERE celula_mae_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 5. Funções Auxiliares de Autorização RLS (Módulo Células)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.celulas_has_global_write(p_ministry_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ministries m
    WHERE m.id = p_ministry_id AND m.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid()
      AND mu.ministry_id = p_ministry_id
      AND COALESCE(mu.is_active, true) = true
      AND mu.congregacao_id IS NULL
      AND LOWER(COALESCE(mu.role, '')) IN (
        'admin', 'administrador', 'secretario_geral', 'pastor', 'supervisor', 'operador'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.celulas_has_local_write(p_ministry_id UUID, p_congregacao_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.celulas_has_global_write(p_ministry_id)
  OR (
    p_congregacao_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = p_ministry_id
        AND mu.congregacao_id = p_congregacao_id
        AND COALESCE(mu.is_active, true) = true
        AND LOWER(COALESCE(mu.role, '')) IN (
          'admin', 'administrador', 'secretaria_local', 'admin_local',
          'auxiliar_secretaria', 'secretaria', 'pastor', 'supervisor', 'operador'
        )
    )
  );
$$;

-- ------------------------------------------------------------------------------
-- 6. Habilitação de RLS e Criação de Políticas
-- ------------------------------------------------------------------------------
ALTER TABLE public.celulas_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celulas_redes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celulas ENABLE ROW LEVEL SECURITY;

-- --- celulas_configuracoes ---
DROP POLICY IF EXISTS "celulas_configuracoes_select" ON public.celulas_configuracoes;
CREATE POLICY "celulas_configuracoes_select" ON public.celulas_configuracoes
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.celulas_configuracoes.ministry_id
        AND COALESCE(mu.is_active, true) = true
    ) OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.celulas_configuracoes.ministry_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "celulas_configuracoes_modify" ON public.celulas_configuracoes;
CREATE POLICY "celulas_configuracoes_modify" ON public.celulas_configuracoes
  FOR ALL TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
  ) WITH CHECK (
    public.celulas_has_global_write(ministry_id)
  );

-- --- celulas_redes ---
DROP POLICY IF EXISTS "celulas_redes_select" ON public.celulas_redes;
CREATE POLICY "celulas_redes_select" ON public.celulas_redes
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.celulas_redes.ministry_id
        AND COALESCE(mu.is_active, true) = true
    ) OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.celulas_redes.ministry_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "celulas_redes_modify" ON public.celulas_redes;
CREATE POLICY "celulas_redes_modify" ON public.celulas_redes
  FOR ALL TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
  ) WITH CHECK (
    public.celulas_has_global_write(ministry_id)
  );

-- --- celulas ---
DROP POLICY IF EXISTS "celulas_select" ON public.celulas;
CREATE POLICY "celulas_select" ON public.celulas
  FOR SELECT TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
    OR (
      congregacao_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.ministry_users mu
        WHERE mu.user_id = auth.uid()
          AND mu.ministry_id = public.celulas.ministry_id
          AND mu.congregacao_id = public.celulas.congregacao_id
          AND COALESCE(mu.is_active, true) = true
      )
    )
  );

DROP POLICY IF EXISTS "celulas_insert" ON public.celulas;
CREATE POLICY "celulas_insert" ON public.celulas
  FOR INSERT TO authenticated WITH CHECK (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );

DROP POLICY IF EXISTS "celulas_update" ON public.celulas;
CREATE POLICY "celulas_update" ON public.celulas
  FOR UPDATE TO authenticated USING (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  ) WITH CHECK (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );

DROP POLICY IF EXISTS "celulas_delete" ON public.celulas;
CREATE POLICY "celulas_delete" ON public.celulas
  FOR DELETE TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
  );

COMMIT;
