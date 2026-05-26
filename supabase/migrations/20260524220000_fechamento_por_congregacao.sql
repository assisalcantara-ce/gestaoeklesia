-- FASE C — ENTREGA 2 — Fechamento Financeiro por Congregação
-- Transforma o fechamento ministerial em fechamentos individuais por congregação.
-- Registros existentes (congregacao_id IS NULL) são preservados como "Sede/Geral".

BEGIN;

-- 1. Adicionar coluna congregacao_id (NULL = Sede / registro ministerial legado)
ALTER TABLE public.tesouraria_fechamentos
  ADD COLUMN IF NOT EXISTS congregacao_id UUID
    REFERENCES public.congregacoes(id) ON DELETE SET NULL;

-- 2. Adicionar status_conselho_fiscal (preparação para módulo Conselho Fiscal futuro)
ALTER TABLE public.tesouraria_fechamentos
  ADD COLUMN IF NOT EXISTS status_conselho_fiscal VARCHAR(30) NOT NULL DEFAULT 'pendente';

ALTER TABLE public.tesouraria_fechamentos
  ADD CONSTRAINT tesouraria_fechamentos_cf_status_check
    CHECK (status_conselho_fiscal IN ('pendente','em_analise','aprovado','aprovado_com_ressalva','rejeitado'));

-- 3. Remover constraint única antiga (ministry_id, mes_referencia)
--    Registros existentes (congregacao_id IS NULL) continuam válidos como "Sede"
ALTER TABLE public.tesouraria_fechamentos
  DROP CONSTRAINT IF EXISTS tesouraria_fechamentos_ministry_id_mes_referencia_key;

-- 4. Índice único parcial: Sede (congregacao_id IS NULL)
--    PostgreSQL considera NULL != NULL no UNIQUE padrão, então dois NULLs não conflitam.
--    O índice parcial resolve isso: um por (ministry_id, mes_referencia) quando NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fechamentos_unique_sede
  ON public.tesouraria_fechamentos (ministry_id, mes_referencia)
  WHERE congregacao_id IS NULL;

-- 5. Índice único parcial: Congregação específica (congregacao_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_fechamentos_unique_cong
  ON public.tesouraria_fechamentos (ministry_id, congregacao_id, mes_referencia)
  WHERE congregacao_id IS NOT NULL;

-- 6. Índice auxiliar para consultas filtradas por congregação
CREATE INDEX IF NOT EXISTS idx_fechamentos_congregacao
  ON public.tesouraria_fechamentos (ministry_id, congregacao_id, mes_referencia);

COMMIT;
