-- Módulo Tesouraria: Fechamento de Caixa Flexível com data_inicio e data_fim
BEGIN;

-- 1. Adicionar colunas data_inicio e data_fim à tabela tesouraria_fechamentos
ALTER TABLE public.tesouraria_fechamentos
  ADD COLUMN IF NOT EXISTS data_inicio DATE,
  ADD COLUMN IF NOT EXISTS data_fim DATE;

-- 2. Atualizar registros existentes com fallback do mês calendário
UPDATE public.tesouraria_fechamentos
SET
  data_inicio = COALESCE(data_inicio, (mes_referencia || '-01')::date),
  data_fim = COALESCE(data_fim, ((mes_referencia || '-01')::date + interval '1 month' - interval '1 day')::date)
WHERE data_inicio IS NULL OR data_fim IS NULL;

-- 3. Atualizar a função de trigger para bloquear edições baseando-se no intervalo de datas e na congregação correspondente
CREATE OR REPLACE FUNCTION public.fn_bloquear_periodo_fechado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public   -- evita search_path injection em SECURITY DEFINER
AS $$
DECLARE
  v_data DATE;
  v_cong_id UUID;
  v_ministry_id UUID;
BEGIN
  -- DELETE e UPDATE: verificar o registro ANTES da operação
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    v_data := OLD.data_lancamento;
    v_cong_id := OLD.congregacao_id;
    v_ministry_id := OLD.ministry_id;

    IF EXISTS (
      SELECT 1
      FROM public.tesouraria_fechamentos
      WHERE ministry_id = v_ministry_id
        AND (
          (v_cong_id IS NULL AND congregacao_id IS NULL)
          OR (v_cong_id = congregacao_id)
        )
        AND v_data >= data_inicio
        AND v_data <= data_fim
        AND status = 'fechado'
    ) THEN
      RAISE EXCEPTION 'Este período financeiro está fechado para esta congregação e não permite alterações.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- INSERT e UPDATE: verificar o novo registro
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_data := NEW.data_lancamento;
    v_cong_id := NEW.congregacao_id;
    v_ministry_id := NEW.ministry_id;

    IF EXISTS (
      SELECT 1
      FROM public.tesouraria_fechamentos
      WHERE ministry_id = v_ministry_id
        AND (
          (v_cong_id IS NULL AND congregacao_id IS NULL)
          OR (v_cong_id = congregacao_id)
        )
        AND v_data >= data_inicio
        AND v_data <= data_fim
        AND status = 'fechado'
    ) THEN
      RAISE EXCEPTION 'Este período financeiro está fechado para esta congregação e não permite alterações.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
