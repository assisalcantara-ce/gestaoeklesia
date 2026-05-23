-- =============================================================================
-- Blindagem definitiva de integridade financeira: meses fechados
-- =============================================================================
-- Bloqueia qualquer INSERT, UPDATE ou DELETE em tesouraria_lancamentos
-- quando o mês do lançamento já tiver sido encerrado em tesouraria_fechamentos.
--
-- Solução: Trigger BEFORE INSERT/UPDATE/DELETE (não apenas RLS) porque:
--   1. Triggers atuam em TODAS as camadas (client SDK, server routes, service role).
--   2. RLS policies podem ser contornadas pelo service_role — triggers não.
--   3. FINANCEIRO_LOCAL não tem SELECT em tesouraria_fechamentos via RLS, então
--      uma policy simples retornaria false para esse role → brecha de segurança.
--
-- A função usa SECURITY DEFINER para ler tesouraria_fechamentos com bypass de
-- RLS (somente leitura, sem escrita), garantindo que a verificação funcione
-- independentemente do role do usuário autenticado.
-- =============================================================================

BEGIN;

-- ─── 1. Função trigger ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_bloquear_periodo_fechado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public   -- evita search_path injection em SECURITY DEFINER
AS $$
DECLARE
  v_mes VARCHAR(7);
BEGIN
  -- ── DELETE e UPDATE: verificar o mês do registro ANTES da operação ──────────
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    v_mes := to_char(OLD.data_lancamento, 'YYYY-MM');

    IF EXISTS (
      SELECT 1
      FROM public.tesouraria_fechamentos
      WHERE ministry_id    = OLD.ministry_id
        AND mes_referencia = v_mes
        AND status         = 'fechado'
    ) THEN
      RAISE EXCEPTION 'Este período financeiro está fechado e não permite alterações.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ── INSERT e UPDATE: verificar o mês do registro NOVO ─────────────────────
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_mes := to_char(NEW.data_lancamento, 'YYYY-MM');

    IF EXISTS (
      SELECT 1
      FROM public.tesouraria_fechamentos
      WHERE ministry_id    = NEW.ministry_id
        AND mes_referencia = v_mes
        AND status         = 'fechado'
    ) THEN
      RAISE EXCEPTION 'Este período financeiro está fechado e não permite alterações.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Retornar o registro correto para cada operação
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Restringir execução direta da função (só o mecanismo de trigger a chama)
REVOKE ALL ON FUNCTION public.fn_bloquear_periodo_fechado() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_bloquear_periodo_fechado() TO postgres;
GRANT EXECUTE ON FUNCTION public.fn_bloquear_periodo_fechado() TO service_role;

-- ─── 2. Trigger em tesouraria_lancamentos ──────────────────────────────────────

DROP TRIGGER IF EXISTS trg_bloquear_periodo_fechado ON public.tesouraria_lancamentos;

CREATE TRIGGER trg_bloquear_periodo_fechado
  BEFORE INSERT OR UPDATE OR DELETE
  ON public.tesouraria_lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_bloquear_periodo_fechado();

-- ─── 3. Policy DELETE em tesouraria_fechamentos (ausente nas migrations anteriores) ──
-- Apenas ADMINISTRADOR ou o dono do ministério pode excluir um fechamento.
-- FINANCEIRO pode *reabrir* um mês via UPDATE status='aberto' (já coberto pela
-- policy de UPDATE existente), mas não pode *apagar* o registro de fechamento.

DROP POLICY IF EXISTS "fechamento_delete" ON public.tesouraria_fechamentos;

CREATE POLICY "fechamento_delete"
  ON public.tesouraria_fechamentos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id    = auth.uid()
        AND mu.ministry_id = tesouraria_fechamentos.ministry_id
        AND mu.permissions @> '["ADMINISTRADOR"]'::jsonb
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id     = tesouraria_fechamentos.ministry_id
        AND m.user_id = auth.uid()
    )
  );

COMMIT;
