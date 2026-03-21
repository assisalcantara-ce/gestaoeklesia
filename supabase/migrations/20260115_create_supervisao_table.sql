-- ============================================
-- SUPERVISÃO/REGIONAL/ÁREA (Nomenclatura editável em Configurações)
-- ============================================

-- 1. Tabela de Supervisões
CREATE TABLE IF NOT EXISTS public.supervisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  
  -- Localização
  cidade VARCHAR(100),
  endereco TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(ministry_id, nome)
);

CREATE INDEX idx_supervisoes_ministry_id ON public.supervisoes(ministry_id);
CREATE INDEX idx_supervisoes_is_active ON public.supervisoes(is_active);

ALTER TABLE public.supervisoes ENABLE ROW LEVEL SECURITY;

-- 1.1. Tabela de Congregações (Divisão 03)
-- Observação: esta tabela é usada por outros módulos (ex: geolocalização) e pela Estrutura Hierárquica.
CREATE TABLE IF NOT EXISTS public.congregacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,

  -- Divisão 01 (opcional quando não existir)
  supervisao_id UUID REFERENCES public.supervisoes(id) ON DELETE SET NULL,

  nome VARCHAR(255) NOT NULL,

  -- Endereço resumido
  endereco TEXT,
  cidade VARCHAR(100),
  uf VARCHAR(2),
  cep VARCHAR(20),

  -- Geolocalização (opcional)
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  status TEXT GENERATED ALWAYS AS (CASE WHEN is_active THEN 'ativo' ELSE 'inativo' END) STORED,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(ministry_id, supervisao_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_congregacoes_ministry_id ON public.congregacoes(ministry_id);
CREATE INDEX IF NOT EXISTS idx_congregacoes_supervisao_id ON public.congregacoes(supervisao_id);
CREATE INDEX IF NOT EXISTS idx_congregacoes_is_active ON public.congregacoes(is_active);
CREATE INDEX IF NOT EXISTS idx_congregacoes_nome ON public.congregacoes USING GIN (nome gin_trgm_ops);

ALTER TABLE public.congregacoes ENABLE ROW LEVEL SECURITY;

-- Políticas base por ministry (mantém compatibilidade enquanto regras por role não são usadas em todas as telas)
DROP POLICY IF EXISTS "congregacoes_ministry_select" ON public.congregacoes;
CREATE POLICY "congregacoes_ministry_select"
  ON public.congregacoes FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "congregacoes_ministry_insert" ON public.congregacoes;
CREATE POLICY "congregacoes_ministry_insert"
  ON public.congregacoes FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "congregacoes_ministry_update" ON public.congregacoes;
CREATE POLICY "congregacoes_ministry_update"
  ON public.congregacoes FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "congregacoes_ministry_delete" ON public.congregacoes;
CREATE POLICY "congregacoes_ministry_delete"
  ON public.congregacoes FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

-- 2. Adicionar coluna supervisao_id na tabela congregacoes
ALTER TABLE public.congregacoes 
ADD COLUMN IF NOT EXISTS supervisao_id UUID REFERENCES public.supervisoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_congregacoes_supervisao_id ON public.congregacoes(supervisao_id);

-- 3. Relacionamento: Supervisor gerencia congregações
-- Adicionar colunas na tabela ministry_users para armazenar supervisão
ALTER TABLE public.ministry_users
ADD COLUMN IF NOT EXISTS supervisao_id UUID REFERENCES public.supervisoes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ministry_users_supervisao_id ON public.ministry_users(supervisao_id);
CREATE INDEX IF NOT EXISTS idx_ministry_users_congregacao_id ON public.ministry_users(congregacao_id);

-- 4. Atualizar constraint de role para incluir 'supervisor'
-- Nota: Como não podemos alterar CHECK constraints diretamente, vamos documentar que 'supervisor' é um role válido
-- CONSTRAINT valid_role CHECK (role IN ('admin', 'manager', 'operator', 'viewer', 'supervisor', 'superintendent', 'coordinator', 'financial'))

-- RLS Policies para supervisões
DROP POLICY IF EXISTS "supervisoes_ministry_access" ON public.supervisoes;
CREATE POLICY "supervisoes_ministry_access"
  ON public.supervisoes FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "supervisoes_admin_all" ON public.supervisoes;
CREATE POLICY "supervisoes_admin_all"
  ON public.supervisoes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.ministry_id = supervisoes.ministry_id
      AND mu.user_id = auth.uid()
      AND mu.role = 'admin'
    )
  );

-- RLS para filtrar congregacoes por supervisao do usuario
DROP POLICY IF EXISTS "congregacoes_filtered_by_role" ON public.congregacoes;
CREATE POLICY "congregacoes_filtered_by_role"
  ON public.congregacoes FOR SELECT
  USING (
    -- Admin vê tudo
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
      AND mu.role = 'admin'
    )
    OR
    -- Supervisor vê sua supervisão
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
      AND mu.role = 'supervisor'
      AND mu.supervisao_id = congregacoes.supervisao_id
    )
    OR
    -- Operador vê sua congregação
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
      AND mu.role = 'operator'
      AND mu.congregacao_id = congregacoes.id
    )
  );

-- RLS para membros respeitarem hierarquia
-- Compatibilidade: algumas bases usam public.membros; outras usam public.members.
DO $$
BEGIN
  IF to_regclass('public.membros') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.membros ADD COLUMN IF NOT EXISTS congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_membros_congregacao_id ON public.membros(congregacao_id)';
    EXECUTE 'DROP POLICY IF EXISTS "membros_filtered_by_role" ON public.membros';
    EXECUTE $$
      CREATE POLICY "membros_filtered_by_role"
        ON public.membros FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.ministry_users mu
            WHERE mu.user_id = auth.uid()
            AND mu.role = 'admin'
          )
          OR
          EXISTS (
            SELECT 1 FROM public.ministry_users mu
            INNER JOIN public.congregacoes c ON c.supervisao_id = mu.supervisao_id
            WHERE mu.user_id = auth.uid()
            AND mu.role = 'supervisor'
            AND c.id = membros.congregacao_id
          )
          OR
          EXISTS (
            SELECT 1 FROM public.ministry_users mu
            WHERE mu.user_id = auth.uid()
            AND mu.role = 'operator'
            AND mu.congregacao_id = membros.congregacao_id
          )
        )
    $$;
  ELSIF to_regclass('public.members') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.members ADD COLUMN IF NOT EXISTS congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_members_congregacao_id ON public.members(congregacao_id)';
    EXECUTE 'DROP POLICY IF EXISTS "members_filtered_by_role" ON public.members';
    EXECUTE $$
      CREATE POLICY "members_filtered_by_role"
        ON public.members FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.ministry_users mu
            WHERE mu.user_id = auth.uid()
            AND mu.role = 'admin'
          )
          OR
          EXISTS (
            SELECT 1 FROM public.ministry_users mu
            INNER JOIN public.congregacoes c ON c.supervisao_id = mu.supervisao_id
            WHERE mu.user_id = auth.uid()
            AND mu.role = 'supervisor'
            AND c.id = members.congregacao_id
          )
          OR
          EXISTS (
            SELECT 1 FROM public.ministry_users mu
            WHERE mu.user_id = auth.uid()
            AND mu.role = 'operator'
            AND mu.congregacao_id = members.congregacao_id
          )
        )
    $$;
  END IF;
END
$$;
