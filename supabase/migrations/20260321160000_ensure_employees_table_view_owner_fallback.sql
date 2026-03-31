-- Garante existência/compatibilidade de public.employees
-- e da view public.employees_with_member_info, com RLS owner fallback.

CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL,
  member_id UUID NOT NULL,

  grupo VARCHAR(100) NOT NULL,
  funcao VARCHAR(100) NOT NULL,
  data_admissao DATE NOT NULL,

  email VARCHAR(255),
  telefone VARCHAR(20),
  whatsapp VARCHAR(20),
  rg VARCHAR(20),

  endereco VARCHAR(500),
  cep VARCHAR(20),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  uf VARCHAR(2),

  banco VARCHAR(50),
  agencia VARCHAR(20),
  conta_corrente VARCHAR(20),
  pix VARCHAR(255),

  obs TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'ATIVO',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS grupo VARCHAR(100),
  ADD COLUMN IF NOT EXISTS funcao VARCHAR(100),
  ADD COLUMN IF NOT EXISTS data_admissao DATE,
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS telefone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20),
  ADD COLUMN IF NOT EXISTS rg VARCHAR(20),
  ADD COLUMN IF NOT EXISTS endereco VARCHAR(500),
  ADD COLUMN IF NOT EXISTS cep VARCHAR(20),
  ADD COLUMN IF NOT EXISTS bairro VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cidade VARCHAR(100),
  ADD COLUMN IF NOT EXISTS uf VARCHAR(2),
  ADD COLUMN IF NOT EXISTS banco VARCHAR(50),
  ADD COLUMN IF NOT EXISTS agencia VARCHAR(20),
  ADD COLUMN IF NOT EXISTS conta_corrente VARCHAR(20),
  ADD COLUMN IF NOT EXISTS pix VARCHAR(255),
  ADD COLUMN IF NOT EXISTS obs TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ATIVO',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF to_regclass('public.ministries') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.employees'::regclass
        AND conname = 'employees_ministry_id_fkey'
    ) THEN
      ALTER TABLE public.employees
        ADD CONSTRAINT employees_ministry_id_fkey
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
      WHERE conrelid = 'public.employees'::regclass
        AND conname = 'employees_member_id_fkey'
    ) THEN
      ALTER TABLE public.employees
        ADD CONSTRAINT employees_member_id_fkey
        FOREIGN KEY (member_id)
        REFERENCES public.members(id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.employees'::regclass
      AND conname = 'employees_valid_status_check'
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_valid_status_check
      CHECK (status IN ('ATIVO', 'INATIVO'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_employees_ministry_id ON public.employees(ministry_id);
CREATE INDEX IF NOT EXISTS idx_employees_member_id ON public.employees(member_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_grupo ON public.employees(grupo);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees_select" ON public.employees;
DROP POLICY IF EXISTS "employees_insert" ON public.employees;
DROP POLICY IF EXISTS "employees_update" ON public.employees;
DROP POLICY IF EXISTS "employees_delete" ON public.employees;

CREATE POLICY "employees_select"
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.employees.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.employees.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "employees_insert"
  ON public.employees
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.employees.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.employees.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "employees_update"
  ON public.employees
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.employees.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.employees.ministry_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.employees.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.employees.ministry_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "employees_delete"
  ON public.employees
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.employees.ministry_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ministries m
      WHERE m.id = public.employees.ministry_id
        AND m.user_id = auth.uid()
    )
  );

DO $$
BEGIN
  IF to_regclass('public.members') IS NOT NULL THEN
    EXECUTE '
      CREATE OR REPLACE VIEW public.employees_with_member_info AS
      SELECT
        e.id,
        e.ministry_id,
        e.member_id,
        e.grupo,
        e.funcao,
        e.data_admissao,
        e.email,
        e.telefone,
        e.whatsapp,
        e.rg,
        e.endereco,
        e.cep,
        e.bairro,
        e.cidade,
        e.uf,
        e.banco,
        e.agencia,
        e.conta_corrente,
        e.pix,
        e.obs,
        e.status,
        e.created_at,
        e.updated_at,
        m.name as member_name,
        m.cpf as member_cpf,
        m.phone as member_phone,
        m.birth_date as member_birth_date
      FROM public.employees e
      LEFT JOIN public.members m ON e.member_id = m.id
    ';
  ELSE
    EXECUTE '
      CREATE OR REPLACE VIEW public.employees_with_member_info AS
      SELECT
        e.id,
        e.ministry_id,
        e.member_id,
        e.grupo,
        e.funcao,
        e.data_admissao,
        e.email,
        e.telefone,
        e.whatsapp,
        e.rg,
        e.endereco,
        e.cep,
        e.bairro,
        e.cidade,
        e.uf,
        e.banco,
        e.agencia,
        e.conta_corrente,
        e.pix,
        e.obs,
        e.status,
        e.created_at,
        e.updated_at,
        NULL::text as member_name,
        NULL::text as member_cpf,
        NULL::text as member_phone,
        NULL::date as member_birth_date
      FROM public.employees e
    ';
  END IF;
END $$;
