-- ============================================================
-- SUPPORT MODULE HARDENING (ABR/2026)
-- Objetivo:
-- 1) Garantir schema completo de suporte (tenant + admin)
-- 2) Corrigir inconsistencias de ticket_number e mensagens
-- 3) Padronizar RLS para ministerio owner/linkado e admin suporte
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1) SUPPORT_TICKETS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ticket_number VARCHAR(20),
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  priority VARCHAR(50) NOT NULL DEFAULT 'medium',
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  sla_minutes INTEGER,
  response_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS ministry_id UUID,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS ticket_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS subject VARCHAR(255),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Garantir default de ticket_number e backfill
ALTER TABLE public.support_tickets
  ALTER COLUMN ticket_number SET DEFAULT ('TK-' || upper(substr(gen_random_uuid()::text, 1, 8)));

UPDATE public.support_tickets
SET ticket_number = 'TK-' || upper(substr(gen_random_uuid()::text, 1, 8))
WHERE ticket_number IS NULL OR btrim(ticket_number) = '';

ALTER TABLE public.support_tickets
  ALTER COLUMN ticket_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.support_tickets'::regclass
      AND conname = 'support_tickets_ticket_number_key'
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_ticket_number_key UNIQUE (ticket_number);
  END IF;
END $$;

-- Check constraints (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.support_tickets'::regclass
      AND conname = 'support_tickets_priority_check'
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_priority_check
      CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.support_tickets'::regclass
      AND conname = 'support_tickets_status_check'
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_status_check
      CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_support_tickets_ministry_id ON public.support_tickets(ministry_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON public.support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

-- Remove trigger legado potencialmente inconsistente
DROP TRIGGER IF EXISTS generate_ticket_number_trigger ON public.support_tickets;
DROP FUNCTION IF EXISTS public.generate_ticket_number();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_support_tickets_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_support_tickets_timestamp();

-- ============================================================
-- 2) SUPPORT_TICKET_MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  attachments JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.support_ticket_messages
  ADD COLUMN IF NOT EXISTS ticket_id UUID,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS attachments JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON public.support_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created_at ON public.support_ticket_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_created ON public.support_ticket_messages(ticket_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_support_ticket_messages_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS support_ticket_messages_updated_at ON public.support_ticket_messages;
CREATE TRIGGER support_ticket_messages_updated_at
  BEFORE UPDATE ON public.support_ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_support_ticket_messages_timestamp();

-- ============================================================
-- 3) SUPPORT_TICKETS_LANDING
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_tickets_landing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(20) UNIQUE NOT NULL DEFAULT ('LND-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  institution_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  whatsapp VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  priority VARCHAR(50) NOT NULL DEFAULT 'medium',
  notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.support_tickets_landing
  ADD COLUMN IF NOT EXISTS ticket_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS institution_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.support_tickets_landing
SET
  ticket_number = COALESCE(NULLIF(btrim(ticket_number), ''), 'LND-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  notes = COALESCE(notes, '[]'::jsonb)
WHERE ticket_number IS NULL OR btrim(ticket_number) = '' OR notes IS NULL;

ALTER TABLE public.support_tickets_landing
  ALTER COLUMN ticket_number SET NOT NULL,
  ALTER COLUMN notes SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.support_tickets_landing'::regclass
      AND conname = 'support_tickets_landing_ticket_number_key'
  ) THEN
    ALTER TABLE public.support_tickets_landing
      ADD CONSTRAINT support_tickets_landing_ticket_number_key UNIQUE (ticket_number);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.support_tickets_landing'::regclass
      AND conname = 'support_tickets_landing_priority_check'
  ) THEN
    ALTER TABLE public.support_tickets_landing
      ADD CONSTRAINT support_tickets_landing_priority_check
      CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.support_tickets_landing'::regclass
      AND conname = 'support_tickets_landing_status_check'
  ) THEN
    ALTER TABLE public.support_tickets_landing
      ADD CONSTRAINT support_tickets_landing_status_check
      CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed', 'em_atendimento', 'aguardando_contrato', 'contrato_finalizado', 'cancelado'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_support_tickets_landing_status ON public.support_tickets_landing(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_landing_priority ON public.support_tickets_landing(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_landing_created_at ON public.support_tickets_landing(created_at DESC);

CREATE OR REPLACE FUNCTION public.update_support_tickets_landing_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS support_tickets_landing_updated_at ON public.support_tickets_landing;
CREATE TRIGGER support_tickets_landing_updated_at
  BEFORE UPDATE ON public.support_tickets_landing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_support_tickets_landing_timestamp();

-- ============================================================
-- 4) RLS HARDENING
-- ============================================================
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets_landing ENABLE ROW LEVEL SECURITY;

-- Limpa políticas legadas
DROP POLICY IF EXISTS "tickets_admin_all" ON public.support_tickets;
DROP POLICY IF EXISTS "tickets_ministry_own" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_owner_select" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_owner_insert" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_owner_update" ON public.support_tickets;

DROP POLICY IF EXISTS "ticket_messages_admin_all" ON public.support_ticket_messages;
DROP POLICY IF EXISTS "ticket_messages_ministry_own" ON public.support_ticket_messages;
DROP POLICY IF EXISTS "support_ticket_messages_ministry_select" ON public.support_ticket_messages;
DROP POLICY IF EXISTS "support_ticket_messages_ministry_insert" ON public.support_ticket_messages;

DROP POLICY IF EXISTS "support_tickets_landing_admin_read" ON public.support_tickets_landing;
DROP POLICY IF EXISTS "support_tickets_landing_admin_update" ON public.support_tickets_landing;

-- SUPPORT_TICKETS: admin suporte (painel)
CREATE POLICY "support_tickets_admin_all"
  ON public.support_tickets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND (
          au.is_active = true
          OR au.status = 'ATIVO'
          OR au.ativo = true
        )
        AND (
          au.can_manage_support = true
          OR au.role IN ('admin', 'super_admin', 'suporte', 'support')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND (
          au.is_active = true
          OR au.status = 'ATIVO'
          OR au.ativo = true
        )
        AND (
          au.can_manage_support = true
          OR au.role IN ('admin', 'super_admin', 'suporte', 'support')
        )
    )
  );

-- SUPPORT_TICKETS: tenant (owner + users vinculados)
CREATE POLICY "support_tickets_ministry_select"
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (
    ministry_id IN (
      SELECT public.get_owned_ministry_ids()
      UNION
      SELECT public.get_linked_ministry_ids()
    )
  );

CREATE POLICY "support_tickets_ministry_insert"
  ON public.support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND ministry_id IN (
      SELECT public.get_owned_ministry_ids()
      UNION
      SELECT public.get_linked_ministry_ids()
    )
  );

CREATE POLICY "support_tickets_ministry_update"
  ON public.support_tickets
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND ministry_id IN (
      SELECT public.get_owned_ministry_ids()
      UNION
      SELECT public.get_linked_ministry_ids()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND ministry_id IN (
      SELECT public.get_owned_ministry_ids()
      UNION
      SELECT public.get_linked_ministry_ids()
    )
  );

-- SUPPORT_TICKET_MESSAGES: admin suporte
CREATE POLICY "support_ticket_messages_admin_all"
  ON public.support_ticket_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND (
          au.is_active = true
          OR au.status = 'ATIVO'
          OR au.ativo = true
        )
        AND (
          au.can_manage_support = true
          OR au.role IN ('admin', 'super_admin', 'suporte', 'support')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND (
          au.is_active = true
          OR au.status = 'ATIVO'
          OR au.ativo = true
        )
        AND (
          au.can_manage_support = true
          OR au.role IN ('admin', 'super_admin', 'suporte', 'support')
        )
    )
  );

-- SUPPORT_TICKET_MESSAGES: tenant (somente mensagens nao internas)
CREATE POLICY "support_ticket_messages_ministry_select"
  ON public.support_ticket_messages
  FOR SELECT
  TO authenticated
  USING (
    ticket_id IN (
      SELECT st.id
      FROM public.support_tickets st
      WHERE st.ministry_id IN (
        SELECT public.get_owned_ministry_ids()
        UNION
        SELECT public.get_linked_ministry_ids()
      )
    )
  );

CREATE POLICY "support_ticket_messages_ministry_insert"
  ON public.support_ticket_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_internal = false
    AND ticket_id IN (
      SELECT st.id
      FROM public.support_tickets st
      WHERE st.user_id = auth.uid()
        AND st.ministry_id IN (
          SELECT public.get_owned_ministry_ids()
          UNION
          SELECT public.get_linked_ministry_ids()
        )
    )
  );

-- LANDING: somente admin suporte
CREATE POLICY "support_tickets_landing_admin_read"
  ON public.support_tickets_landing
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND (
          au.is_active = true
          OR au.status = 'ATIVO'
          OR au.ativo = true
        )
        AND (
          au.can_manage_support = true
          OR au.role IN ('admin', 'super_admin', 'suporte', 'support')
        )
    )
  );

CREATE POLICY "support_tickets_landing_admin_update"
  ON public.support_tickets_landing
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND (
          au.is_active = true
          OR au.status = 'ATIVO'
          OR au.ativo = true
        )
        AND (
          au.can_manage_support = true
          OR au.role IN ('admin', 'super_admin', 'suporte', 'support')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND (
          au.is_active = true
          OR au.status = 'ATIVO'
          OR au.ativo = true
        )
        AND (
          au.can_manage_support = true
          OR au.role IN ('admin', 'super_admin', 'suporte', 'support')
        )
    )
  );

-- ============================================================
-- FIM
-- ============================================================
