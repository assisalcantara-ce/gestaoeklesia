-- Corrige RLS de supervisoes para permitir acesso por:
-- 1) vínculo em ministry_users
-- 2) owner do ministério (ministries.user_id = auth.uid())
--
-- Alinha com o padrão já aplicado em campos/congregacoes/configurations.

CREATE TABLE IF NOT EXISTS public.supervisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL,
  codigo INTEGER,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  cidade VARCHAR(100),
  endereco TEXT,
  uf VARCHAR(2),
  supervisor_member_id UUID,
  supervisor_matricula VARCHAR(50),
  supervisor_nome VARCHAR(255),
  supervisor_cpf VARCHAR(20),
  supervisor_data_nascimento DATE,
  supervisor_cargo VARCHAR(100),
  supervisor_celular VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF to_regclass('public.ministries') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.supervisoes'::regclass
        AND conname = 'supervisoes_ministry_id_fkey'
    ) THEN
      ALTER TABLE public.supervisoes
        ADD CONSTRAINT supervisoes_ministry_id_fkey
        FOREIGN KEY (ministry_id)
        REFERENCES public.ministries(id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.members') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.supervisoes'::regclass
        AND conname = 'supervisoes_supervisor_member_id_fkey'
    ) THEN
      ALTER TABLE public.supervisoes
        ADD CONSTRAINT supervisoes_supervisor_member_id_fkey
        FOREIGN KEY (supervisor_member_id)
        REFERENCES public.members(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_supervisoes_ministry_id ON public.supervisoes(ministry_id);
CREATE INDEX IF NOT EXISTS idx_supervisoes_is_active ON public.supervisoes(is_active);
CREATE INDEX IF NOT EXISTS idx_supervisoes_supervisor_member_id ON public.supervisoes(supervisor_member_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_supervisoes_ministry_nome_unique ON public.supervisoes(ministry_id, nome);
CREATE UNIQUE INDEX IF NOT EXISTS idx_supervisoes_ministry_codigo_unique
  ON public.supervisoes(ministry_id, codigo)
  WHERE codigo IS NOT NULL;

ALTER TABLE public.supervisoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supervisoes_ministry_access" ON public.supervisoes;
DROP POLICY IF EXISTS "supervisoes_admin_all" ON public.supervisoes;
DROP POLICY IF EXISTS "supervisoes_select" ON public.supervisoes;
DROP POLICY IF EXISTS "supervisoes_insert" ON public.supervisoes;
DROP POLICY IF EXISTS "supervisoes_update" ON public.supervisoes;
DROP POLICY IF EXISTS "supervisoes_delete" ON public.supervisoes;

CREATE POLICY "supervisoes_select"
  ON public.supervisoes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.supervisoes.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.supervisoes.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "supervisoes_insert"
  ON public.supervisoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.supervisoes.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.supervisoes.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "supervisoes_update"
  ON public.supervisoes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.supervisoes.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.supervisoes.ministry_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.supervisoes.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.supervisoes.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "supervisoes_delete"
  ON public.supervisoes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.supervisoes.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.supervisoes.ministry_id
        AND m.user_id = auth.uid()
    )
  );
