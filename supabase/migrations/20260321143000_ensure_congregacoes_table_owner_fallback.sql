-- Garante existência/compatibilidade da tabela public.congregacoes
-- e políticas RLS com fallback para dono do ministério.

CREATE TABLE IF NOT EXISTS public.congregacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL,
  supervisao_id UUID NULL,
  campo_id UUID NULL,

  nome VARCHAR(255) NOT NULL,

  dirigente VARCHAR(255) NULL,
  dirigente_cpf VARCHAR(20) NULL,
  dirigente_cargo VARCHAR(100) NULL,
  dirigente_matricula VARCHAR(100) NULL,

  endereco TEXT NULL,
  cidade VARCHAR(100) NULL,
  uf VARCHAR(2) NULL,
  cep VARCHAR(20) NULL,

  latitude DOUBLE PRECISION NULL,
  longitude DOUBLE PRECISION NULL,

  status_imovel TEXT NULL,

  foto_url VARCHAR(500) NULL,
  foto_bucket VARCHAR(100) NULL,
  foto_path TEXT NULL,

  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF to_regclass('public.ministries') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.congregacoes'::regclass
        AND conname = 'congregacoes_ministry_id_fkey'
    ) THEN
      ALTER TABLE public.congregacoes
        ADD CONSTRAINT congregacoes_ministry_id_fkey
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
      WHERE conrelid = 'public.congregacoes'::regclass
        AND conname = 'congregacoes_supervisao_id_fkey'
    ) THEN
      ALTER TABLE public.congregacoes
        ADD CONSTRAINT congregacoes_supervisao_id_fkey
        FOREIGN KEY (supervisao_id)
        REFERENCES public.supervisoes(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.campos') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.congregacoes'::regclass
        AND conname = 'congregacoes_campo_id_fkey'
    ) THEN
      ALTER TABLE public.congregacoes
        ADD CONSTRAINT congregacoes_campo_id_fkey
        FOREIGN KEY (campo_id)
        REFERENCES public.campos(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_congregacoes_ministry_id ON public.congregacoes(ministry_id);
CREATE INDEX IF NOT EXISTS idx_congregacoes_supervisao_id ON public.congregacoes(supervisao_id);
CREATE INDEX IF NOT EXISTS idx_congregacoes_campo_id ON public.congregacoes(campo_id);
CREATE INDEX IF NOT EXISTS idx_congregacoes_is_active ON public.congregacoes(is_active);

ALTER TABLE public.congregacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "congregacoes_select" ON public.congregacoes;
DROP POLICY IF EXISTS "congregacoes_insert" ON public.congregacoes;
DROP POLICY IF EXISTS "congregacoes_update" ON public.congregacoes;
DROP POLICY IF EXISTS "congregacoes_delete" ON public.congregacoes;

CREATE POLICY "congregacoes_select"
  ON public.congregacoes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.congregacoes.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.congregacoes.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "congregacoes_insert"
  ON public.congregacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.congregacoes.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.congregacoes.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "congregacoes_update"
  ON public.congregacoes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.congregacoes.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.congregacoes.ministry_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.congregacoes.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.congregacoes.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "congregacoes_delete"
  ON public.congregacoes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.congregacoes.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.congregacoes.ministry_id
        AND m.user_id = auth.uid()
    )
  );
