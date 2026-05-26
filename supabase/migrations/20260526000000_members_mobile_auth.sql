-- =====================================================================
-- FASE E ENTREGA 1 — Members Mobile Auth Foundation
-- Idempotente: pode ser reaplicada sem erros
-- =====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1. FK: members.auth_user_id → auth.users(id)
-- Garante integridade referencial. ON DELETE SET NULL: conta deletada
-- não remove o membro, apenas desvincula.
-- --------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_members_auth_user'
      AND conrelid = 'public.members'::regclass
  ) THEN
    ALTER TABLE public.members
      ADD CONSTRAINT fk_members_auth_user
      FOREIGN KEY (auth_user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- --------------------------------------------------------------------
-- 2. Índice parcial: lookup rápido por auth_user_id
-- Só indexa linhas com auth_user_id preenchido (economiza espaço)
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_members_auth_user_id
  ON public.members(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- --------------------------------------------------------------------
-- 3. RLS self-read: membro autenticado lê APENAS seu próprio registro
-- Política PERMISSIVA → somada (OR) às políticas de ministry_users.
-- Não quebra acesso do staff.
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS members_self_read ON public.members;
CREATE POLICY members_self_read ON public.members
  FOR SELECT
  USING (auth_user_id = auth.uid());

-- --------------------------------------------------------------------
-- 4. RLS self-update: membro pode atualizar APENAS seu registro.
-- A restrição de quais colunas podem ser alteradas é enforced na API
-- (coluna-level restriction não existe em PostgreSQL RLS policies).
-- Política PERMISSIVA → somada às policies do staff.
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS members_self_update ON public.members;
CREATE POLICY members_self_update ON public.members
  FOR UPDATE
  USING (auth_user_id = auth.uid());

COMMIT;
