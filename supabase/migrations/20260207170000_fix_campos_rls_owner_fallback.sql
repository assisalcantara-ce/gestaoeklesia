-- Corrige RLS/policies de public.campos para permitir acesso por:
-- 1) vínculo em ministry_users OU
-- 2) usuário dono do ministério (ministries.user_id = auth.uid())
--
-- Também garante (best-effort) que a tabela exista em bases legadas.

CREATE TABLE IF NOT EXISTS public.campos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL,

  -- Divisão 03 (Supervisão) opcional (FK adicionada condicionalmente)
  supervisao_id UUID,

  nome VARCHAR(255) NOT NULL,

  -- Campo sede da supervisão selecionada
  is_sede BOOLEAN NOT NULL DEFAULT false,

  -- Pastor do campo (opcional) (FK adicionada condicionalmente)
  pastor_member_id UUID,
  pastor_nome VARCHAR(255),
  pastor_data_posse DATE,

  -- Endereço resumido
  cep VARCHAR(20),
  municipio VARCHAR(100),
  uf VARCHAR(2),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- FKs best-effort (bases legadas podem não ter supervisoes/members ainda)
DO $$
BEGIN
  IF to_regclass('public.ministries') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.campos'::regclass
        AND conname = 'campos_ministry_id_fkey'
    ) THEN
      ALTER TABLE public.campos
        ADD CONSTRAINT campos_ministry_id_fkey
        FOREIGN KEY (ministry_id)
        REFERENCES public.ministries(id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.supervisoes') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.campos'::regclass
        AND conname = 'campos_supervisao_id_fkey'
    ) THEN
      ALTER TABLE public.campos
        ADD CONSTRAINT campos_supervisao_id_fkey
        FOREIGN KEY (supervisao_id)
        REFERENCES public.supervisoes(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.members') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.campos'::regclass
        AND conname = 'campos_pastor_member_id_fkey'
    ) THEN
      ALTER TABLE public.campos
        ADD CONSTRAINT campos_pastor_member_id_fkey
        FOREIGN KEY (pastor_member_id)
        REFERENCES public.members(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_campos_ministry_id ON public.campos(ministry_id);
CREATE INDEX IF NOT EXISTS idx_campos_supervisao_id ON public.campos(supervisao_id);
CREATE INDEX IF NOT EXISTS idx_campos_is_active ON public.campos(is_active);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_campos_nome'
  ) THEN
    -- GIN trigram index para busca por nome (requer extensão pg_trgm; em geral já vem no Supabase)
    CREATE INDEX idx_campos_nome ON public.campos USING GIN (nome gin_trgm_ops);
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- Se pg_trgm não existir, ignorar (index é apenas otimização)
    NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_campos_sede_unique_per_supervisao'
  ) THEN
    CREATE UNIQUE INDEX idx_campos_sede_unique_per_supervisao
      ON public.campos(ministry_id, supervisao_id)
      WHERE (is_sede = true AND supervisao_id IS NOT NULL);
  END IF;
END $$;

ALTER TABLE public.campos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campos_ministry_select" ON public.campos;
DROP POLICY IF EXISTS "campos_ministry_insert" ON public.campos;
DROP POLICY IF EXISTS "campos_ministry_update" ON public.campos;
DROP POLICY IF EXISTS "campos_ministry_delete" ON public.campos;

CREATE POLICY "campos_ministry_select"
  ON public.campos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.campos.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.campos.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "campos_ministry_insert"
  ON public.campos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.campos.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.campos.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "campos_ministry_update"
  ON public.campos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.campos.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.campos.ministry_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.campos.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.campos.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "campos_ministry_delete"
  ON public.campos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.campos.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.campos.ministry_id
        AND m.user_id = auth.uid()
    )
  );
