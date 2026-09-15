-- ═══════════════════════════════════════════════════════════════════════════════
-- Migração: Fundação Oficial do Módulo de Comunicados e Mural de Avisos
-- Tabela: secretaria_comunicados
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.secretaria_comunicados (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id      UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id   UUID REFERENCES public.congregacoes(id) ON DELETE CASCADE,
  departamento_id  UUID REFERENCES public.departamentos(id) ON DELETE SET NULL,
  
  -- Dados do comunicado
  titulo           VARCHAR(255) NOT NULL,
  conteudo         TEXT NOT NULL,
  categoria        VARCHAR(50) NOT NULL DEFAULT 'geral', -- 'geral' | 'urgente' | 'departamento' | 'evento'
  imagem_url       TEXT,
  
  -- Publicação e Vigência
  publicado_em     TIMESTAMPTZ,
  expira_em        TIMESTAMPTZ,
  ativo            BOOLEAN NOT NULL DEFAULT true,
  
  -- Auditoria
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Constraints de Integridade de Domínio
  CONSTRAINT secretaria_comunicados_categoria_check 
    CHECK (categoria IN ('geral', 'urgente', 'departamento', 'evento'))
);

-- Índices otimizados para busca e ordenação no mural
CREATE INDEX IF NOT EXISTS idx_secretaria_comunicados_feed 
  ON public.secretaria_comunicados (ministry_id, congregacao_id, ativo, publicado_em DESC);

CREATE INDEX IF NOT EXISTS idx_secretaria_comunicados_expira 
  ON public.secretaria_comunicados (expira_em) 
  WHERE expira_em IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_secretaria_comunicados_dept 
  ON public.secretaria_comunicados (departamento_id) 
  WHERE departamento_id IS NOT NULL;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.secretaria_comunicados_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_secretaria_comunicados_updated_at ON public.secretaria_comunicados;
CREATE TRIGGER trg_secretaria_comunicados_updated_at
  BEFORE UPDATE ON public.secretaria_comunicados
  FOR EACH ROW EXECUTE FUNCTION public.secretaria_comunicados_set_updated_at();

-- Habilitação de RLS
ALTER TABLE public.secretaria_comunicados ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "secretaria_comunicados_select" ON public.secretaria_comunicados;
DROP POLICY IF EXISTS "secretaria_comunicados_insert" ON public.secretaria_comunicados;
DROP POLICY IF EXISTS "secretaria_comunicados_update" ON public.secretaria_comunicados;
DROP POLICY IF EXISTS "secretaria_comunicados_delete" ON public.secretaria_comunicados;

-- Leitura:
-- 1. Equipe administrativa do ministério (vê todos os comunicados do tenant, incluindo rascunhos e expirados)
-- 2. Membro autenticado (vê somente publicados, ativos, vigentes, do seu ministério, que sejam gerais ou da sua congregação)
CREATE POLICY "secretaria_comunicados_select" ON public.secretaria_comunicados FOR SELECT USING (
  -- A. Equipe administrativa do ministério
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
  OR
  -- B. Membro autenticado
  (
    ativo = true
    AND publicado_em IS NOT NULL
    AND publicado_em <= now()
    AND (expira_em IS NULL OR expira_em >= now())
    AND (
      -- Comunicado geral do ministério do membro
      (
        congregacao_id IS NULL
        AND ministry_id IN (
          SELECT ministry_id FROM public.members WHERE auth_user_id = auth.uid()
        )
      )
      OR
      -- Comunicado específico da congregação do membro
      (
        congregacao_id IS NOT NULL
        AND congregacao_id IN (
          SELECT congregacao_id FROM public.members WHERE auth_user_id = auth.uid()
        )
        AND ministry_id IN (
          SELECT ministry_id FROM public.members WHERE auth_user_id = auth.uid()
        )
      )
    )
  )
);

-- Escrita / Modificação: Exclusivo para administradores e gestores do ministério
CREATE POLICY "secretaria_comunicados_insert" ON public.secretaria_comunicados FOR INSERT WITH CHECK (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users
    WHERE user_id = auth.uid()
      AND (
        role IN ('admin', 'manager')
        OR permissions @> '["ADMINISTRADOR"]'::jsonb
        OR permissions @> '["GESTAO"]'::jsonb
        OR permissions @> '["SECRETARIA"]'::jsonb
      )
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
);

CREATE POLICY "secretaria_comunicados_update" ON public.secretaria_comunicados FOR UPDATE USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users
    WHERE user_id = auth.uid()
      AND (
        role IN ('admin', 'manager')
        OR permissions @> '["ADMINISTRADOR"]'::jsonb
        OR permissions @> '["GESTAO"]'::jsonb
        OR permissions @> '["SECRETARIA"]'::jsonb
      )
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
);

CREATE POLICY "secretaria_comunicados_delete" ON public.secretaria_comunicados FOR DELETE USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users
    WHERE user_id = auth.uid()
      AND (
        role IN ('admin', 'manager')
        OR permissions @> '["ADMINISTRADOR"]'::jsonb
        OR permissions @> '["GESTAO"]'::jsonb
      )
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
);

COMMIT;
