-- ============================================================
-- Módulo Dizimistas
-- ============================================================
BEGIN;

-- 1. Corrigir constraint de tipo_recebimento (adicionar 'outros')
--    Executa apenas se a tabela já existir (depende da migration 20260415100000)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'tesouraria_lancamentos'
  ) THEN
    ALTER TABLE public.tesouraria_lancamentos
      DROP CONSTRAINT IF EXISTS tesouraria_tipo_valido;
    ALTER TABLE public.tesouraria_lancamentos
      ADD CONSTRAINT tesouraria_tipo_valido CHECK (
        tipo_recebimento IN ('oferta','dizimo','evento','campanha','contribuicao','outros')
      );
  END IF;
END;
$$;

-- 2. Campo is_dizimista na tabela members
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS is_dizimista BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Ministros existentes são automaticamente dizimistas
UPDATE public.members
  SET is_dizimista = TRUE
WHERE tipo_cadastro = 'ministro'
  AND is_dizimista = FALSE;

-- 4. Tabela de controle de pagamentos de dízimo por membro/mês
CREATE TABLE IF NOT EXISTS public.dizimistas_pagamentos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id    UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  member_id      UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  mes_referencia VARCHAR(7) NOT NULL,          -- formato YYYY-MM
  status         VARCHAR(10) NOT NULL DEFAULT 'pendente',
  valor          NUMERIC(12,2),
  data_pagamento DATE,
  observacao     TEXT,
  criado_por     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(ministry_id, member_id, mes_referencia),
  CONSTRAINT dizimistas_status_valido CHECK (status IN ('pago', 'pendente'))
);

CREATE INDEX IF NOT EXISTS idx_dizimistas_ministry  ON public.dizimistas_pagamentos(ministry_id);
CREATE INDEX IF NOT EXISTS idx_dizimistas_member    ON public.dizimistas_pagamentos(member_id);
CREATE INDEX IF NOT EXISTS idx_dizimistas_mes       ON public.dizimistas_pagamentos(mes_referencia);

-- 5. RLS
ALTER TABLE public.dizimistas_pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dizimistas_select" ON public.dizimistas_pagamentos;
DROP POLICY IF EXISTS "dizimistas_insert" ON public.dizimistas_pagamentos;
DROP POLICY IF EXISTS "dizimistas_update" ON public.dizimistas_pagamentos;
DROP POLICY IF EXISTS "dizimistas_delete" ON public.dizimistas_pagamentos;

CREATE POLICY "dizimistas_select"
  ON public.dizimistas_pagamentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id     = auth.uid()
        AND mu.ministry_id = dizimistas_pagamentos.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb
        )
    )
  );

CREATE POLICY "dizimistas_insert"
  ON public.dizimistas_pagamentos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id     = auth.uid()
        AND mu.ministry_id = dizimistas_pagamentos.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO_LOCAL"]'::jsonb
        )
    )
  );

CREATE POLICY "dizimistas_update"
  ON public.dizimistas_pagamentos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id     = auth.uid()
        AND mu.ministry_id = dizimistas_pagamentos.ministry_id
        AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
        )
    )
  );

CREATE POLICY "dizimistas_delete"
  ON public.dizimistas_pagamentos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id     = auth.uid()
        AND mu.ministry_id = dizimistas_pagamentos.ministry_id
        AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb
    )
  );

COMMIT;
