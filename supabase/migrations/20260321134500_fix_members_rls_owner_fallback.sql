-- Corrige RLS de members para permitir acesso por:
-- 1) vínculo em ministry_users
-- 2) owner do ministério (ministries.user_id = auth.uid())
--
-- Também preserva filtro restritivo por role sem bloquear owner.

CREATE TABLE IF NOT EXISTS public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  cpf VARCHAR(20),
  birth_date DATE,
  gender VARCHAR(20),
  marital_status VARCHAR(50),
  occupation VARCHAR(255),
  address VARCHAR(500),
  complement VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2),
  zipcode VARCHAR(20),
  member_since DATE DEFAULT CURRENT_DATE,
  role VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  custom_fields JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  congregacao_id UUID,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'deceased', 'transferred'))
);

DO $$
BEGIN
  IF to_regclass('public.ministries') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.members'::regclass
        AND conname = 'members_ministry_id_fkey'
    ) THEN
      ALTER TABLE public.members
        ADD CONSTRAINT members_ministry_id_fkey
        FOREIGN KEY (ministry_id)
        REFERENCES public.ministries(id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_ministry_cpf_unique ON public.members(ministry_id, cpf);
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_ministry_email_unique ON public.members(ministry_id, email);

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.members ENABLE ROW LEVEL SECURITY';

  -- Compatibilidade de schema para bases antigas
  EXECUTE 'ALTER TABLE public.members ADD COLUMN IF NOT EXISTS congregacao_id uuid';
  EXECUTE 'ALTER TABLE public.members ADD COLUMN IF NOT EXISTS latitude double precision';
  EXECUTE 'ALTER TABLE public.members ADD COLUMN IF NOT EXISTS longitude double precision';

  -- FK best-effort para congregacao_id
  IF to_regclass('public.congregacoes') IS NOT NULL THEN
    BEGIN
      EXECUTE '
        ALTER TABLE public.members
        ADD CONSTRAINT members_congregacao_id_fkey
        FOREIGN KEY (congregacao_id) REFERENCES public.congregacoes(id) ON DELETE SET NULL
      ';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    WHEN others THEN
      NULL;
    END;
  END IF;

  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_members_ministry_id ON public.members(ministry_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_members_congregacao_id ON public.members(congregacao_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_members_latitude_longitude ON public.members(latitude, longitude)';

  -- Policies antigas
  EXECUTE 'DROP POLICY IF EXISTS "Membros isolados por ministry" ON public.members';
  EXECUTE 'DROP POLICY IF EXISTS "Membros podem ser inseridos no seu ministry" ON public.members';
  EXECUTE 'DROP POLICY IF EXISTS "Membros podem ser atualizados no seu ministry" ON public.members';
  EXECUTE 'DROP POLICY IF EXISTS "Membros podem ser deletados no seu ministry" ON public.members';
  EXECUTE 'DROP POLICY IF EXISTS "members_filtered_by_role" ON public.members';
  EXECUTE 'DROP POLICY IF EXISTS "members_select" ON public.members';
  EXECUTE 'DROP POLICY IF EXISTS "members_insert" ON public.members';
  EXECUTE 'DROP POLICY IF EXISTS "members_update" ON public.members';
  EXECUTE 'DROP POLICY IF EXISTS "members_delete" ON public.members';

  -- CRUD base por ministério (membro vinculado ou owner)
  EXECUTE '
    CREATE POLICY "members_select"
      ON public.members
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.ministry_users mu
          WHERE mu.user_id = auth.uid()
            AND mu.ministry_id = public.members.ministry_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.ministries m
          WHERE m.id = public.members.ministry_id
            AND m.user_id = auth.uid()
        )
      )
  ';

  EXECUTE '
    CREATE POLICY "members_insert"
      ON public.members
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.ministry_users mu
          WHERE mu.user_id = auth.uid()
            AND mu.ministry_id = public.members.ministry_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.ministries m
          WHERE m.id = public.members.ministry_id
            AND m.user_id = auth.uid()
        )
      )
  ';

  EXECUTE '
    CREATE POLICY "members_update"
      ON public.members
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.ministry_users mu
          WHERE mu.user_id = auth.uid()
            AND mu.ministry_id = public.members.ministry_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.ministries m
          WHERE m.id = public.members.ministry_id
            AND m.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.ministry_users mu
          WHERE mu.user_id = auth.uid()
            AND mu.ministry_id = public.members.ministry_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.ministries m
          WHERE m.id = public.members.ministry_id
            AND m.user_id = auth.uid()
        )
      )
  ';

  EXECUTE '
    CREATE POLICY "members_delete"
      ON public.members
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.ministry_users mu
          WHERE mu.user_id = auth.uid()
            AND mu.ministry_id = public.members.ministry_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.ministries m
          WHERE m.id = public.members.ministry_id
            AND m.user_id = auth.uid()
        )
      )
  ';

  -- Filtro restritivo por role para SELECT, com bypass de owner
  -- Se congregacoes não existir ainda, cai para regra sem join em congregacoes.
  IF to_regclass('public.congregacoes') IS NOT NULL THEN
    EXECUTE '
      CREATE POLICY "members_filtered_by_role"
        ON public.members
        AS RESTRICTIVE
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.ministries m
            WHERE m.id = public.members.ministry_id
              AND m.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.ministry_users mu
            WHERE mu.user_id = auth.uid()
              AND mu.ministry_id = public.members.ministry_id
              AND (
                mu.role IN (''admin'', ''manager'', ''viewer'')
                OR (
                  mu.role = ''supervisor''
                  AND public.members.congregacao_id IS NOT NULL
                  AND EXISTS (
                    SELECT 1
                    FROM public.congregacoes c
                    WHERE c.id = public.members.congregacao_id
                      AND c.ministry_id = public.members.ministry_id
                      AND c.supervisao_id = mu.supervisao_id
                  )
                )
                OR (
                  mu.role = ''operator''
                  AND mu.congregacao_id = public.members.congregacao_id
                )
              )
          )
        )
    ';
  ELSE
    EXECUTE '
      CREATE POLICY "members_filtered_by_role"
        ON public.members
        AS RESTRICTIVE
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.ministries m
            WHERE m.id = public.members.ministry_id
              AND m.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.ministry_users mu
            WHERE mu.user_id = auth.uid()
              AND mu.ministry_id = public.members.ministry_id
              AND mu.role IN (''admin'', ''manager'', ''viewer'', ''supervisor'', ''operator'')
          )
        )
    ';
  END IF;
END
$$;