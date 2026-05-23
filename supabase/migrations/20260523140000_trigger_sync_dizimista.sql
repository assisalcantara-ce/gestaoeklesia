-- =============================================================================
-- Fase 1 — Fundação Financeira: Sincronização automática de dízimos
-- =============================================================================
-- Trigger AFTER INSERT OR UPDATE em tesouraria_lancamentos:
--   Quando tipo_movimento='entrada', tipo_recebimento='dizimo', member_id NOT NULL
--   → faz UPSERT em dizimistas_pagamentos para o mês de referência.
--
-- Trigger AFTER DELETE em tesouraria_lancamentos:
--   Quando o lançamento excluído era um dízimo de membro cadastrado
--   → reverte o status para 'pendente' em dizimistas_pagamentos.
--
-- ATENÇÃO: A lógica de upsert no código TypeScript (tesouraria/page.tsx) continua
-- funcionando — o trigger no banco é uma camada adicional de garantia que não
-- entra em conflito (ON CONFLICT DO UPDATE é idempotente).
-- =============================================================================

BEGIN;

-- ─── 1. Função: sincronizar dízimo ao lançar ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_sync_dizimista()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes     VARCHAR(7);
  v_old_mes VARCHAR(7);
BEGIN
  v_mes := to_char(NEW.data_lancamento, 'YYYY-MM');

  -- ─ UPDATE: reverter mês/membro anterior quando mudou ─────────────────────
  -- Cenários cobertos:
  --   • data_lancamento muda para outro mês
  --   • member_id muda para outro membro
  --   • lançamento deixa de ser dízimo (tipo alterado)
  -- Em todos os casos, o registro antigo de dizimistas_pagamentos deve voltar
  -- para 'pendente' (se não houver outro lançamento de dízimo cobrindo aquele mês).
  IF TG_OP = 'UPDATE' THEN
    v_old_mes := to_char(OLD.data_lancamento, 'YYYY-MM');

    IF OLD.tipo_movimento   = 'entrada'
       AND OLD.tipo_recebimento = 'dizimo'
       AND OLD.member_id IS NOT NULL
       AND (
         v_old_mes        <> v_mes              -- mudou de mês
         OR OLD.member_id <> NEW.member_id       -- mudou de membro
         OR NEW.tipo_recebimento <> 'dizimo'     -- deixou de ser dízimo
         OR NEW.tipo_movimento   <> 'entrada'    -- deixou de ser entrada
         OR NEW.member_id IS NULL                -- perdeu vínculo de membro
       )
    THEN
      -- Só reverte se não há OUTRO lançamento de dízimo para aquele mês+membro
      -- (OLD.id já tem os dados novos após UPDATE, por isso a exclusão por id ainda é necessária
      --  pois o mesmo id agora aponta para o novo mês)
      IF NOT EXISTS (
        SELECT 1 FROM public.tesouraria_lancamentos tl
        WHERE tl.ministry_id       = OLD.ministry_id
          AND tl.member_id         = OLD.member_id
          AND tl.tipo_recebimento  = 'dizimo'
          AND tl.tipo_movimento    = 'entrada'
          AND to_char(tl.data_lancamento, 'YYYY-MM') = v_old_mes
          AND tl.id               <> OLD.id
      ) THEN
        UPDATE public.dizimistas_pagamentos
        SET    status     = 'pendente',
               updated_at = now()
        WHERE  ministry_id    = OLD.ministry_id
          AND  member_id      = OLD.member_id
          AND  mes_referencia = v_old_mes;
      END IF;
    END IF;
  END IF;

  -- ─ INSERT / UPDATE: sincronizar novo estado ───────────────────────────────
  IF NEW.tipo_movimento    = 'entrada'
     AND NEW.tipo_recebimento = 'dizimo'
     AND NEW.member_id IS NOT NULL
  THEN
    INSERT INTO public.dizimistas_pagamentos
      (ministry_id, member_id, mes_referencia, status, valor, data_pagamento)
    VALUES
      (NEW.ministry_id, NEW.member_id, v_mes, 'pago', NEW.valor, NEW.data_lancamento)
    ON CONFLICT (ministry_id, member_id, mes_referencia)
    DO UPDATE SET
      status         = 'pago',
      valor          = EXCLUDED.valor,
      data_pagamento = EXCLUDED.data_pagamento,
      updated_at     = now();
  END IF;

  RETURN NEW;
END;
$$;

-- ─── 2. Função: reverter dízimo ao excluir lançamento ────────────────────────

CREATE OR REPLACE FUNCTION public.fn_unsync_dizimista()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes VARCHAR(7);
BEGIN
  IF OLD.tipo_movimento = 'entrada'
     AND OLD.tipo_recebimento = 'dizimo'
     AND OLD.member_id IS NOT NULL
  THEN
    v_mes := to_char(OLD.data_lancamento, 'YYYY-MM');

    -- Reabrir o dízimo somente se não houver outro lançamento de dízimo
    -- do mesmo membro/mês (caso raro mas possível: dois lançamentos de dízimo para o mesmo mês)
    IF NOT EXISTS (
      SELECT 1 FROM public.tesouraria_lancamentos tl
      WHERE tl.ministry_id     = OLD.ministry_id
        AND tl.member_id       = OLD.member_id
        AND tl.tipo_recebimento = 'dizimo'
        AND tl.tipo_movimento  = 'entrada'
        AND to_char(tl.data_lancamento, 'YYYY-MM') = v_mes
        AND tl.id <> OLD.id  -- excluir o próprio registro sendo deletado
    ) THEN
      UPDATE public.dizimistas_pagamentos
      SET status     = 'pendente',
          updated_at = now()
      WHERE ministry_id    = OLD.ministry_id
        AND member_id      = OLD.member_id
        AND mes_referencia = v_mes;
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

-- ─── 3. Triggers ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_sync_dizimista   ON public.tesouraria_lancamentos;
DROP TRIGGER IF EXISTS trg_unsync_dizimista ON public.tesouraria_lancamentos;

CREATE TRIGGER trg_sync_dizimista
  AFTER INSERT OR UPDATE ON public.tesouraria_lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_dizimista();

CREATE TRIGGER trg_unsync_dizimista
  AFTER DELETE ON public.tesouraria_lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_unsync_dizimista();

COMMIT;
