-- Garante colunas `is_active` em bases legadas (tabelas já existiam sem essas colunas).
-- Motivo: CREATE TABLE IF NOT EXISTS não altera tabela existente.

DO $$
BEGIN
  IF to_regclass('public.congregacoes') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'congregacoes'
        AND column_name = 'is_active'
    ) THEN
      ALTER TABLE public.congregacoes
        ADD COLUMN is_active boolean NOT NULL DEFAULT true;
    END IF;

    -- Índice (best-effort)
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_congregacoes_is_active ON public.congregacoes(is_active);
    EXCEPTION WHEN others THEN
      -- noop
    END;
  END IF;

  IF to_regclass('public.supervisoes') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'supervisoes'
        AND column_name = 'is_active'
    ) THEN
      ALTER TABLE public.supervisoes
        ADD COLUMN is_active boolean NOT NULL DEFAULT true;
    END IF;

    BEGIN
      CREATE INDEX IF NOT EXISTS idx_supervisoes_is_active ON public.supervisoes(is_active);
    EXCEPTION WHEN others THEN
      -- noop
    END;
  END IF;

  IF to_regclass('public.campos') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'campos'
        AND column_name = 'is_active'
    ) THEN
      ALTER TABLE public.campos
        ADD COLUMN is_active boolean NOT NULL DEFAULT true;
    END IF;

    BEGIN
      CREATE INDEX IF NOT EXISTS idx_campos_is_active ON public.campos(is_active);
    EXCEPTION WHEN others THEN
      -- noop
    END;
  END IF;
END
$$;
