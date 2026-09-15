-- =====================================================================
-- FASE E.2.1 — Fundação do Schema Financeiro Mobile
-- Adiciona vínculo seguro entre fin_payment_charges e o membro autenticado
-- Idempotente: pode ser reaplicada com segurança
-- =====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1. Adicionar coluna member_id com FK para members(id)
-- ON DELETE SET NULL: se o cadastro do membro for excluído, o registro
-- financeiro da cobrança é preservado para integridade contábil e auditoria.
-- --------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fin_payment_charges'
      AND column_name = 'member_id'
  ) THEN
    ALTER TABLE public.fin_payment_charges
      ADD COLUMN member_id UUID REFERENCES public.members(id) ON DELETE SET NULL;
  END IF;
END $$;

-- --------------------------------------------------------------------
-- 2. Índice composto parcial para consultas de cobranças por membro
-- Otimiza consultas do tipo: WHERE ministry_id = ? AND member_id = ?
-- Apenas indexa registros vinculados a membros (economiza storage).
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_fpc_ministry_member
  ON public.fin_payment_charges(ministry_id, member_id)
  WHERE member_id IS NOT NULL;

-- --------------------------------------------------------------------
-- 3. RLS: Membro autenticado consulta APENAS suas próprias cobranças
-- Multi-tenant rigoroso:
-- O membro só lê se:
--   - fin_payment_charges.member_id corresponde ao member_id associado ao auth.uid()
--   - E o ministry_id da cobrança coincide com o ministry_id do membro
-- Política PERMISSIVE -> somada (OR) às políticas administrativas existentes.
-- NÃO há políticas de INSERT/UPDATE/DELETE para membros (operações diretas bloqueadas).
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "fpc_member_self_read" ON public.fin_payment_charges;
CREATE POLICY "fpc_member_self_read" ON public.fin_payment_charges
  FOR SELECT
  TO authenticated
  USING (
    member_id IS NOT NULL
    AND member_id IN (
      SELECT m.id FROM public.members m
      WHERE m.auth_user_id = auth.uid()
        AND m.ministry_id = fin_payment_charges.ministry_id
    )
  );

COMMIT;
